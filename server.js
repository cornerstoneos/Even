const express = require('express');
const nodeFetch = require('node-fetch');
const cors = require('cors');
const crypto = require('crypto');
const MARKETS = require('./data/markets.json');
const MUNICIPALITIES = require('./data/municipalities.json');

// Prefer Node's built-in fetch (undici) — node-fetch v2 throws "Premature close"
// on long Anthropic responses. Fall back to node-fetch on older runtimes.
const fetch = (...args) => (globalThis.fetch ? globalThis.fetch(...args) : nodeFetch(...args));

const app = express();
app.use(cors());

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://klgofcqrncabfhskiijn.supabase.co';

// ─── Market resolution (zip/city → nearest covered market) ───────────────────
function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Beyond this, "nearest market" stops being a meaningful proxy for local pricing.
// Without a cap, a contractor in Boise silently inherits Denver's permit fees and
// material prices and the estimate is scored as fully-grounded local data — the
// same false precision the Miami fallback used to produce, just one layer down.
const MAX_MARKET_DISTANCE_MILES = 75;

// A municipality only counts as "you are here" if it's genuinely close. Past this
// we know the county but not the city, so permits fall back to county-level rows.
const MAX_MUNICIPALITY_DISTANCE_MILES = 15;

function nearestMarket(lat, lng) {
  let best = null, bestDist = Infinity;
  for (const m of MARKETS) {
    const d = haversineMiles(lat, lng, m.lat, m.lng);
    if (d < bestDist) { bestDist = d; best = m; }
  }
  if (!best || bestDist > MAX_MARKET_DISTANCE_MILES) return null;
  return { ...best, distanceMiles: Math.round(bestDist) };
}

// Narrows a resolved market down to a specific city, so permit fees can be filtered
// to the jurisdiction that will actually issue the permit instead of every city in
// the metro. Municipalities without coordinates are name-match only (see below).
function nearestMunicipality(lat, lng, market) {
  let best = null, bestDist = Infinity;
  for (const m of MUNICIPALITIES) {
    if (m.market !== market || typeof m.lat !== 'number') continue;
    const d = haversineMiles(lat, lng, m.lat, m.lng);
    if (d < bestDist) { bestDist = d; best = m; }
  }
  return best && bestDist <= MAX_MUNICIPALITY_DISTANCE_MILES ? best : null;
}

// Free, keyless zip → lat/lng lookup (no API key to manage, no dataset to bundle/maintain)
async function zipToLatLng(zip) {
  try {
    const r = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const data = await r.json();
    const place = data?.places?.[0];
    if (!place) return null;
    return { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) };
  } catch (e) {
    console.error('zipToLatLng failed:', e.message);
    return null;
  }
}

const escapeRegex = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest whole-word match wins. Word boundaries matter: plain substring matching
// resolves "Miamisburg, OH" to Miami and "Hollywood, CA" to Hollywood FL. Returns the
// length of the string that actually matched so callers can compare specificity
// across two different lists.
function bestNameMatch(lower, list, namesOf) {
  let hit = null, len = 0;
  for (const entry of list) {
    for (const raw of namesOf(entry)) {
      if (!raw) continue;
      const c = String(raw).toLowerCase();
      if (c.length <= len) continue;
      if (new RegExp(`\\b${escapeRegex(c)}\\b`).test(lower)) { hit = entry; len = c.length; }
    }
  }
  return { hit, len };
}

// Resolves free-text location input ("City, State" or a 5-digit zip) to the nearest
// covered market, and — where we can tell — the specific municipality within it.
async function resolveMarket(locationText) {
  if (!locationText) return null;
  const text = locationText.trim();
  const lower = text.toLowerCase();

  // A zip is the most precise signal available and is checked first — a street name
  // can contain a city name ("123 Miami St, Boise ID 83702"), so trusting free text
  // over the zip would resolve that address to Florida.
  const zipMatch = text.match(/\b(\d{5})\b/);
  if (zipMatch) {
    const coords = await zipToLatLng(zipMatch[1]);
    if (coords) {
      const market = nearestMarket(coords.lat, coords.lng);
      if (!market) return null;
      const muni = nearestMunicipality(coords.lat, coords.lng, market.market);
      return muni ? { ...market, municipality: muni.name } : market;
    }
  }

  // No usable zip — fall back to name matching, longest-match-wins across BOTH lists
  // rather than municipalities-first. Municipality names are substrings of some market
  // names ("Miami" inside "Miami-Dade"), so a naive municipality-first pass would
  // narrow someone who typed the county down to a single city's fee schedule.
  // Comparing match length lets "Miami-Dade" resolve to the market while
  // "Miami Gardens" and "North Miami Beach" still beat the shorter "Miami".
  const muni = bestNameMatch(lower, MUNICIPALITIES, m => [m.name, ...(m.aliases || [])]);
  const market = bestNameMatch(lower, MARKETS, m => [m.market, m.zone]);

  if (muni.hit && muni.len >= market.len) {
    const parent = MARKETS.find(m => m.market === muni.hit.market);
    if (parent) return { ...parent, municipality: muni.hit.name, distanceMiles: 0 };
  }
  return market.hit || null;
}

async function getMarketData(market) {
  return supabaseFind('market_data', { market }, 'market,state,zone,materials,labor,permits,updated_at');
}

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

// Fire-and-forget error logging to Supabase — never throws, never blocks the caller.
async function logError(source, message, context) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/error_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ source, message: String(message).slice(0, 2000), context: context || null })
    });
  } catch (e) {
    console.error('logError failed:', e.message);
  }
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
    logError('stripe_webhook', err.message, { stage: 'signature' });
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
    logError('stripe_webhook', err.message, { stage: 'handler', eventType: event?.type });
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

// ─── Markets (for frontend autocomplete) ─────────────────────────────────────
// Municipalities are included so a contractor in Hialeah or Miami Gardens can find
// their own city in the dropdown instead of having to know it maps to "Miami-Dade".
app.get('/api/markets', (req, res) => {
  const markets = MARKETS.map(({ market, state, zone }) => ({ market, state, zone, kind: 'market' }));
  const munis = MUNICIPALITIES.map(({ name, market, state, county }) => ({
    market: name, state, zone: `${county} County · ${market}`, kind: 'municipality', parent: market
  }));
  res.json([...markets, ...munis]);
});

// Permit rows are stored per-municipality, so a fully-researched metro can carry
// hundreds of them. Sending all of them costs real tokens on every estimate and
// buries the two lines that actually apply to this job. Narrow to the jurisdiction
// that will issue the permit, plus the county baseline.
const UNKNOWN_MUNI_PERMIT_CAP = 40;

function normalizeMuni(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\b(city|town|village|county) of\b/g, '')
    .replace(/\bfl\b|\bflorida\b/g, '')
    .replace(/[^a-z\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function filterPermits(permits, municipality) {
  if (!Array.isArray(permits) || !permits.length) return { permits, scope: 'none' };

  const isCounty = r => /\bcounty\b/i.test(r.municipality || '');
  const countyRows = permits.filter(isCounty);

  if (municipality) {
    const target = normalizeMuni(municipality);
    const cityRows = permits.filter(r => !isCounty(r) && normalizeMuni(r.municipality) === target);
    if (cityRows.length) {
      return { permits: [...cityRows, ...countyRows], scope: 'municipality', municipality };
    }
    // We know exactly where they are, we just haven't researched this city's fee
    // schedule yet. County rows are the honest stand-in — flagged, not passed off
    // as this city's actual fees.
    return { permits: countyRows, scope: 'county-fallback', municipality };
  }

  if (countyRows.length) return { permits: countyRows, scope: 'county' };
  return { permits: permits.slice(0, UNKNOWN_MUNI_PERMIT_CAP), scope: 'partial' };
}

// Florida Building Code R202 defines the High Velocity Hurricane Zone as exactly
// two counties: Miami-Dade and Broward. Palm Beach is Wind-Borne Debris Region but
// NOT HVHZ, so it does not carry NOA-approved product cost. Deciding this from the
// resolved market rather than substring-matching the raw address is what keeps
// "Hollywood, CA" from being priced as hurricane zone.
const HVHZ_MARKETS = new Set(['Miami-Dade', 'Broward']);

// ─── Local market data lookup (grounds estimates in real pipeline data) ──────
app.get('/api/market-data', async (req, res) => {
  const location = req.query.location || '';
  const matched = await resolveMarket(location);
  if (!matched) return res.json({ market: null, hvhz: null });
  const hvhz = HVHZ_MARKETS.has(matched.market);
  const data = await getMarketData(matched.market);
  if (!data) return res.json({ market: matched.market, state: matched.state, zone: matched.zone, municipality: matched.municipality || null, hvhz, materials: null, labor: null, permits: null });
  const { permits, scope, municipality } = filterPermits(data.permits, matched.municipality);
  res.json({ ...data, permits, municipality: municipality || matched.municipality || null, permitScope: scope, hvhz });
});

// ─── Anthropic proxy ──────────────────────────────────────────────────────────
app.post('/api/estimate', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set — cannot call Anthropic');
    logError('anthropic_proxy', 'ANTHROPIC_API_KEY missing', null);
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
        if (response.status >= 500 || response.status === 429) logError('anthropic_proxy', `HTTP ${response.status}: ${JSON.stringify(data).slice(0, 500)}`, { model: req.body?.model });
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
          logError('anthropic_proxy', streamErr.message, { stage: 'stream', model: req.body?.model });
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
  logError('anthropic_proxy', (lastErr && lastErr.message) || 'Upstream fetch failed after retries', { stage: 'exhausted', model: req.body?.model });
  res.status(502).json({ error: { message: (lastErr && lastErr.message) || 'Upstream fetch failed after retries' } });
});

// ─── Client-side error reporting ──────────────────────────────────────────────
app.post('/api/log-error', async (req, res) => {
  const { message, stack, url, context } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });
  await logError('client', String(message).slice(0, 2000), { stack: stack ? String(stack).slice(0, 2000) : null, url, ...context });
  res.json({ ok: true });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Even proxy running on port ${PORT}`));
