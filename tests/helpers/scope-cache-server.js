// Child process for scope-cache.test.js and access.test.js: runs the real
// server.js with Anthropic and the Supabase REST/auth APIs mocked. The fake
// tables live in a JSON file, so a second process (a "restart") sees what the
// first one wrote.
const fs = require('fs');
const DB = process.env.FAKE_DB, LOG = process.env.FAKE_LOG;
process.env.ANTHROPIC_API_KEY = 'test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-test-key';
const load = () => (fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, 'utf8')) : {});
const save = d => fs.writeFileSync(DB, JSON.stringify(d));
const log = l => fs.appendFileSync(LOG, l + '\n');
const table = (d, t) => (d['__' + t] = d['__' + t] || {});
const USERS = { 'tok-free': { id: '11111111-1111-1111-1111-111111111111', email: 'free@example.com' }, 'tok-pro': { id: '22222222-2222-2222-2222-222222222222', email: 'pro@example.com' } };
const real = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
  if (url.includes('api.anthropic.com')) {
    log('anthropic');
    const n = fs.readFileSync(LOG, 'utf8').split('\n').filter(x => x === 'anthropic').length;
    const text = `{"projectName":"run${n}","tradeBreakdown":[{"trade":"Plumbing","icon":"x","items":[]}],"questions":[],"lineItems":[{"type":"other","category":"Labor","description":"Mock line","qty":1,"unit":"ea","unitCost":100}]}`;
    if (JSON.parse(opts.body).stream && opts.body.includes('CUT_OFF_STREAM')) {
      return new Response(`data: {"type":"message_delta","delta":{"stop_reason":"max_tokens"}}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }
    if (JSON.parse(opts.body).stream) {
      const sse = `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}\n\nevent: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n`;
      return new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }
    return json({ content: [{ type: 'text', text: `{"projectName":"run${n}","tradeBreakdown":[{"trade":"Plumbing","icon":"x","items":[]}],"questions":[],"lineItems":[{"type":"other","category":"Labor","description":"Mock line","qty":1,"unit":"ea","unitCost":100}]}` }], stop_reason: 'end_turn' });
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
    if (m === 'PATCH') { if (d[key]) { d[key].hits = JSON.parse(opts.body).hits; save(d); } return new Response('', { status: 204 }); }
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
    if (m === 'PATCH') { Object.assign(t[id] = t[id] || {}, JSON.parse(opts.body)); save(d); return new Response('', { status: 204 }); }
  }
  if (url.includes('/rest/v1/app_events')) {
    const t = (d.__events = d.__events || []); t.push(JSON.parse(opts.body)); save(d); return new Response('', { status: 201 });
  }
  if (url.includes('/rest/v1/')) return json([]);
  return real(url, opts);
};
require('../../server.js');
