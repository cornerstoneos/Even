// Child process for scope-cache.test.js: runs the real server.js with Anthropic
// and the Supabase REST API mocked. The fake scope_cache table lives in a JSON
// file, so a second process (a "restart") sees what the first one wrote.
const fs = require('fs');
const DB = process.env.FAKE_DB, LOG = process.env.FAKE_LOG;
process.env.ANTHROPIC_API_KEY = 'test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-test-key';
const load = () => (fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, 'utf8')) : {});
const save = d => fs.writeFileSync(DB, JSON.stringify(d));
const log = l => fs.appendFileSync(LOG, l + '\n');
const real = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.includes('api.anthropic.com')) {
    log('anthropic');
    const n = fs.readFileSync(LOG, 'utf8').split('\n').filter(x => x === 'anthropic').length;
    return new Response(JSON.stringify({ content: [{ type: 'text', text: `{"projectName":"run${n}","tradeBreakdown":[{"trade":"Plumbing","icon":"x","items":[]}],"lineItems":[]}` }], stop_reason: 'end_turn' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/rest/v1/scope_cache')) {
    const u = new URL(url), d = load(), m = opts.method || 'GET';
    const key = (u.searchParams.get('key') || '').replace(/^eq\./, '');
    log(`db ${m} ${(opts.headers || {}).apikey === 'svc-test-key' ? 'svc' : 'NOKEY'}`);
    if (m === 'GET') return new Response(JSON.stringify(d[key] ? [{ scope: d[key].scope, hits: d[key].hits }] : []), { status: 200 });
    if (m === 'POST') { const b = JSON.parse(opts.body); if (!d[b.key]) d[b.key] = { scope: b.scope, hits: 0, bodyKeys: Object.keys(b) }; save(d); return new Response('', { status: 201 }); }
    if (m === 'PATCH') { if (d[key]) { d[key].hits = JSON.parse(opts.body).hits; save(d); } return new Response('', { status: 204 }); }
    if (m === 'DELETE') { const had = key && d[key] ? [d[key]] : []; if (key) delete d[key]; save(d); return new Response(JSON.stringify(had), { status: 200 }); }
  }
  if (url.includes('/rest/v1/')) return new Response('[]', { status: 200 });
  return real(url, opts);
};
require('../../server.js');
