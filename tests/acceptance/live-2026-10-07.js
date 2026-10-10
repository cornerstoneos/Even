// LIVE acceptance on even-os.com (real model, real server), founder ES bugs 2026-10-07.
// One run = fresh browser (new device), type the job, answer every question with its
// first option, build, then generate both PDFs in the page. Reports total, direct
// costs, permit lines, the scope cache headers, English found (ES runs) and whether
// any model reasoning appeared on screen.
// Usage: node tests/acceptance/live-2026-10-07.js <outDir> <lang> <trade> "<city>" "<scope>" <label>
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs'),{execFileSync}=require('child_process');
const [out,LANG,TRADE,CITY,SCOPE,LABEL]=process.argv.slice(2);
const EN_WORDS=new Set(['the','and','of','for','with','your','you','to','is','are','this','that','what','how','scope','estimate','estimated','labor','materials','material','permit','permits','included','include','not','only','client','proposal','cost','sheet','price','range','bid','optional','override','location','swap','relocate','same','yes','unsure','sure','need','needs','upgrade','upgrading','overhead','underground','service','brand','preference','obtained','already','pull','identified','items','item','sets','sees','stays','dashboard','unlimited','more','jobs','week','go','profit','cushion','margin','assumptions','exclusions','notes','disposal','utility','haul','away','old','new','install','remove','helper','hours','hour','each','waste','data','our','in','on','at','by','from','or','be','will','per','day','days','month','free','sign','save','download','copy','send','print','phone','email','license','company','business','job','address','name','note','schedule','payment','deposit','completion','due','valid','signature','date','accepted','prepared','contractor','owner','work','other','details','detail','back','edit','answers','start','over','build','analyze','electrical','electricians','helpers','building','minimum','fee','trade','city','market','local','wage','rates','rate','default','multiplier','works','means','lump','sum','live','preview','breakdown','tracker','variance','actual','summary','refine','meter','existing','wire','wiring','breaker','panel?','main','ground','grounding','circuit','circuits','replace','replacement','new','outdoor','indoor','garage','wall','closet','straight','handles','water','heater','gallon','tank','line','lines','drain','valve','supply','connect','fitting','fittings','copper','pipe','pipes','kit','strap','straps','pan','expansion','vent','gas','electric','test']);
const ALLOWED=/\b(NEMA\s*3R|THHN|THWN|Square\s*D|QO|HOM|FPL|PEX-?[ab]?|PVC|CPVC|AWG|GFCI|AFCI|HVHZ|NOA|Siemens|Eaton|Cutler-Hammer|Leviton|Southwire|Rheem|A\.?\s?O\.?\s?Smith|Bradford White|SharkBite|Watts|Aventura|Margate|Tequesta|Even|EI|PDF|Pro|USD|Premium|HVAC|BLS|OS|ventas@[\w.]+|[\w.]+@[\w.]+)\b/gi;
function englishHits(text){const hits=[];for(const line of text.split(/\n+/)){const l=line.replace(ALLOWED,' ');const w=(l.toLowerCase().match(/[a-záéíóúñü?]+/g)||[]).filter(x=>EN_WORDS.has(x));if(w.length) hits.push(`[${[...new Set(w)].join(',')}] ${line.trim().slice(0,170)}`);}return hits;}
const REASON_RE=/\bI'll\b|\bI will\b|\bLet me\b|\bP\d+ is\b|\bthe catalog\b|\bref(s)? [LMP]\d|\bL\d+ |\bM\d+\b/;
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch();
  // Own browser identity per run: the free-limit backup counts IP + browser, and earlier
  // runs from this machine used it up. The per-IP daily cap still applies.
  const ctx=await browser.newContext({viewport:{width:390,height:844},userAgent:`Mozilla/5.0 (EvenAcceptance ${LABEL}-${Date.now()}) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36`}); const page=await ctx.newPage();
  const R={label:LABEL,lang:LANG,trade:TRADE,city:CITY,cache:[],reasoning:[],english:{}};
  page.on('pageerror',e=>console.log('pageerror',e.message));
  await page.route('**/*',async r=>{const req=r.request(),u=req.url();
    try{const h={...req.headers()};delete h['accept-encoding'];const resp=await fetch(u,{method:req.method(),headers:h,body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer()});
      if(u.includes('/api/estimate')){const kind=JSON.parse(req.postData()||'{}').even_kind;R.cache.push({kind,status:resp.status,body:resp.status>=400?(await resp.clone().text()).slice(0,300):undefined,cache:resp.headers.get('x-even-cache'),key:(resp.headers.get('x-even-cache-key')||'').slice(0,8)});}
      const b=Buffer.from(await resp.arrayBuffer());const rh={};resp.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k))rh[k]=v;});await r.fulfill({status:resp.status,headers:rh,body:b});}catch(e){await r.abort().catch(()=>{});}});
  await page.goto('https://even-os.com/',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(3500);
  R.deployOk=await page.evaluate(()=>document.documentElement.innerHTML.includes('Leyendo la lista de precios'));
  const text=()=>page.evaluate(()=>document.body.innerText);
  const snap=async step=>{const t=await text();fs.writeFileSync(`${out}/${step}.txt`,t);await page.screenshot({path:`${out}/${step}.png`,fullPage:true});if(LANG==='es')R.english[step]=englishHits(t);};
  if(LANG==='es') await page.evaluate(()=>{const b=[...document.querySelectorAll('.lang-btn')].find(x=>x.textContent.trim()==='ES');setLang('es',b);});
  await page.selectOption('#est-trade',TRADE);
  await page.fill('#est-location',CITY);
  await page.fill('#scope-text',SCOPE);
  await snap('1-input');
  await page.click('#gen-btn');
  try{ await page.waitForSelector('.q-chip',{timeout:120000}); }
  catch(e){ await snap('2-refine-FAILED'); console.log('STUCK:',(await text()).slice(0,1500),'\nAPI:',JSON.stringify(R.cache)); throw e; }
  await page.waitForTimeout(800);
  await snap('2-refine');
  R.questions=await page.evaluate(()=>(window._allQuestions||[]).map(q=>q.question+' -> '+(q.options||[])[0]));
  const nq=await page.locator('.q-block').count();
  for(let i=0;i<nq;i++){ await page.locator(`#qchips-${i} .q-chip`).first().click(); await page.waitForTimeout(200); }
  await page.waitForTimeout(700);
  const t0=Date.now();
  await page.click('#calc-btn');
  for(let i=0;i<600;i++){
    const t=await page.evaluate(()=>{const a=document.getElementById('loading-step-text'),b=document.getElementById('loading-live-items');return (a?a.innerText:'')+' || '+(b?b.innerText:'');});
    if(REASON_RE.test(t)) R.reasoning.push(t.slice(0,200));
    if(i===20) await snap('3-loading');
    if(await page.locator('#s-estimate.active').count()) break;
    await page.waitForTimeout(250);
  }
  await page.waitForSelector('#s-estimate.active',{timeout:180000}); R.seconds=Math.round((Date.now()-t0)/100)/10; await page.waitForTimeout(2000);
  await snap('4-estimate');
  Object.assign(R,await page.evaluate(()=>({total:currentEstimate.totalBid,direct:currentEstimate.subtotal,
    lines:currentEstimate.lineItems.map(l=>`${l.category} | ${l.description} | ${l.qty} ${l.unit} x ${l.unitCost} = ${l.total}${l.ref?' ['+l.ref+']':''}`),
    permits:currentEstimate.lineItems.filter(l=>l.category==='Permits').map(l=>({desc:l.description,row:l.permitRow&&l.permitRow.municipality+' / '+l.permitRow.work_type,total:l.total})),
    scopeKey:currentEstimate.scopeKey})));
  // PDFs are built in the page; sign-in is only the download gate, so a stand-in user is set here.
  for(const kind of ['internal','proposal']){
    const b64=await page.evaluate(async kind=>{currentUser=currentUser||{id:'acceptance',email:'ventas@acmeelectric.com'};
      localStorage.setItem('even_biz',JSON.stringify({company:'Acme Electric LLC',phone:'(305) 555-0100',email:'ventas@acmeelectric.com',license:'EC13001234'}));
      let got=null;const orig=window.savePDF;window.savePDF=d=>{got=d.output('datauristring').split(',')[1];};
      if(kind==='internal') await downloadCostSheet(); else {const doc=await buildClientProposalPDF((window.jspdf||{}).jsPDF);got=doc.output('datauristring').split(',')[1];}
      window.savePDF=orig;return got;},kind);
    const f=`${out}/${kind}.pdf`;fs.writeFileSync(f,Buffer.from(b64,'base64'));
    const t=execFileSync('pdftotext',['-layout',f,'-']).toString();fs.writeFileSync(f.replace('.pdf','.txt'),t);
    if(LANG==='es') R.english['pdf-'+kind]=englishHits(t);
    if(REASON_RE.test(t)) R.reasoning.push('pdf '+kind);
  }
  await browser.close();
  fs.writeFileSync(`${out}/report.json`,JSON.stringify(R,null,2));
  console.log(JSON.stringify(R,null,2));
})().catch(e=>{console.error(e);process.exit(1);});
