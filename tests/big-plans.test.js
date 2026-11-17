// Big plan sets (founder 2026-11-17): the first real job was a 17 MB, 45-page
// permit set and the app refused it. Over 15 MB the browser keeps only the
// trade's sheets; if that can't get small enough it uploads the whole set to
// POST /api/plan-upload, which stores it with the AI and returns a file id the
// scope request then references. Checked here against the real server.js
// (Anthropic mocked): only PDFs are stored, the same file gets the same id,
// only ids this server issued are accepted, the Files beta header is sent, and
// the browser code has the trim + upload + bilingual messages.
const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const {buildRequest,planFileIds}=require('../lib/guard');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'even-bigplans-'));
const DB=path.join(dir,'db.json'),LOG=path.join(dir,'log.txt');fs.writeFileSync(LOG,'');
const port=40100+Math.floor(Math.random()*300);
const APP='https://even-os.com';
const H=(extra={})=>({origin:APP,'x-even-device':'dev-bigplans-xxxxxxxxxxxx','x-forwarded-for':'203.0.113.77','user-agent':'Mozilla/5.0 TestPhone',...extra});
const scopeBody=src=>({even_kind:'scope',model:'claude-sonnet-5',max_tokens:3000,output_config:{effort:'low'},messages:[{role:'user',content:[{type:'document',source:src},{type:'text',text:'Construction estimating. Trade:Plumbing|Location:Fort Lauderdale\nSCOPE: See attached plans for scope of work.'}]}]});
const logLines=()=>fs.readFileSync(LOG,'utf8').split('\n');

console.log('\n=== guard: a file reference is a valid attachment, nothing else rides along ===');
const ok=buildRequest(scopeBody({type:'file',file_id:'file_abc12345XYZ'}));
check('a scope request with a plan-file reference is allowed', !ok.error, ok.error);
check('the reference is passed through as a file source only', !ok.error&&JSON.stringify(ok.body.messages[0].content[0])==='{"type":"document","source":{"type":"file","file_id":"file_abc12345XYZ"}}', JSON.stringify(ok.body&&ok.body.messages[0].content[0]));
check('planFileIds finds it', JSON.stringify(planFileIds(ok.body))==='["file_abc12345XYZ"]');
for(const [what,src] of [['a made-up id shape',{type:'file',file_id:'../../etc'}],['a url source',{type:'url',url:'https://evil.example/x.pdf'}],['an id with spaces',{type:'file',file_id:'file_ab cd efgh'}]]){
  const r=buildRequest(scopeBody(src)); check(`rejected: ${what}`, !!r.error, JSON.stringify(r.body&&r.body.messages));
}
const extra=buildRequest(scopeBody({type:'file',file_id:'file_abc12345XYZ',url:'https://evil.example'}));
check('extra fields on a file source are dropped', !extra.error&&!JSON.stringify(extra.body.messages).includes('evil'), JSON.stringify(extra.body&&extra.body.messages));

const start=()=>new Promise((res,rej)=>{
  const p=spawn(process.execPath,[path.join(__dirname,'helpers','scope-cache-server.js')],{env:{...process.env,PORT:String(port),FAKE_DB:DB,FAKE_LOG:LOG,RATE_LIMIT_SCALE:'20'},stdio:['ignore','pipe','pipe']});
  p.stdout.on('data',d=>{if(/running on port/.test(d)) res(p);}); p.stderr.on('data',()=>{}); p.on('exit',c=>rej(new Error('server exited '+c)));
});
(async()=>{
  const srv=await start();
  const up=async(buf,h={})=>{const r=await fetch(`http://localhost:${port}/api/plan-upload`,{method:'POST',headers:H({'content-type':'application/pdf',...h}),body:buf});return {status:r.status,j:await r.json().catch(()=>({}))};};
  console.log('\n=== /api/plan-upload ===');
  const pdf=Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(18*1024*1024,65)]);   // an 18 MB "plan set"
  const a=await up(pdf);
  check('an 18 MB PDF is stored and gets a file id', a.status===200&&/^file_/.test(a.j.fileId||''), JSON.stringify(a));
  const upl=logLines().filter(l=>l.startsWith('files-upload '));
  check('it went to the AI file storage with the Files beta header, full size, as a PDF', upl.length===1&&/files-api-2025-04-14/.test(upl[0])&&upl[0].includes(`"size":${pdf.length}`)&&upl[0].includes('application/pdf'), upl.join(' | '));
  const b=await up(pdf);
  check('the same file again gets the same id without a second upload', b.j.fileId===a.j.fileId&&logLines().filter(l=>l.startsWith('files-upload ')).length===1, JSON.stringify(b));
  const notPdf=await up(Buffer.from('<html>not a pdf</html>'),{'x-even-lang':'es'});
  check('a non-PDF is refused, in Spanish when the app is in Spanish', notPdf.status===400&&notPdf.j.error?.code==='bad_file'&&/no es un PDF/.test(notPdf.j.error?.message||''), JSON.stringify(notPdf));
  const other=await fetch(`http://localhost:${port}/api/plan-upload`,{method:'POST',headers:H({origin:'https://evil.example','content-type':'application/pdf'}),body:pdf});
  check('another website cannot upload', other.status===403, other.status);

  console.log('\n=== the scope request with the stored file ===');
  const run=async body=>{const r=await fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:H({'content-type':'application/json'}),body:JSON.stringify(body)});return {status:r.status,j:await r.json().catch(()=>({}))};};
  const s1=await run(scopeBody({type:'file',file_id:a.j.fileId}));
  const req=logLines().filter(l=>l.startsWith('req ')).pop()||'';
  check('the scope runs with the issued file id', s1.status===200, JSON.stringify(s1));
  check('the AI request carries the file reference and the Files beta header', /"fileDoc":true/.test(req)&&/files-api-2025-04-14/.test(req), req);
  const before=logLines().filter(l=>l==='anthropic').length;
  const s2=await fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:H({'content-type':'application/json','x-even-lang':'es'}),body:JSON.stringify(scopeBody({type:'file',file_id:'file_notissuedbyus123'}))});
  const s2j=await s2.json().catch(()=>({}));
  check('an id this server never issued is refused (no peeking at other files), in Spanish', s2.status===400&&s2j.error?.code==='plan_expired'&&/Súbelos otra vez/.test(s2j.error?.message||''), JSON.stringify(s2j));
  check('and it never reached the AI', logLines().filter(l=>l==='anthropic').length===before);
  const plain=await run(scopeBody({type:'base64',media_type:'application/pdf',data:'JVBERi0xLjcK'}));
  const req2=logLines().filter(l=>l.startsWith('req ')).pop()||'';
  check('a normal small PDF still works and does not send the Files header', plain.status===200&&!/files-api/.test(req2), req2);

  console.log('\n=== the browser side (index.html) ===');
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  check('over 15 MB is no longer a hard stop', !/is too large \(max 15MB\)/.test(html));
  check('plumbing keeps P- sheets, electrical E-, HVAC M-', /Plumbing:\['P'\]/.test(html)&&/Electrical:\['E'\]/.test(html)&&/HVAC:\['M','H'\]/.test(html));
  check('site plan and general-notes sheets are kept for every trade', /GENERAL_SHEET_RE=\/\^\(SP\|CS\|COV\|G\|T\)/.test(html));
  check('a stored plan set is sent as a file reference', /doc\.fileId\?\{type:'document',source:\{type:'file',file_id:doc\.fileId\}\}/.test(html));
  check('Analyze waits while plans are still being read', /_docsPending>0\)\{showToast\(appLang==='es'\?'Todavía estamos leyendo tus planos/.test(html));
  check('the too-big, too-many-pages and upload-failed messages exist in Spanish', /Sube solo las páginas de tu oficio/.test(html)&&/tiene más de \$\{MAX_PDF_PAGES\} páginas/.test(html)&&/No pudimos subir/.test(html));
  check('PDF libraries load from cdnjs with exact versions, only when needed', /pdf\.js\/3\.11\.174\/pdf\.min\.js/.test(html)&&/pdf-lib\/1\.17\.1\/pdf-lib\.min\.js/.test(html)&&!/<script src="[^"]*pdf-lib/.test(html));

  srv.kill();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
