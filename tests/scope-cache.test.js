// The scope cache survives a server restart: the first process asks the model and
// writes the scope to Supabase (scope_cache); a fresh process answers the same
// request from Supabase without calling the model. Also: only the hash and the
// scope are stored, unmarked requests never touch the cache, and one key can be
// cleared with the service key. Anthropic and Supabase are mocked.
const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'even-scope-'));
const DB=path.join(dir,'db.json'),LOG=path.join(dir,'log.txt');fs.writeFileSync(LOG,'');
let port=39000+Math.floor(Math.random()*500);
const start=()=>new Promise((res,rej)=>{
  port++;
  const p=spawn(process.execPath,[path.join(__dirname,'helpers','scope-cache-server.js')],{env:{...process.env,PORT:String(port),FAKE_DB:DB,FAKE_LOG:LOG},stdio:['ignore','pipe','pipe']});
  p.stdout.on('data',d=>{if(/running on port/.test(d)) res(p);});
  p.stderr.on('data',()=>{}); p.on('exit',c=>rej(new Error('server exited '+c)));
});
const stop=p=>new Promise(r=>{p.removeAllListeners('exit');p.on('exit',r);p.kill();});
const body={model:'claude-sonnet-5',max_tokens:100,messages:[{role:'user',content:'SECRET-CLIENT-NAME Smith, 12 Ocean Dr'}],output_config:{effort:'medium'}};
const post=(b,h={})=>fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:{'content-type':'application/json',...h},body:JSON.stringify(b)})
  .then(async r=>({cache:r.headers.get('x-even-cache'),key:r.headers.get('x-even-cache-key'),text:(await r.json()).content[0].text}));
const anthropicCalls=()=>fs.readFileSync(LOG,'utf8').split('\n').filter(x=>x==='anthropic').length;
(async()=>{
  console.log('\n=== Scope cache survives a restart ===');
  let srv=await start();
  const a=await post(body,{'x-even-cache':'1'});
  check('first request is a miss and asks the model once', a.cache==='miss'&&anthropicCalls()===1, JSON.stringify(a));
  await new Promise(r=>setTimeout(r,200));
  const row=Object.values(JSON.parse(fs.readFileSync(DB,'utf8')))[0];
  check('the scope was written to scope_cache', !!row&&row.scope.projectName==='run1');
  check('only key + scope are stored (no prompt, no names)', row&&JSON.stringify(row.bodyKeys)==='["key","scope"]'&&!fs.readFileSync(DB,'utf8').includes('SECRET-CLIENT-NAME'), JSON.stringify(row&&row.bodyKeys));
  check('the key is a 64-char hash', /^[a-f0-9]{64}$/.test(a.key||''), a.key);
  check('the server used the service key for Supabase', !fs.readFileSync(LOG,'utf8').includes('NOKEY'));
  await stop(srv); srv=await start();
  const b=await post({...body,stream:false,max_tokens:999},{'x-even-cache':'1'});
  check('after a restart: same scope, from Supabase, no new model call', b.cache==='hit-db'&&JSON.parse(b.text).projectName==='run1'&&anthropicCalls()===1, JSON.stringify(b));
  const c=await post(body,{'x-even-cache':'1'});
  check('then served from memory', c.cache==='hit-memory'&&anthropicCalls()===1, c.cache);
  const u=await post(body);
  check('a request without X-Even-Cache is never cached', !u.cache&&anthropicCalls()===2, JSON.stringify(u));

  console.log('\n=== Clearing one bad scope ===');
  const del=(k,auth)=>fetch(`http://localhost:${port}/api/scope-cache/${k}`,{method:'DELETE',headers:auth?{authorization:'Bearer '+auth}:{}});
  check('without the service key: refused', (await del(a.key)).status===401);
  check('with a wrong key: refused', (await del(a.key,'nope')).status===401);
  const ok=await (await del(a.key,'svc-test-key')).json();
  check('with the service key: cleared', ok.ok&&ok.deleted===1, JSON.stringify(ok));
  const d=await post(body,{'x-even-cache':'1'});
  check('next identical request asks the model again', d.cache==='miss'&&anthropicCalls()===3, JSON.stringify(d));
  await stop(srv);
  fs.rmSync(dir,{recursive:true,force:true});
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
