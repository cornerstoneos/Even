// Browser checks (Playwright), not part of tests/run.sh. Usage: node tests/acceptance/<this file> index.html <outDir>
// Browser checks for bugs 1, 2, 4 (2026-10-06). Mock API server + mocked Supabase sign-in.
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs'),{spawn}=require('child_process');
const OUT=process.argv[3], PORT=39800+Math.floor(Math.random()*90), dir=fs.mkdtempSync('/tmp/bugs-');
let pass=0,fail=0; const check=(n,c,d)=>{c?(pass++,console.log('  PASS  '+n)):(fail++,console.log('  FAIL  '+n+'\n         '+(d||'')))};
(async()=>{
  fs.writeFileSync(dir+'/log.txt','');
  const srv=spawn(process.execPath,[''+require('path').join(__dirname,'..','helpers')+'/scope-cache-server.js'],{env:{...process.env,PORT:String(PORT),FAKE_DB:dir+'/db.json',FAKE_LOG:dir+'/log.txt',RATE_LIMIT_SCALE:'50'}});
  await new Promise(r=>srv.stdout.on('data',d=>{if(/running/.test(d))r();}));
  const html=fs.readFileSync(process.argv[2],'utf8').replace("const API_ORIGIN = 'https://even-production.up.railway.app';","const API_ORIGIN = 'https://api.even.test';");
  const browser=await chromium.launch();
  const SB='https://klgofcqrncabfhskiijn.supabase.co';
  const mk=async(opts={})=>{
    const ctx=await browser.newContext({viewport:opts.vp||{width:390,height:844},deviceScaleFactor:2}); const page=await ctx.newPage();
    const st={estBodies:[],slowSignup:opts.slowSignup||0,apiDelay:opts.apiDelay||0};
    page.on('pageerror',e=>console.log('  pageerror',e.message));
    page.on('dialog',d=>{ st.lastDialog=d.message(); (opts.acceptDialogs?d.accept():d.dismiss()); });
    await page.route('**/*',async r=>{const req=r.request(),u=req.url();
      if(u.replace(/[?#].*$/,'')==='https://even-os.com/') return r.fulfill({status:200,contentType:'text/html',body:html});
      if(u.startsWith(SB+'/auth/v1/signup')||u.startsWith(SB+'/auth/v1/token')){
        if(st.slowSignup) await new Promise(z=>setTimeout(z,st.slowSignup));
        const now=Math.floor(Date.now()/1000);
        return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'tok-free',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'free@example.com',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}})});
      }
      if(u.startsWith(SB+'/auth/v1/authorize')) return r.fulfill({status:200,contentType:'text/html',body:'<html><body><h1>Fake Google sign-in</h1></body></html>'});
      if(u.startsWith(SB+'/auth/v1/user')) return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'11111111-1111-1111-1111-111111111111',email:'free@example.com',aud:'authenticated'})});
      if(u.startsWith(SB+'/rest/v1/')) return r.fulfill({status:200,contentType:'application/json',body:'[]'});
      if(u.startsWith('https://api.even.test')){
        if(/\/api\/estimate$/.test(u)){ st.estBodies.push(req.postData()); if(st.apiDelay) await new Promise(z=>setTimeout(z,st.apiDelay)); }
        const resp=await fetch(u.replace('https://api.even.test','http://localhost:'+PORT),{method:req.method(),headers:req.headers(),body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer()});
        const b=Buffer.from(await resp.arrayBuffer()); const rh={}; resp.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k))rh[k]=v;}); return r.fulfill({status:resp.status,headers:rh,body:b}); }
      try{const h={...req.headers()};delete h['accept-encoding'];const resp=await fetch(u,{method:req.method(),headers:h});const b=Buffer.from(await resp.arrayBuffer());const rh={};resp.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k))rh[k]=v;});await r.fulfill({status:resp.status,headers:rh,body:b});}catch(e){await r.abort().catch(()=>{});}});
    await page.goto('https://even-os.com/',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(2500);
    return {ctx,page,st};
  };
  const fill=async(page,job={})=>page.evaluate(j=>{navigate('input');document.getElementById('est-trade').value=j.trade||'Plumbing';document.getElementById('est-location').value=j.loc??'Somewhere, TX';document.getElementById('est-sqft').value=j.sqft||'1800';document.getElementById('scope-text').value=j.scope||'Replace 40 gal water heater';document.getElementById('est-location').dispatchEvent(new Event('input',{bubbles:true}));},job).then(()=>page.waitForTimeout(600));
  const runAll=async(page)=>{ await page.locator('#gen-btn').click(); await page.waitForFunction(()=>getComputedStyle(document.getElementById('calc-btn')).display!=='none'&&!document.getElementById('calc-btn').disabled,null,{timeout:60000}); await page.waitForTimeout(500); await page.locator('#calc-btn').click(); await page.waitForFunction(()=>{try{return document.getElementById('s-estimate').classList.contains('active')&&currentEstimate&&currentEstimate.totalBid>0}catch(e){return false}},null,{timeout:60000}); await page.waitForTimeout(800); };
  const state=page=>page.evaluate(()=>({screen:[...document.querySelectorAll('.screen.active')].map(s=>s.id).join(','),total:(()=>{try{return currentEstimate&&currentEstimate.totalBid}catch(e){return null}})(),loc:document.getElementById('est-location').value,scope:document.getElementById('scope-text').value,trade:document.getElementById('est-trade').value,busy:window._runBusy}));

  console.log('\n=== Bug 1: repeat taps never lose the job ===');
  { const {ctx,page,st}=await mk({apiDelay:3000});
    await fill(page);
    await page.locator('#gen-btn').dblclick();
    await page.waitForTimeout(200);
    await page.mouse.click(195,700); await page.mouse.click(195,760); // second taps landing on the next screen
    await page.waitForFunction(()=>getComputedStyle(document.getElementById('calc-btn')).display!=='none',null,{timeout:60000});
    check('double-tap Analyze: one questions request, job intact', st.estBodies.length===1&&(await state(page)).scope.startsWith('Replace'), JSON.stringify(await state(page)));
    await page.waitForTimeout(600);
    await page.locator('#calc-btn').click({clickCount:3});
    await page.waitForTimeout(800);
    await page.evaluate(()=>{ document.querySelectorAll('.topbar-brand').forEach(b=>b.click()); startNewEstimate(); }); // logo / Start Over while loading
    const mid=await state(page);
    check('Start Over / logo while the estimate is loading: refused, job kept', mid.scope.startsWith('Replace')&&mid.loc==='Somewhere, TX'&&mid.busy>0, JSON.stringify(mid));
    await page.waitForFunction(()=>{try{return document.getElementById('s-estimate').classList.contains('active')&&currentEstimate&&currentEstimate.totalBid>0}catch(e){return false}},null,{timeout:60000});
    check('triple-tap Build Estimate: one estimate request, estimate arrives', st.estBodies.length===2&&(await state(page)).total>0, st.estBodies.length+' requests');
    await page.waitForTimeout(600);
    await page.evaluate(()=>startNewEstimate());   // dialog dismissed
    check('Start Over on a finished estimate asks first; "Cancel" keeps it', /Start a new estimate/.test(st.lastDialog||'')&&(await state(page)).total>0, st.lastDialog);
    await ctx.close(); }
  { const {ctx,page,st}=await mk({acceptDialogs:true});
    await fill(page); await runAll(page);
    await page.evaluate(()=>startNewEstimate());
    const s2=await state(page);
    check('Start Over confirmed: estimate cleared, scope and sq ft cleared, city and trade kept', s2.screen==='s-input'&&s2.total==null&&s2.scope===''&&s2.loc==='Somewhere, TX'&&s2.trade==='Plumbing', JSON.stringify(s2));
    await page.evaluate(()=>{document.getElementById('est-location').value='';document.getElementById('scope-text').value='Replace faucet';});
    await page.waitForTimeout(600); const n0=st.estBodies.length; st.lastDialog='';
    await page.locator('#gen-btn').click(); await page.waitForTimeout(800);
    check('Analyze with no city: stopped with a message, no request', /city or ZIP/.test(st.lastDialog)&&st.estBodies.length===n0, st.lastDialog+' / '+(st.estBodies.length-n0)+' requests');
    await ctx.close(); }

  console.log('\n=== Bug 4: signing in never changes the same job ===');
  { const {ctx,page,st}=await mk({acceptDialogs:true});
    await fill(page); await runAll(page);
    const out1=await page.evaluate(()=>currentEstimate.totalBid); const bodies1=st.estBodies.slice();
    // sign up from the proposal button (the founder's path), then run the same job again
    await page.locator('#s-estimate .pdf-card').nth(1).click();
    await page.fill('#auth-email','free@example.com'); await page.fill('#auth-password','secret123');
    await page.locator('#auth-submit-btn').click();
    await page.waitForFunction(()=>!!currentUser,null,{timeout:15000});
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{navigate('input');});      // back to the form, fields as they were
    await page.waitForTimeout(600);
    await fill(page);                                       // same job typed again
    st.estBodies.length=0; await runAll(page);
    const out2=await page.evaluate(()=>currentEstimate.totalBid);
    const strip=b=>{const j=JSON.parse(b); return JSON.stringify(j.messages);};
    check('same job signed out vs signed in: identical AI requests', bodies1.length===2&&st.estBodies.length===2&&strip(bodies1[0])===strip(st.estBodies[0])&&strip(bodies1[1])===strip(st.estBodies[1]), 'differs');
    check('same total signed out and signed in', out1===out2, out1+' vs '+out2);
    await ctx.close(); }

  console.log('\n=== Bug 2: sign-up never freezes ===');
  { const {ctx,page}=await mk({acceptDialogs:true});
    await fill(page); await runAll(page);
    await page.locator('#s-estimate .pdf-card').nth(1).click();
    await page.screenshot({path:OUT+'/signup-panel-phone.png'});
    await page.fill('#auth-email','free@example.com'); await page.fill('#auth-password','secret123');
    const t0=Date.now(); await page.locator('#auth-submit-btn').click();
    await page.waitForFunction(()=>document.getElementById('topbar-auth-panel').style.display==='none',null,{timeout:10000});
    await page.waitForTimeout(1200);
    const r=await page.evaluate(()=>({proposal:document.getElementById('proposal-section').style.display,btn:document.getElementById('auth-submit-btn').textContent,disabled:document.getElementById('auth-submit-btn').disabled,user:!!currentUser}));
    check('email sign-up: panel closes, proposal opens, button reset', r.user&&r.proposal==='block'&&!r.disabled&&r.btn!=='...', JSON.stringify(r)+' '+(Date.now()-t0)+'ms');
    await page.screenshot({path:OUT+'/after-signup-phone.png'});
    await ctx.close(); }
  { const {ctx,page}=await mk({slowSignup:26000,acceptDialogs:true});
    await page.evaluate(()=>{toggleAuthPanel();switchAuthTab('signup');});
    await page.fill('#auth-email','slow@example.com'); await page.fill('#auth-password','secret123');
    await page.locator('#auth-submit-btn').click();
    await page.waitForTimeout(21500);
    const r=await page.evaluate(()=>({err:document.getElementById('auth-error').textContent,btn:document.getElementById('auth-submit-btn').textContent,disabled:document.getElementById('auth-submit-btn').disabled}));
    check('sign-up service hangs: after 20s an error shows and the button works again', /taking too long/.test(r.err)&&!r.disabled&&r.btn==='Create Account', JSON.stringify(r));
    await ctx.close(); }
  { const {ctx,page}=await mk({acceptDialogs:true});
    await fill(page); await runAll(page);
    const before=await page.evaluate(()=>currentEstimate.totalBid);
    await page.locator('#s-estimate .pdf-card').nth(1).click();
    await Promise.all([page.waitForURL(/auth\/v1\/authorize/,{timeout:15000}),page.locator('#topbar-auth-panel button:has-text("Continue with Google")').click()]);
    await page.goBack({waitUntil:'domcontentloaded'}); await page.waitForTimeout(4000);
    const r=await page.evaluate(()=>({screen:[...document.querySelectorAll('.screen.active')].map(s=>s.id).join(','),total:(()=>{try{return currentEstimate&&currentEstimate.totalBid}catch(e){return null}})(),btn:document.getElementById('auth-submit-btn').textContent,disabled:document.getElementById('auth-submit-btn').disabled,loc:document.getElementById('est-location').value,scope:document.getElementById('scope-text').value,toast:document.querySelector('.toast')?.textContent||document.body.innerText.match(/Google sign-in wasn.t completed[^\n]*/)?.[0]||''}));
    check('backing out of Google: lands on the same estimate, controls usable', r.screen==='s-estimate'&&r.total===before&&!r.disabled, JSON.stringify(r));
    check('...with the job fields kept and a message', r.loc==='Somewhere, TX'&&r.scope.startsWith('Replace')&&/Google/.test(r.toast), JSON.stringify(r));
    await page.screenshot({path:OUT+'/back-from-google-phone.png'});
    await ctx.close(); }
  { const {ctx,page}=await mk({vp:{width:390,height:844}});
    await page.evaluate(()=>{toggleAuthPanel();switchAuthTab('login');});
    await page.screenshot({path:OUT+'/signin-panel-phone.png'});
    const box=await page.locator('#topbar-auth-panel').boundingBox();
    check('sign-in panel fits a phone screen', box&&box.x>=0&&box.x+box.width<=390&&box.y+box.height<=844, JSON.stringify(box));
    await ctx.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close(); srv.kill(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
