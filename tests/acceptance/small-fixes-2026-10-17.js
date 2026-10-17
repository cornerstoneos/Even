// Browser check for the 2026-10-17 small fixes (a) and (b): the proposal never
// shows the login email as the company, the screen asks for the business name,
// and the tracker's "Pro Feature" tag shows for free/signed-out, not for Pro.
// Run: node tests/acceptance/small-fixes-2026-10-17.js [screenshot dir]
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs'),path=require('path');
const out=process.argv[2]||require('os').tmpdir()+'/even-small';fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
let pass=0,fail=0;const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
(async()=>{
  const b=await chromium.launch();
  for(const lang of ['en','es']){
    console.log(`\n=== ${lang.toUpperCase()} · phone 375px ===`);
    const p=await (await b.newContext({viewport:{width:375,height:812}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/*',r=>{const u=r.request().url();if(u.replace(/[?#].*$/,'')==='https://even-os.com/')return r.fulfill({status:200,contentType:'text/html',body:html});if(u.startsWith('https://even-production'))return r.fulfill({status:200,contentType:'application/json',body:'{}'});return r.continue();});
    await p.goto('https://even-os.com/');await p.waitForTimeout(700);
    const show=async(pro)=>p.evaluate(({pro,l})=>{ localStorage.removeItem('even_biz'); currentUser=pro===null?null:{id:'u1',email:'even-test-20261013@example.com'}; isPro=!!pro; updateUserBadge();
      if(l==='es'&&appLang!=='es') setLang('es',document.querySelectorAll('.lang-btn')[1]);
      const d=priceScope({lineItems:[{type:'other',category:'Plumbing',description:'Water heater',qty:1,unit:'ea',unitCost:900}]},buildCatalog(null,null,{}),{marketAdj:1,oh:12,profit:22,cushion:8,lang:appLang});
      currentEstimate=d; window._ctx={location:'Miami'}; navigate('estimate'); renderEstimate(d);
      document.getElementById('proposal-edit-card').style.display='block'; populateProposalAssumptions(); renderProposalPreview();
      const tag=document.getElementById('tracker-pro-tag');
      return {tag:!tag.hidden&&getComputedStyle(tag).display!=='none',h1:document.querySelector('#proposal-content h1')?.textContent,prompt:!document.getElementById('biz-missing').hidden,promptText:document.getElementById('biz-missing').textContent.trim()};
    },{pro,l:lang});
    let r=await show(null);
    check('signed out: tracker shows the Pro Feature tag', r.tag, JSON.stringify(r));
    r=await show(false);
    check('free account: tracker shows the Pro Feature tag', r.tag, JSON.stringify(r));
    r=await show(true);
    check('Pro account: no Pro Feature tag on the tracker', !r.tag, JSON.stringify(r));
    check(`no business name: header says "${lang==='es'?'Tu empresa':'Your company'}", not the login email`, r.h1===(lang==='es'?'Tu empresa':'Your company')&&!/@/.test(r.h1), r.h1);
    check('the screen asks for the business name', r.prompt&&r.promptText.includes(lang==='es'?'Tu propuesta dice "Tu empresa"':'Your proposal says "Your company"'), r.promptText);
    await p.screenshot({path:`${out}/small-${lang}.png`,fullPage:true});
    await p.fill('#biz-company','Acme Plumbing LLC'); await p.waitForTimeout(150);
    const after=await p.evaluate(()=>{ renderProposalPreview(); return {h1:document.querySelector('#proposal-content h1').textContent,prompt:!document.getElementById('biz-missing').hidden}; });
    check('after typing a name: header shows it, prompt goes away', after.h1==='Acme Plumbing LLC'&&!after.prompt, JSON.stringify(after));
    const sw=await p.evaluate(()=>document.documentElement.scrollWidth);
    check('phone: no sideways scroll', sw<=375, sw);
    check('no page errors', !errs.length, errs.join(' | '));
  }
  await b.close();console.log(`\n──────────────\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
