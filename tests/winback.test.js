// "Your free estimates are back" win-back email (founder spec 2026-10-31), end to
// end against the real server.js with Supabase and Resend mocked.
// Acceptance: the dry run lists the right people and excludes internal accounts;
// a test user gets the top-up + email (test mode = Resend mocked); a second run
// within 30 days does nothing; unsubscribe stops future sends; switch off =
// nothing sends; at most 3 times ever; the free limit really goes back up.
const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'even-winback-'));
const DB=path.join(dir,'db.json'),LOG=path.join(dir,'log.txt');fs.writeFileSync(LOG,'');
const D=86400000, ago=d=>new Date(Date.now()-d*D).toISOString();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const FREE='11111111-1111-1111-1111-111111111111';
const users={
  [id(1)]:{email:'usedall@gmail.com',estimate_count:5,is_pro:false,created_at:ago(3),prefs:{lang:'en'}},          // used all 5: yes
  [id(2)]:{email:'idle@gmail.com',estimate_count:1,is_pro:false,created_at:ago(40),prefs:{lang:'es'}},          // ran 1, 20 days ago: yes (ES)
  [id(3)]:{email:'active@gmail.com',estimate_count:2,is_pro:false,created_at:ago(30),prefs:{}},                  // ran one 2 days ago: no
  [id(4)]:{email:'pro@gmail.com',estimate_count:9,is_pro:true,created_at:ago(60),prefs:{}},                      // Pro: no
  [id(5)]:{email:'founder@even-test.dev',estimate_count:5,is_pro:false,created_at:ago(60),prefs:{}},             // FOUNDER_EMAIL: no
  [id(6)]:{email:'tester@example.com',estimate_count:5,is_pro:false,created_at:ago(60),prefs:{}},                // test address: no
  [id(7)]:{email:'team@gmail.com',estimate_count:5,is_pro:false,created_at:ago(60),prefs:{},is_internal:true},   // internal flag: no
  [id(8)]:{email:'unsub@gmail.com',estimate_count:5,is_pro:false,created_at:ago(60),prefs:{},email_unsub:true},  // unsubscribed: no
  [id(9)]:{email:'thrice@gmail.com',estimate_count:5,is_pro:false,created_at:ago(200),prefs:{},winback_count:3,winback_last_at:ago(90)}, // 3 times: no
  [id(10)]:{email:'recent@gmail.com',estimate_count:5,is_pro:false,created_at:ago(60),prefs:{},winback_count:1,winback_last_at:ago(10)}, // 10 days ago: no
  [id(11)]:{email:'listed@gmail.com',estimate_count:5,is_pro:false,created_at:ago(60),prefs:{}},                 // WINBACK_EXCLUDE: no
  [FREE]:{email:'free@example.com',estimate_count:5,is_pro:false,created_at:ago(60),prefs:{}}                    // test account
};
fs.writeFileSync(DB,JSON.stringify({__users:users,__events:[{event:'estimate_run',user_id:id(2),created_at:ago(20)},{event:'estimate_run',user_id:id(3),created_at:ago(2)}]}));
const base={...process.env,FAKE_DB:DB,FAKE_LOG:LOG,WINBACK_SECRET:'wb-secret-test-123',FOUNDER_EMAIL:'founder@even-test.dev',WINBACK_EXCLUDE:'listed@gmail.com, other@x.com',
  RESEND_API_KEY:'re_test',WELCOME_FROM_EMAIL:'Lenny <lenny@test.example>',PUBLIC_API_ORIGIN:'https://api.test.example',USAGE_HASH_SECRET:'hash-secret'};
let port=42100+Math.floor(Math.random()*300);
const start=env=>new Promise((res,rej)=>{ port++;
  const p=spawn(process.execPath,[path.join(__dirname,'helpers','scope-cache-server.js')],{env:{...base,...env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  p.stdout.on('data',d=>{if(/running on port/.test(d)) res(p);}); p.stderr.on('data',()=>{}); p.on('exit',c=>rej(new Error('server exited '+c)));});
const stop=p=>new Promise(r=>{p.removeAllListeners('exit');p.on('exit',r);p.kill();});
const db=()=>{for(let i=0;;i++){try{return JSON.parse(fs.readFileSync(DB,'utf8'));}catch(e){if(i>20)throw e;}}};
const mails=()=>fs.readFileSync(LOG,'utf8').split('\n').filter(l=>l.startsWith('email ')).map(l=>JSON.parse(l.slice(6)));
const run=async(body,secret='wb-secret-test-123')=>{const r=await fetch(`http://localhost:${port}/api/winback`,{method:'POST',headers:{'content-type':'application/json',...(secret?{'x-winback-secret':secret}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json().catch(()=>({}))};};

(async()=>{
  console.log('\n=== Locked ===');
  let srv=await start({WINBACK_EMAIL_ENABLED:'1'});
  check('no secret: refused', (await run({dryRun:true},null)).status===401);
  check('wrong secret: refused', (await run({dryRun:true},'nope')).status===401);

  console.log('\n=== Dry run ===');
  let r=await run({});
  const ids=(r.body.list||[]).map(x=>x.id).sort();
  check('dry run is the default and sends nothing', r.body.dryRun===true&&mails().length===0);
  check('lists exactly: used all their free estimates, and idle 14+ days', JSON.stringify(ids)===JSON.stringify([id(1),id(2)].sort()), JSON.stringify(r.body.list));
  check('reasons are right', r.body.list.find(x=>x.id===id(1)).why==='used_all'&&r.body.list.find(x=>x.id===id(2)).why==='idle_14_days');
  const sk=r.body.skipped;
  check('excludes internal accounts (founder address, list, flag, test addresses)', sk.internal===5&&!ids.includes(FREE), JSON.stringify(sk));
  check('excludes active, Pro is never even read, unsubscribed never read, 3-times and 30-day limits', sk.active===1&&sk.max_times===1&&sk.sent_recently===1&&!ids.includes(id(4))&&!ids.includes(id(8)), JSON.stringify(sk));
  check('the answer never carries a full email address (Action logs are public)', !JSON.stringify(r.body).includes('@gmail.com')&&r.body.list[0].email.includes('***'), JSON.stringify(r.body.list));
  await stop(srv);

  console.log('\n=== Switch off ===');
  srv=await start({});
  r=await run({dryRun:false});
  check('switch off: nothing sends, nobody is topped up', r.body.reason==='off'&&r.body.sent===0&&mails().length===0&&!db().__users[id(1)].winback_count, JSON.stringify(r.body));
  await stop(srv);

  console.log('\n=== Send (test mode: Resend mocked) ===');
  srv=await start({WINBACK_EMAIL_ENABLED:'1'});
  r=await run({dryRun:false});
  const M=mails();
  check('two emails sent', r.body.sent===2&&M.length===2, JSON.stringify(r.body));
  const en=M.find(m=>m.to[0]==='usedall@gmail.com'), es=M.find(m=>m.to[0]==='idle@gmail.com');
  check("EN subject 'Your 3 free estimates are back', from the welcome sender", en&&en.subject==='Your 3 free estimates are back'&&en.from==='Lenny <lenny@test.example>');
  check("ES subject 'Tus 3 estimados gratis están de vuelta' (their language)", es&&es.subject==='Tus 3 estimados gratis están de vuelta');
  check("body: one line on what Even does, 'Clarity before you bid.', one button, unsubscribe link", en&&/Even builds the full estimate/.test(en.text)&&en.text.includes('Clarity before you bid.')&&en.text.includes('Run an estimate: https://even-os.com/')&&/Unsubscribe: https:\/\/api\.test\.example\/api\/unsubscribe\?u=/.test(en.text));
  check("ES body: 'Claridad antes de cotizar.' and 'Haz un estimado'", es&&es.text.includes('Claridad antes de cotizar.')&&es.text.includes('Haz un estimado: https://even-os.com/'));
  check('no em dashes in either email', !M.some(m=>(m.subject+m.text).includes('—')));
  const u1=db().__users[id(1)], u2=db().__users[id(2)];
  check('used-all account: topped up so 3 are free (5 used, bonus 3)', u1.bonus_estimates===3&&u1.winback_count===1&&!!u1.winback_last_at, JSON.stringify(u1));
  check('idle account with 4 left: bonus never lowers it, still counted once', (u2.bonus_estimates||0)===0&&u2.winback_count===1, JSON.stringify(u2));
  // The free limit really goes back up: the usage endpoint for that account.
  { const d0=db(); d0.__users[FREE]={...d0.__users[FREE],estimate_count:5,bonus_estimates:3}; fs.writeFileSync(DB,JSON.stringify(d0));
    const u=await (await fetch(`http://localhost:${port}/api/usage`,{headers:{origin:'https://even-os.com',authorization:'Bearer tok-free','x-even-device':'dev-winback-000000000001'}})).json();
    check('a topped-up account really has 3 free estimates again', u.remaining===3&&u.allowed===true&&u.limit===8, JSON.stringify(u)); }

  console.log('\n=== Second run within 30 days ===');
  r=await run({dryRun:false});
  check('does nothing', r.body.sent===0&&mails().length===2&&r.body.eligible===0, JSON.stringify(r.body));

  console.log('\n=== Unsubscribe ===');
  const link=en.text.match(/https:\/\/api\.test\.example(\/api\/unsubscribe\?[^\s]+)/)[1];
  let page=await fetch(`http://localhost:${port}${link.replace(/u=[^&]+/,'u='+id(1)).replace(/t=[0-9a-f]+/,'t=bad'+'0'.repeat(29))}`);
  check('a forged link is refused', page.status===400&&!db().__users[id(1)].email_unsub);
  page=await fetch(`http://localhost:${port}${link}`);
  check("the email's link unsubscribes and says so", page.status===200&&(await page.text()).includes("You're unsubscribed")&&db().__users[id(1)].email_unsub===true);
  const esLink=es.text.match(/https:\/\/api\.test\.example(\/api\/unsubscribe\?[^\s]+)/)[1];
  page=await fetch(`http://localhost:${port}${esLink}`,{method:'POST'});
  check('one-click (POST) works too, page in Spanish', page.status===200&&(await page.text()).includes('cancelaste tu suscripción')&&db().__users[id(2)].email_unsub===true);
  { const d0=db(); for(const k of [id(1),id(2)]) d0.__users[k].winback_last_at=ago(45); fs.writeFileSync(DB,JSON.stringify(d0)); }
  r=await run({dryRun:false});
  check('unsubscribed: no future sends even after 30 days', r.body.sent===0&&mails().length===2, JSON.stringify(r.body));

  console.log('\n=== At most 3 times ever ===');
  { const d0=db(); d0.__users[id(20)]={email:'again@gmail.com',estimate_count:5,is_pro:false,created_at:ago(300),prefs:{},winback_count:2,winback_last_at:ago(40)}; fs.writeFileSync(DB,JSON.stringify(d0)); }
  r=await run({dryRun:false});
  check('third time goes out', r.body.sent===1&&db().__users[id(20)].winback_count===3);
  { const d0=db(); d0.__users[id(20)].winback_last_at=ago(60); fs.writeFileSync(DB,JSON.stringify(d0)); }
  r=await run({dryRun:false});
  check('never a fourth', r.body.sent===0&&db().__users[id(20)].winback_count===3, JSON.stringify(r.body));
  const h=await (await fetch(`http://localhost:${port}/health`)).json();
  check('/health shows the win-back switch and secret as yes/no only', h.email.winbackOn===true&&h.email.winbackSecret===true&&!JSON.stringify(h).includes('wb-secret'));
  await stop(srv);

  const wf=fs.readFileSync(path.join(__dirname,'..','.github','workflows','winback.yml'),'utf8');
  check('scheduled daily Action with a by-hand dry-run option, secret from repo secrets', /schedule:/.test(wf)&&/workflow_dispatch:/.test(wf)&&/dry_run/.test(wf)&&/secrets\.WINBACK_SECRET/.test(wf)&&!/wb-secret/.test(wf));
  fs.rmSync(dir,{recursive:true,force:true});
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
