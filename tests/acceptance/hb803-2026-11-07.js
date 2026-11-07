// HB 803 permit line (Nov 7 build C), in a real browser against index.html.
// A Fort Lauderdale estimate priced by the app's own engine from real Broward
// permit rows shows the note under its permit line with the row's date, on the
// screen and on the cost sheet, EN + ES; a Charlotte (NC) estimate does not; the
// client proposal PDF never does.
// Run: node tests/acceptance/hb803-2026-11-07.js [out dir]
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const out=process.argv[2]||require('os').tmpdir()+'/even-hb803'; fs.mkdirSync(out,{recursive:true});
const root=path.join(__dirname,'..','..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const P=require(path.join(root,'lib','pipeline')).loadPipeline();
const batch=JSON.parse(fs.readFileSync(path.join(root,'data','batches','even_master_batch.json'),'utf8'));
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
function job(market,city,match,lang){
  const m=batch.find(x=>x.market===market);
  const md={...m,permits:m.permits.filter(r=>String(r.municipality||'').startsWith(city)).slice(0,60)};
  const cat=P.buildCatalog(md,new Set(['Plumbing']),{});
  const pe=cat.permits.find(e=>match.test(e.row.work_type||''))||cat.permits[0];
  const mat=cat.materials.find(e=>/water heater/i.test(e.row.item||''))||cat.materials[0];
  const r=P.priceScope({projectName:'Water heater',lineItems:[{type:'material',ref:mat.ref,qty:1},{type:'permit',ref:pe.ref,description:'Plumbing permit'}]},cat,
    {marketAdj:1,laborMult:2,oh:15,profit:20,cushion:6,lang,sqft:0});
  return {r,row:pe.row,loc:`${city}, ${m.state}`};
}
const NOTE={en:"Permit fee per the city's posted schedule (as of DATE); may change under Florida HB 803.",
  es:'Tarifa de permiso según la tabla publicada por la ciudad (al DATE); puede cambiar por la ley HB 803 de Florida.'};
(async()=>{
  const b=await chromium.launch({proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined});
  for(const lang of ['en','es']) for(const [label,market,city,rx,fl] of [['Fort Lauderdale, FL','Broward','Fort Lauderdale',/plumb/i,true],['Charlotte, NC','Charlotte','Charlotte',/plumb/i,false]]){
    const {r,row,loc}=job(market,city,rx,lang);
    console.log(`\n=== ${label} · ${lang.toUpperCase()} · permit row: ${row.municipality} / ${row.work_type} (${row.date}) ===`);
    const ctx=await b.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:true}); const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/*',r=>{const u=r.request().url();
      if(u.replace(/[?#].*$/,'')==='https://even-os.com/') return r.fulfill({status:200,contentType:'text/html',body:html});
      if(u.startsWith('https://even-production')) return r.fulfill({status:200,contentType:'application/json',body:'{}'});
      return r.continue();});
    await p.goto('https://even-os.com/'+(lang==='es'?'?lang=es':'')); await p.waitForTimeout(2500);
    const res=await p.evaluate(async({r,loc})=>{
      window._ctx={trade:'Plumbing',location:loc,client:'Rivera',projectLabel:''};
      r.confidenceTier='medium'; currentEstimate=r; navigate('estimate'); renderEstimate(r);
      await new Promise(x=>setTimeout(x,300));
      const i=r.lineItems.findIndex(l=>l.permitRow);
      const screen=document.getElementById('ls-'+i)?.textContent||'';
      let cost='',prop='';
      const orig=window.savePDF;
      window.savePDF=(doc)=>{cost=doc.output('datauristring').split(',')[1];};
      await downloadCostSheet();
      const J=(window.jspdf||{}).jsPDF; const d=await buildClientProposalPDF(J); prop=d.output('datauristring').split(',')[1];
      window.savePDF=orig;
      return {screen,cost,prop};
    },{r,loc});
    const tag=`${city.replace(/\s/g,'')}-${lang}`;
    fs.writeFileSync(`${out}/costsheet-${tag}.pdf`,Buffer.from(res.cost,'base64'));
    fs.writeFileSync(`${out}/proposal-${tag}.pdf`,Buffer.from(res.prop,'base64'));
    const txt=f=>execFileSync('pdftotext',['-layout',f,'-']).toString().replace(/\s+/g,' ');
    const costT=txt(`${out}/costsheet-${tag}.pdf`), propT=txt(`${out}/proposal-${tag}.pdf`);
    const want=NOTE[lang].replace('DATE',row.date);
    await p.locator('#li-body').screenshot({path:`${out}/screen-${tag}.png`}).catch(()=>{});
    if(fl){
      check(`screen: "${res.screen}"`, res.screen===want, `want "${want}"`);
      check('cost sheet PDF carries the same line', costT.includes(want.slice(0,40))&&costT.includes(row.date)&&costT.includes('HB 803'), costT.slice(0,400));
    }else{
      check(`screen: no HB 803 ("${res.screen}")`, !/HB 803/.test(res.screen));
      check('cost sheet PDF: no HB 803', !/HB 803/.test(costT));
    }
    check('client proposal PDF: no HB 803', !/HB 803/.test(propT)&&propT.length>100, propT.slice(0,200));
    check('no page errors', errs.length===0, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
