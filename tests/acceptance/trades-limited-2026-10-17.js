// Landscaping + Pools on the screens: both trades in the dropdown (EN + ES), the
// "limited data" label under the trade picker and on the estimate, phone width.
// Run: node tests/acceptance/trades-limited-2026-10-17.js [screenshot dir]
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs'),path=require('path');
const out=process.argv[2]||require('os').tmpdir()+'/even-trades';fs.mkdirSync(out,{recursive:true});
const root=path.join(__dirname,'..','..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const batch=JSON.parse(fs.readFileSync(path.join(root,'data/batches/even_master_batch.json'),'utf8'));
const md={...batch.find(m=>m.market==='Broward'),municipality:'Fort Lauderdale',permitScope:'municipality'};
let pass=0,fail=0;const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
(async()=>{
  const b=await chromium.launch();
  for(const lang of ['en','es']){
    console.log(`\n=== ${lang.toUpperCase()} · phone 375px ===`);
    const p=await (await b.newContext({viewport:{width:375,height:812}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/*',r=>{const u=r.request().url();if(u.replace(/[?#].*$/,'')==='https://even-os.com/')return r.fulfill({status:200,contentType:'text/html',body:html});if(u.startsWith('https://even-production'))return r.fulfill({status:200,contentType:'application/json',body:'{}'});return r.continue();});
    await p.goto('https://even-os.com/');await p.waitForTimeout(800);
    if(lang==='es') await p.evaluate(()=>setLang('es',document.querySelectorAll('.lang-btn')[1]));
    const W=x=>lang==='es'?x[1]:x[0], LBL=W(['Limited local data for this trade. Check materials and labor.','Datos locales limitados para este oficio. Revisa materiales y mano de obra.']);
    const opts=await p.$$eval('#est-trade option',o=>o.map(x=>x.textContent.trim()));
    check('dropdown has both trades', opts.includes(W(['Landscaping','Paisajismo']))&&opts.includes(W(['Pools','Piscinas'])), opts.join(', '));
    await p.selectOption('#est-trade','Pools');
    let t=await p.evaluate(()=>{const e=document.getElementById('trade-limited');return {v:document.getElementById('est-trade').value,shown:!e.hidden,txt:e.textContent};});
    check('picking Pools shows the label under the picker', t.v==='Pools'&&t.shown&&t.txt===LBL, JSON.stringify(t));
    await p.selectOption('#est-trade','Plumbing');
    t=await p.evaluate(()=>!document.getElementById('trade-limited').hidden);
    check('a normal trade has no label', !t);
    await p.selectOption('#est-trade','Landscaping');
    t=await p.evaluate(()=>document.getElementById('trade-limited').textContent);
    check('Landscaping shows the label', t===LBL, t);
    await p.screenshot({path:`${out}/trade-picker-${lang}.png`});
    const r=await p.evaluate(md=>{
      const cats=scopeMaterialCategories('Landscaping',[{trade:'Landscaping'}]);
      const cat=buildCatalog(md,cats,{trade:'Landscaping'});
      const sod=cat.materials.find(e=>/^Landscaping - Sod/.test(e.row.category));
      const d=priceScope({lineItems:[{type:'material',ref:sod.ref,qty:20},{type:'labor',ref:cat.labor[0].ref,hours:20,description:'Lay sod'}]},cat,{marketAdj:1,laborMult:2.2,oh:12,profit:22,cushion:8,lang:appLang});
      d.confidenceTier=capConfidence(computeConfidenceTier(md,cats),'Landscaping'); d.limitedTrade='Landscaping';
      currentEstimate=d; window._ctx={location:'Fort Lauderdale',trade:'Landscaping'}; navigate('estimate'); renderEstimate(d);
      const e=document.getElementById('limited-note'); return {shown:!e.hidden,txt:e.textContent,tier:d.confidenceTier,sw:document.documentElement.scrollWidth};
    },md);
    await p.waitForTimeout(300);
    check('estimate screen carries the label', r.shown&&r.txt===LBL, JSON.stringify(r));
    check(`confidence not HIGH (${r.tier})`, r.tier!=='high');
    await p.screenshot({path:`${out}/trade-estimate-${lang}.png`});
    const sw=await p.evaluate(()=>document.documentElement.scrollWidth);
    check('phone: no sideways scroll', sw<=375, sw);
    check('no page errors', !errs.length, errs.join(' | '));
  }
  await b.close();console.log(`\n──────────────\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
