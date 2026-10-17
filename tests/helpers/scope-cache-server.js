// Child process for scope-cache.test.js and access.test.js: runs the real
// server.js with Anthropic and the Supabase REST/auth APIs mocked. The fake
// tables live in a JSON file, so a second process (a "restart") sees what the
// first one wrote.
const fs = require('fs');
const DB = process.env.FAKE_DB, LOG = process.env.FAKE_LOG;
process.env.ANTHROPIC_API_KEY = 'test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-test-key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
const load = () => (fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, 'utf8')) : {});
const save = d => fs.writeFileSync(DB, JSON.stringify(d));
const log = l => fs.appendFileSync(LOG, l + '\n');
const table = (d, t) => (d['__' + t] = d['__' + t] || {});
const USERS = { 'tok-free': { id: '11111111-1111-1111-1111-111111111111', email: 'free@example.com' }, 'tok-pro': { id: '22222222-2222-2222-2222-222222222222', email: 'pro@example.com' }, 'tok-pro2': { id: '33333333-3333-3333-3333-333333333333', email: 'pro2@example.com' } };
const real = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
  if (url.includes('api.anthropic.com')) {
    log('anthropic');
    { const b = JSON.parse(opts.body); log('req ' + JSON.stringify({ model: b.model, beta: (opts.headers || {})['anthropic-beta'], fallbacks: b.fallbacks || null, thinking: b.thinking || null, effort: b.output_config?.effort || null })); }
    if (opts.body.includes('REFUSE_ME')) {
      if (JSON.parse(opts.body).stream) return new Response(`data: {"type":"message_delta","delta":{"stop_reason":"refusal"}}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } });
      return json({ content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null } });
    }
    const n = fs.readFileSync(LOG, 'utf8').split('\n').filter(x => x === 'anthropic').length;
    // A partner supply-house row in the prompt (where-i-shop.test.js): the scope buys from it.
    const hRef = /\\nH1 /.test(opts.body) ? ',{"type":"material","ref":"H1","qty":10}' : '';
    const text = `{"projectName":"run${n}","tradeBreakdown":[{"trade":"Plumbing","icon":"x","items":[]}],"questions":[],"lineItems":[{"type":"other","category":"Labor","description":"Mock line","qty":1,"unit":"ea","unitCost":100},{"type":"material","ref":"M1","qty":2},{"type":"labor","ref":"L1","hours":3},{"type":"permit","ref":"P1","qty":0}${hRef}]}`;
    if (JSON.parse(opts.body).stream && opts.body.includes('CUT_OFF_STREAM')) {
      return new Response(`data: {"type":"message_delta","delta":{"stop_reason":"max_tokens"}}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }
    if (JSON.parse(opts.body).stream) {
      const sse = `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}\n\nevent: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n`;
      return new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }
    return json({ content: [{ type: 'text', text: `{"projectName":"run${n}","tradeBreakdown":[{"trade":"Plumbing","icon":"x","items":[]}],"questions":[],"lineItems":[{"type":"other","category":"Labor","description":"Mock line","qty":1,"unit":"ea","unitCost":100},{"type":"material","ref":"M1","qty":2},{"type":"labor","ref":"L1","hours":3},{"type":"permit","ref":"P1","qty":0}]}` }], stop_reason: 'end_turn' });
  }
  if (url.includes('api.resend.com')) {
    const b = JSON.parse(opts.body); log('email ' + JSON.stringify({ from: b.from, to: b.to, subject: b.subject, hasAttachment: !!(b.attachments && b.attachments.length), text: b.text }));
    return json({ id: 'email_test' });
  }
  if (url.includes('/storage/v1/object/sign/')) return json({ signedURL: '/object/sign/supplier-sheets/x?token=t' });
  if (url.includes('/storage/v1/object/')) {
    const d0 = load(); const st = (d0.__storage = d0.__storage || {});
    const p0 = decodeURI(url.split('/storage/v1/object/')[1]);
    const ok = (opts.headers || {}).apikey === 'svc-test-key';
    if (!ok) return json({ error: 'unauthorized' }, 401);
    st[p0] = { size: Buffer.from(opts.body).length, type: (opts.headers || {})['Content-Type'] }; save(d0);
    return json({ Key: p0 });
  }
  if (url.includes('/auth/v1/user')) {
    const tok = String((opts.headers || {}).Authorization || '').replace('Bearer ', '');
    return USERS[tok] ? json(USERS[tok]) : json({ msg: 'bad jwt' }, 401);
  }
  const u = new URL(url), m = opts.method || 'GET', d = load();
  const svc = (opts.headers || {}).apikey === 'svc-test-key' ? 'svc' : 'NOKEY';
  if (url.includes('/rest/v1/scope_cache')) {
    const key = (u.searchParams.get('key') || '').replace(/^eq\./, '');
    log(`db ${m} ${svc}`);
    if (m === 'GET') return json(d[key] ? [{ scope: d[key].scope, hits: d[key].hits }] : []);
    if (m === 'POST') { const b = JSON.parse(opts.body); if (!d[b.key]) d[b.key] = { scope: b.scope, hits: 0, bodyKeys: Object.keys(b) }; save(d); return new Response('', { status: 201 }); }
    if (m === 'PATCH') { if (d[key]) { d[key].hits = JSON.parse(opts.body).hits; save(d); } return new Response(null, { status: 204 }); }
    if (m === 'DELETE') { const had = key && d[key] ? [d[key]] : []; if (key) delete d[key]; save(d); return json(had); }
  }
  if (url.includes('/rest/v1/app_usage')) {
    const t = table(d, 'app_usage');
    if (m === 'GET') {
      const keys = (u.searchParams.get('key') || '').replace(/^in\.\(|\)$/g, '').split(',').map(k => k.replace(/^"|"$/g, ''));
      return json(keys.filter(k => t[k]).map(k => ({ key: k, ...t[k] })));
    }
    if (m === 'POST') { for (const r of JSON.parse(opts.body)) t[r.key] = { count: r.count, first_at: r.first_at }; save(d); return new Response('', { status: 201 }); }
  }
  if (url.includes('/rest/v1/users')) {
    const t = table(d, 'users');
    const id = (u.searchParams.get('id') || '').replace(/^eq\./, '');
    if (m === 'GET') return json(t[id] ? [t[id]] : []);
    if (m === 'POST') { const b = JSON.parse(opts.body); if (!t[b.id]) t[b.id] = { estimate_count: 0, is_pro: b.id === USERS['tok-pro'].id }; save(d); return new Response('', { status: 201 }); }
    if (m === 'PATCH') { Object.assign(t[id] = t[id] || {}, JSON.parse(opts.body)); save(d); return new Response(null, { status: 204 }); }
  }
  if (url.includes('/rest/v1/app_events')) {
    const t = (d.__events = d.__events || []); t.push(JSON.parse(opts.body)); save(d); return new Response('', { status: 201 });
  }
  // Quote-request link tables (quote-link.test.js). Filters: eq. only, enough for the server's queries.
  const rows = name => (d['__' + name] = d['__' + name] || []);
  const matches = row => [...u.searchParams.entries()].every(([k, v]) => {
    if (['select', 'order', 'limit', 'on_conflict'].includes(k)) return true;
    if (v.startsWith('eq.')) return String(row[k]) === v.slice(3);
    if (v.startsWith('gt.')) return String(row[k]) > v.slice(3);
    if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(row[k]));
    return true;
  });
  if (url.includes('/rest/v1/market_data')) {
    const mkt = (u.searchParams.get('market') || '').replace(/^eq\./, '');
    const batch = JSON.parse(fs.readFileSync(require('path').join(__dirname, '..', '..', 'data', 'batches', 'even_master_batch.json'), 'utf8'));
    const m = batch.find(x => x.market === mkt);
    return json(m ? [{ market: m.market, state: m.state, zone: m.zone, materials: m.materials, labor: m.labor, permits: m.permits }] : []);
  }
  for (const name of ['contractor_pages', 'quote_requests', 'suppliers', 'partner_prices', 'supplier_signups']) {
    if (!url.includes('/rest/v1/' + name)) continue;
    const t = rows(name);
    log(`db ${name} ${m} ${svc}`);
    if (svc !== 'svc') return json({ message: 'no key' }, 401);
    if (m === 'GET') return json(t.filter(matches));
    if (m === 'POST') {
      const b = JSON.parse(opts.body);
      if (name === 'contractor_pages') {
        const clash = t.find(x => x.slug === b.slug && x.user_id !== b.user_id);
        if (clash) return json({ code: '23505', message: 'duplicate key value violates unique constraint' }, 409);
        const i = t.findIndex(x => x.user_id === b.user_id);
        if (i >= 0) t[i] = { ...t[i], ...b }; else t.push(b);
        save(d); return json([t.find(x => x.user_id === b.user_id)], 201);
      }
      const row = { id: require('crypto').randomUUID(), created_at: new Date().toISOString(), draft: null, estimate_id: null, ...b };
      t.push(row); save(d); return json([row], 201);
    }
    if (m === 'PATCH') { const b = JSON.parse(opts.body); t.filter(matches).forEach(r => Object.assign(r, b)); save(d); return new Response(null, { status: 204 }); }
  }
  if (url.includes('/rest/v1/')) return json([]);
  return real(url, opts);
};
require('../../server.js');
