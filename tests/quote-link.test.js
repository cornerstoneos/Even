// Quote-request link (quote engine phase B), end to end against the real
// server.js with Anthropic and Supabase mocked (helpers/scope-cache-server.js).
// Acceptance (tasks/app.md): (1) a request on a test slug creates a row and a
// draft priced exactly like the same job typed in by hand; (3) the homeowner page
// shows no prices; (4) the inbox can open it (draft carries what the estimate
// screen needs); (5) 10 rapid posts from one IP are throttled; (6) EN/ES, no em
// dashes. RLS (2) is checked live in Postgres (see tasks/app.md for the run).
const fs=require('fs'),os=require('os'),path=require('path'),{spawn,execFileSync}=require('child_process');
const {loadPipeline}=require('../lib/pipeline');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const root=path.join(__dirname,'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'even-quote-'));
const DB=path.join(dir,'db.json'),LOG=path.join(dir,'log.txt');fs.writeFileSync(LOG,'');
const FREE='11111111-1111-1111-1111-111111111111', PRO='22222222-2222-2222-2222-222222222222';
const PREFS={oh:15,profit:20,cushion:6,laborMult:2.0,marketAdj:'standard',lang:'en',laborType:'own',bidType:'fixed'};
fs.writeFileSync(DB,JSON.stringify({
  __users:{[FREE]:{estimate_count:0,is_pro:false,email:'free@example.com',prefs:PREFS},[PRO]:{estimate_count:0,is_pro:true,email:'pro@example.com',prefs:{...PREFS,lang:'es'}}},
  __contractor_pages:[]
}));
const port=40100+Math.floor(Math.random()*300);
const start=()=>new Promise((res,rej)=>{
  const p=spawn(process.execPath,[path.join(__dirname,'helpers','scope-cache-server.js')],{env:{...process.env,PORT:String(port),FAKE_DB:DB,FAKE_LOG:LOG,RATE_LIMIT_SCALE:'1'},stdio:['ignore','pipe','pipe']});
  p.stdout.on('data',d=>{if(/running on port/.test(d)) res(p);}); p.stderr.on('data',()=>{}); p.on('exit',c=>rej(new Error('server exited '+c)));
});
const db=()=>JSON.parse(fs.readFileSync(DB,'utf8')||'{}');
const calls=()=>fs.readFileSync(LOG,'utf8').split('\n').filter(x=>x==='anthropic').length;
const APP='https://even-os.com';
const H=(ip,extra={})=>({'content-type':'application/json',origin:APP,'x-forwarded-for':ip,'user-agent':'Mozilla/5.0 Test','x-even-device':'dev-quote-test-000000000',...extra});
const api=async(method,p,body,ip='203.0.113.50',extra)=>{const r=await fetch(`http://localhost:${port}${p}`,{method,headers:H(ip,extra),body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json().catch(()=>({})),cache:r.headers.get('x-even-cache')};};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitDraft=async(pred,ms=8000)=>{const t=Date.now();while(Date.now()-t<ms){const r=(db().__quote_requests||[]).find(pred);if(r&&!['pending','building'].includes(r.draft_status)) return r;await sleep(100);}return (db().__quote_requests||[]).find(pred);};

(async()=>{
  const srv=await start();
  try{
  console.log('\n=== contractor sets up the link ===');
  let r=await api('PUT','/api/my-page',{slug:'test-co',trades:['Plumbing','Electrical'],company:'Test Plumbing Co',phone:'(954) 555-0100'});
  check('signed out: cannot set up a link', r.status===401, JSON.stringify(r));
  r=await api('PUT','/api/my-page',{slug:'Bad Slug!',trades:['Plumbing']},undefined,{authorization:'Bearer tok-free'});
  check('a bad slug is refused', r.status===400&&r.body.error?.code==='bad_slug', JSON.stringify(r));
  r=await api('PUT','/api/my-page',{slug:'admin',trades:['Plumbing']},undefined,{authorization:'Bearer tok-free'});
  check('a reserved slug is refused', r.status===409, JSON.stringify(r));
  r=await api('PUT','/api/my-page',{slug:'test-co',trades:['Plumbing','Electrical','Fire Sprinklers'],company:'Test Plumbing Co',phone:'(954) 555-0100'},undefined,{authorization:'Bearer tok-free'});
  check('free account saves its link', r.status===200&&r.body.page?.slug==='test-co', JSON.stringify(r));
  check('unknown trades are dropped', JSON.stringify(r.body.page?.trades)==='["Plumbing","Electrical"]', JSON.stringify(r.body.page?.trades));
  r=await api('PUT','/api/my-page',{slug:'test-co',trades:['Plumbing']},undefined,{authorization:'Bearer tok-pro'});
  check('another contractor cannot take the same slug', r.status===409&&r.body.error?.code==='slug_taken', JSON.stringify(r));
  r=await api('PUT','/api/my-page',{slug:'pro-co',trades:['Plumbing'],company:'Pro Co'},undefined,{authorization:'Bearer tok-pro'});
  check('Pro account saves its own link', r.status===200, JSON.stringify(r));
  r=await api('GET','/api/my-page',null,undefined,{authorization:'Bearer tok-free'});
  check('GET /api/my-page returns only your own page', r.body.page?.slug==='test-co'&&r.body.emailOn===false, JSON.stringify(r.body));

  console.log('\n=== (3) the public page: name, phone, trades; no prices, no ids ===');
  r=await api('GET','/api/q/test-co');
  check('public page answers', r.status===200&&r.body.company==='Test Plumbing Co'&&r.body.phone==='(954) 555-0100', JSON.stringify(r.body));
  check('no user id, no pricing data on the public page', !JSON.stringify(r.body).match(/user_id|1111|price|materials|labor|permits|\$/i), JSON.stringify(r.body));
  r=await api('GET','/api/q/nobody-here');
  check('unknown slug: 404', r.status===404);
  const q=fs.readFileSync(path.join(root,'q.html'),'utf8');
  check('homeowner page shows no dollar amounts or pricing words', !/\$\s?\d|unitCost|totalBid|priceScope|market_data/.test(q));
  check('homeowner page has English and Spanish', /Request an estimate/.test(q)&&/Pide un estimado/.test(q)&&/Powered by/.test(q)&&/Funciona con/.test(q));
  check('homeowner page has no em dashes', !q.includes('—'), (q.match(/.{30}—.{30}/)||[])[0]);
  check('homeowner page has the honeypot field', /id="f-website"/.test(q)&&/website:v\('f-website'\)/.test(q));
  check('homeowner page fits a phone (viewport, 16px inputs, no fixed widths)', /width=device-width/.test(q)&&/font:16px/.test(q)&&!/width:\s*[4-9]\d\dpx/.test(q.replace(/max-width:560px/,'')));
  const qs=[...q.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
  const tmp=path.join(dir,'q.js');fs.writeFileSync(tmp,qs);
  let syntaxOk=true;try{execFileSync(process.execPath,['--check',tmp]);}catch(e){syntaxOk=false;}
  check('homeowner page script parses', syntaxOk);
  const toml=fs.readFileSync(path.join(root,'netlify.toml'),'utf8');
  check('even-os.com/q/<slug> serves the form (Netlify rewrite)', /from = "\/q\/\*"[\s\S]*to = "\/q\.html"[\s\S]*status = 200/.test(toml));

  console.log('\n=== intake checks ===');
  const job={slug:'test-co',name:'Ana Homeowner',phone:'954-555-0199',email:'',address:'12 Palm St',city:'Fort Lauderdale',zip:'',trade:'Plumbing',description:'Replace a 40 gallon electric water heater in the garage, same spot.',lang:'en'};
  r=await api('POST','/api/quote-request',{...job,name:'',phone:''},'198.51.100.1');
  check('missing name and contact: 400 with the fields', r.status===400&&r.body.error?.fields?.includes('name')&&r.body.error?.fields?.includes('contact'), JSON.stringify(r.body));
  r=await api('POST','/api/quote-request',job,'198.51.100.1',{origin:'https://evil.example'});
  check('another website cannot post requests', r.status===403);
  const beforeHp=(db().__quote_requests||[]).length, aiHp=calls();
  r=await api('POST','/api/quote-request',{...job,website:'http://spam.example'},'198.51.100.2');
  check('honeypot filled: answers ok, stores nothing, runs nothing', r.status===200&&(db().__quote_requests||[]).length===beforeHp&&calls()===aiHp, JSON.stringify(r));

  console.log('\n=== (1) a request becomes a draft priced like the same job typed by hand ===');
  const ai0=calls();
  r=await api('POST','/api/quote-request',job,'198.51.100.3');
  check('valid request: 200 right away', r.status===200&&r.body.ok, JSON.stringify(r));
  const row=await waitDraft(x=>x.name==='Ana Homeowner');
  check('row stored for the right contractor', row&&row.user_id===FREE&&row.slug==='test-co'&&row.status==='new', JSON.stringify(row&&{u:row.user_id,s:row.status}));
  check('draft built', row&&row.draft_status==='ready'&&row.draft&&row.draft.estimate, row&&row.draft_status);
  check('two AI calls (scope + estimate), like the app', calls()===ai0+2, calls()-ai0);
  const d=row.draft, e=d.estimate;
  check("draft uses the contractor's saved settings (overhead 15, profit 20, cushion 6, labor 2.0x)", d.ctx.oh===15&&d.ctx.profit===20&&d.ctx.cushion===6&&d.ctx.laborMult===2&&e.overhead.pct===15&&e.profit.pct===20, JSON.stringify(d.ctx));
  check('free account: own labor rate never used (Pro only)', d.ctx.laborRate===null);
  check('Fort Lauderdale permits and local prices came from the city data', d.marketMeta&&d.marketMeta.municipality==='Fort Lauderdale'&&d.marketMeta.permitScope==='municipality'&&e.lineItems.some(l=>l.category==='Permits'&&/Fort Lauderdale/.test(l.description))&&e.lineItems.some(l=>l.priced==='catalog'), JSON.stringify(d.marketMeta));
  check('draft carries what the estimate screen needs (scope text, questions, job address)', d.scopeText===job.description&&Array.isArray(d.scopeData.questions)&&e.jobAddress==='12 Palm St, Fort Lauderdale');
  check('draft counted as one of the free estimates', db().__users[FREE].estimate_count===1, db().__users[FREE].estimate_count);

  // The same job typed in by hand: the app's own code builds the two requests from
  // the same inputs (questions skipped). They must hit the draft's stored scopes.
  const P=loadPipeline();
  const ctx={trade:'Plumbing',location:'Fort Lauderdale',projtype:'Residential — Single Family',sqft:'not specified',client:'',bidType:'fixed',laborType:'own',oh:15,profit:20,cushion:6,laborMult:2,laborRate:null,projectLabel:'',lang:'en'};
  const scopeBody={even_kind:'scope',max_tokens:3000,messages:[{role:'user',content:[{type:'text',text:P.scopePromptText({...ctx,scope:job.description,nDocs:0,nImages:0})}]}],output_config:{effort:'low'}};
  const ai1=calls();
  const s1=await fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:H('198.51.100.9',{'x-even-cache':'1',authorization:'Bearer tok-free'}),body:JSON.stringify(scopeBody)});
  const sj=await s1.json();
  check('hand-entered scope call: same request, served from the stored scope', s1.headers.get('x-even-cache')?.startsWith('hit')&&calls()===ai1, s1.headers.get('x-even-cache'));
  const scopeData=JSON.parse(sj.content[0].text);
  const md=await (await fetch(`http://localhost:${port}/api/market-data?location=${encodeURIComponent(ctx.location)}`)).json();
  md.materials=md.materials.filter(x=>x?.tier!=='invalid_cross_market_copy');
  const cats=P.scopeMaterialCategories(ctx.trade,scopeData.tradeBreakdown);
  const cat=P.buildCatalog(md,cats,{suppliers:undefined,subs:undefined});
  const blocks=P.estimatePromptBlocks({ctx,scope:job.description,ansText:'',tradeBreakdown:scopeData.tradeBreakdown||[],pricingBlock:P.pricingBlockFor(md,P.hvhzNoteFor(md.hvhz),cat,ctx.location),lang:'en'});
  const estBody={even_kind:'estimate',max_tokens:24000,stream:true,messages:[{role:'user',content:blocks}],output_config:{effort:'medium'},thinking:{type:'adaptive',display:'summarized'}};
  const s2=await fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:H('198.51.100.9',{'x-even-cache':'1',authorization:'Bearer tok-free'}),body:JSON.stringify(estBody)});
  const ej=await s2.json();
  check('hand-entered estimate call: same request, served from the stored scope', s2.headers.get('x-even-cache')?.startsWith('hit')&&calls()===ai1, s2.headers.get('x-even-cache'));
  const hand=P.priceScope(JSON.parse(ej.content[0].text),cat,{marketAdj:1,laborMult:2,laborRate:null,oh:15,profit:20,cushion:6,sqft:0,hvhz:md.hvhz,calibration:null,lang:'en'});
  check(`same number: draft $${e.totalBid} = typed by hand $${hand.totalBid}`, hand.totalBid===e.totalBid&&JSON.stringify(hand.lineItems)===JSON.stringify(e.lineItems), `${hand.totalBid} vs ${e.totalBid}`);
  check('re-running the same job did not count again', db().__users[FREE].estimate_count===1, db().__users[FREE].estimate_count);

  console.log('\n=== language, free limit, Pro ===');
  r=await api('POST','/api/quote-request',{...job,slug:'pro-co',name:'Luis',description:'Cambiar el calentador de agua de 40 galones en el garaje.',lang:'es'},'198.51.100.4');
  const proRow=await waitDraft(x=>x.name==='Luis');
  check("Pro contractor who works in Spanish gets a Spanish draft", proRow&&proRow.draft_status==='ready'&&proRow.draft.ctx.lang==='es'&&proRow.draft.estimate.lineItems.some(l=>/Permiso/.test(l.description))&&proRow.user_id===PRO, proRow&&proRow.draft_status);
  check('Pro drafts never touch the free count', db().__users[PRO].estimate_count===0);
  const dd=db(); dd.__users[FREE].estimate_count=5; fs.writeFileSync(DB,JSON.stringify(dd));
  r=await api('POST','/api/quote-request',{...job,name:'Out Of Credits',description:'Install a new 200 amp panel and a subpanel in the garage.'},'198.51.100.5');
  const lim=await waitDraft(x=>x.name==='Out Of Credits');
  check('free account out of estimates: request stored, draft marked limit (no AI call)', lim&&lim.draft_status==='limit'&&!lim.draft, lim&&lim.draft_status);
  r=await api('POST',`/api/quote-requests/${lim.id}/draft`,null,'198.51.100.5',{authorization:'Bearer tok-pro'});
  check("another contractor cannot rebuild someone else's request", r.status===404, JSON.stringify(r));

  console.log('\n=== (5) spam: 10 rapid posts from one IP are throttled ===');
  const codes=[];
  for(let i=0;i<10;i++){ const x=await api('POST','/api/quote-request',{...job,name:'Spam '+i},'192.0.2.77'); codes.push(x.status); }
  const okN=codes.filter(c=>c===200).length, thr=codes.filter(c=>c===429).length;
  check(`10 rapid posts: ${okN} accepted, ${thr} throttled (limit 3 a minute)`, okN===3&&thr===7, codes.join(','));
  await sleep(300);

  console.log('\n=== (6) the app side: EN/ES, no em dashes in the new text ===');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const blk=html.slice(html.indexOf('//  ESTIMATE LINK + REQUESTS'),html.indexOf('async function loadDashboard(){'));
  check('inbox and link code found', blk.length>2000);
  check('no em dashes in the inbox/link text', !blk.includes('—'), (blk.match(/.{30}—.{30}/)||[])[0]);
  for(const [en,es] of [['Your estimate link','Tu enlace de estimados'],['Requests','Solicitudes'],['OPEN DRAFT','ABRIR BORRADOR'],['BUILD IT MYSELF','ARMARLO YO'],['Link copied.','Enlace copiado.']])
    check(`EN/ES: "${en}" / "${es}"`, html.includes(en)&&html.includes(es));
  check('settings card has the slug, trades, on/off, copy and preview', ['link-slug','link-trades','link-active','copyQuoteLink()','previewQuoteLink()'].every(k=>html.includes(k)));
  check('saved margins and language travel with the account (used by drafts)', /oh: sliderVals\.oh, profit: sliderVals\.profit, cushion: sliderVals\.cushion/.test(html)&&/lang: appLang/.test(html));
  check('the inbox reads only through RLS with the signed-in session (no service key in the page)', !/service_role|SUPABASE_SERVICE/.test(html));
  }finally{ srv.kill(); }
  console.log(`\n──────────────\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
