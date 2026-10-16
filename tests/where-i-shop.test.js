// "Where I shop" + the partner price rule (DECIDED founder 2026-10-14), end to
// end against the real server.js (Anthropic and Supabase mocked).
// Rule: a partner supply house's prices are used ONLY in estimates of PAID
// contractors who picked that supplier, labeled with its name. Never in the
// general price list, never for free or signed-out users, never for a Pro who
// picked a different supplier. Enforced on the server: partner_prices is read
// only by partnerRowsFor(), and /api/market-data never includes it.
// The material list itself (phase A) is checked in the browser run
// tests/acceptance/where-i-shop-2026-10-17.js.
const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const {loadPipeline}=require('../lib/pipeline');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const root=path.join(__dirname,'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'even-shop-'));
const DB=path.join(dir,'db.json'),LOG=path.join(dir,'log.txt');fs.writeFileSync(LOG,'');
const FREE='11111111-1111-1111-1111-111111111111', PRO='22222222-2222-2222-2222-222222222222', PRO2='33333333-3333-3333-3333-333333333333';
const base={oh:12,profit:22,cushion:8,laborMult:2.2,lang:'en'};
const ITEM='Partner Test Water Heater 50 Gal XYZ-123', PRICE=777.77;
fs.writeFileSync(DB,JSON.stringify({
  __users:{
    [FREE]:{estimate_count:0,is_pro:false,email:'free@example.com',prefs:{...base,shops:[{id:'V019',name:'84 Lumber',primary:true}]}},
    [PRO]:{estimate_count:0,is_pro:true,email:'pro@example.com',prefs:{...base,shops:[{id:'V019',name:'84 Lumber',primary:true}]}},
    [PRO2]:{estimate_count:0,is_pro:true,email:'pro2@example.com',prefs:{...base,shops:[{id:'V020',name:'Express Roofing Supply Corp.',primary:true},{id:null,name:'My cousin\'s yard'}]}}
  },
  __suppliers:[{id:'V019',name:'84 Lumber',is_partner:true,active:true},{id:'V020',name:'Express Roofing Supply Corp.',is_partner:false,active:true}],
  __partner_prices:[{supplier_id:'V019',market:'Broward',category:'Plumbing - Water Heaters',item:ITEM,unit:'ea',price:PRICE,source:'84 Lumber contractor price sheet',date:'2026-10-15'}],
  __contractor_pages:[
    {user_id:FREE,slug:'free-co',company:'Free Co',trades:['Plumbing'],active:true},
    {user_id:PRO,slug:'pro-co',company:'Pro Co',trades:['Plumbing'],active:true},
    {user_id:PRO2,slug:'pro2-co',company:'Pro Two',trades:['Plumbing'],active:true}]
}));
const port=40500+Math.floor(Math.random()*300);
const start=()=>new Promise((res,rej)=>{
  const p=spawn(process.execPath,[path.join(__dirname,'helpers','scope-cache-server.js')],{env:{...process.env,PORT:String(port),FAKE_DB:DB,FAKE_LOG:LOG,RATE_LIMIT_SCALE:'5'},stdio:['ignore','pipe','pipe']});
  p.stdout.on('data',d=>{if(/running on port/.test(d)) res(p);}); p.stderr.on('data',()=>{}); p.on('exit',c=>rej(new Error('server exited '+c)));
});
const db=()=>JSON.parse(fs.readFileSync(DB,'utf8')||'{}');
let ipN=10;
const H=(tok)=>({'content-type':'application/json',origin:'https://even-os.com','x-forwarded-for':'203.0.113.'+(ipN++),'user-agent':'Mozilla/5.0 Test',...(tok?{authorization:'Bearer '+tok}:{})});
const get=async(p,tok)=>{const r=await fetch(`http://localhost:${port}${p}`,{headers:H(tok)});return {status:r.status,body:await r.json().catch(()=>({}))};};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitDraft=async(name,ms=8000)=>{const t=Date.now();while(Date.now()-t<ms){const r=(db().__quote_requests||[]).find(x=>x.name===name);if(r&&!['pending','building'].includes(r.draft_status)) return r;await sleep(100);}return (db().__quote_requests||[]).find(x=>x.name===name);};

(async()=>{
  const srv=await start();
  try{
  console.log('\n=== who gets partner prices (server) ===');
  const L='/api/partner-prices?location=Fort%20Lauderdale';
  let r=await get(L);
  check('signed out: refused (401)', r.status===401, JSON.stringify(r));
  r=await get(L,'tok-free');
  check('free account that picked the partner: no rows', r.status===200&&r.body.rows.length===0&&r.body.reason==='not_pro', JSON.stringify(r.body));
  r=await get(L,'tok-pro2');
  check('Pro that picked a different supplier: no rows', r.status===200&&r.body.rows.length===0, JSON.stringify(r.body));
  r=await get(L,'tok-pro');
  check("Pro that picked the partner: the partner's rows, with its name", r.status===200&&r.body.rows.length===1&&r.body.rows[0].supplier==='84 Lumber'&&r.body.rows[0].price===PRICE, JSON.stringify(r.body));
  r=await get('/api/partner-prices?location=Miami','tok-pro');
  check('Pro + partner, but another market: no rows (prices are per market)', r.body.rows.length===0, JSON.stringify(r.body));
  r=await get('/api/market-data?location=Fort%20Lauderdale');
  check('the general price list (market data) never carries partner rows', r.status===200&&Array.isArray(r.body.materials)&&r.body.materials.length>0&&!JSON.stringify(r.body).includes(ITEM)&&!JSON.stringify(r.body).includes(String(PRICE)));

  console.log('\n=== the same rule inside quote-link drafts (server-built estimates) ===');
  const job=(slug,name)=>({slug,name,phone:'954-555-0100',city:'Fort Lauderdale',trade:'Plumbing',description:'Replace a 50 gallon water heater in the garage.',lang:'en'});
  for(const [slug,name] of [['pro-co','A Pro X'],['free-co','A Free X'],['pro2-co','A Pro Y']]){
    const x=await fetch(`http://localhost:${port}/api/quote-request`,{method:'POST',headers:H(),body:JSON.stringify(job(slug,name))});
    check(`request to ${slug} accepted`, x.status===200);
  }
  const dx=await waitDraft('A Pro X'), df=await waitDraft('A Free X'), dy=await waitDraft('A Pro Y');
  const line=dx&&dx.draft&&dx.draft.estimate.lineItems.find(l=>l.priced==='partner');
  check("Pro who picked 84 Lumber: draft priced from 84 Lumber's sheet", line&&line.unitCost===PRICE&&line.supplier==='84 Lumber'&&/\(84 Lumber\)/.test(line.description)&&line.priceDate==='2026-10-15', JSON.stringify(line));
  check('that line carries waste like any material (counted item: none)', line&&line.qty===10, line&&line.qty);
  for(const [who,d] of [['free account who picked 84 Lumber',df],['Pro who picked a different supplier',dy]]){
    const j=JSON.stringify(d&&d.draft);
    check(`${who}: draft built, no 84 Lumber price or item anywhere in it`, d&&d.draft_status==='ready'&&!j.includes(ITEM)&&!j.includes(String(PRICE))&&!j.includes('"partner"'), d&&d.draft_status);
  }

  console.log('\n=== the pricing engine (index.html code) ===');
  const P=loadPipeline();
  const batch=JSON.parse(fs.readFileSync(path.join(root,'data/batches/even_master_batch.json'),'utf8'));
  const md={...batch.find(m=>m.market==='Broward')};
  const partner=[{supplier_id:'V019',supplier:'84 Lumber',category:'Plumbing - Water Heaters',item:ITEM,unit:'ea',price:PRICE,source:'84 Lumber sheet',date:'2026-10-15'}];
  const withP=P.buildCatalog(md,new Set(['Plumbing']),{partner}), without=P.buildCatalog(md,new Set(['Plumbing']),{});
  check('partner rows become H# refs, kept apart from the M# catalog', withP.partner.length===1&&withP.byRef.H1&&!withP.materials.some(e=>e.row.item===ITEM));
  check('the model sees the partner item by name only (no price)', P.catalogPromptText(withP).includes(`H1 [Plumbing - Water Heaters] ${ITEM} | ea (84 Lumber)`)&&!P.catalogPromptText(withP).includes('777.77'));
  check('without partner rows the prompt is exactly what it was (same stored scopes)', P.catalogPromptText(without)===P.catalogPromptText(P.buildCatalog(md,new Set(['Plumbing']),{partner:[]}))&&!P.catalogPromptText(without).includes('SUPPLY HOUSE PRICE SHEET'));
  const scope={lineItems:[{type:'material',ref:'H1',qty:1}]};
  const s={marketAdj:1.12,laborMult:2.2,oh:12,profit:22,cushion:8,sqft:0,hvhz:true,lang:'en'};
  const priced=P.priceScope(scope,withP,s);
  check("priced at the supply house's number (no market level or HVHZ uplift on top)", priced.lineItems[0].unitCost===PRICE&&priced.lineItems[0].priced==='partner', JSON.stringify(priced.lineItems[0]));
  const unpriced=P.priceScope(scope,without,s);
  check('a free / other-supplier catalog cannot price that ref at all', !unpriced.lineItems.length);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  check('estimate screen labels it "Priced from [supplier] sheet, [date]" (EN/ES)', /Priced from \$\{item\.supplier\} sheet/.test(html)&&/Precio de la lista de \$\{item\.supplier\}/.test(html));
  check('the app only asks for partner rows when Pro and signed in', /if\(!isPro\|\|!currentUser\|\|!\(window\._myShops\|\|\[\]\)\.some\(x=>x&&x\.id\)\) return \[\];/.test(html));
  check('partner_prices is read in exactly one place on the server', (fs.readFileSync(path.join(root,'server.js'),'utf8').match(/partner_prices\?/g)||[]).length===1);
  }finally{ srv.kill(); }
  console.log(`\n──────────────\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
