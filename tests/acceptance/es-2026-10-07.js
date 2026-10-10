// Browser check (Playwright), not part of tests/run.sh: founder ES bugs 2026-10-07.
// Runs the Aventura 100A->200A panel job through the whole flow (type, analyze,
// answer, build, both PDFs) with the model mocked to answer in the requested
// language and real market data from the live server, then scans the screen at
// every step and both PDFs for English (ES run) and for model reasoning (both).
// Usage: node tests/acceptance/es-2026-10-07.js index.html <outDir> [es|en]
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs'),{execFileSync}=require('child_process');
const [htmlPath,out,langArg]=process.argv.slice(2);
const html=fs.readFileSync(htmlPath,'utf8');
const LANG=langArg||'es';
const REASONING='For the permit, since there is no dedicated electrical-only permit row available (P9 is add-on only), I will use P1 building permit minimum fee and size the hours.';
const API='https://even-production.up.railway.app';

const SCOPE={
  es:{projectName:'Cambio de panel de 100A a 200A',tradeBreakdown:[{trade:'Electricidad',icon:'⚡',items:['Retirar panel existente de 100A','Instalar panel nuevo de 200A','Conectar circuitos existentes']}],keyFacts:['Casa unifamiliar en Aventura','Servicio de 200A'],
    questions:[{id:'q1',question:'¿Dónde está el panel?',options:['Garaje interior','Pared exterior','Closet de servicio']},{id:'q2',question:'¿Es un cambio en el mismo lugar o hay que reubicarlo?',options:['Mismo lugar','Reubicar el panel']},{id:'q3',question:'¿Incluye permiso e inspección?',options:['Sí, incluir permiso','No, el dueño lo maneja','No estoy seguro']}]},
  en:{projectName:'100A to 200A panel upgrade',tradeBreakdown:[{trade:'Electrical',icon:'⚡',items:['Remove existing 100A panel','Install new 200A panel','Reconnect existing circuits']}],keyFacts:['Single family home in Aventura','200A service'],
    questions:[{id:'q1',question:'Panel location?',options:['Indoor garage','Outdoor exterior wall','Utility closet']},{id:'q2',question:'Is this a straight swap or relocation?',options:['Same location','Relocate panel']},{id:'q3',question:'Permit and inspection included?',options:['Yes, include permit','No, owner handles','Unsure']}]}
};
function estimateJSON(prompt,lang){
  const ref=re=>{const m=prompt.match(re);return m?m[1]:null;};
  const es=lang==='es';
  const permit=ref(/^(P\d+) Aventura — Electrical Permit/m);
  const elec=ref(/^(L\d+) Electricians/m);
  const helper=ref(/^(L\d+) Helpers--Electricians/m);
  const mats=[...prompt.matchAll(/^(M\d+) \[Electrical[^\]]*\] ([^|\n]*(Load Center|Breaker|THHN|Wire|Conduit)[^|\n]*)/gmi)].slice(0,3).map(m=>m[1]);
  const li=[
    ...mats.map((r,i)=>({type:'material',ref:r,qty:i===2?30:1,description:es?['Centro de carga nuevo de 200A','Breaker principal de 200A','Cable THHN para la acometida'][i]:['New 200A load center','200A main breaker','THHN service wire'][i]})),
    elec&&{type:'labor',ref:elec,hours:10,description:es?'Retirar el panel viejo, instalar el nuevo y reconectar los circuitos':'Remove old panel, install new one and reconnect circuits'},
    helper&&{type:'labor',ref:helper,hours:6,description:es?'Ayudante para la instalación':'Helper for the install'},
    permit&&{type:'permit',ref:permit,qty:0,description:es?'Permiso eléctrico':'Electrical permit'},
    {type:'other',category:'Disposal',description:es?'Retiro del panel viejo':'Haul away old panel',qty:1,unit:'ea',unitCost:60},
    {type:'other',category:'Utility',description:es?'Coordinación del corte y reconexión con FPL':'FPL disconnect and reconnect coordination',qty:1,unit:'ea',unitCost:150}
  ].filter(Boolean);
  return JSON.stringify({projectName:SCOPE[lang].projectName,lineItems:li,
    assumptions:es?['El panel se instala en el mismo lugar.','El cableado existente está en buen estado.']:['Panel stays in the same location.','Existing wiring is in good shape.'],
    exclusions:es?['Reparación de paredes o pintura.','Trabajo de FPL en el medidor.']:['Wall repair or paint.','FPL meter work.'],estimatedDays:es?'2-3 días':'2-3 days'});
}
const sse=(evts)=>evts.map(e=>`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');

// English that must not appear in ES. Allowed: brand, product and model names (NEMA 3R, THHN, Square D...).
const EN_WORDS=['the','and','of','for','with','your','you','to','is','are','this','that','what','how','scope','estimate','estimated','labor','materials','material','permit','permits','included','include','not','only','client','proposal','cost','sheet','price','range','bid','optional','override','location','swap','relocate','same','yes','unsure','sure','need','needs','upgrade','upgrading','overhead','underground','service','brand','preference','obtained','already','pull','identified','items','item','sets','sees','stays','dashboard','unlimited','more','jobs','week','go','profit','cushion','margin','assumptions','exclusions','notes','disposal','utility','haul','away','old','new','install','remove','helper','hours','hour','each','waste','data','our','in','on','at','by','from','or','be','will','per','day','days','month','free','sign','save','download','copy','send','print','phone','email','license','company','business','job','address','name','note','schedule','payment','deposit','completion','due','valid','signature','date','accepted','prepared','contractor','owner','scope','work','other','details','detail','back','edit','answers','start','over','build','analyze','electrical','electricians','helpers','building','minimum','fee','trade','city','market','local','wage','rates','rate','default','multiplier','how','it','works','means','lump','sum','live','preview','breakdown','powered','tracker','variance','actual','summary'];
const ALLOWED=/\b(NEMA\s*3R|THHN|Square\s*D|FPL|PEX-?b?|PVC|AWG|GFCI|AFCI|HVHZ|NOA|Siemens|Eaton|Cutler-Hammer|Leviton|Southwire|Aventura|Even|EI|PDF|Pro|USD|Premium|HVAC)\b/g;
function englishHits(text){
  const hits=[];
  for(const line of text.split(/\n+/)){
    const l=line.replace(ALLOWED,' ');
    const words=l.toLowerCase().match(/[a-záéíóúñü]+/g)||[];
    const en=words.filter(w=>EN_WORDS.includes(w));
    // "no", "a", "es", "de" are Spanish too and not in the list; flag a line on 1+ English word.
    if(en.length) hits.push(`[${[...new Set(en)].join(',')}] ${line.trim().slice(0,160)}`);
  }
  return hits;
}

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch();
  const report={lang:LANG,steps:{},reasoningSeen:false,pdfs:{}};
  for(const [vpName,vp] of [['phone',{width:390,height:844}],['desktop',{width:1440,height:900}]]){
    const ctx=await browser.newContext({viewport:vp,acceptDownloads:true}); const page=await ctx.newPage();
    page.on('pageerror',e=>console.log('pageerror',e.message));
    await page.route('**/*',async r=>{
      const req=r.request(),u=req.url();
      if(u.replace(/[?#].*$/,'')==='https://even-os.com/') return r.fulfill({status:200,contentType:'text/html',body:html});
      if(u.startsWith(API+'/api/estimate')){
        const body=JSON.parse(req.postData()||'{}');
        const text=JSON.stringify(body.messages);
        const lang=/Language:Spanish/.test(text)?'es':'en';
        if(body.even_kind==='scope') return r.fulfill({status:200,contentType:'application/json',headers:{'X-Even-Cache':'miss','X-Even-Cache-Key':'k1'},body:JSON.stringify({content:[{type:'text',text:JSON.stringify(SCOPE[lang])}]})});
        const est=estimateJSON(body.messages[0].content.map(b=>b.text||'').join('\n'),lang);
        await new Promise(res=>setTimeout(res,1500));
        return r.fulfill({status:200,contentType:'text/event-stream',headers:{'X-Even-Cache':'miss','X-Even-Cache-Key':'k2'},body:sse([
          {type:'message_start'},{type:'content_block_start',index:0,content_block:{type:'thinking'}},
          ...REASONING.match(/.{1,40}/g).map(t=>({type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:t}})),
          {type:'content_block_start',index:1,content_block:{type:'text'}},
          ...est.match(/.{1,200}/g).map(t=>({type:'content_block_delta',index:1,delta:{type:'text_delta',text:t}})),
          {type:'message_delta',delta:{stop_reason:'end_turn'}},{type:'message_stop'}])});
      }
      if(u.startsWith(API+'/api/usage')) return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({signedIn:true,isPro:false,used:1,limit:5,remaining:4})});
      if(u.startsWith(API+'/api/event')) return r.fulfill({status:200,contentType:'application/json',body:'{}'});
      try{const h={...req.headers()};delete h['accept-encoding'];const resp=await fetch(u,{method:req.method(),headers:h,body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer()});const b=Buffer.from(await resp.arrayBuffer());const rh={};resp.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k))rh[k]=v;});await r.fulfill({status:resp.status,headers:rh,body:b});}catch(e){await r.abort().catch(()=>{});}
    });
    await page.goto('https://even-os.com/',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(2500);
    const visible=()=>page.evaluate(()=>document.body.innerText);
    const grab=async step=>{const t=await visible(); fs.writeFileSync(`${out}/${LANG}-${vpName}-${step}.txt`,t); report.steps[`${vpName}:${step}`]=LANG==='es'?englishHits(t):[]; if(/P9 is add-on|I will use P1|dedicated electrical-only/.test(t)) report.reasoningSeen=true; await page.screenshot({path:`${out}/${LANG}-${vpName}-${step}.png`,fullPage:!/loading/.test(step)});};
    await page.evaluate(lang=>{
      if(lang==='es'){ const b=[...document.querySelectorAll('.lang-btn')].find(x=>x.textContent.trim()==='ES'); setLang('es',b); }
      currentUser={id:'x',email:'ventas@acmeelectric.com'};
      localStorage.setItem('even_biz',JSON.stringify({company:'Acme Electric LLC',phone:'(305) 555-0100',email:'ventas@acmeelectric.com',license:'EC13001234'}));
    },LANG);
    await page.selectOption('#est-trade',{label:LANG==='es'?/Electricidad|Eléctric/:'Electrical'}).catch(async()=>{await page.selectOption('#est-trade','Electrical').catch(()=>{});});
    await page.fill('#est-location','Aventura, FL');
    await page.fill('#scope-text',LANG==='es'?'Cambiar el panel eléctrico de 100A a 200A en una casa unifamiliar':'Upgrade electrical panel from 100A to 200A in a single family home');
    await grab('1-input');
    await page.click('#gen-btn'); await page.waitForSelector('.q-chip',{timeout:30000}); await page.waitForTimeout(700);
    await grab('2-refine');
    const nq=await page.locator('.q-block').count();
    for(let i=0;i<nq;i++){ await page.locator(`#qchips-${i} .q-chip`).first().click(); await page.waitForTimeout(150); }
    await page.waitForTimeout(600);
    await page.click('#calc-btn');
    // Watch the loading screen for model reasoning while it runs.
    for(let i=0;i<40;i++){ const t=await visible(); if(/P9 is add-on|I will use P1|dedicated electrical-only/.test(t)) report.reasoningSeen=true;
      if(i===8) await grab('3-loading');
      if(await page.locator('#s-estimate.active').count()) break; await page.waitForTimeout(250); }
    await page.waitForSelector('#s-estimate.active',{timeout:60000}); await page.waitForTimeout(1500);
    await grab('4-estimate');
    if(vpName==='phone'){
      // Both PDFs, captured instead of saved.
      for(const kind of ['internal','proposal']){
        const b64=await page.evaluate(async kind=>{
          let got=null; const orig=window.savePDF; window.savePDF=(doc)=>{got=doc.output('datauristring').split(',')[1];};
          if(kind==='internal') await downloadCostSheet(); else { const J=(window.jspdf||{}).jsPDF; const doc=await buildClientProposalPDF(J); got=doc.output('datauristring').split(',')[1]; }
          window.savePDF=orig; return got; },kind);
        const f=`${out}/${LANG}-${kind}.pdf`; fs.writeFileSync(f,Buffer.from(b64,'base64'));
        const txt=execFileSync('pdftotext',['-layout',f,'-']).toString();
        fs.writeFileSync(f.replace('.pdf','.txt'),txt);
        report.pdfs[kind]=LANG==='es'?englishHits(txt):[];
        if(/P9 is add-on|I will use P1/.test(txt)) report.reasoningSeen=true;
        // Permit line must be the electrical row.
        report.pdfs[kind+'_permitLine']=(txt.match(/.*(Permiso|Permit)[^\n]*/g)||[]).slice(0,4);
      }
      report.permitLines=await page.evaluate(()=>currentEstimate.lineItems.filter(l=>l.category==='Permits').map(l=>({d:l.description,row:l.permitRow?.work_type,total:l.total})));
      report.total=await page.evaluate(()=>currentEstimate.totalBid);
      report.direct=await page.evaluate(()=>currentEstimate.subtotal);
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(`${out}/${LANG}-report.json`,JSON.stringify(report,null,2));
  const n=Object.values(report.steps).flat().length+(report.pdfs.internal||[]).length+(report.pdfs.proposal||[]).length;
  console.log(JSON.stringify(report,null,2).slice(0,20000));
  console.log(`\n${LANG}: English lines flagged = ${n}; reasoning visible = ${report.reasoningSeen}`);
})().catch(e=>{console.error(e);process.exit(1);});
