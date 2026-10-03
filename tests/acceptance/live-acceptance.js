// Live acceptance test (not part of tests/run.sh: it spends real API calls).
// Usage: node tests/acceptance/live-acceptance.js https://even-os.com/ <A|B> <runs>
// A = Plumbing, Fort Lauderdale, 40 gal water heater, 1,800 sqft. B = Remodeling, Miami, gut 5x8 bathroom.
// Each run is a fresh browser session; every question gets its first option. Prints totals,
// the X-Even-Cache result per request, and whether every run matched. Requests are sent
// through Node (fetch) because Chromium trips over some sandbox proxies.
// Usage: node acc.js <baseUrl> <A|B> <runs>
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const TESTS={
  A:{trade:'Plumbing',location:'Fort Lauderdale, FL',sqft:'1800',scope:'Replace 40 gal water heater'},
  B:{trade:'Remodeling',location:'Miami, FL',sqft:'',scope:'Gut 5x8 bathroom'}
};
(async()=>{
  const [base,which,runs]=[process.argv[2],process.argv[3],+process.argv[4]||1];
  const t=TESTS[which];
  const px=process.env.HTTPS_PROXY?new URL(process.env.HTTPS_PROXY):null;
  const proxy=px?{server:`${px.protocol}//${px.host}`,username:decodeURIComponent(px.username)||undefined,password:decodeURIComponent(px.password)||undefined}:undefined;
  const browser=await chromium.launch();
  const out=[];
  for(let i=0;i<runs;i++){
    const cacheLog=[];
    const ctx=await browser.newContext({viewport:{width:430,height:900},ignoreHTTPSErrors:true});
    const page=await ctx.newPage();
    page.on('pageerror',e=>console.error('pageerror',e.message));
    page.on('console',m=>{if(['error','warning'].includes(m.type()))console.error('console',m.type(),m.text().slice(0,300));});
    const localBody=process.env.LOCAL_HTML?require('fs').readFileSync(process.env.LOCAL_HTML,'utf8'):null;
    // Every request goes out through Node (the sandbox proxy trips Chromium up).
    await page.route('**/*',async r=>{
      const req=r.request(); const url=req.url();
      if(localBody&&url.replace(/[?#].*$/,'')===base) return r.fulfill({status:200,contentType:'text/html',body:localBody});
      try{
        const h={...req.headers()}; delete h['accept-encoding'];
        const resp=await fetch(url,{method:req.method(),headers:h,body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer(),redirect:'follow'});
        if(/\/api\/estimate$/.test(url)) cacheLog.push(resp.headers.get('x-even-cache')||'none');
        const buf=Buffer.from(await resp.arrayBuffer());
        const rh={}; resp.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k)) rh[k]=v;});
        rh['access-control-allow-origin']=rh['access-control-allow-origin']||'*';
        await r.fulfill({status:resp.status,headers:rh,body:buf});
      }catch(e){ await r.abort().catch(()=>{}); }
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1500);
    await page.evaluate(t=>{
      document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
      if(typeof navigate==='function') navigate('input');
      document.getElementById('est-trade').value=t.trade;
      document.getElementById('est-location').value=t.location;
      document.getElementById('est-sqft').value=t.sqft;
      document.getElementById('scope-text').value=t.scope;
    },t);
    await page.evaluate(()=>startEstimate());
    await page.waitForFunction(()=>document.getElementById('questions-section')?.style.display==='block'||/red/.test(document.getElementById('ai-summary-text')?.innerHTML||''),null,{timeout:120000});
    const qs=await page.evaluate(()=>{window._qAnswers=window._qAnswers||{};(window._allQuestions||[]).forEach(q=>{window._qAnswers[q.question]=(q.options||[])[0]||'';});return (window._allQuestions||[]).map(q=>q.question+' => '+((q.options||[])[0]||''));});
    await page.evaluate(()=>{calculateEstimate();});
    await page.waitForFunction(()=>{try{return document.getElementById('s-estimate')?.classList.contains('active')||(document.getElementById('calc-btn')&&!document.getElementById('calc-btn').disabled&&!document.getElementById('screen-loading').classList.contains('active'))}catch(e){return false}},null,{timeout:240000}).catch(()=>{});
    const st=await page.evaluate(()=>({est:document.getElementById('s-estimate')?.classList.contains('active'),toast:document.querySelector('.toast,#toast')?.textContent}));console.error('state',JSON.stringify(st));
    await page.waitForFunction(()=>{try{return document.getElementById('s-estimate')?.classList.contains('active')&&currentEstimate&&currentEstimate.totalBid>0;}catch(e){return false}},null,{timeout:5000});
    const est=await page.evaluate(()=>JSON.parse(JSON.stringify(currentEstimate)));
    const lines=est.lineItems.map(l=>`${l.category} | ${l.description} | ${l.qty} ${l.unit} x ${l.unitCost} = ${l.total}`);
    out.push({run:i+1,cache:cacheLog.join(','),scopeKey:est.scopeKey,total:est.totalBid,subtotal:est.subtotal,oh:est.overhead,cont:est.contingency,profit:est.profit,permits:est.lineItems.filter(l=>l.category==='Permits').length,lines,qs,assumptions:est.assumptions});
    console.log(JSON.stringify(out[out.length-1],null,1));
    await ctx.close();
  }
  const sig=o=>JSON.stringify([o.lines,o.total]);
  console.log('CACHE',which,out.map(o=>o.cache).join(' | '));
  console.log('SUMMARY',which,out.map(o=>o.total).join(', '),'identical:',out.every(o=>sig(o)===sig(out[0])),'permits:',out.map(o=>o.permits).join(','));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
