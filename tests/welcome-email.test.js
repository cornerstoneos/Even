// Welcome email (founder idea 2026-10-13). Built behind a flag because
// even-os.com is NOT verified in Resend (checked 2026-10-17: no Resend DKIM or
// send-domain DNS records). Checks against the real server.js (Supabase and
// Resend mocked): off by default; when switched on, exactly one email per new
// account (email or Google alike: it fires when the server first creates the
// account's row), in the app's language, reply-to the founder, unsubscribe line;
// no address in the repo; no em dashes.
const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const {welcomeEmail}=require('../lib/welcome');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const root=path.join(__dirname,'..');
console.log('\n=== copy ===');
const en=welcomeEmail('en'), es=welcomeEmail('es');
check('EN subject + founder copy + P.S.', en.subject==='Welcome to Even'&&en.text.includes("I'm Lenny, I built Even.")&&en.text.includes('Hit reply and tell me. I read every one.'));
check('ES subject + copy uses tú', es.subject==='Bienvenido a Even'&&es.text.includes('Soy Lenny, creé Even.')&&es.text.includes('Responde y cuéntame'));
check('unsubscribe line in both', /unsubscribe/.test(en.text)&&/cancelar/.test(es.text));
check('no em dashes', !JSON.stringify([en,es]).includes('—'));
const lib=fs.readFileSync(path.join(root,'lib/welcome.js'),'utf8');
check('no email address written in the code (sender and reply-to come from Railway)', !/[\w.+-]+@[\w-]+\.(com|net|org|io)\b/.test(lib)&&/process\.env\.WELCOME_FROM_EMAIL/.test(lib)&&/process\.env\.REPLY_TO_EMAIL/.test(lib));
check('the app tells the server its language', /'X-Even-Lang':appLang==='es'\?'es':'en'/.test(fs.readFileSync(path.join(root,'index.html'),'utf8')));

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'even-wel-'));
const DB=path.join(dir,'db.json'),LOG=path.join(dir,'log.txt');
const port=41500+Math.floor(Math.random()*200);
const start=env=>new Promise((res,rej)=>{const p=spawn(process.execPath,[path.join(__dirname,'helpers','scope-cache-server.js')],{env:{...process.env,PORT:String(port),FAKE_DB:DB,FAKE_LOG:LOG,...env},stdio:['ignore','pipe','pipe']});p.stdout.on('data',d=>{if(/running on port/.test(d)) res(p);});p.on('exit',c=>rej(new Error('exit '+c)));});
const emails=()=>fs.readFileSync(LOG,'utf8').split('\n').filter(l=>l.startsWith('email ')).map(l=>JSON.parse(l.slice(6)));
const visit=async(tok,lang)=>{await (await fetch(`http://localhost:${port}/api/usage`,{headers:{origin:'https://even-os.com',authorization:'Bearer '+tok,'x-even-lang':lang,'x-forwarded-for':'203.0.113.9'}})).text();};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ON={WELCOME_EMAIL_ENABLED:'1',RESEND_API_KEY:'re_test',WELCOME_FROM_EMAIL:'Lenny from Even <lenny@sender.test>',REPLY_TO_EMAIL:'founder@reply.test'};
(async()=>{
  console.log('\n=== off by default ===');
  fs.writeFileSync(DB,'{}');fs.writeFileSync(LOG,'');
  let srv=await start({WELCOME_EMAIL_ENABLED:'',RESEND_API_KEY:'re_test'});
  try{ await visit('tok-free','en'); await sleep(300); check('flag off: a new account gets no email', emails().length===0); }finally{ srv.kill(); }
  await sleep(200);
  console.log('\n=== switched on ===');
  fs.writeFileSync(DB,'{}');fs.writeFileSync(LOG,'');
  srv=await start(ON);
  try{
    await visit('tok-free','es'); await sleep(300);
    let em=emails();
    check('new account: one welcome email', em.length===1, em.length);
    check('in the app language (Spanish here), to the account, from the Railway sender', em[0]&&em[0].subject==='Bienvenido a Even'&&em[0].to[0]==='free@example.com'&&em[0].from==='Lenny from Even <lenny@sender.test>');
    check('reply-to is the founder (variable) with an unsubscribe header', em[0]&&em[0].reply_to==='founder@reply.test'&&/mailto:founder@reply\.test\?subject=unsubscribe/.test(em[0].headers['List-Unsubscribe']));
    await visit('tok-free','es'); await visit('tok-free','en'); await sleep(300);
    check('coming back never sends a second one', emails().length===1, emails().length);
    await visit('tok-pro','en'); await sleep(300);
    check('another new account gets its own, in English', emails().length===2&&emails()[1].subject==='Welcome to Even');
  }finally{ srv.kill(); }
  await sleep(200);
  srv=await start(ON);
  try{ await visit('tok-free','en'); await sleep(300); check('after a server restart: still only one per account', emails().length===2, emails().length); }finally{ srv.kill(); }
  console.log(`\n──────────────\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
