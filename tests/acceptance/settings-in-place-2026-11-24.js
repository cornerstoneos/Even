// Browser check (Playwright), not part of tests/run.sh (founder 2026-11-24):
// (1) Settings -> Your business holds company/license/phone/email, mirrored to the proposal card;
// (2) Labor and margins opens in place on the dashboard and goes back to the estimate screen.
// Usage: node tests/acceptance/settings-in-place-2026-11-24.js
const {chromium}=require('playwright');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','..','index.html'),'utf8');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/*',async r=>{const u=r.request().url();
 if(u.replace(/[?#].*$/,'')==='https://even-os.com/')return r.fulfill({status:200,contentType:'text/html',body:html});
 if(u.includes('railway.app'))return r.fulfill({status:200,contentType:'application/json',body:u.includes('/api/markets')?'[]':'{}'});
 return r.continue().catch(()=>r.abort());});
await p.goto('https://even-os.com/',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
await p.evaluate(()=>navigate('dashboard'));await p.waitForTimeout(500);
const out={};
await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('onclick')?.includes("'set-biz'"));b.click();});
out.bizVisible=await p.isVisible('#sbiz-company');
await p.fill('#sbiz-company','Even Roofing Test');await p.fill('#sbiz-license','CCC123');await p.fill('#sbiz-phone','954-555-0100');
out.stored=await p.evaluate(()=>localStorage.getItem('even_biz'));
out.proposalMirror=await p.evaluate(()=>document.getElementById('biz-company').value);
await p.screenshot({path:'/tmp/settings-biz.png'});
await p.evaluate(()=>document.getElementById('dash-margins-btn').click());await p.waitForTimeout(300);
out.screenStillDash=await p.evaluate(()=>document.getElementById('s-dashboard').classList.contains('active'));
out.marginsInDash=await p.evaluate(()=>document.getElementById('your-settings').parentNode.id);
out.marginsVisible=await p.isVisible('#your-settings');
await p.evaluate(()=>document.getElementById('your-settings').scrollIntoView());await p.screenshot({path:'/tmp/settings-margins.png'});
await p.evaluate(()=>navigate('input'));await p.waitForTimeout(300);
out.backHome=await p.evaluate(()=>{const f=document.getElementById('your-settings');return f.closest('#s-input')?true:false;});
out.inputFoldWorks=await p.evaluate(()=>{const f=document.getElementById('your-settings');const btn=f.previousElementSibling;btn.click();return !f.hidden&&btn.textContent.includes('settings')||btn.textContent.length>0&&!f.hidden;});
await p.evaluate(()=>navigate('dashboard'));await p.evaluate(()=>document.getElementById('dash-margins-btn').click());
out.reopen=await p.evaluate(()=>document.getElementById('your-settings').parentNode.id+' hidden='+document.getElementById('your-settings').hidden);
out.errs=errs;console.log(JSON.stringify(out,null,1));await b.close();})();
