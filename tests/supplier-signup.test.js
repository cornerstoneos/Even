// Supplier signup page, even-os.com/suppliers (founder 2026-10-15), against the
// real server.js (Supabase REST + storage and Resend mocked). Acceptance: a test
// file in EN and in ES lands in the PRIVATE bucket, the row is stored, the
// founder gets an email (address read from a Railway variable, never in the
// repo), spam is stopped, the page is EN + ES with the approved wording.
const fs=require('fs'),os=require('os'),path=require('path'),{spawn,execFileSync}=require('child_process');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const root=path.join(__dirname,'..');
const page=fs.readFileSync(path.join(root,'suppliers.html'),'utf8');
console.log('\n=== the page ===');
check('approved line, EN', page.includes("We never publish or resell your price sheet. Your prices are used inside contractors' estimates, shown line by line on the job they're pricing."));
check('the same line in Spanish', page.includes('Nunca publicamos ni revendemos tu lista de precios.'));
check('never says "never shown to competitors"', !/competitor|competencia/i.test(page));
check('"Free for you" / "Gratis para ti"', page.includes('Free for you.')&&page.includes('Gratis para ti.'));
check('confirmation in both languages', page.includes("Got it, we'll be in touch")&&page.includes('Recibido, te contactaremos'));
check('all spec fields (company, contact, phone, email, counties, trades, file, note) + honeypot', ['f-company','f-contact','f-phone','f-email','id="counties"','id="trades"','f-file','f-note','f-website'].every(k=>page.includes(k)));
check('file types and 10 MB cap on the page', /accept="\.pdf,\.csv,\.xls,\.xlsx,\.jpg,\.jpeg,\.png"/.test(page)&&/MAX=10\*1024\*1024/.test(page));
check('no em dashes, no email addresses in the page', !page.includes('—')&&!/[\w.+-]+@[\w-]+\.\w+/.test(page.replace(/\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\{2,\}/g,'')));
const tmp=path.join(os.tmpdir(),'sup-'+Date.now()+'.js');fs.writeFileSync(tmp,[...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n'));
let ok=true;try{execFileSync(process.execPath,['--check',tmp]);}catch(e){ok=false;}
check('page script parses', ok);
const toml=fs.readFileSync(path.join(root,'netlify.toml'),'utf8');
check('even-os.com/suppliers and /suppliers-es serve the page', /from = "\/suppliers"\n  to = "\/suppliers\.html"\n  status = 200/.test(toml)&&/from = "\/suppliers-es"\n  to = "\/suppliers\.html"/.test(toml));
const srvSrc=fs.readFileSync(path.join(root,'server.js'),'utf8');
check('founder address only from Railway (FOUNDER_EMAIL / REPLY_TO_EMAIL); no address in server.js', /process\.env\.FOUNDER_EMAIL \|\| process\.env\.REPLY_TO_EMAIL/.test(srvSrc)&&!/[\w.+-]+@(gmail|even-os)\.com/i.test(srvSrc));

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'even-sup-'));
const DB=path.join(dir,'db.json'),LOG=path.join(dir,'log.txt');fs.writeFileSync(LOG,'');fs.writeFileSync(DB,'{}');
const port=41200+Math.floor(Math.random()*200);
const start=env=>new Promise((res,rej)=>{const p=spawn(process.execPath,[path.join(__dirname,'helpers','scope-cache-server.js')],{env:{...process.env,PORT:String(port),FAKE_DB:DB,FAKE_LOG:LOG,RATE_LIMIT_SCALE:'1',...env},stdio:['ignore','pipe','pipe']});p.stdout.on('data',d=>{if(/running on port/.test(d)) res(p);});p.on('exit',c=>rej(new Error('exit '+c)));});
const db=()=>JSON.parse(fs.readFileSync(DB,'utf8'));
const emails=()=>fs.readFileSync(LOG,'utf8').split('\n').filter(l=>l.startsWith('email ')).map(l=>JSON.parse(l.slice(6)));
let ipN=1;
const post=async(body,o={})=>{const r=await fetch(`http://localhost:${port}/api/supplier-signup`,{method:'POST',headers:{'content-type':'application/json',origin:o.origin||'https://even-os.com','x-forwarded-for':o.ip||'192.0.2.'+(ipN++),'user-agent':'Mozilla/5.0 Test'},body:JSON.stringify(body)});return {status:r.status,body:await r.json().catch(()=>({}))};};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const csv=Buffer.from('item,unit,price\nGAF Timberline HDZ,bundle,38.50\n').toString('base64');
const pdf=Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF').toString('base64');
(async()=>{
  let srv=await start({FOUNDER_EMAIL:'founder@example.test',RESEND_API_KEY:'re_test'});
  try{
    console.log('\n=== submissions ===');
    let r=await post({company:'Test Roofing Supply',contact_name:'Ana',phone:'954-555-0100',email:'ana@supplier.example',counties:['Broward','Nowhere'],trades:['Roofing','Bogus'],note:'Contractor tier',lang:'en',file:{name:'price sheet.csv',type:'text/csv',data:csv}});
    check('EN submission accepted', r.status===200&&r.body.ok, JSON.stringify(r));
    r=await post({company:'Suministros Prueba',phone:'305-555-0101',counties:['Miami-Dade'],trades:['Plumbing'],lang:'es',file:{name:'lista.pdf',type:'application/pdf',data:pdf}});
    check('ES submission accepted', r.status===200&&r.body.ok, JSON.stringify(r));
    await sleep(600);
    const rows=db().__supplier_signups||[], st=db().__storage||{};
    check('two rows stored with the details', rows.length===2&&rows[0].company==='Test Roofing Supply'&&rows[1].lang==='es', JSON.stringify(rows.map(x=>x.company)));
    check('unknown counties and trades dropped', JSON.stringify(rows[0].counties)==='["Broward"]'&&JSON.stringify(rows[0].trades)==='["Roofing"]');
    check('both files in the private bucket supplier-sheets (service key only)', Object.keys(st).length===2&&Object.keys(st).every(k=>k.startsWith('supplier-sheets/'))&&rows.every(x=>st['supplier-sheets/'+x.file_path]), JSON.stringify(Object.keys(st)));
    const em=emails();
    check('founder got one email per submission, file attached, to the address from the variable', em.length===2&&em.every(e=>e.to[0]==='founder@example.test'&&e.hasAttachment)&&em[0].subject==='New supplier price sheet: Test Roofing Supply', JSON.stringify(em.map(e=>[e.to,e.subject])));
    check('email has the details and a private link', /Company: Test Roofing Supply/.test(em[0].text)&&/Private link \(7 days\):/.test(em[0].text));
    check('until even-os.com is verified, the sender is Resend\'s test sender', em[0].from==='Even <onboarding@resend.dev>');
    check('rows marked emailed', (db().__supplier_signups||[]).every(x=>x.emailed===true));

    console.log('\n=== checks and spam ===');
    r=await post({company:'',lang:'en'});
    check('missing company, contact and file: 400 with the fields', r.status===400&&['company','contact','file'].every(f=>r.body.error.fields.includes(f)), JSON.stringify(r.body));
    r=await post({company:'X',phone:'1',file:{name:'virus.exe',type:'application/octet-stream',data:csv}});
    check('wrong file type refused', r.status===400&&r.body.error.fields.includes('file_type'));
    r=await post({company:'X',phone:'1',file:{name:'big.pdf',type:'application/pdf',data:Buffer.alloc(10*1024*1024+1).toString('base64')}});
    check('file over 10 MB refused', r.status===400&&r.body.error.fields.includes('file_size'), JSON.stringify(r.body));
    const before=(db().__supplier_signups||[]).length;
    r=await post({company:'Bot',phone:'1',website:'spam.example',file:{name:'a.csv',data:csv}});
    check('honeypot: answers ok, stores nothing', r.status===200&&(db().__supplier_signups||[]).length===before);
    r=await post({company:'X',phone:'1',file:{name:'a.csv',data:csv}},{origin:'https://evil.example'});
    check('another website cannot post', r.status===403);
    const codes=[];for(let i=0;i<6;i++){codes.push((await post({company:'Rapid '+i,phone:'1',file:{name:'a.csv',data:csv}},{ip:'192.0.2.250'})).status);}
    check(`rapid posts from one connection throttled (${codes.join(',')})`, codes.filter(c=>c===429).length===3, codes.join(','));
  }finally{ srv.kill(); }
  // Without the Railway variables nothing is emailed, the submission is still stored.
  fs.writeFileSync(LOG,''); fs.writeFileSync(DB,'{}');
  srv=await start({FOUNDER_EMAIL:'',REPLY_TO_EMAIL:'',RESEND_API_KEY:''});
  try{
    const r=await post({company:'No Email Co',phone:'1',file:{name:'a.csv',data:csv}});
    await sleep(300);
    check('no founder address set: stored, no email sent', r.status===200&&(db().__supplier_signups||[]).length===1&&emails().length===0&&!db().__supplier_signups[0].emailed);
  }finally{ srv.kill(); }
  console.log(`\n──────────────\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
