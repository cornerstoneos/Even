// Build it and walk away, the page side, in a real browser against index.html
// with a fake signed-in session and the /api/builds answers mocked.
// Acceptance (tasks/app.md, Oct 31 #1): a build finished while away shows as
// Ready and opens with the server's total and lines; a failed one offers Try
// again; the push ask appears only after opening a build that finished while
// away; the iPhone hint shows only on iPhone Safari outside Home Screen mode;
// signed out sees the sign-in line; EN + ES; 375px with no sideways scroll.
// Run: node tests/acceptance/walk-away-2026-10-31.js [screenshot dir]
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs'),path=require('path');
const out=process.argv[2]||require('os').tmpdir()+'/even-walk';
fs.mkdirSync(out,{recursive:true});
const root=path.join(__dirname,'..','..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};

// A real priced result: the app's own pipeline on real Broward rows.
const P=require(path.join(root,'lib','pipeline')).loadPipeline();
const batch=JSON.parse(fs.readFileSync(path.join(root,'data','batches','even_master_batch.json'),'utf8'));
const md=batch.find(m=>m.market==='Broward');
const tb=[{trade:'Plumbing',icon:'x',items:[]}];
const cat=P.buildCatalog(md,P.scopeMaterialCategories('Plumbing',tb),{});
const scoped={projectName:'Rivera kitchen',lineItems:[{type:'material',ref:'M1',qty:2},{type:'labor',ref:'L1',hours:4},{type:'other',category:'Labor',description:'Haul away old sink',qty:1,unit:'ea',unitCost:120}]};
const result=P.priceScope(scoped,cat,{marketAdj:1,laborMult:2,laborRate:null,oh:15,profit:20,cushion:6,sqft:0,hvhz:true,calibration:null,lang:'en'});
result.confidenceTier='MEDIUM';
const ctxObj={trade:'Plumbing',location:'Fort Lauderdale',projtype:'Residential — Single Family',sqft:'not specified',client:'Rivera',bidType:'fixed',laborType:'own',oh:15,profit:20,cushion:6,laborMult:2,laborRate:null,projectLabel:'',lang:'en'};
const ID_READY='aaaaaaaa-0000-4000-8000-000000000001', ID_FAIL='aaaaaaaa-0000-4000-8000-000000000002', ID_BUILD='aaaaaaaa-0000-4000-8000-000000000003';
const vapidPublic=require('web-push').generateVAPIDKeys().publicKey;

async function session(b,{lang='en',ua,standalone=false,signedIn=true,shot}){
  const ctx=await b.newContext({viewport:{width:375,height:812},...(ua?{userAgent:ua}:{})});
  if(standalone) await ctx.addInitScript(()=>{ Object.defineProperty(window.navigator,'standalone',{get:()=>true}); });
  // Headless Chromium starts with notifications 'denied'; a normal browser starts at
  // 'default' (never asked). Stand in a never-asked Notification so the ask can show.
  await ctx.addInitScript(()=>{ window.Notification=class{ static permission='default'; static async requestPermission(){ window.__asked=(window.__asked||0)+1; return 'denied'; } }; });
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const calls=[];
  await p.route('**/*',async r=>{const u=r.request().url();
    if(u.replace(/[?#].*$/,'')==='https://even-os.com/') return r.fulfill({status:200,contentType:'text/html',body:html});
    if(u.startsWith('https://even-production.up.railway.app')){
      const pth=new URL(u).pathname; calls.push(r.request().method()+' '+pth);
      const J=o=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
      if(pth==='/api/builds') return J({builds:[
        {id:ID_READY,label:'Rivera kitchen',status:'ready',clientGone:true,total:result.totalBid},
        {id:ID_FAIL,label:'Lopez laundry',status:'failed',clientGone:true,total:null},
        {id:ID_BUILD,label:'Kim deck',status:'building',clientGone:false,total:null}]});
      if(pth===`/api/builds/${ID_READY}`) return J({build:{id:ID_READY,label:'Rivera kitchen',lang,status:'ready',clientGone:true,result,
        meta:{ctx:ctxObj,scopeData:{projectName:'Rivera kitchen',tradeBreakdown:tb,questions:[]},marketMeta:null,answers:{},questions:[],fields:{trade:'Plumbing',location:'Fort Lauderdale',scope:'New sink and disposal',client:'Rivera',label:'Rivera kitchen'}}}});
      if(pth.endsWith('/opened')) return J({ok:true});
      if(pth.endsWith('/retry')) return J({ok:true,status:'building'});
      if(pth==='/api/push/config') return J({enabled:true,publicKey:vapidPublic});
      return J({});
    }
    return r.continue();});
  await p.goto('https://even-os.com/'); await p.waitForTimeout(700);
  await p.evaluate(({signedIn,lang})=>{
    if(lang==='es') setLang('es',document.querySelectorAll('.lang-btn')[1]);
    if(signedIn){ sbClient={from:()=>({select(){return this},eq(){return this},order(){return this},limit(){return this},insert(){return this},single(){return Promise.resolve({data:{id:'job-1'},error:null})},then(r){r({data:[],error:null})}}),auth:{getSession:async()=>({data:{session:{access_token:'t'}}}),signOut:async()=>({})}};
      currentUser={id:'u-test',email:'pro@example.com'}; isPro=false; estimateCount=1; updateUserBadge(); loadBuilds(); }
  },{signedIn,lang});
  await p.waitForTimeout(400);
  return {p,ctx,errs,calls};
}
const noSideScroll=p=>p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);

(async()=>{
  const b=await chromium.launch();
  for(const lang of ['en','es']){
    const es=lang==='es';
    console.log(`\n=== ${lang.toUpperCase()} · desktop-class browser · phone width 375px ===`);
    const {p,ctx,errs,calls}=await session(b,{lang});
    const txt=await p.textContent('#bg-builds');
    check('ready build shows with the spec\'s words', txt.includes(es?'Tu estimado para Rivera kitchen está listo.':'Your estimate for Rivera kitchen is ready.'), txt);
    check('failed build shows the retry words and a Try again button', txt.includes(es?'No pudimos terminar Lopez laundry. Toca para intentar de nuevo.':"We couldn't finish Lopez laundry. Tap to try again.")&&txt.includes(es?'REINTENTAR':'TRY AGAIN'));
    check('a build still running says you can leave', txt.includes(es?'Puedes salir de esta página':'You can leave this page'));
    check('no sideways scroll with the cards up', await noSideScroll(p));
    await p.screenshot({path:`${out}/cards-${lang}.png`});
    check('no push ask before a build is opened', !(await p.$('#bg-ask')));
    await p.click(`#bg-builds button[onclick="openBuild('${ID_READY}')"]`); await p.waitForTimeout(600);
    const shown=await p.evaluate(()=>({total:currentEstimate&&currentEstimate.totalBid,lines:currentEstimate&&currentEstimate.lineItems.length,screen:document.querySelector('.screen.active')?.id,client:document.getElementById('est-client').value}));
    check(`opening it shows the server's numbers: $${shown.total} = $${result.totalBid}, ${shown.lines} lines`, shown.total===result.totalBid&&shown.lines===result.lineItems.length&&shown.screen==='s-estimate'&&shown.client==='Rivera', JSON.stringify(shown));
    check('opening marks it opened on the server', calls.includes(`POST /api/builds/${ID_READY}/opened`), calls.join());
    const ask=await p.textContent('#bg-ask').catch(()=>'');
    check('after opening a build that finished while away: "Get a ping when it\'s ready?"', ask.includes(es?'¿Te avisamos cuando esté listo?':"Get a ping when it's ready?"), ask);
    check('no sideways scroll on the estimate with the ask showing', await noSideScroll(p));
    await p.screenshot({path:`${out}/ask-${lang}.png`});
    await p.click('#bg-ask button.ghost'); await p.waitForTimeout(150);
    check('"Not now" closes it and it is not asked again', !(await p.$('#bg-ask'))&&await p.evaluate(()=>localStorage.getItem('even_push_asked'))==='1');
    await p.click(`#bg-builds button[onclick^="retryBuild('${ID_FAIL}'"]`); await p.waitForTimeout(300);
    check('Try again calls the server retry', calls.includes(`POST /api/builds/${ID_FAIL}/retry`));
    check('no page errors', errs.length===0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n=== iPhone ===');
  const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  const CRIOS='Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1';
  for(const [name,opts,expect] of [['iPhone Safari tab',{ua:IPHONE},true],['iPhone Home Screen app',{ua:IPHONE,standalone:true},false],['Chrome on iPhone',{ua:CRIOS},false]]){
    const {p,ctx}=await session(b,opts);
    await p.click(`#bg-builds button[onclick="openBuild('${ID_READY}')"]`); await p.waitForTimeout(600);
    const t=await p.textContent('#bg-builds');
    const hint=t.includes('add Even to your Home Screen');
    check(`${name}: Add to Home Screen hint ${expect?'shows':'does not show'}`, hint===expect, t.slice(0,160));
    if(expect) await p.screenshot({path:`${out}/iphone-hint.png`});
    await ctx.close();
  }

  console.log('\n=== Signed out ===');
  { const {p,ctx}=await session(b,{signedIn:false});
    const vis=await p.evaluate(()=>getComputedStyle(document.getElementById('bg-signin-note')).display!=='none');
    check('signed out: "Sign in and Even keeps building even if you leave."', vis&&(await p.textContent('#bg-signin-note')).includes('Sign in and Even keeps building even if you leave.'));
    check('signed out: no builds strip', await p.evaluate(()=>document.getElementById('bg-builds').hidden));
    await ctx.close(); }
  { const {p,ctx}=await session(b,{});
    check('signed in: the sign-in line is hidden', await p.evaluate(()=>getComputedStyle(document.getElementById('bg-signin-note')).display==='none'));
    await ctx.close(); }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
