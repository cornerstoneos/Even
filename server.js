const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const crypto = require('crypto');

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

// ─── Anthropic proxy ──────────────────────────────────────────────────────────
app.post('/api/estimate', async (req, res) => {
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
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Even proxy running on port ${PORT}`));
