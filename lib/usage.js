// Free-limit and access rules, counted on the server (decided 2026-10-03).
// The browser used to keep its own count (sessionStorage for signed-out users,
// a column it could rewrite for signed-in ones), so a new tab or one console
// line reset it. Now every count lives here.
const crypto = require('crypto');

// ── The numbers. Change them here, nowhere else. ────────────────────────────
const LIMITS = {
  ANON_ESTIMATES: 3,          // signed out, per device (and per IP+browser as backup)
  FREE_ACCOUNT_ESTIMATES: 5,  // signed in, not Pro: 3 + 2, anonymous ones from the device count
  ANON_PER_IP_PER_DAY: 10,    // abuse cap on signed-out estimates from one IP per day
  BACKUP_WINDOW_DAYS: 30,     // how long the IP+browser backup count remembers
  DATA_TRADE_CREDIT: 1,       // "share a job cost" gives this many extra, once
  // Requests per minute per IP that actually reach the AI (cached or refused ones
  // don't), plus a looser cap on every request. RATE_LIMIT_SCALE env multiplies them (tests).
  RATE_PER_MINUTE: { estimate: 6, scope: 12, scope_fix: 12, beautify: 10, insights: 6, price_sheet: 6, event: 40, any: 60 }
};

function makeUsage({ supabaseUrl, serviceKey, fetchImpl, secret }) {
  const f = (...a) => fetchImpl(...a);
  const headers = extra => ({ 'Content-Type': 'application/json', apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}`, ...extra });
  const hmac = s => crypto.createHmac('sha256', secret()).update(s).digest('hex').slice(0, 40);
  const day = () => new Date().toISOString().slice(0, 10);

  // ── identity ──
  const tokenCache = new Map();
  async function userFromToken(token) {
    if (!token || !serviceKey()) return null;
    const hit = tokenCache.get(token);
    if (hit && hit.exp > Date.now()) return hit.user;
    try {
      const r = await f(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceKey(), Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(4000) });
      const u = r.ok ? await r.json() : null;
      const user = u && u.id ? { id: u.id, email: u.email || null } : null;
      tokenCache.set(token, { user, exp: Date.now() + 5 * 60000 });
      if (tokenCache.size > 2000) tokenCache.delete(tokenCache.keys().next().value);
      return user;
    } catch (e) { return null; }
  }
  async function identify(req) {
    // The client can send its own X-Forwarded-For; the hosting proxy appends the
    // real address at the end, so take the right-most public address.
    const isPrivate = a => /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|fc|fd|fe80)/i.test(a);
    const chain = String(req.get('x-forwarded-for') || '').split(',').map(x => x.trim()).filter(Boolean);
    const ip = [...chain].reverse().find(a => !isPrivate(a)) || chain[chain.length - 1] || req.socket?.remoteAddress || '';
    const ua = String(req.get('user-agent') || '');
    const dev = String(req.get('x-even-device') || '');
    const auth = String(req.get('authorization') || '');
    const user = /^Bearer\s+\S+/.test(auth) ? await userFromToken(auth.replace(/^Bearer\s+/i, '')) : null;
    return {
      user,
      ipHash: hmac('ip:' + ip),
      devHash: /^[A-Za-z0-9-]{16,64}$/.test(dev) ? hmac('dev:' + dev) : null,
      fpHash: hmac('fp:' + ip + '|' + ua)   // IP + browser: a new tab or private window lands here too
    };
  }

  // ── app_usage rows: key -> { count, first_at } ──
  async function getRows(keys) {
    const out = {};
    if (!keys.length || !serviceKey()) return out;
    const r = await f(`${supabaseUrl}/rest/v1/app_usage?key=in.(${keys.map(k => `"${k}"`).join(',')})&select=key,count,first_at`, { headers: headers() });
    if (!r.ok) throw new Error('app_usage read failed ' + r.status);
    for (const row of await r.json()) out[row.key] = row;
    return out;
  }
  async function putRows(rows) {
    if (!rows.length || !serviceKey()) return;
    const r = await f(`${supabaseUrl}/rest/v1/app_usage?on_conflict=key`, {
      method: 'POST', headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(rows.map(x => ({ key: x.key, count: x.count, first_at: x.first_at, updated_at: new Date().toISOString() })))
    });
    if (!r.ok) throw new Error('app_usage write failed ' + r.status + ' ' + await r.text());
  }
  const windowed = row => {
    if (!row) return 0;
    const age = Date.now() - new Date(row.first_at).getTime();
    return age > LIMITS.BACKUP_WINDOW_DAYS * 86400000 ? 0 : row.count;
  };

  async function userRow(user) {
    const r = await f(`${supabaseUrl}/rest/v1/users?id=eq.${user.id}&select=estimate_count,is_pro`, { headers: headers() });
    const row = r.ok ? (await r.json())[0] : null;
    if (row) return row;
    // First time the server sees this account: create its row (the browser can no longer insert it).
    await f(`${supabaseUrl}/rest/v1/users?on_conflict=id`, {
      method: 'POST', headers: headers({ Prefer: 'resolution=ignore-duplicates,return=minimal' }),
      body: JSON.stringify({ id: user.id, email: user.email, estimate_count: 0, is_pro: false })
    }).catch(() => {});
    return { estimate_count: 0, is_pro: false };
  }

  // Estimates reserved but not finished yet, so ten parallel requests at 2/3 can't all pass.
  const pending = new Map();
  const pend = (id, d) => { const n = (pending.get(id) || 0) + d; n > 0 ? pending.set(id, n) : pending.delete(id); };

  // Where this person stands. Never throws: if the database can't be read we fail
  // closed for signed-out users and open for signed-in ones (they are known).
  async function status(ident) {
    const keys = [`ipday:${ident.ipHash}:${day()}`, `fp:${ident.fpHash}`];
    if (ident.devHash) keys.push(`dev:${ident.devHash}`, `credit:dev:${ident.devHash}`);
    if (ident.user) keys.push(`credit:user:${ident.user.id}`);
    let rows = {}, dbOk = true;
    try { rows = await getRows(keys); } catch (e) { dbOk = false; }
    const devCount = ident.devHash ? (rows[`dev:${ident.devHash}`]?.count || 0) : 0;
    const fpCount = windowed(rows[`fp:${ident.fpHash}`]);
    const ipDay = rows[`ipday:${ident.ipHash}:${day()}`]?.count || 0;
    const pkey = ident.user ? 'u:' + ident.user.id : 'a:' + (ident.devHash || ident.fpHash);
    if (ident.user) {
      let row = { estimate_count: 0, is_pro: false };
      try { row = await userRow(ident.user); } catch (e) {}
      const credit = rows[`credit:user:${ident.user.id}`] ? LIMITS.DATA_TRADE_CREDIT : 0;
      const used = Math.max(row.estimate_count || 0, devCount);
      const limit = LIMITS.FREE_ACCOUNT_ESTIMATES + credit;
      return { signedIn: true, isPro: !!row.is_pro, used, limit, remaining: row.is_pro ? null : Math.max(0, limit - used),
        allowed: !!row.is_pro || used + (pending.get(pkey) || 0) < limit, reason: row.is_pro ? null : 'pro_required', rows, devCount, fpCount, ipDay, userCount: row.estimate_count || 0, pkey, dbOk };
    }
    const credit = ident.devHash && rows[`credit:dev:${ident.devHash}`] ? LIMITS.DATA_TRADE_CREDIT : 0;
    const used = Math.max(devCount, fpCount);
    const limit = LIMITS.ANON_ESTIMATES + credit;
    let allowed = dbOk && used + (pending.get(pkey) || 0) < limit, reason = 'signup_required';
    if (allowed && ipDay >= LIMITS.ANON_PER_IP_PER_DAY) { allowed = false; reason = 'daily_cap'; }
    return { signedIn: false, isPro: false, used, limit, remaining: Math.max(0, limit - used), allowed, reason: allowed ? null : (dbOk ? reason : 'unavailable'), rows, devCount, fpCount, ipDay, pkey, dbOk };
  }

  // Count one finished estimate (a fresh AI scope; cache hits never get here).
  async function record(ident, st) {
    const now = new Date().toISOString();
    const rows = [];
    const k = (key, row, windowedCount) => rows.push({ key, count: (windowedCount ?? (row?.count || 0)) + 1, first_at: (windowedCount === 0 || !row) ? now : row.first_at });
    k(`fp:${ident.fpHash}`, st.rows[`fp:${ident.fpHash}`], windowed(st.rows[`fp:${ident.fpHash}`]));
    if (ident.devHash) k(`dev:${ident.devHash}`, st.rows[`dev:${ident.devHash}`]);
    if (!ident.user) k(`ipday:${ident.ipHash}:${day()}`, st.rows[`ipday:${ident.ipHash}:${day()}`]);
    await putRows(rows);
    if (ident.user) {
      // Never goes down: signing up or switching devices doesn't reset anything.
      await f(`${supabaseUrl}/rest/v1/users?id=eq.${ident.user.id}`, {
        method: 'PATCH', headers: headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ estimate_count: Math.max(st.userCount || 0, st.devCount || 0) + 1 })
      });
    }
  }

  // "Share a job cost, get 1 free estimate": once per account and once per device.
  async function dataTradeCredit(ident) {
    const keys = [];
    if (ident.user) keys.push(`credit:user:${ident.user.id}`);
    if (ident.devHash) keys.push(`credit:dev:${ident.devHash}`);
    if (!keys.length) return { ok: false, reason: 'no_identity' };
    const rows = await getRows(keys);
    if (keys.some(k => rows[k])) return { ok: false, reason: 'already_used' };
    const now = new Date().toISOString();
    await putRows(keys.map(key => ({ key, count: 1, first_at: now })));
    return { ok: true };
  }

  // Funnel events: event + user id or device hash. No names, emails or job text.
  async function event(name, ident) {
    if (!serviceKey()) return;
    try {
      await f(`${supabaseUrl}/rest/v1/app_events`, {
        method: 'POST', headers: headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ event: name, user_id: ident.user ? ident.user.id : null, device_hash: ident.user ? null : (ident.devHash || ident.fpHash) })
      });
    } catch (e) {}
  }

  // Per-IP rate limit, in memory (per server instance).
  const buckets = new Map();
  function rateOk(ipHash, kind) {
    const per = (LIMITS.RATE_PER_MINUTE[kind] || 6) * (Number(process.env.RATE_LIMIT_SCALE) || 1);
    const key = kind + ':' + ipHash, now = Date.now();
    const arr = (buckets.get(key) || []).filter(t => now - t < 60000);
    if (arr.length >= per) { buckets.set(key, arr); return false; }
    arr.push(now); buckets.set(key, arr);
    if (buckets.size > 20000) buckets.delete(buckets.keys().next().value);
    return true;
  }

  return { identify, status, record, event, dataTradeCredit, rateOk, pend };
}

module.exports = { makeUsage, LIMITS };
