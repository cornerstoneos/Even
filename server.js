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
// Only the app's own pages may call this server from a browser. The cache headers
// are read by the app (and are how a bad scope's key is found).
const ALLOWED_ORIGINS = [
  'https://even-os.com', 'https://www.even-os.com',
  ...String(process.env.EXTRA_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
];
const originAllowed = o => !!o && (ALLOWED_ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));
app.use(cors({
  origin: (o, cb) => cb(null, originAllowed(o)),
  exposedHeaders: ['X-Even-Cache', 'X-Even-Cache-Key'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Even-Cache', 'X-Even-Device']
}));
const { buildRequest, MAIN: mainModel, LIGHT: lightModel, SCOPE_FIX_TEXT } = require('./lib/guard');
const guardModels = { MAIN: mainModel, LIGHT: lightModel };
const { makeUsage, LIMITS } = require('./lib/usage');
const STARTED_AT = new Date().toISOString();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://klgofcqrncabfhskiijn.supabase.co';
// Lazily built: server.js reads env at call time so tests can set it after require.
let _usage = null;
const usage = () => _usage || (_usage = makeUsage({
  supabaseUrl: SUPABASE_URL,
  serviceKey: () => process.env.SUPABASE_SERVICE_ROLE_KEY,
  secret: () => process.env.USAGE_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'even-dev',
  fetchImpl: (...a) => fetch(...a)
}));

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
        usage().event('pro_started', { user: { id: userId } });
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
    // Which models are live right now (set on Railway: EVEN_MAIN_MODEL / EVEN_LIGHT_MODEL).
    models: { main: guardModels.MAIN(), light: guardModels.LIGHT() },
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasStripeSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    // Email setup, as yes/no only (no addresses): founder alerts need a Resend key
    // + FOUNDER_EMAIL or REPLY_TO_EMAIL; client mail needs a verified domain sender.
    email: { resendKey: !!process.env.RESEND_API_KEY, founderAddress: !!(process.env.FOUNDER_EMAIL || process.env.REPLY_TO_EMAIL),
      fromSet: !!process.env.NOTIFY_FROM_EMAIL, quoteEmailOn: process.env.QUOTE_EMAIL_ENABLED === '1', welcomeEmailOn: process.env.WELCOME_EMAIL_ENABLED === '1' },
    startedAt: STARTED_AT
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
// that will issue the permit (county rows only where the city has no fee on file).
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

// A single city row used to count as city-level grounding, so a city with 4 rows
// earned the same HIGH confidence as one with its full fee schedule on file. A city
// now has to carry the core fees (a base permit fee, and electrical / plumbing /
// mechanical / roofing — or one base fee that covers all trades) before its rows
// count as the city's schedule. Definition lives in data/permit_core_fees.json so
// the even-data checklist grades cities by exactly the same rule.
const CORE = (() => {
  const c = require('./data/permit_core_fees.json');
  const rx = s => new RegExp(s, 'i');
  return {
    exclude: rx(c.exclude), base: rx(c.base), allTrades: rx(c.all_trades),
    trades: Object.entries(c.trades).map(([name, s]) => [name, rx(s)])
  };
})();

function missingCoreFees(cityRows) {
  const rows = cityRows.filter(r => !CORE.exclude.test(r.work_type || ''));
  const bases = rows.filter(r => CORE.base.test(r.work_type || ''));
  const coversAll = bases.some(r => CORE.allTrades.test(`${r.work_type || ''} ${r.notes || ''}`));
  const missing = bases.length ? [] : ['base permit fee'];
  for (const [name, rx] of CORE.trades) {
    if (!coversAll && !rows.some(r => rx.test(r.work_type || ''))) missing.push(name);
  }
  return missing;
}

// City-first (decided 2026-10-02): a city with its own rows gets ONLY its own rows.
// The county schedule is never stacked on top of a city permit, which is how a
// Fort Lauderdale water heater used to come back with a city permit plus a
// Broward County one. County rows are used only as the labeled stand-in for a
// core fee the city schedule is missing, for a city we have not researched, and
// for unincorporated areas (Kendall, Jupiter Farms), where the county issues.
function countyRowsForMissing(countyRows, missing) {
  const tests = missing.map(m => m === 'base permit fee' ? CORE.base : (CORE.trades.find(([n]) => n === m) || [])[1]).filter(Boolean);
  return countyRows.filter(r => !CORE.exclude.test(r.work_type || '') && tests.some(rx => rx.test(r.work_type || '')));
}

function filterPermits(permits, municipality, unincorporated) {
  if (!Array.isArray(permits) || !permits.length) return { permits, scope: 'none' };

  const isCounty = r => /\bcounty\b/i.test(r.municipality || '');
  const countyRows = permits.filter(isCounty);

  if (municipality) {
    if (unincorporated) return { permits: countyRows, scope: 'unincorporated', municipality };
    const target = normalizeMuni(municipality);
    const cityRows = permits.filter(r => !isCounty(r) && normalizeMuni(r.municipality) === target);
    if (cityRows.length) {
      const missing = missingCoreFees(cityRows);
      return {
        permits: missing.length ? [...cityRows, ...countyRowsForMissing(countyRows, missing)] : cityRows,
        scope: missing.length ? 'municipality-partial' : 'municipality',
        municipality,
        missing
      };
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
// One function so the quote-link draft reads exactly what the app reads.
async function marketPayload(location) {
  const matched = await resolveMarket(location || '');
  if (!matched) return { market: null, hvhz: null };
  const hvhz = HVHZ_MARKETS.has(matched.market);
  const data = await getMarketData(matched.market);
  if (!data) return { market: matched.market, state: matched.state, zone: matched.zone, municipality: matched.municipality || null, hvhz, materials: null, labor: null, permits: null };
  const muniEntry = MUNICIPALITIES.find(m => m.name === matched.municipality && m.market === matched.market);
  const { permits, scope, municipality, missing } = filterPermits(data.permits, matched.municipality, !!muniEntry?.unincorporated);
  return { ...data, permits, municipality: municipality || matched.municipality || null, permitScope: scope, permitMissing: missing || [], hvhz };
}
app.get('/api/market-data', async (req, res) => {
  res.json(await marketPayload(req.query.location || ''));
});

// ─── Scope cache: same job in = same scope out ───────────────────────────────
// The models on this route (see lib/guard.js) do not accept a temperature setting,
// so two identical requests can still come back with different scopes. The client
// marks the scope-reading calls (questions, estimate scope) with X-Even-Cache: 1;
// an identical request body is then answered from the first result instead of a
// second roll of the dice. Prices are computed in the browser from the scope, so
// an identical scope means an identical number. In memory: a server restart (each
// deploy) starts it empty.
const SCOPE_CACHE_MAX = 500;
const SCOPE_CACHE_TTL_MS = 30 * 24 * 3600 * 1000;
const scopeCache = new Map();
// Keyed on what decides the answer (model, prompt, effort), not on transport
// details: the client's non-streaming fallback (after a stalled stream) and the
// bigger-budget retry must land on the same entry as the stream they replace.
function scopeCacheKey(body) {
  const { model, messages, output_config } = body || {};
  return crypto.createHash('sha256').update(JSON.stringify({ model, messages, output_config })).digest('hex');
}
// A request already running for the same key: a second identical request waits
// for its answer instead of rolling the dice again (a stalled phone stream whose
// fallback arrives while the first call is still finishing).
const scopeInflight = new Map();
function scopeInflightStart(key) {
  let resolve;
  const p = new Promise(r => { resolve = r; });
  scopeInflight.set(key, p);
  return text => { if (scopeInflight.get(key) === p) scopeInflight.delete(key); resolve(text || null); };
}
function scopeCacheGet(key) {
  const hit = scopeCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > SCOPE_CACHE_TTL_MS) { scopeCache.delete(key); return null; }
  scopeCache.delete(key); scopeCache.set(key, hit); // refresh LRU position
  return hit.text;
}
function scopeCacheSet(key, text) {
  if (!text) return;
  scopeCache.set(key, { text, at: Date.now() });
  while (scopeCache.size > SCOPE_CACHE_MAX) scopeCache.delete(scopeCache.keys().next().value);
}

// Second layer: Supabase table scope_cache, so a scope survives restarts and
// deploys. Holds only the key (a hash) and the scope JSON the model returned,
// never the prompt. Service role only (RLS on, no policies, anon/authenticated
// revoked). Rows expire 30 days after they were written (our default, not
// data-backed). A Load Market Batch changes the prompt, so it changes the key.
const SCOPE_DB_TTL_DAYS = 30;
const scopeDbHeaders = key => ({ 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` });
const scopeDbCutoff = () => new Date(Date.now() - SCOPE_DB_TTL_DAYS * 86400000).toISOString();
function parseScopeText(text) {
  const t = String(text || '').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(t); } catch (e) {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}
async function scopeDbGet(key) {
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sk) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/scope_cache?key=eq.${key}&created_at=gt.${encodeURIComponent(scopeDbCutoff())}&select=scope,hits`,
      { headers: scopeDbHeaders(sk), signal: AbortSignal.timeout(3000) });
    if (!r.ok) return null;
    const row = (await r.json())?.[0];
    // Stored as the model's exact text (a jsonb string). jsonb objects reorder keys,
    // and the next prompt is built from this scope, so a re-serialized object
    // would change that prompt's key and break same-in-same-out after a restart.
    if (!row) return null;
    if (typeof row.scope !== 'string') {
      // An older-format row (stored as an object): drop it so the fresh answer can be stored.
      await fetch(`${SUPABASE_URL}/rest/v1/scope_cache?key=eq.${key}`, { method: 'DELETE', headers: { ...scopeDbHeaders(sk), Prefer: 'return=minimal' } }).catch(() => {});
      return null;
    }
    // Fire-and-forget usage stats; never blocks the answer.
    fetch(`${SUPABASE_URL}/rest/v1/scope_cache?key=eq.${key}`, {
      method: 'PATCH', headers: { ...scopeDbHeaders(sk), Prefer: 'return=minimal' },
      body: JSON.stringify({ last_used_at: new Date().toISOString(), hits: (row.hits || 0) + 1 })
    }).catch(() => {});
    return row.scope;
  } catch (e) { console.error('scope_cache read failed:', e.message); return null; }
}
async function scopeDbPut(key, text) {
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sk || !parseScopeText(text)) return;   // only finished, parseable scopes
  try {
    // First answer wins: a later identical request never overwrites it.
    const r = await fetch(`${SUPABASE_URL}/rest/v1/scope_cache?on_conflict=key`, {
      method: 'POST', headers: { ...scopeDbHeaders(sk), Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ key, scope: text })
    });
    if (!r.ok) console.error('scope_cache write failed:', r.status, await r.text());
  } catch (e) { console.error('scope_cache write failed:', e.message); }
}
async function scopeDbPurgeExpired() {
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sk) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/scope_cache?created_at=lt.${encodeURIComponent(scopeDbCutoff())}`,
      { method: 'DELETE', headers: { ...scopeDbHeaders(sk), Prefer: 'return=minimal' } });
  } catch (e) { console.error('scope_cache purge failed:', e.message); }
}
setTimeout(scopeDbPurgeExpired, 10000);
setInterval(scopeDbPurgeExpired, 6 * 3600 * 1000).unref();

// Clear one bad scope: DELETE /api/scope-cache/<key> with
// "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>". The key is in the
// X-Even-Cache-Key response header and saved on the estimate as scopeKey.
app.delete('/api/scope-cache/:key', async (req, res) => {
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const auth = req.get('authorization') || '';
  const given = Buffer.from(auth.replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(sk || '');
  if (!sk || given.length !== want.length || !crypto.timingSafeEqual(given, want)) return res.status(401).json({ error: 'unauthorized' });
  const key = String(req.params.key || '');
  if (!/^[a-f0-9]{64}$/.test(key)) return res.status(400).json({ error: 'key must be a 64-char hex hash' });
  scopeCache.delete(key);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/scope_cache?key=eq.${key}`, { method: 'DELETE', headers: { ...scopeDbHeaders(sk), Prefer: 'return=representation' } });
  const rows = r.ok ? await r.json() : [];
  res.json({ ok: r.ok, deleted: rows.length, note: 'Cleared here and in Supabase. Another running server instance keeps its in-memory copy until it restarts.' });
});

// ─── Trade stats (user 2026-10-10) ───────────────────────────────────────────
// Read off the estimate's own job line ("Trade:...|Location:...\nLanguage:..."),
// so nothing extra comes from the browser. Trade is kept only if it is one of the
// app's trade options; city only if it names a known municipality (never the
// typed text, which can be a street address).
const STAT_TRADES = new Set(['General Contractor', 'Roofing', 'Electrical', 'Plumbing', 'HVAC', 'Remodeling', 'Framing', 'Painting', 'Flooring', 'Concrete', 'Siding', 'Decks', 'Landscaping', 'Pools']);
function jobStats(body) {
  try {
    const job = (body.messages[0].content || []).map(b => b && b.text || '').find(t => /^Trade:/.test(t)) || '';
    const trade = (job.match(/^Trade:([^|\n]*)/) || [])[1] || '';
    const loc = ((job.match(/\|Location:([^|\n]*)/) || [])[1] || '').toLowerCase();
    const lang = /\nLanguage:Spanish/.test(job) ? 'es' : 'en';
    const muni = loc ? bestNameMatch(loc, MUNICIPALITIES, m => [m.name, ...(m.aliases || [])]) : { hit: null };
    return { trade: STAT_TRADES.has(trade.trim()) ? trade.trim() : (trade.trim() ? 'Other' : null), city: muni.hit ? muni.hit.name : null, lang };
  } catch (e) { return {}; }
}

// ─── Anthropic proxy ──────────────────────────────────────────────────────────
app.post('/api/estimate', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set — cannot call Anthropic');
    logError('anthropic_proxy', 'ANTHROPIC_API_KEY missing', null);
    return res.status(500).json({ error: { message: 'Server misconfigured: ANTHROPIC_API_KEY missing' } });
  }
  // ── Lock: app origin only, a known request shape, rate limits, free limits ──
  const origin = req.get('origin') || '';
  if (!originAllowed(origin)) {
    logError('proxy_reject', 'origin_not_allowed', { origin: origin.slice(0, 200) });
    return res.status(403).json({ error: { code: 'origin_not_allowed', message: 'Not allowed' } });
  }
  const built = buildRequest(req.body);
  if (built.error) {
    logError('proxy_reject', built.error, { kind: String(req.body?.even_kind || '').slice(0, 40), model: String(req.body?.model || '').slice(0, 60) });
    return res.status(400).json({ error: { code: 'request_not_allowed', message: 'Request not allowed' } });
  }
  const U = usage();
  const ident = await U.identify(req);
  const tooMany = () => {
    logError('proxy_reject', 'rate_limited', { kind: built.kind });
    return res.status(429).json({ error: { code: 'rate_limited', message: 'Too many requests. Wait a minute and try again.' } });
  };
  if (!U.rateOk(ident.ipHash, 'any')) return tooMany();
  if (built.spec.pro) {
    const st = await U.status(ident);
    if (!st.isPro) return res.status(402).json({ error: { code: 'pro_required', message: 'Even Pro feature' } });
  }
  const wantStream = built.body.stream === true;
  const cacheKey = (built.kind === 'scope' || built.kind === 'estimate') ? scopeCacheKey(built.body) : null;
  let finishInflight = () => {};
  let onFresh = () => {}, release = () => {}, freshDone = false;
  if (cacheKey) {
    res.setHeader('X-Even-Cache-Key', cacheKey);
    let text = scopeCacheGet(cacheKey), layer = 'memory';
    if (!text && scopeInflight.has(cacheKey)) {
      text = await Promise.race([scopeInflight.get(cacheKey), new Promise(r => setTimeout(() => r(null), 170000))]);
      layer = 'inflight';
    }
    if (!text) {
      text = await scopeDbGet(cacheKey); layer = 'db';
      if (text) scopeCacheSet(cacheKey, text);
    }
    if (text) {
      res.setHeader('X-Even-Cache', `hit-${layer}`);
      return res.json({ content: [{ type: 'text', text }], stop_reason: 'end_turn', cached: true });
    }
    // Not cached: this is a new AI call, so the free limit applies. A cached or
    // re-opened identical job above never counts and is never blocked.
    if (!built.spec.pro) {
      const st = await U.status(ident);
      if (!st.allowed) {
        return res.status(402).json({ error: { code: st.reason || 'limit_reached', message: 'Free estimates used', used: st.used, limit: st.limit, signedIn: st.signedIn } });
      }
      if (built.spec.counts && !st.isPro) {
        U.pend(st.pkey, 1);
        let released = false;
        release = () => { if (!released) { released = true; U.pend(st.pkey, -1); } };
        onFresh = () => { freshDone = true; U.record(ident, st).catch(e => logError('usage', e.message, null)).finally(release); U.event('estimate_run', ident, jobStats(built.body)); };
      } else if (built.spec.counts) {
        onFresh = () => U.event('estimate_run', ident, jobStats(built.body));
      }
    }
    if (!U.rateOk(ident.ipHash, built.kind)) { release(); return tooMany(); }
    finishInflight = scopeInflightStart(cacheKey);
    res.setHeader('X-Even-Cache', 'miss');
  } else if (!U.rateOk(ident.ipHash, built.kind)) return tooMany();
  try {
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
          'anthropic-beta': ['prompt-caching-2024-07-31', built.body.fallbacks ? 'server-side-fallback-2026-07-01' : null].filter(Boolean).join(',')
        },
        body: JSON.stringify(built.body)
      });

      // Errors always come back as a normal JSON body — read + forward it (never stream an error)
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: { message: 'HTTP ' + response.status } }));
        console.error(`Anthropic ${response.status} for model=${built.body.model}:`, JSON.stringify(data));
        if (response.status >= 500 || response.status === 429) logError('anthropic_proxy', `HTTP ${response.status}: ${JSON.stringify(data).slice(0, 500)}`, { model: built.body.model });
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
        // Read the text and stop reason off the stream as it passes, so a finished
        // scope can be cached. Never cache a cut-off one.
        const decoder = new TextDecoder();
        let sseBuf = '', fullText = '', stopReason = null;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
            if (cacheKey) {
              sseBuf += decoder.decode(value, { stream: true });
              let idx;
              while ((idx = sseBuf.indexOf('\n\n')) >= 0) {
                const frame = sseBuf.slice(0, idx); sseBuf = sseBuf.slice(idx + 2);
                for (const line of frame.split('\n')) {
                  if (!line.startsWith('data:')) continue;
                  try {
                    const evt = JSON.parse(line.slice(5).trim());
                    if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') fullText += evt.delta.text;
                    else if (evt.type === 'message_delta' && evt.delta?.stop_reason) stopReason = evt.delta.stop_reason;
                  } catch (e) { /* ping or partial frame */ }
                }
              }
            }
          }
          if (cacheKey && stopReason === 'end_turn') { scopeCacheSet(cacheKey, fullText); finishInflight(fullText); scopeDbPut(cacheKey, fullText); onFresh(); }
        } catch (streamErr) {
          console.error('Anthropic stream interrupted:', streamErr.message);
          logError('anthropic_proxy', streamErr.message, { stage: 'stream', model: built.body.model });
        }
        return res.end();
      }

      const data = await response.json();
      if (cacheKey && data?.stop_reason === 'end_turn' && Array.isArray(data.content)) {
        const text = data.content.map(b => b.text || '').join('');
        scopeCacheSet(cacheKey, text); finishInflight(text); scopeDbPut(cacheKey, text); onFresh();
      }
      return res.status(response.status).json(data);
    } catch (err) {
      // Transient socket drops ("Premature close", ECONNRESET) during setup — retry with backoff
      lastErr = err;
      console.error(`Anthropic proxy fetch failed (attempt ${attempt}/${MAX_TRIES}):`, err.message);
      if (res.headersSent) return res.end();
      if (attempt < MAX_TRIES) await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  logError('anthropic_proxy', (lastErr && lastErr.message) || 'Upstream fetch failed after retries', { stage: 'exhausted', model: built.body.model });
  res.status(502).json({ error: { message: (lastErr && lastErr.message) || 'Upstream fetch failed after retries' } });
  } finally {
    // Anything that ended without a cacheable answer (error, cut-off) releases waiters.
    finishInflight(null);
    // A finished estimate releases its reservation once it is recorded; anything
    // else (error, cut-off stream) releases it now, so a retry isn't blocked by it.
    if (!freshDone) release();
  }
});

// ─── Free-limit status, funnel events, data-trade credit ─────────────────────
function appOnly(req, res) {
  if (originAllowed(req.get('origin') || '')) return true;
  res.status(403).json({ error: { code: 'origin_not_allowed' } });
  return false;
}
app.get('/api/usage', async (req, res) => {
  if (!appOnly(req, res)) return;
  const U = usage(); const ident = await U.identify(req);
  const st = await U.status(ident);
  res.json({ signedIn: st.signedIn, isPro: st.isPro, used: st.used, limit: st.limit, remaining: st.remaining, allowed: st.allowed, reason: st.reason,
    limits: { anon: LIMITS.ANON_ESTIMATES, freeAccount: LIMITS.FREE_ACCOUNT_ESTIMATES } });
});
const CLIENT_EVENTS = new Set(['signup', 'pdf_download', 'pro_modal_shown']);
app.post('/api/event', async (req, res) => {
  if (!appOnly(req, res)) return;
  const name = String(req.body?.event || '');
  if (!CLIENT_EVENTS.has(name)) return res.status(400).json({ error: { code: 'unknown_event' } });
  const U = usage(); const ident = await U.identify(req);
  if (!U.rateOk(ident.ipHash, 'event')) return res.status(429).json({ error: { code: 'rate_limited' } });
  await U.event(name, ident);
  res.json({ ok: true });
});
app.post('/api/data-trade-credit', async (req, res) => {
  if (!appOnly(req, res)) return;
  const U = usage(); const ident = await U.identify(req);
  if (!U.rateOk(ident.ipHash, 'event')) return res.status(429).json({ error: { code: 'rate_limited' } });
  try { res.json(await U.dataTradeCredit(ident)); } catch (e) { res.status(500).json({ ok: false }); }
});

// ─── Quote-request link (Phase B) ────────────────────────────────────────────
// even-os.com/q/<slug>: a homeowner sends a job, the server builds a DRAFT with
// the contractor's own settings through the app's own pipeline (lib/pipeline.js
// runs index.html's prompt and pricing code), and the contractor reviews it in
// the normal estimate screen. Nothing goes to the homeowner except a "we got
// your request" confirmation, and only once email is switched on.
// Tables contractor_pages and quote_requests: RLS on; homeowners never read
// anything; rows are written only here (service role); a contractor reads and
// updates only their own. Homeowner contact data stays in Supabase, never logs.
const PIPE = (() => { try { return require('./lib/pipeline').loadPipeline(); } catch (e) { console.error('pipeline load failed:', e.message); return null; } })();
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const RESERVED_SLUGS = new Set(['admin', 'api', 'app', 'even', 'help', 'login', 'pro', 'q', 'signup', 'suppliers', 'support', 'test', 'www']);
const QUOTE_TRADES = ['General Contractor', 'Roofing', 'Electrical', 'Plumbing', 'HVAC', 'Remodeling', 'Framing', 'Painting', 'Flooring', 'Concrete', 'Siding', 'Decks', 'Landscaping', 'Pools'];
const svc = extra => ({ 'Content-Type': 'application/json', apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, ...(extra || {}) });
async function sbRest(method, pathQ, body, prefer) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, status: 503, data: null };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathQ}`, { method, headers: svc(prefer ? { Prefer: prefer } : {}), body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) {}
  return { ok: r.ok, status: r.status, data };
}
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const clipText = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, n);

// One AI call the way /api/estimate makes it: same request recipe, same cache
// key, same stored scope, same free-limit count. Throws { code } on a refusal.
async function anthropicCall(body) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01',
          'anthropic-beta': ['prompt-caching-2024-07-31', body.fallbacks ? 'server-side-fallback-2026-07-01' : null].filter(Boolean).join(',') },
        body: JSON.stringify(body)
      });
      if (!r.ok) { const e = new Error('anthropic_http_' + r.status); e.code = r.status >= 500 || r.status === 429 ? 'retry' : 'ai_error'; throw e; }
      if (!body.stream) { const d = await r.json(); return { text: (d.content || []).map(b => b.text || '').join(''), stop: d.stop_reason }; }
      const reader = r.body.getReader(), dec = new TextDecoder();
      let buf = '', text = '', stop = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, i); buf = buf.slice(i + 2);
          for (const line of frame.split('\n')) {
            if (!line.startsWith('data:')) continue;
            try {
              const ev = JSON.parse(line.slice(5).trim());
              if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') text += ev.delta.text;
              else if (ev.type === 'message_delta' && ev.delta?.stop_reason) stop = ev.delta.stop_reason;
            } catch (e) {}
          }
        }
      }
      return { text, stop };
    } catch (e) {
      lastErr = e;
      if (e.code === 'ai_error') throw e;
      if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}
async function serverAI(raw, ident) {
  const built = buildRequest(raw);
  if (built.error) { const e = new Error(built.error); e.code = 'request_not_allowed'; throw e; }
  const key = (built.kind === 'scope' || built.kind === 'estimate') ? scopeCacheKey(built.body) : null;
  if (key) {
    let text = scopeCacheGet(key);
    if (!text && scopeInflight.has(key)) text = await Promise.race([scopeInflight.get(key), new Promise(r => setTimeout(() => r(null), 170000))]);
    if (!text) { text = await scopeDbGet(key); if (text) scopeCacheSet(key, text); }
    if (text) return { text, key, cached: true };
  }
  const U = usage();
  const st = await U.status(ident);
  if (!st.allowed) { const e = new Error('limit'); e.code = 'limit'; throw e; }
  if (built.spec.counts && !st.isPro) U.pend(st.pkey, 1);
  const finish = key ? scopeInflightStart(key) : () => {};
  try {
    const { text, stop } = await anthropicCall(built.body);
    if (stop === 'refusal') { const e = new Error('refusal'); e.code = 'refusal'; throw e; }
    if (stop !== 'end_turn') { const e = new Error('cut_off_' + stop); e.code = 'cut_off'; throw e; }
    if (key) { scopeCacheSet(key, text); finish(text); scopeDbPut(key, text); }
    if (built.spec.counts) {
      if (!st.isPro) await U.record(ident, st).catch(e => logError('usage', e.message, null));
      U.event('estimate_run', ident, jobStats(built.body));
    }
    return { text, key, cached: false };
  } finally {
    finish(null);
    if (built.spec.counts && !st.isPro) U.pend(st.pkey, -1);
  }
}

// Same as the app's getCostCalibration (Pro only): logged actuals by category.
async function costCalibrationFor(userId, trade) {
  if (!trade) return null;
  const jobs = (await sbRest('GET', `estimates?user_id=eq.${userId}&trade=ilike.${encodeURIComponent('*' + trade + '*')}&select=id,estimate_json&order=created_at.desc&limit=15`)).data || [];
  if (!jobs.length) return null;
  const entries = (await sbRest('GET', `cost_entries?estimate_id=in.(${jobs.map(j => j.id).join(',')})&select=estimate_id,line_index,actual_cost`)).data || [];
  if (entries.length < 3) return null;
  const byId = Object.fromEntries(jobs.map(j => [j.id, j.estimate_json]));
  const byCategory = {};
  entries.forEach(e => {
    const line = byId[e.estimate_id]?.lineItems?.[e.line_index];
    if (!line || !line.total) return;
    (byCategory[line.category || 'Other'] = byCategory[line.category || 'Other'] || []).push(((e.actual_cost - line.total) / line.total) * 100);
  });
  return Object.entries(byCategory).filter(([, a]) => a.length >= 2)
    .map(([category, a]) => ({ category, avgVariancePct: Math.round(a.reduce((s, v) => s + v, 0) / a.length), n: a.length }))
    .filter(c => Math.abs(c.avgVariancePct) >= 5);
}

// The contractor's estimate inputs for a request: what the app would hold if
// they typed this job in themselves (their saved settings, the homeowner's words).
function quoteJobContext(row, prefs, isPro) {
  const num = (v, d) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : d);
  const lang = prefs.lang === 'es' || prefs.lang === 'en' ? prefs.lang : (row.lang === 'es' ? 'es' : 'en');
  return {
    trade: QUOTE_TRADES.includes(row.trade) ? row.trade : 'General Contractor',
    location: [row.city, row.zip].filter(Boolean).join(' '),
    projtype: 'Residential — Single Family', sqft: 'not specified', client: row.name || '',
    bidType: prefs.bidType || 'fixed', laborType: prefs.laborType || 'own',
    oh: num(prefs.oh, 12), profit: num(prefs.profit, 22), cushion: num(prefs.cushion, 8),
    laborMult: +prefs.laborMult > 0 ? +prefs.laborMult : PIPE.LABOR_MULT_DEFAULT,
    laborRate: isPro && +prefs.laborRate > 0 ? +prefs.laborRate : null,
    projectLabel: '', lang, marketAdj: ['aggressive', 'premium'].includes(prefs.marketAdj) ? prefs.marketAdj : 'standard'
  };
}

// Builds the draft for one request. Same steps as the app: read the scope,
// load the city's data, build the catalog, run the estimate prompt, price it in
// code. The homeowner's job is never re-worded, so the contractor re-running
// it by hand (same words, same city, questions skipped) gets the same number.
async function buildQuoteDraft(row) {
  const setRow = patch => sbRest('PATCH', `quote_requests?id=eq.${row.id}`, patch, 'return=minimal');
  try {
    if (!PIPE || !process.env.ANTHROPIC_API_KEY) throw Object.assign(new Error('pipeline_unavailable'), { code: 'failed' });
    await setRow({ draft_status: 'building' });
    const u = ((await sbRest('GET', `users?id=eq.${row.user_id}&select=prefs,is_pro,email`)).data || [])[0] || {};
    const prefs = u.prefs || {}, isPro = !!u.is_pro;
    const ctx = quoteJobContext(row, prefs, isPro);
    const ident = { user: { id: row.user_id, email: u.email || null }, ipHash: 'quote-link', devHash: null, fpHash: 'quote-' + row.user_id };
    const scopeText = row.description;
    const first = { role: 'user', content: [{ type: 'text', text: PIPE.scopePromptText({ trade: ctx.trade, location: ctx.location, projtype: ctx.projtype, sqft: ctx.sqft, lang: ctx.lang, scope: scopeText, nDocs: 0, nImages: 0 }) }] };
    const sRes = await serverAI({ even_kind: 'scope', max_tokens: 3000, messages: [first], output_config: { effort: 'low' } }, ident);
    let scopeData = parseScopeText(sRes.text);
    if (!scopeData) {
      const fix = await serverAI({ even_kind: 'scope_fix', max_tokens: 1500, messages: [first, { role: 'assistant', content: sRes.text }, { role: 'user', content: SCOPE_FIX_TEXT }], output_config: { effort: 'low' } }, ident);
      scopeData = parseScopeText(fix.text);
    }
    if (!scopeData) throw Object.assign(new Error('scope_unreadable'), { code: 'failed' });
    let md = await marketPayload(ctx.location);
    const hvhz = md && md.market && typeof md.hvhz === 'boolean' ? md.hvhz : false;
    if (!md || !md.market || (!md.materials?.length && !md.labor?.length && !md.permits?.length)) md = null;
    if (md && Array.isArray(md.materials)) md.materials = md.materials.filter(r => r?.tier !== 'invalid_cross_market_copy');
    const scopeCats = PIPE.scopeMaterialCategories(ctx.trade, scopeData.tradeBreakdown);
    const partner = md ? (await partnerRowsFor(row.user_id, md.market)).rows : [];
    const catalog = PIPE.buildCatalog(md, scopeCats, { suppliers: prefs.suppliers, subs: prefs.subs, partner, trade: ctx.trade });
    const hvhzNote = PIPE.hvhzNoteFor(hvhz);
    const pricingBlock = PIPE.pricingBlockFor(md, hvhzNote, catalog, ctx.location);
    const blocks = PIPE.estimatePromptBlocks({ ctx, scope: scopeText, ansText: '', tradeBreakdown: scopeData.tradeBreakdown || [], pricingBlock, lang: ctx.lang });
    const eRes = await serverAI({ even_kind: 'estimate', max_tokens: 24000, stream: true, messages: [{ role: 'user', content: blocks }], output_config: { effort: 'medium' }, thinking: { type: 'adaptive', display: 'summarized' } }, ident);
    const scoped = parseScopeText(eRes.text);
    if (!scoped) throw Object.assign(new Error('estimate_unreadable'), { code: 'failed' });
    const adj = PIPE.marketAdjFor(ctx.marketAdj);
    const calibration = isPro ? await costCalibrationFor(row.user_id, ctx.trade).catch(() => null) : null;
    const data = PIPE.priceScope(scoped, catalog, { marketAdj: adj.mult, laborMult: ctx.laborMult, laborRate: ctx.laborRate, oh: ctx.oh, profit: ctx.profit, cushion: ctx.cushion,
      sqft: parseFloat(String(ctx.sqft).replace(/,/g, '')) || 0, hvhz, calibration, lang: ctx.lang });
    if (data.pricingNotes.length) data.assumptions = [...data.pricingNotes, ...data.assumptions];
    data.labelAdj = adj.label;
    data.scopeKey = eRes.key || null;
    data.confidenceTier = PIPE.capConfidence(PIPE.computeConfidenceTier(md, scopeCats), ctx.trade);
    if (PIPE.limitedTrade(ctx.trade)) data.limitedTrade = ctx.trade;
    data.jobAddress = [row.address, row.city].filter(Boolean).join(', ');
    const marketMeta = md ? {
      market: md.market, municipality: md.municipality, permitScope: md.permitScope, permitMissing: md.permitMissing || [],
      permitCount: (md.permits || []).length, materialCount: PIPE.inScopeMaterials(md.materials, scopeCats).length,
      materialScope: scopeCats ? [...scopeCats].join(', ') : null, laborCount: (md.labor || []).length,
      proMaterials: PIPE.materialSourceQuality(md.materials, scopeCats) >= 3,
      permitCounty: (md.permits || []).map(p => p.municipality || '').find(n => /\bcounty\b/i.test(n)) || null
    } : null;
    const draft = { v: 1, ctx, scopeText, scopeData: { projectName: scopeData.projectName, tradeBreakdown: scopeData.tradeBreakdown || [], keyFacts: scopeData.keyFacts || [], questions: scopeData.questions || [] },
      estimate: data, marketMeta, hvhz, builtAt: new Date().toISOString() };
    await setRow({ draft, draft_status: 'ready' });
    return { ok: true, draft };
  } catch (e) {
    const code = e.code === 'limit' ? 'limit' : 'failed';
    if (code === 'failed') logError('quote_draft', e.message, { request: row.id });
    await setRow({ draft_status: code }).catch(() => {});
    return { ok: false, code };
  }
}

// ─── Partner price rule (DECIDED founder 2026-10-14) ─────────────────────────
// A partner supply house's prices reach ONLY a paid (Pro) contractor who picked
// that supplier in My supply houses, labeled with the supplier's name. They live
// in partner_prices (server only), never in market_data, so the general price
// list, free and signed-out users, and contractors who picked another supplier
// never receive them: this function is the only way out of that table.
async function partnerRowsFor(userId, market) {
  if (!userId || !market) return { rows: [], reason: 'no_user' };
  const u = ((await sbRest('GET', `users?id=eq.${userId}&select=is_pro,prefs`)).data || [])[0];
  if (!u || !u.is_pro) return { rows: [], reason: 'not_pro' };
  const picked = [...new Set(((u.prefs || {}).shops || []).map(x => x && x.id).filter(id => /^V\d{3,4}$/.test(String(id || ''))))];
  if (!picked.length) return { rows: [], reason: 'none_picked' };
  const sup = (await sbRest('GET', `suppliers?id=in.(${picked.join(',')})&is_partner=eq.true&active=eq.true&select=id,name`)).data || [];
  if (!sup.length) return { rows: [], reason: 'no_partner_picked' };
  const names = Object.fromEntries(sup.map(x => [x.id, x.name]));
  const rows = (await sbRest('GET', `partner_prices?supplier_id=in.(${sup.map(x => x.id).join(',')})&market=eq.${encodeURIComponent(market)}&select=supplier_id,category,item,unit,price,source,date`)).data || [];
  return { rows: rows.filter(r => names[r.supplier_id]).map(r => ({ supplier_id: r.supplier_id, supplier: names[r.supplier_id], category: r.category, item: r.item, unit: r.unit, price: +r.price, source: r.source, date: r.date })), reason: rows.length ? null : 'no_rows_for_market' };
}
app.get('/api/partner-prices', async (req, res) => {
  const ident = await signedInUser(req, res); if (!ident) return;
  if (!usage().rateOk(ident.ipHash, 'event')) return res.status(429).json({ error: { code: 'rate_limited' } });
  const m = await resolveMarket(String(req.query.location || ''));
  const out = await partnerRowsFor(ident.user.id, m && m.market);
  res.json(out);
});

// Email stays OFF until the founder turns it on: QUOTE_EMAIL_ENABLED=1 plus
// RESEND_API_KEY and NOTIFY_FROM_EMAIL on Railway (even-os.com must be verified
// in Resend first). No address is written in this public repo.
const quoteEmailOn = () => process.env.QUOTE_EMAIL_ENABLED === '1' && !!process.env.RESEND_API_KEY && !!process.env.NOTIFY_FROM_EMAIL;
async function sendEmail(to, subject, text) {
  if (!quoteEmailOn() || !to) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: process.env.NOTIFY_FROM_EMAIL, to: [to], subject, text, ...(process.env.REPLY_TO_EMAIL ? { reply_to: process.env.REPLY_TO_EMAIL } : {}) }) });
    if (!r.ok) logError('email', 'resend_' + r.status, null);
    return r.ok;
  } catch (e) { logError('email', e.message, null); return false; }
}

const quoteIpDay = new Map();
function quoteIpOk(ipHash) {
  const k = ipHash + ':' + new Date().toISOString().slice(0, 10);
  const n = (quoteIpDay.get(k) || 0) + 1;
  quoteIpDay.set(k, n);
  if (quoteIpDay.size > 20000) quoteIpDay.delete(quoteIpDay.keys().next().value);
  return n <= LIMITS.QUOTE_PER_IP_PER_DAY;
}
async function pageBySlug(slug) {
  if (!SLUG_RE.test(slug)) return null;
  const r = await sbRest('GET', `contractor_pages?slug=eq.${slug}&active=eq.true&select=user_id,slug,company,phone,logo_url,trades`);
  return (r.data || [])[0] || null;
}

// Public: what the homeowner form shows. No prices, no pricing data, no user id.
app.get('/api/q/:slug', async (req, res) => {
  const U = usage(); const ident = await U.identify(req);
  if (!U.rateOk(ident.ipHash, 'page')) return res.status(429).json({ error: { code: 'rate_limited' } });
  const page = await pageBySlug(String(req.params.slug || '').toLowerCase());
  if (!page) return res.status(404).json({ error: { code: 'not_found' } });
  res.json({ slug: page.slug, company: page.company || '', phone: page.phone || '', logo: page.logo_url || '', trades: (page.trades || []).filter(t => QUOTE_TRADES.includes(t)) });
});

app.post('/api/quote-request', async (req, res) => {
  if (!appOnly(req, res)) return;
  const U = usage(); const ident = await U.identify(req);
  const b = req.body || {};
  if (!U.rateOk(ident.ipHash, 'quote') || !quoteIpOk(ident.ipHash)) return res.status(429).json({ error: { code: 'rate_limited' } });
  // Honeypot: a hidden field people never see. A bot that fills it gets a normal
  // "thanks" and nothing is stored or built.
  if (clip(b.website, 200)) return res.json({ ok: true });
  const row = {
    slug: clip(b.slug, 40).toLowerCase(), name: clip(b.name, 100), phone: clip(b.phone, 40), email: clip(b.email, 200).toLowerCase(),
    address: clip(b.address, 200), city: clip(b.city, 80), zip: clip(b.zip, 10), trade: clip(b.trade, 40),
    description: clipText(b.description, 4000), lang: b.lang === 'es' ? 'es' : 'en'
  };
  const bad = [];
  if (!row.name) bad.push('name');
  if (!row.phone && !row.email) bad.push('contact');
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.email)) bad.push('email');
  if (row.phone && (row.phone.replace(/\D/g, '').length < 7)) bad.push('phone');
  if (!row.city) bad.push('city');
  if (row.zip && !/^\d{5}$/.test(row.zip)) bad.push('zip');
  if (row.description.length < 10) bad.push('description');
  if (bad.length) return res.status(400).json({ error: { code: 'invalid', fields: bad } });
  const page = await pageBySlug(row.slug);
  if (!page) return res.status(404).json({ error: { code: 'not_found' } });
  if (!(page.trades || []).includes(row.trade)) row.trade = 'General Contractor';
  const since = new Date(Date.now() - 86400000).toISOString();
  const recent = await sbRest('GET', `quote_requests?user_id=eq.${page.user_id}&created_at=gt.${encodeURIComponent(since)}&select=id`);
  const overCap = (recent.data || []).length >= LIMITS.QUOTE_DRAFTS_PER_PAGE_PER_DAY;
  const ins = await sbRest('POST', 'quote_requests', { ...row, user_id: page.user_id, status: 'new', draft_status: overCap ? 'capped' : 'pending' }, 'return=representation');
  if (!ins.ok || !ins.data?.[0]) { logError('quote_request', 'insert_failed_' + ins.status, null); return res.status(500).json({ error: { code: 'unavailable' } }); }
  const saved = ins.data[0];
  res.json({ ok: true });
  // After the answer: the homeowner never waits on the AI.
  if (!overCap) buildQuoteDraft(saved).catch(() => {});
  const es = row.lang === 'es';
  sendEmail(row.email, es ? `Recibimos tu solicitud: ${page.company || ''}`.trim() : `We got your request: ${page.company || ''}`.trim(),
    es ? `Hola ${row.name},\n\n${page.company || 'El contratista'} recibió tu solicitud de estimado y te contactará pronto.${page.phone ? '\nTeléfono: ' + page.phone : ''}\n` : `Hi ${row.name},\n\n${page.company || 'The contractor'} got your estimate request and will be in touch soon.${page.phone ? '\nPhone: ' + page.phone : ''}\n`);
  sbRest('GET', `users?id=eq.${page.user_id}&select=email,prefs`).then(r => {
    const u = (r.data || [])[0]; if (!u) return;
    const ces = (u.prefs || {}).lang === 'es';
    sendEmail(u.email, ces ? 'Nueva solicitud de estimado en Even' : 'New estimate request on Even',
      ces ? `${row.name} (${row.city}) te pidió un estimado. Tu borrador se está preparando.\nÁbrelo en https://even-os.com/?requests=1\n` : `${row.name} (${row.city}) asked you for an estimate. Your draft is being built.\nOpen it at https://even-os.com/?requests=1\n`);
  }).catch(() => {});
});

// Contractor side: their own page (any signed-in account; drafts count toward
// the free-estimate limit for non-Pro accounts, Pro is unlimited).
async function signedInUser(req, res) {
  if (!appOnly(req, res)) return null;
  const ident = await usage().identify(req);
  if (!ident.user) { res.status(401).json({ error: { code: 'signin_required' } }); return null; }
  return ident;
}
app.get('/api/my-page', async (req, res) => {
  const ident = await signedInUser(req, res); if (!ident) return;
  const r = await sbRest('GET', `contractor_pages?user_id=eq.${ident.user.id}&select=slug,company,phone,logo_url,trades,active`);
  res.json({ page: (r.data || [])[0] || null, emailOn: quoteEmailOn() });
});
app.put('/api/my-page', async (req, res) => {
  const ident = await signedInUser(req, res); if (!ident) return;
  const U = usage();
  if (!U.rateOk(ident.ipHash, 'event')) return res.status(429).json({ error: { code: 'rate_limited' } });
  const b = req.body || {};
  const slug = clip(b.slug, 40).toLowerCase();
  if (!SLUG_RE.test(slug) || /--/.test(slug)) return res.status(400).json({ error: { code: 'bad_slug' } });
  if (RESERVED_SLUGS.has(slug)) return res.status(409).json({ error: { code: 'slug_taken' } });
  const trades = (Array.isArray(b.trades) ? b.trades : []).filter(t => QUOTE_TRADES.includes(t)).slice(0, 12);
  const u = ((await sbRest('GET', `users?id=eq.${ident.user.id}&select=logo_url`)).data || [])[0] || {};
  const row = { user_id: ident.user.id, slug, company: clip(b.company, 120), phone: clip(b.phone, 40), logo_url: u.logo_url || null,
    trades: trades.length ? trades : ['General Contractor'], active: b.active !== false, updated_at: new Date().toISOString() };
  const r = await sbRest('POST', 'contractor_pages?on_conflict=user_id', row, 'resolution=merge-duplicates,return=representation');
  if (!r.ok) {
    if (r.status === 409 || /duplicate|unique/i.test(JSON.stringify(r.data || ''))) return res.status(409).json({ error: { code: 'slug_taken' } });
    logError('my_page', 'upsert_failed_' + r.status, null);
    return res.status(500).json({ error: { code: 'unavailable' } });
  }
  const p = r.data[0];
  res.json({ page: { slug: p.slug, company: p.company, phone: p.phone, logo_url: p.logo_url, trades: p.trades, active: p.active } });
});
// Retry a draft that failed (server restart, limit since lifted). Own rows only.
app.post('/api/quote-requests/:id/draft', async (req, res) => {
  const ident = await signedInUser(req, res); if (!ident) return;
  const id = String(req.params.id || '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: { code: 'bad_id' } });
  if (!usage().rateOk(ident.ipHash, 'quote')) return res.status(429).json({ error: { code: 'rate_limited' } });
  const row = ((await sbRest('GET', `quote_requests?id=eq.${id}&user_id=eq.${ident.user.id}&select=*`)).data || [])[0];
  if (!row) return res.status(404).json({ error: { code: 'not_found' } });
  if (row.draft_status === 'ready') return res.json({ ok: true, draft_status: 'ready' });
  const out = await buildQuoteDraft(row);
  res.json({ ok: out.ok, draft_status: out.ok ? 'ready' : out.code });
});

// ─── Supplier signup page (even-os.com/suppliers, founder 2026-10-15) ────────
// A supply house sends its contractor price sheet; no account. The file goes to
// the PRIVATE bucket supplier-sheets, the details to supplier_signups (server
// only), and the founder gets an email. The founder's address is read from
// Railway (FOUNDER_EMAIL, else REPLY_TO_EMAIL), never written in this repo.
// Sender: NOTIFY_FROM_EMAIL once even-os.com is verified in Resend; until then
// Resend's own test sender, which only delivers to the Resend account's email.
const founderEmail = () => process.env.FOUNDER_EMAIL || process.env.REPLY_TO_EMAIL || '';
const notifyFrom = () => process.env.NOTIFY_FROM_EMAIL || 'Even <onboarding@resend.dev>';
async function emailFounder(subject, text, attachment) {
  if (!process.env.RESEND_API_KEY || !founderEmail()) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: notifyFrom(), to: [founderEmail()], subject, text, ...(attachment ? { attachments: [attachment] } : {}) }) });
    if (!r.ok) logError('email', 'founder_resend_' + r.status + ' ' + (await r.text()).slice(0, 300), null);
    return r.ok;
  } catch (e) { logError('email', e.message, null); return false; }
}
const SHEET_TYPES = { pdf: 'application/pdf', csv: 'text/csv', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
const SHEET_MAX_BYTES = 10 * 1024 * 1024;
const SUPPLIER_COUNTIES = ['Miami-Dade', 'Broward', 'Palm Beach', 'Other'];
const SUPPLIER_TRADES = ['Roofing', 'Electrical', 'Plumbing', 'HVAC', 'Lumber and framing', 'Drywall', 'Flooring and tile', 'Concrete', 'Windows and doors', 'Pools', 'Landscaping and irrigation', 'Other'];
const supplierIpDay = new Map();
app.post('/api/supplier-signup', async (req, res) => {
  if (!appOnly(req, res)) return;
  const U = usage(); const ident = await U.identify(req);
  const k = ident.ipHash + ':' + new Date().toISOString().slice(0, 10);
  const n = (supplierIpDay.get(k) || 0) + 1; supplierIpDay.set(k, n);
  if (!U.rateOk(ident.ipHash, 'quote') || n > 10) return res.status(429).json({ error: { code: 'rate_limited' } });
  const b = req.body || {};
  if (clip(b.website, 200)) return res.json({ ok: true });   // honeypot
  const row = {
    company: clip(b.company, 120), contact_name: clip(b.contact_name, 100), phone: clip(b.phone, 40), email: clip(b.email, 200).toLowerCase(),
    counties: (Array.isArray(b.counties) ? b.counties : []).filter(x => SUPPLIER_COUNTIES.includes(x)),
    trades: (Array.isArray(b.trades) ? b.trades : []).filter(x => SUPPLIER_TRADES.includes(x)),
    note: clipText(b.note, 1000), lang: b.lang === 'es' ? 'es' : 'en'
  };
  const bad = [];
  if (!row.company) bad.push('company');
  if (!row.phone && !row.email) bad.push('contact');
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.email)) bad.push('email');
  let file = null;
  if (b.file && b.file.data) {
    const name = clip(b.file.name, 120).replace(/[^\w.\- ]+/g, '_') || 'price-sheet';
    const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
    const buf = Buffer.from(String(b.file.data), 'base64');
    if (!ext || !SHEET_TYPES[ext]) bad.push('file_type');
    else if (!buf.length || buf.length > SHEET_MAX_BYTES) bad.push('file_size');
    else file = { name, ext, type: SHEET_TYPES[ext], buf };
  } else bad.push('file');
  if (bad.length) return res.status(400).json({ error: { code: 'invalid', fields: bad } });
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sk) return res.status(503).json({ error: { code: 'unavailable' } });
  const objPath = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${file.name.replace(/\s+/g, '-')}`;
  try {
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/supplier-sheets/${encodeURI(objPath)}`, {
      method: 'POST', headers: { apikey: sk, Authorization: `Bearer ${sk}`, 'Content-Type': file.type, 'x-upsert': 'false' }, body: file.buf });
    if (!up.ok) { logError('supplier_signup', 'upload_' + up.status, null); return res.status(500).json({ error: { code: 'unavailable' } }); }
  } catch (e) { logError('supplier_signup', e.message, null); return res.status(500).json({ error: { code: 'unavailable' } }); }
  const ins = await sbRest('POST', 'supplier_signups', { ...row, file_path: objPath, file_name: file.name, file_type: file.type, file_size: file.buf.length }, 'return=representation');
  if (!ins.ok || !ins.data?.[0]) { logError('supplier_signup', 'insert_' + ins.status, null); return res.status(500).json({ error: { code: 'unavailable' } }); }
  res.json({ ok: true });
  // After the answer: a 7-day private link + the file itself to the founder.
  (async () => {
    let link = '';
    try {
      const sg = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/supplier-sheets/${encodeURI(objPath)}`, { method: 'POST', headers: { apikey: sk, Authorization: `Bearer ${sk}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 7 * 86400 }) });
      const j = sg.ok ? await sg.json() : null;
      if (j && (j.signedURL || j.signedUrl)) link = `${SUPABASE_URL}/storage/v1${j.signedURL || j.signedUrl}`;
    } catch (e) {}
    const text = [`New supplier price sheet from even-os.com/suppliers (${row.lang.toUpperCase()})`, '',
      `Company: ${row.company}`, `Contact: ${row.contact_name || '-'}`, `Phone: ${row.phone || '-'}`, `Email: ${row.email || '-'}`,
      `Counties: ${row.counties.join(', ') || '-'}`, `Trades: ${row.trades.join(', ') || '-'}`, `Note: ${row.note || '-'}`, '',
      `File: ${file.name} (${Math.round(file.buf.length / 1024)} KB), attached.`, link ? `Private link (7 days): ${link}` : 'Private link: not available, the file is in Supabase bucket supplier-sheets.',
      `Supabase row: supplier_signups ${ins.data[0].id}`].join('\n');
    const ok = await emailFounder(`New supplier price sheet: ${row.company}`, text, file.buf.length <= 7 * 1024 * 1024 ? { filename: file.name, content: file.buf.toString('base64') } : null);
    if (ok) sbRest('PATCH', `supplier_signups?id=eq.${ins.data[0].id}`, { emailed: true }, 'return=minimal');
  })().catch(() => {});
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
