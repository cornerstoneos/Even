const express = require('express');
const nodeFetch = require('node-fetch');
const cors = require('cors');
const crypto = require('crypto');

// Prefer Node's built-in fetch (undici) — node-fetch v2 throws "Premature close"
// on long Anthropic responses. Fall back to node-fetch on older runtimes.
const fetch = (...args) => (globalThis.fetch ? globalThis.fetch(...args) : nodeFetch(...args));

const app = express();
app.use(cors());

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://klgofcqrncabfhskiijn.supabase.co';

function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!secret) throw new Error('Missing STRIPE_WEBHOOK_SECRET env var');
  const parts = sigHeader.split(',');
  let timestamp = null;
  const signatures = [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    if (k === 't') timestamp = v;
    if (k === 'v1') signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) throw new Error('Invalid Stripe-Signature header');
  const signed = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  if (!signatures.includes(expected)) throw new Error('Stripe signature mismatch');
  return JSON.parse(rawBody);
}

async function supabaseUpdate(table, match, payload) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); return; }
  const params = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(payload)
  });
  if (!r.ok) console.error(`Supabase PATCH ${table} error:`, await r.text());
}

async function supabaseFind(table, match, select) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); return null; }
  const params = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}&select=${select}`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const data = await r.json();
  return data?.[0] || null;
}

// Stripe webhook — must be registered BEFORE express.json() to get raw body
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = verifyStripeSignature(req.body.toString('utf8'), sig, secret);
  } catch (err) {
    console.error('Stripe webhook sig error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Stripe event:', event.type);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const customerId = session.customer;
      if (userId && userId !== 'guest') {
        await supabaseUpdate('users', { id: userId }, { is_pro: true, stripe_customer_id: customerId });
        console.log(`Pro activated: user=${userId} customer=${customerId}`);
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const row = await supabaseFind('users', { stripe_customer_id: sub.customer }, 'id');
      if (row?.id) {
        await supabaseUpdate('users', { id: row.id }, { is_pro: false });
        console.log(`Pro revoked: user=${row.id}`);
      }
    } else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const active = sub.status === 'active' || sub.status === 'trialing';
      const row = await supabaseFind('users', { stripe_customer_id: sub.customer }, 'id');
      if (row?.id) {
        await supabaseUpdate('users', { id: row.id }, { is_pro: active });
        console.log(`Sub updated: user=${row.id} is_pro=${active} status=${sub.status}`);
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '25mb' }));

// ─── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasStripeSecret: !!process.env.STRIPE_WEBHOOK_SECRET
  });
});

// ─── Anthropic proxy ──────────────────────────────────────────────────────────
app.post('/api/estimate', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set — cannot call Anthropic');
    return res.status(500).json({ error: { message: 'Server misconfigured: ANTHROPIC_API_KEY missing' } });
  }
  const wantStream = req.body && req.body.stream === true;
  const MAX_TRIES = 3;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31'
        },
        body: JSON.stringify(req.body)
      });

      // Errors always come back as a normal JSON body — read + forward it (never stream an error)
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: { message: 'HTTP ' + response.status } }));
        console.error(`Anthropic ${response.status} for model=${req.body?.model}:`, JSON.stringify(data));
        return res.status(response.status).json(data);
      }

      if (wantStream) {
        // Pipe the Anthropic SSE stream straight to the browser. Once bytes start
        // flowing we're committed — no retry mid-stream — so the retry loop only
        // guards connection setup above.
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders && res.flushHeaders();
        const reader = response.body.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
        } catch (streamErr) {
          console.error('Anthropic stream interrupted:', streamErr.message);
        }
        return res.end();
      }

      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      // Transient socket drops ("Premature close", ECONNRESET) during setup — retry with backoff
      lastErr = err;
      console.error(`Anthropic proxy fetch failed (attempt ${attempt}/${MAX_TRIES}):`, err.message);
      if (res.headersSent) return res.end();
      if (attempt < MAX_TRIES) await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  res.status(502).json({ error: { message: (lastErr && lastErr.message) || 'Upstream fetch failed after retries' } });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Even proxy running on port ${PORT}`));
