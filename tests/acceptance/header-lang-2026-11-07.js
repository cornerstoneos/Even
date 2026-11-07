// Spanish link + header crowding (founder 2026-11-05, Nov 7 build A), in a real
// browser against index.html. Acceptance: ?lang=es opens in Spanish signed out
// (header, steps, headline, placeholder, ES highlighted); EN switches back; a
// reload with no param gives the last choice; ?lang=en wins over a saved ES; and
// at 375 and 390px, EN and ES, signed in and out, no header element overlaps
// another or is cut off.
// Run: node tests/acceptance/header-lang-2026-11-07.js [screenshot dir]
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs'),path=require('path');
const out=process.argv[2]||require('os').tmpdir()+'/even-hdr';
fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
async function page(ctx){
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.replace(/[?#].*$/,'')==='https://even-os.com/') return r.fulfill({status:200,contentType:'text/html',body:html});
    if(u.startsWith('https://even-production')) return r.fulfill({status:200,contentType:'application/json',body:'{}'});
    return r.continue();});
  return {p,errs};
}
const state=p=>p.evaluate(()=>({lang:appLang,
  esActive:document.querySelectorAll('.lang-btn')[1].classList.contains('active'),
  auth:document.getElementById('topbar-auth-btn')?.textContent.trim(),
  steps:[...document.querySelectorAll('#s-input .slbl')].map(e=>e.textContent.trim()),
  head:document.querySelector('#s-input .hero-tag').textContent.trim(),
  ph:document.getElementById('scope-text').placeholder.slice(0,30)}));
const overlaps=p=>p.evaluate(()=>{
  const vis=[...document.querySelectorAll('.topbar button,.topbar .topbar-logo,.topbar .lang-toggle,#user-badge')].filter(e=>{
    const s=getComputedStyle(e),b=e.getBoundingClientRect();
    let hid=false; for(let n=e;n;n=n.parentElement){const c=getComputedStyle(n); if(c.visibility==='hidden'||c.display==='none') hid=true;}
    return !hid&&b.width>0&&b.height>0;});
  const ov=[]; for(let i=0;i<vis.length;i++)for(let j=i+1;j<vis.length;j++){
    if(vis[i].contains(vis[j])||vis[j].contains(vis[i])) continue;
    const a=vis[i].getBoundingClientRect(),c=vis[j].getBoundingClientRect();
    if(a.left<c.right-1&&c.left<a.right-1&&a.top<c.bottom-1&&c.top<a.bottom-1) ov.push((vis[i].id||vis[i].className)+' x '+(vis[j].id||vis[j].className));}
  const cut=vis.filter(e=>{const b=e.getBoundingClientRect();return b.left<-1||b.right>innerWidth+1||(e.scrollWidth>e.clientWidth+1&&e.tagName==='BUTTON');}).map(e=>e.id||e.className);
  return {ov,cut,noSide:document.documentElement.scrollWidth<=innerWidth+1};});

(async()=>{
  const b=await chromium.launch({proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined});
  console.log('\n=== Spanish link, fresh phone browser, signed out ===');
  { const ctx=await b.newContext({viewport:{width:375,height:812},ignoreHTTPSErrors:true}); const {p,errs}=await page(ctx);
    await p.goto('https://even-os.com/?lang=es'); await p.waitForTimeout(900);
    let s=await state(p);
    check('?lang=es: app is in Spanish with ES highlighted', s.lang==='es'&&s.esActive, JSON.stringify(s));
    check(`header in Spanish: "${s.auth}"`, /INICIAR/i.test(s.auth||''), s.auth);
    check(`steps in Spanish: ${s.steps.join(' / ')}`, s.steps.join('|').toUpperCase()==='ALCANCE|REFINAR|ESTIMADO', s.steps.join('|'));
    check(`headline in Spanish: "${s.head}"`, s.head.startsWith('Alcance adentro'), s.head);
    check(`placeholder in Spanish: "${s.ph}…"`, s.ph.startsWith('Pega el alcance'), s.ph);
    await p.screenshot({path:`${out}/lang-es-link.png`});
    await p.click('.lang-btn >> nth=0'); await p.waitForTimeout(200); s=await state(p);
    check('tap EN: English', s.lang==='en'&&!s.esActive&&s.head.startsWith('Scope in')&&s.ph.startsWith('Paste scope'), JSON.stringify(s));
    await p.goto('https://even-os.com/'); await p.waitForTimeout(700); s=await state(p);
    check('reload with no param: last choice (EN)', s.lang==='en', s.lang);
    await p.click('.lang-btn >> nth=1'); await p.goto('https://even-os.com/'); await p.waitForTimeout(700); s=await state(p);
    check('reload with no param after choosing ES: Spanish', s.lang==='es'&&s.esActive, JSON.stringify(s));
    await p.goto('https://even-os.com/?lang=en'); await p.waitForTimeout(700); s=await state(p);
    check('?lang=en wins over the saved ES', s.lang==='en'&&!s.esActive, JSON.stringify(s));
    check('no page errors', errs.length===0, errs.join(' | '));
    await ctx.close(); }
  { const ctx=await b.newContext({viewport:{width:375,height:812}}); await ctx.addInitScript(()=>{ Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}}); });
    const {p,errs}=await page(ctx); await p.goto('https://even-os.com/?lang=es'); await p.waitForTimeout(700);
    check('storage blocked (private mode): ?lang=es still works, no errors', (await state(p)).lang==='es'&&errs.length===0, errs.join('|'));
    const {p:p2,errs:e2}=await page(ctx); await p2.goto('https://even-os.com/'); await p2.waitForTimeout(700);
    check('storage blocked, no param: English', (await state(p2)).lang==='en'&&e2.length===0, e2.join('|'));
    await ctx.close(); }

  console.log('\n=== Header at phone width ===');
  for(const w of [375,390]) for(const lang of ['en','es']) for(const [st,signed,gopro] of [['signed out',false,false],['signed in',true,false],['signed in + GO PRO',true,true]]){
    const ctx=await b.newContext({viewport:{width:w,height:740},ignoreHTTPSErrors:true}); const {p}=await page(ctx);
    await p.goto('https://even-os.com/'+(lang==='es'?'?lang=es':'')); await p.waitForTimeout(1200);
    await p.evaluate(({signed,gopro})=>{ if(signed){ currentUser={id:'u',email:'contractor@example.com'}; isPro=false; estimateCount=gopro?1:0; updateUserBadge(); } },{signed,gopro});
    await p.waitForTimeout(250);
    const r=await overlaps(p); const name=`${w}-${lang}-${st.replace(/[^a-z]+/gi,'-')}`;
    await p.screenshot({path:`${out}/hdr-${name}.png`,clip:{x:0,y:0,width:w,height:60}});
    check(`${w}px ${lang.toUpperCase()} ${st}: nothing overlaps or is cut off`, !r.ov.length&&!r.cut.length&&r.noSide, JSON.stringify(r));
    await ctx.close(); }

  console.log('\n=== Theme switch moved to the menu on phones ===');
  { const ctx=await b.newContext({viewport:{width:375,height:812}}); const {p}=await page(ctx);
    await p.goto('https://even-os.com/'); await p.waitForTimeout(600);
    const before=await p.evaluate(()=>document.body.classList.contains('light')||document.documentElement.dataset.theme||'');
    await p.evaluate(()=>openSidebar()); await p.waitForTimeout(300);
    await p.click('#sidebar button:has-text("Light / dark mode")'); await p.waitForTimeout(200);
    const after=await p.evaluate(()=>document.body.classList.contains('light')||document.documentElement.dataset.theme||'');
    check('menu has Light / dark mode and it switches the theme', before!==after, `${before} -> ${after}`);
    await ctx.close(); }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
