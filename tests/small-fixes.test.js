// Saturday 2026-10-17 small fixes.
// (a) The proposal header never shows the login email as the company name: no
//     name (or an email typed as one) prints "Your company" / "Tu empresa" and
//     the screen asks for the business name.
// (b) The Actual Cost Tracker's "Pro Feature" tag is hidden on Pro accounts.
// (c) The signed-out free count: keyed by the browser's device id, with an
//     IP + browser (+ language) backup so a private window doesn't reset it. A
//     brand-new visitor on another network, or a different person behind the
//     same address with a different browser language, starts at 3.
// Browser run: tests/acceptance/small-fixes-2026-10-17.js.
const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const {ESTIMATE_RULES}=require('../lib/guard');
const {LIMITS}=require('../lib/usage');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

console.log('\n=== (a) company name on the proposal ===');
const s=html.indexOf('//  CLIENT PROPOSAL'), e=html.indexOf('function renderProposalPreview(){');
const store={}, ls={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;}};
const fmt=n=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const api=new Function('window','localStorage','currentUser','fmt','savePrefs','liveProposalUpdate',html.slice(s,e)+';return {buildClientProposal,setBiz,bizCompanyName};')({_finalBid:null,_proposalDetail:'full'},ls,{email:'even-test-20261013@example.com'},fmt,()=>{},()=>{});
const est={projectName:'Water heater',totalBid:2000,lineItems:[{category:'Plumbing',description:'Water heater',qty:1,unit:'ea',unitCost:900,total:900}],assumptions:[],exclusions:[]};
let P=api.buildClientProposal(est,{},'en');
check('no business name: header says "Your company", flagged as missing', P.company==='Your company'&&P.companyMissing===true, JSON.stringify({c:P.company,m:P.companyMissing}));
check('the login email is still only a contact line, never the company', P.company!=='even-test-20261013@example.com'&&P.email==='even-test-20261013@example.com');
P=api.buildClientProposal(est,{},'es');
check('Spanish: "Tu empresa"', P.company==='Tu empresa');
api.setBiz('company','even-test-20261013@example.com');
P=api.buildClientProposal(est,{},'en');
check('the login email typed into Company name is not used as the company', P.company==='Your company'&&P.companyMissing);
api.setBiz('company','someone@else.com');
check('any email address in Company name is not used as the company', api.buildClientProposal(est,{},'en').company==='Your company');
api.setBiz('company','Acme Plumbing LLC');
P=api.buildClientProposal(est,{},'en');
check('a real name prints as is', P.company==='Acme Plumbing LLC'&&!P.companyMissing);
check('PDF header: no initials badge made from "Your company"', /\}else if\(!P\.companyMissing&&initialsOf\(P\.company\)\)\{/.test(html));
check('the screen asks for the name (EN/ES) and the PDF download reminds', /Your proposal says "Your company" until you add your business name\./.test(html)&&/Tu propuesta dice &quot;Tu empresa&quot; hasta que agregues el nombre de tu negocio\./.test(html)&&/if\(P\.companyMissing\) showToast\(/.test(html));

console.log('\n=== (b) tracker tag ===');
check('the tag has an id and is hidden exactly when isPro', /id="tracker-pro-tag"/.test(html)&&/function syncTrackerTag\(\)\{ const t=document\.getElementById\('tracker-pro-tag'\); if\(t\) t\.hidden=!!isPro; \}/.test(html));
check('re-checked on every estimate and every account change', /syncTrackerTag\(\);\n  \/\/ Each tracker row/.test(html)&&/function updateUserBadge\(\)\{\n  syncTrackerTag\(\);/.test(html));

console.log('\n=== (c) the free count for a new visitor (real server, mocked APIs) ===');
check('backup window is 7 days', LIMITS.BACKUP_WINDOW_DAYS===7);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'even-small-'));
const DB=path.join(dir,'db.json'),LOG=path.join(dir,'log.txt');fs.writeFileSync(LOG,'');
const port=40900+Math.floor(Math.random()*200);
const est2=job=>({even_kind:'estimate',max_tokens:24000,output_config:{effort:'medium'},messages:[{role:'user',content:[{type:'text',text:ESTIMATE_RULES},{type:'text',text:'LOCAL DATA CATALOG',cache_control:{type:'ephemeral'}},{type:'text',text:`Trade:Plumbing|Location:Miami\nLanguage:English\nSCOPE:${job}\nANSWERS:\nEXTRACTED:[]\nReturn the JSON for THIS job now.`}]}]});
const H=(dev,lang,ip='198.51.100.44',ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1')=>({'content-type':'application/json',origin:'https://even-os.com','x-forwarded-for':ip,'user-agent':ua,'accept-language':lang,'x-even-device':dev});
(async()=>{
  const srv=await new Promise((res,rej)=>{const p=spawn(process.execPath,[path.join(__dirname,'helpers','scope-cache-server.js')],{env:{...process.env,PORT:String(port),FAKE_DB:DB,FAKE_LOG:LOG,RATE_LIMIT_SCALE:'20'},stdio:['ignore','pipe','pipe']});p.stdout.on('data',d=>{if(/running on port/.test(d)) res(p);});p.on('exit',c=>rej(new Error('exit '+c)));});
  try{
    const usage=async h=>(await fetch(`http://localhost:${port}/api/usage`,{headers:h})).json();
    const A='dev-aaaaaaaaaaaaaaaaaaaaaaaa';
    for(let i=1;i<=2;i++){ const r=await fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:H(A,'en-US,en;q=0.9'),body:JSON.stringify(est2('job '+i))}); await r.text(); }
    let u=await usage(H(A,'en-US,en;q=0.9'));
    check('first person on a shared address used 2: 1 left', u.remaining===1, JSON.stringify(u));
    u=await usage(H('dev-pppppppppppppppppppppppp','en-US,en;q=0.9'));
    check('same browser, same address, new private window: still 1 left (no reset)', u.remaining===1, JSON.stringify(u));
    u=await usage(H('dev-bbbbbbbbbbbbbbbbbbbbbbbb','es-US,es;q=0.9'));
    check('another person behind that address (Spanish phone): 3 left', u.remaining===3, JSON.stringify(u));
    u=await usage(H('dev-cccccccccccccccccccccccc','en-US,en;q=0.9','203.0.113.200'));
    check('a brand-new visitor on another network: 3 left', u.remaining===3&&u.used===0, JSON.stringify(u));
  }finally{ srv.kill(); }
  console.log(`\n──────────────\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
