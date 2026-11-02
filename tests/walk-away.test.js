// Build it and walk away + notifications (founder spec 2026-10-31), end to end
// against the real server.js with Anthropic, Supabase, Resend and web push mocked
// (helpers/scope-cache-server.js; web push is proven with a mocked sender, no real
// device). Acceptance: a build whose page closes still finishes, is kept, and its
// total and lines are identical to the same inputs priced in-page; a push (and the
// email, when switched on) goes out with the spec's words; a failed build can be
// retried; another account can't read it; signed out keeps today's flow; free
// accounts are counted exactly like a normal estimate.
const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const {loadPipeline}=require('../lib/pipeline');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const root=path.join(__dirname,'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'even-walk-'));
const DB=path.join(dir,'db.json'),LOG=path.join(dir,'log.txt');fs.writeFileSync(LOG,'');
const FREE='11111111-1111-1111-1111-111111111111', PRO='22222222-2222-2222-2222-222222222222';
fs.writeFileSync(DB,JSON.stringify({__users:{[FREE]:{estimate_count:0,is_pro:false,email:'free@example.com'},[PRO]:{estimate_count:0,is_pro:true,email:'pro@example.com'}}}));
const vapid=require('web-push').generateVAPIDKeys();
const port=41100+Math.floor(Math.random()*300);
const env={...process.env,PORT:String(port),FAKE_DB:DB,FAKE_LOG:LOG,PUSH_ENABLED:'1',VAPID_PUBLIC_KEY:vapid.publicKey,VAPID_PRIVATE_KEY:vapid.privateKey,
  BUILD_EMAIL_ENABLED:'1',RESEND_API_KEY:'re_test',NOTIFY_FROM_EMAIL:'Even <alerts@test.example>'};
const start=()=>new Promise((res,rej)=>{
  const p=spawn(process.execPath,[path.join(__dirname,'helpers','scope-cache-server.js')],{env,stdio:['ignore','pipe','pipe']});
  p.stdout.on('data',d=>{if(/running on port/.test(d)) res(p);}); p.stderr.on('data',()=>{}); p.on('exit',c=>rej(new Error('server exited '+c)));
});
// The fake server rewrites this file on every write: retry a read that lands mid-write.
const db=()=>{for(let i=0;;i++){try{return JSON.parse(fs.readFileSync(DB,'utf8')||'{}');}catch(e){if(i>20) throw e;}}};
const logLines=pre=>fs.readFileSync(LOG,'utf8').split('\n').filter(x=>x.startsWith(pre));
const calls=()=>logLines('anthropic').filter(x=>x==='anthropic').length;
const H=(extra={})=>({'content-type':'application/json',origin:'https://even-os.com','x-forwarded-for':'203.0.113.77','user-agent':'Mozilla/5.0 Test','x-even-device':'dev-walk-test-000000001',...extra});
const api=async(method,p,body,extra)=>{const r=await fetch(`http://localhost:${port}${p}`,{method,headers:H(extra),body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json().catch(()=>({}))};};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const build=id=>(db().__bg_builds||[]).find(b=>b.id===id);
const waitBuild=async(id,ms=8000)=>{const t=Date.now();while(Date.now()-t<ms){const b=build(id);if(b&&b.status!=='building') return b;await sleep(100);}return build(id);};
const P=loadPipeline();
const PRO_H={authorization:'Bearer tok-pro'}, FREE_H={authorization:'Bearer tok-free'};

(async()=>{
  const srv=await start();
  try{
  // The same inputs the page builds (index.html _calculateEstimate), for a Fort Lauderdale plumbing job.
  const ctx={trade:'Plumbing',location:'Fort Lauderdale',projtype:'Residential — Single Family',sqft:'not specified',client:'Garcia',bidType:'fixed',laborType:'own',oh:15,profit:20,cushion:6,laborMult:2,laborRate:null,projectLabel:'',lang:'en'};
  const md=await (await fetch(`http://localhost:${port}/api/market-data?location=${encodeURIComponent(ctx.location)}`)).json();
  md.materials=md.materials.filter(x=>x?.tier!=='invalid_cross_market_copy');
  const tb=[{trade:'Plumbing',icon:'x',items:[]}];
  const cats=P.scopeMaterialCategories(ctx.trade,tb);
  const catalog=P.buildCatalog(md,cats,{});
  const priceOpts={marketAdj:1,laborMult:2,laborRate:null,oh:15,profit:20,cushion:6,sqft:0,hvhz:md.hvhz,calibration:null,lang:'en'};
  const reqFor=scope=>({even_kind:'estimate',max_tokens:24000,stream:true,messages:[{role:'user',content:P.estimatePromptBlocks({ctx,scope,ansText:'',tradeBreakdown:tb,pricingBlock:P.pricingBlockFor(md,P.hvhzNoteFor(md.hvhz),catalog,ctx.location),lang:'en'})}],output_config:{effort:'medium'},thinking:{type:'adaptive',display:'summarized'}});
  const {byRef,...cat}=catalog;
  const bgIn=(label,lang='en')=>({label,lang,catalog:cat,priceOpts,meta:{labelAdj:'',confidenceTier:'MEDIUM',trade:ctx.trade,ctx,scopeData:{projectName:label,tradeBreakdown:tb},marketMeta:null,answers:{},questions:[],fields:{trade:'Plumbing',location:'Fort Lauderdale',scope:'x',client:'Garcia'}}});
  // The page's own post-AI steps (index.html), for the "priced in-page" side.
  const pagePrice=(text,key)=>{const d=P.priceScope(JSON.parse(text),catalog,priceOpts);if(d.pricingNotes.length)d.assumptions=[...d.pricingNotes,...d.assumptions];d.labelAdj='';d.scopeKey=key;d.confidenceTier='MEDIUM';return d;};
  const readStream=async r=>{const t=await r.text();return t.split('\n').filter(l=>l.startsWith('data:')).map(l=>{try{return JSON.parse(l.slice(5).trim());}catch(e){return null;}}).filter(e=>e&&e.type==='content_block_delta'&&e.delta?.type==='text_delta').map(e=>e.delta.text).join('');};

  console.log('\n=== Today (before this build): a page closed mid-estimate ===');
  { const ctrl=new AbortController(), c0=calls();
    const r=await fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:H({'x-even-cache':'1'}),body:JSON.stringify(reqFor('Signed out SLOW_STREAM swap the water heater')),signal:ctrl.signal});
    const key=r.headers.get('x-even-cache-key'); ctrl.abort(); await sleep(1800);
    check('the server keeps reading the AI answer after the page closes, and caches it', calls()===c0+1&&!!db()[key], key);
    check('signed out: no build is kept (nothing to come back to), as before', !(db().__bg_builds||[]).length && !r.headers.get('x-even-build-id'));
    const again=await fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:H({'x-even-cache':'1'}),body:JSON.stringify(reqFor('Signed out SLOW_STREAM swap the water heater'))});
    check('the same inputs typed again come back from the cache (no second AI call)', again.headers.get('x-even-cache')?.startsWith('hit')&&calls()===c0+1);
  }

  console.log('\n=== Signed in, page stays open (normal case) ===');
  let r=await fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:H({'x-even-cache':'1',...PRO_H}),body:JSON.stringify({...reqFor('Garcia bath: replace the toilet and vanity'),even_build:bgIn('Garcia bath')})});
  const idA=r.headers.get('x-even-build-id'); const keyA=r.headers.get('x-even-cache-key');
  const textA=await readStream(r);
  const a=await waitBuild(idA);
  check('the request carries a build id back to the page', /^[0-9a-f-]{36}$/.test(idA||''), idA);
  check('the build is kept as ready, page was watching (no push needed)', a&&a.status==='ready'&&a.client_gone===false&&!a.notified_at, JSON.stringify(a&&{s:a.status,g:a.client_gone}));
  const inPageA=pagePrice(textA,keyA);
  check(`server copy = page's price: $${a&&a.result.totalBid} = $${inPageA.totalBid}, same lines`, a&&a.result.totalBid===inPageA.totalBid&&JSON.stringify(a.result.lineItems)===JSON.stringify(inPageA.lineItems), a&&a.result.totalBid);
  check('the AI request itself was unchanged (even_build never reaches the model)', !fs.readFileSync(LOG,'utf8').includes('even_build'));
  check('no push for a build the contractor watched', logLines('push ').length===0);

  console.log('\n=== Walk away: the page closes mid-build ===');
  await api('POST','/api/push/subscribe',{subscription:{endpoint:'https://push.example/device-1',keys:{p256dh:'BPk'.padEnd(87,'x'),auth:'auth-key-123456'}},lang:'en'},PRO_H);
  await api('POST','/api/push/subscribe',{subscription:{endpoint:'https://push.example/gone-device',keys:{p256dh:'BPk'.padEnd(87,'y'),auth:'auth-key-654321'}},lang:'en'},PRO_H);
  const ctrl=new AbortController();
  r=await fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:H({'x-even-cache':'1',...PRO_H}),body:JSON.stringify({...reqFor('Rivera kitchen SLOW_STREAM: new sink and disposal'),even_build:bgIn('Rivera kitchen')}),signal:ctrl.signal});
  const idB=r.headers.get('x-even-build-id'), keyB=r.headers.get('x-even-cache-key');
  ctrl.abort();
  check('right after closing, the build is still building', build(idB)?.status==='building', build(idB)?.status);
  const b=await waitBuild(idB);
  check('it finishes on the server anyway and is kept as ready', b&&b.status==='ready'&&b.client_gone===true, JSON.stringify(b&&{s:b.status,g:b.client_gone}));
  // Reopen: the same inputs built in-page (served from the cache, same answer).
  const rB=await fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:H({'x-even-cache':'1',...PRO_H}),body:JSON.stringify(reqFor('Rivera kitchen SLOW_STREAM: new sink and disposal'))});
  const textB=(await rB.json()).content[0].text, inPageB=pagePrice(textB,keyB);
  check(`reopened job is identical to the same inputs built in-page: $${b&&b.result.totalBid} = $${inPageB.totalBid}`, b&&b.result.totalBid===inPageB.totalBid&&JSON.stringify(b.result.lineItems)===JSON.stringify(inPageB.lineItems)&&b.result.lineItems.length===inPageB.lineItems.length);
  await sleep(300);
  const pushes=logLines('push ').map(l=>JSON.parse(l.slice(5)));
  check('a push went to the device, with the spec\'s words and a link to the job', pushes.length===1&&pushes[0].body.body==='Your estimate for Rivera kitchen is ready.'&&pushes[0].body.url===`/?build=${idB}`, JSON.stringify(pushes));
  check('a dead device (410) is removed, the live one kept', (db().__push_subscriptions||[]).map(s=>s.endpoint).join()==='https://push.example/device-1');
  const mails=logLines('email ').map(l=>JSON.parse(l.slice(6)));
  check('email (switched on in this test) carries the same words', mails.length===1&&mails[0].subject==='Your estimate for Rivera kitchen is ready.'&&mails[0].to[0]==='pro@example.com'&&mails[0].text.includes(`https://even-os.com/?build=${idB}`), JSON.stringify(mails));
  check('notified once, marked', !!build(idB).notified_at);

  console.log('\n=== Coming back ===');
  let lst=await api('GET','/api/builds',null,PRO_H);
  const item=(lst.body.builds||[]).find(x=>x.id===idB);
  check('the list shows the ready job with its total', item&&item.status==='ready'&&item.total===b.result.totalBid&&item.clientGone===true, JSON.stringify(item));
  const one=await api('GET',`/api/builds/${idB}`,null,PRO_H);
  check('opening it returns the priced result and what the screens need', one.status===200&&one.body.build.result.totalBid===b.result.totalBid&&one.body.build.meta.fields.client==='Garcia', one.status);
  check('another account cannot read it', (await api('GET',`/api/builds/${idB}`,null,FREE_H)).status===404);
  check('signed out cannot list builds', (await api('GET','/api/builds')).status===401);
  await api('POST',`/api/builds/${idB}/opened`,null,PRO_H);
  lst=await api('GET','/api/builds',null,PRO_H);
  check('once opened it leaves the list', !(lst.body.builds||[]).some(x=>x.id===idB));

  console.log('\n=== A build that fails, then Try again ===');
  r=await fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:H({'x-even-cache':'1',...PRO_H}),body:JSON.stringify({...reqFor('Lopez laundry FAIL_ONCE: move the washer box'),even_build:bgIn('Lopez laundry','es')})});
  const idC=r.headers.get('x-even-build-id'); await r.text();
  const c=await waitBuild(idC);
  check('a cut-off answer marks the build failed (not ready, nothing priced)', c&&c.status==='failed'&&!c.result, JSON.stringify(c&&{s:c.status,e:c.error}));
  lst=await api('GET','/api/builds',null,PRO_H);
  check('the list shows it as failed (the page offers Try again)', (lst.body.builds||[]).some(x=>x.id===idC&&x.status==='failed'));
  const retry=await api('POST',`/api/builds/${idC}/retry`,null,PRO_H);
  check('Try again starts it on the server', retry.status===200&&retry.body.status==='building', JSON.stringify(retry));
  const c2=await waitBuild(idC);
  check('the retry finishes ready', c2&&c2.status==='ready'&&c2.result&&c2.result.totalBid>0, JSON.stringify(c2&&{s:c2.status,e:c2.error}));
  const esPush=logLines('push ').map(l=>JSON.parse(l.slice(5))).pop();
  check('Spanish build: the push is in Spanish', esPush&&esPush.body.body==='Tu estimado para Lopez laundry está listo.', JSON.stringify(esPush));
  check('another account cannot retry it', (await api('POST',`/api/builds/${idC}/retry`,null,FREE_H)).status===404);

  console.log('\n=== Free accounts count exactly like a normal estimate ===');
  const before=db().__users[FREE].estimate_count||0;
  r=await fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:H({'x-even-cache':'1',...FREE_H,'x-even-device':'dev-walk-free-0000000002','x-forwarded-for':'203.0.113.99'}),body:JSON.stringify({...reqFor('Free account job: fix a leaking hose bib'),even_build:bgIn('Hose bib')})});
  const idF=r.headers.get('x-even-build-id'); await r.text(); await waitBuild(idF); await sleep(200);
  check('a free account build counts once', (db().__users[FREE].estimate_count||0)===before+1, `${before} -> ${db().__users[FREE].estimate_count}`);

  console.log('\n=== Push setup ===');
  const cfg=await api('GET','/api/push/config');
  check('the page gets the public key (never the private one)', cfg.body.enabled===true&&cfg.body.publicKey===vapid.publicKey&&!JSON.stringify(cfg.body).includes(vapid.privateKey));
  check('signed out cannot subscribe', (await api('POST','/api/push/subscribe',{subscription:{endpoint:'https://push.example/x',keys:{p256dh:'a',auth:'b'}}})).status===401);
  check('a bad subscription is refused', (await api('POST','/api/push/subscribe',{subscription:{endpoint:'http://insecure',keys:{}}},PRO_H)).status===400);
  const hl=await (await fetch(`http://localhost:${port}/health`)).json();
  check('/health shows push and build email as yes/no only', hl.push.on===true&&hl.push.vapidPublic===true&&hl.email.buildEmailOn===true&&!JSON.stringify(hl).includes(vapid.publicKey));
  }finally{ srv.kill(); }

  console.log('\n=== Messages, switches, page wiring ===');
  const N=require('../lib/notify');
  const m=[N.buildMessage(true,'Garcia bath','en'),N.buildMessage(true,'Garcia bath','es'),N.buildMessage(false,'Garcia bath','en'),N.buildMessage(false,'Garcia bath','es')].map(x=>x.body);
  check('the four messages are the spec\'s exact words', m[0]==='Your estimate for Garcia bath is ready.'&&m[1]==='Tu estimado para Garcia bath está listo.'&&m[2]==="We couldn't finish Garcia bath. Tap to try again."&&m[3]==='No pudimos terminar Garcia bath. Toca para intentar de nuevo.', JSON.stringify(m));
  for(const k of ['PUSH_ENABLED','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','BUILD_EMAIL_ENABLED']) delete process.env[k];
  check('switches off by default: no push, no email', N.pushOn()===false&&N.emailOn()===false&&(await N.pushToUser({userId:PRO,payload:{},sbRest:async()=>({data:[{endpoint:'x'}]})})).reason==='off');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const fnBody=n=>{const s=html.indexOf(`function ${n}(`);return html.slice(s,html.indexOf('\n}',s));};
  check('permission is asked only from the "Get a ping" button, never on load', (html.match(/requestPermission\(/g)||[]).length===1&&fnBody('enablePush').includes('requestPermission(')&&fnBody('openBuild').includes('if(b.clientGone) maybeAskPush()'));
  check('the ask appears only after a build that finished while away (openBuild of a client-gone build)', (html.match(/maybeAskPush\(\)(?!\{)/g)||[]).length===1);
  check('iPhone hint: iPhone + Safari + not Home Screen only', /iOS&&safari&&!standalone/.test(fnBody('isIphoneSafariTab'))&&/CriOS\|FxiOS/.test(fnBody('isIphoneSafariTab')));
  check('signed out sees "Sign in and Even keeps building even if you leave." (EN/ES)', html.includes('data-en="Sign in and Even keeps building even if you leave." data-es="Inicia sesión y Even sigue construyendo aunque salgas."'));
  check('the page sends the build only when signed in', /const bgBuild=currentUser\?bgBuildPayload\(/.test(html));
  check('the page and the server price with the same settings object', /const data=priceScope\(scoped,catalog,priceOpts\);/.test(html));
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  check('service worker only shows notifications (no fetch caching)', /addEventListener\('push'/.test(sw)&&!/addEventListener\('fetch'/.test(sw));
  const tracked=require('child_process').execFileSync('git',['ls-files'],{cwd:root}).toString().split('\n').filter(f=>/\.(js|json|html|toml|md|yml)$/.test(f));
  const leak=tracked.filter(f=>{try{return /VAPID_PRIVATE_KEY\s*[=:]\s*['"]?[A-Za-z0-9_-]{40,}/.test(fs.readFileSync(path.join(root,f),'utf8'));}catch(e){return false;}});
  check('no VAPID private key in the repo', leak.length===0, leak.join());
  const ui=[...html.matchAll(/(?:es\?|data-e[ns]=)['"`][^'"`]*/g)].map(x=>x[0]).filter(x=>/Even sigue construyendo|keeps building|Get a ping|Te avisamos|Home Screen|pantalla de inicio/.test(x));
  check('no em dashes in the new words', ui.length>0&&!ui.some(x=>x.includes('—')), ui.filter(x=>x.includes('—')).join(' | '));
  fs.rmSync(dir,{recursive:true,force:true});
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
