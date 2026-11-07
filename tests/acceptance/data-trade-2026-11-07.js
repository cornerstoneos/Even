// Data Trade without a photo (Nov 7 build D), in a real browser against
// index.html and the real server.js (Supabase/Anthropic mocked by
// tests/helpers/scope-cache-server.js). Acceptance: trade + city + cost with no
// photo is accepted and the server grants the credit once (free limit 3 -> 4);
// a second try says already used and grants nothing; EN + ES copy never asks
// for a photo.
// Run: node tests/acceptance/data-trade-2026-11-07.js [out dir]
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const out=process.argv[2]||os.tmpdir()+'/even-dt'; fs.mkdirSync(out,{recursive:true});
const root=path.join(__dirname,'..','..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'even-dt-'));
const DB=path.join(dir,'db.json'),LOG=path.join(dir,'log.txt');fs.writeFileSync(LOG,'');
const port=40100+Math.floor(Math.random()*300);
const start=()=>new Promise((res,rej)=>{
  const p=spawn(process.execPath,[path.join(root,'tests','helpers','scope-cache-server.js')],{env:{...process.env,PORT:String(port),FAKE_DB:DB,FAKE_LOG:LOG,RATE_LIMIT_SCALE:'20'},stdio:['ignore','pipe','pipe']});
  p.stdout.on('data',d=>{if(/running on port/.test(d)) res(p);}); p.on('exit',c=>rej(new Error('server exited '+c)));
});
(async()=>{
  const srv=await start();
  const b=await chromium.launch({proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined});
  for(const lang of ['en','es']){
    const es=lang==='es';
    console.log(`\n=== ${lang.toUpperCase()} · signed out · phone ===`);
    const ctx=await b.newContext({viewport:{width:375,height:812},ignoreHTTPSErrors:true});
    const ip='198.51.100.'+(lang==='en'?71:72);
    await ctx.route('**/*',async r=>{const u=r.request().url();
      if(u.replace(/[?#].*$/,'')==='https://even-os.com/') return r.fulfill({status:200,contentType:'text/html',body:html});
      if(u.startsWith('https://even-production.up.railway.app')){
        const req=r.request(), h={...req.headers(),origin:'https://even-os.com','x-forwarded-for':ip};
        if(req.method()==='OPTIONS') return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
        const resp=await fetch(u.replace('https://even-production.up.railway.app',`http://localhost:${port}`),{method:req.method(),headers:h,body:req.postData()||undefined});
        return r.fulfill({status:resp.status,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:Buffer.from(await resp.arrayBuffer())});
      }
      return r.continue();});
    const alerts=[];
    const open=async()=>{const p=await ctx.newPage(); p.on('dialog',d=>{alerts.push(d.message());d.accept();});
      await p.goto('https://even-os.com/'+(es?'?lang=es':'')); await p.waitForTimeout(1500); return p;};
    let p=await open();
    const limit0=await p.evaluate(async()=>(await refreshUsage())&&window._usage.limit);
    await p.evaluate(()=>openDataTrade()); await p.waitForTimeout(300);
    const modalText=await p.locator('#data-trade-modal').innerText();
    const phs=await p.evaluate(()=>[...document.querySelectorAll('#data-trade-modal [placeholder]')].map(e=>e.placeholder).join(' | '));
    check('modal copy never asks for a photo', !/photo|foto|recibo|receipt/i.test(modalText+phs), modalText);
    check('no file upload in the modal', await p.locator('#data-trade-modal input[type=file]').count()===0);
    if(es) check(`placeholders in Spanish: ${phs}`, /Oficio/.test(phs)&&/Ciudad/.test(phs)&&/Pies cuadrados/.test(phs)&&/Notas/.test(phs)&&/costo total/.test(phs), phs);
    check('no em dashes in the modal copy', !/—/.test(modalText+phs), modalText);
    await p.locator('#data-trade-modal').screenshot({path:`${out}/modal-${lang}.png`});
    await p.fill('#trade-trade','Roofing'); await p.fill('#trade-city','Davie'); await p.fill('#trade-cost','18500');
    await p.click('#trade-submit-btn'); await p.waitForTimeout(1200);
    const limit1=await p.evaluate(async()=>(await refreshUsage())&&window._usage.limit);
    check(`no photo, accepted: "${alerts.at(-1)}"`, alerts.at(-1)===(es?'Gracias. Se desbloqueó 1 estimado gratis.':'Thank you. 1 free estimate unlocked.'), alerts.join(' | '));
    check(`credit granted once by the server: free limit ${limit0} -> ${limit1}`, limit1===limit0+1, `${limit0} -> ${limit1}`);
    await p.close();
    // Second try in a new tab (same device, fresh session): the server says no.
    p=await open();
    await p.evaluate(()=>openDataTrade());
    await p.fill('#trade-trade','Roofing'); await p.fill('#trade-city','Davie'); await p.fill('#trade-cost','9000');
    await p.click('#trade-submit-btn'); await p.waitForTimeout(1200);
    const limit2=await p.evaluate(async()=>(await refreshUsage())&&window._usage.limit);
    check(`second try: "${alerts.at(-1)}"`, es?/Ya usaste/.test(alerts.at(-1)):/^Already used/.test(alerts.at(-1)), alerts.at(-1));
    check(`second try grants nothing: limit stays ${limit2}`, limit2===limit1);
    // Same tab again: blocked before it even asks the server.
    await p.evaluate(()=>openDataTrade()); await p.click('#trade-submit-btn',{force:true}).catch(()=>{}); await p.waitForTimeout(300);
    check('third try in the same tab: button off + "already used" message', await p.evaluate(()=>document.getElementById('trade-submit-btn').disabled&&getComputedStyle(document.getElementById('trade-used-msg')).display!=='none'));
    await p.locator('#data-trade-modal').screenshot({path:`${out}/used-${lang}.png`});
    await ctx.close();
  }
  await b.close(); srv.kill();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
