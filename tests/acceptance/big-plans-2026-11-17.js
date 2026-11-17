// Browser check (Playwright), not part of tests/run.sh: big plan sets
// (founder 2026-11-17). Uploads a real oversize plan set through the app in
// Spanish and checks: (A) Plumbing -> only the plumbing + site/notes sheets are
// kept, under 15 MB, sent inline, Spanish toast; (B) General Contractor (no sheet
// prefix) -> the full file goes to /api/plan-upload and the scope request
// references the returned file id; (C) a file over 60 MB gets the Spanish
// "too large" message. The AI and the upload endpoint are mocked.
// Usage: node tests/acceptance/big-plans-2026-11-17.js index.html <plan-set.pdf> <outDir>
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const [htmlPath,planPath,out]=process.argv.slice(2);
const html=fs.readFileSync(htmlPath,'utf8');
const API='https://even-production.up.railway.app';
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const SCOPE={projectName:'Plomería casa nueva',tradeBreakdown:[{trade:'Plomería',icon:'x',items:['Rough-in']}],keyFacts:['Casa nueva'],questions:[{id:'q1',question:'¿Material?',options:['CPVC','PEX']}]};
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch();
  const runCase=async(trade,file,label)=>{
    const ctx=await browser.newContext({viewport:{width:390,height:844}}); const page=await ctx.newPage();
    const seen={scope:null,upload:null};
    page.on('pageerror',e=>console.log('pageerror',e.message));
    await page.route('**/*',async r=>{
      const req=r.request(),u=req.url();
      if(u.replace(/[?#].*$/,'')==='https://even-os.com/') return r.fulfill({status:200,contentType:'text/html',body:html});
      if(u.startsWith(API+'/api/plan-upload')){ seen.upload={size:(req.postDataBuffer()||Buffer.alloc(0)).length,ct:req.headers()['content-type']}; return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({fileId:'file_testABCDEFGH1234'})}); }
      if(u.startsWith(API+'/api/estimate')){ const b=JSON.parse(req.postData()||'{}'); if(b.even_kind==='scope') seen.scope=b; return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:[{type:'text',text:JSON.stringify(SCOPE)}],stop_reason:'end_turn'})}); }
      if(u.startsWith(API+'/api/usage')) return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({signedIn:false,isPro:false,used:0,limit:3,remaining:3,allowed:true})});
      if(u.startsWith(API+'/api/markets')) return r.fulfill({status:200,contentType:'application/json',body:'[]'});
      if(u.startsWith(API)) return r.fulfill({status:200,contentType:'application/json',body:'{}'});
      try{const h={...req.headers()};delete h['accept-encoding'];const resp=await fetch(u,{method:req.method(),headers:h,body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer()});const b=Buffer.from(await resp.arrayBuffer());const rh={};resp.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k))rh[k]=v;});await r.fulfill({status:resp.status,headers:rh,body:b});}catch(e){await r.abort().catch(()=>{});}
    });
    await page.goto('https://even-os.com/?lang=es',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(2000);
    await page.selectOption('#est-trade',trade);
    const toasts=[];
    await page.exposeFunction('_logToast',t=>toasts.push(t));
    await page.evaluate(()=>{const o=window.showToast; window.showToast=(m,d)=>{window._logToast(String(m)); return o(m,d);};});
    await page.setInputFiles('#doc-in',file);
    // Wait for the file to be read (trimmed or uploaded) or rejected.
    for(let i=0;i<240;i++){ const st=await page.evaluate(()=>({n:uploadedDocs.length,p:window._docsPending||0})); if(st.n>0||(st.p===0&&i>4)) break; await page.waitForTimeout(500); }
    await page.waitForTimeout(500);
    const docs=await page.evaluate(()=>uploadedDocs.map(d=>({fileId:d.fileId||null,b64len:d.data?d.data.length:0,sheets:d.sheets||null})));
    let pages=null;
    if(docs[0]&&docs[0].b64len){
      const b64=await page.evaluate(()=>uploadedDocs[0].data);
      const f=path.join(out,`${label}-trimmed.pdf`); fs.writeFileSync(f,Buffer.from(b64,'base64'));
      pages=Number((execFileSync('pdfinfo',[f]).toString().match(/Pages:\s+(\d+)/)||[])[1]);
    }
    if(docs.length){
      await page.fill('#est-location','Fort Lauderdale, FL');
      await page.click('#gen-btn'); await page.waitForTimeout(3000);
    }
    await page.screenshot({path:path.join(out,`${label}.png`)});
    await ctx.close();
    return {docs,toasts,seen,pages};
  };

  console.log('\n=== (A) Plumbing: keep only the plumbing + site/notes sheets ===');
  const A=await runCase('Plumbing',planPath,'A-plumbing');
  const rawBytes=A.docs[0]?Math.floor(A.docs[0].b64len*3/4):0;
  check('the 17 MB set is accepted', A.docs.length===1, JSON.stringify(A.docs)+' '+A.toasts.join(' | '));
  check('it was trimmed in the browser (no upload)', A.docs[0]&&!A.docs[0].fileId&&!A.seen.upload, JSON.stringify(A.docs));
  check('trimmed file is under 15 MB', rawBytes>0&&rawBytes<=15*1024*1024, rawBytes);
  check('kept sheets are the plumbing sheets plus site/notes', A.docs[0]&&JSON.stringify(A.docs[0].sheets)==='["SP-1","A-0","P-1.1","P-1.2","P-1.3","P-2.1","P-2.2","P-3.1","P-3.2","P-4.1"]', JSON.stringify(A.docs[0]&&A.docs[0].sheets));
  check('the PDF really has those 10 pages', A.pages===10, A.pages);
  check('the toast says so in Spanish', A.toasts.some(t=>/Usamos las 8 hojas de plomería/.test(t)), A.toasts.join(' | '));
  const aDoc=A.seen.scope&&A.seen.scope.messages[0].content[0];
  check('the scope request carries the trimmed PDF inline', aDoc&&aDoc.type==='document'&&aDoc.source.type==='base64', JSON.stringify(aDoc).slice(0,120));

  console.log('\n=== (B) General Contractor: no sheet prefix, the full set is uploaded ===');
  const B=await runCase('General Contractor',planPath,'B-gc');
  check('the full file was uploaded as a PDF', B.seen.upload&&B.seen.upload.size===fs.statSync(planPath).size&&/application\/pdf/.test(B.seen.upload.ct||''), JSON.stringify(B.seen.upload));
  check('the doc is held as a file id', B.docs[0]&&B.docs[0].fileId==='file_testABCDEFGH1234', JSON.stringify(B.docs));
  const bDoc=B.seen.scope&&B.seen.scope.messages[0].content[0];
  check('the scope request references the file id', bDoc&&bDoc.source&&bDoc.source.type==='file'&&bDoc.source.file_id==='file_testABCDEFGH1234', JSON.stringify(bDoc));
  check('the upload toast is Spanish', B.toasts.some(t=>/subiendo el archivo completo/.test(t)), B.toasts.join(' | '));

  console.log('\n=== (C) over 60 MB: a clear Spanish message ===');
  const huge=path.join(out,'huge.pdf'); fs.writeFileSync(huge,Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(61*1024*1024,65)]));
  const C=await runCase('Plumbing',huge,'C-huge');
  check('it is refused with the Spanish message', C.docs.length===0&&C.toasts.some(t=>/es demasiado grande \(máx\. 60 MB\)\. Sube solo las páginas de tu oficio/.test(t)), C.toasts.join(' | '));
  fs.unlinkSync(huge);

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
