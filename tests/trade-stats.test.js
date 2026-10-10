// Trade stats (user 2026-10-10) and the Spanish trade-name fix.
// 1. Each fresh estimate_run event carries trade, city and language, read off the
//    estimate's own job line: trade only if it is an app option, city only if it is
//    a known municipality (a typed street address is never stored).
// 2. Spanish trade names from the AI still add their materials to the catalog.
const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const src=(()=>{const a=html.indexOf('const TRADE_MATERIALS='),b=html.indexOf('\n}',html.indexOf('function scopeMaterialCategories('))+2;return html.slice(a,b);})();
const scopeMaterialCategories=new Function(src+';return scopeMaterialCategories;')();

console.log('\n=== Spanish trade names add their materials ===');
const es=scopeMaterialCategories('Plumbing',[{trade:'Plomería'},{trade:'Electricidad'}]);
check('ES bathroom run as Plumbing still brings Electrical materials', es&&es.has('Electrical')&&es.has('Plumbing'), es&&[...es]);
const es2=scopeMaterialCategories('Electrical',[{trade:'Eléctrico'},{trade:'Pintura'},{trade:'Tablaroca'}]);
check('Eléctrico / Pintura / Tablaroca map to Electrical / Paint / Drywall', es2&&es2.has('Paint')&&es2.has('Drywall')&&es2.has('Electrical'), es2&&[...es2]);
check('Spanish remodel or general contractor = every category', scopeMaterialCategories('Plumbing',[{trade:'Remodelación de baño'}])===null&&scopeMaterialCategories('Contratista General',[])===null);
check('English unchanged', [...scopeMaterialCategories('Plumbing',[{trade:'Electrical'}])].sort().join()==='Electrical,Plumbing');

console.log('\n=== estimate_run events carry trade, city, language ===');
const {ESTIMATE_RULES}=require('../lib/guard');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'even-stats-'));
const DB=path.join(dir,'db.json'),LOG=path.join(dir,'log.txt');fs.writeFileSync(LOG,'');
const port=40500+Math.floor(Math.random()*300);
const est=(job,lang)=>({even_kind:'estimate',max_tokens:24000,output_config:{effort:'medium'},messages:[{role:'user',content:[{type:'text',text:ESTIMATE_RULES},{type:'text',text:'CATALOG'},{type:'text',text:`${job}\nLanguage:${lang}\nSCOPE:x ${Math.random()}\nANSWERS:\nEXTRACTED:[]`}]}]});
(async()=>{
  const p=await new Promise((res,rej)=>{const c=spawn(process.execPath,[path.join(__dirname,'helpers','scope-cache-server.js')],{env:{...process.env,PORT:String(port),FAKE_DB:DB,FAKE_LOG:LOG,RATE_LIMIT_SCALE:'20'},stdio:['ignore','pipe','pipe']});c.stdout.on('data',d=>{if(/running on port/.test(d))res(c);});c.on('exit',x=>rej(new Error('exit '+x)));});
  let n=0;
  const post=async b=>{n++;const r=await fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:{'content-type':'application/json',origin:'https://even-os.com','x-even-device':'dev-stats-'+n+'-0000000000','x-forwarded-for':'203.0.113.'+(100+n),'user-agent':'Stats'+n,'X-Even-Cache':'1'},body:JSON.stringify(b)});await r.json();await new Promise(r=>setTimeout(r,150));};
  await post(est('Trade:Electrical|Location:Aventura, FL|Type:Residential','Spanish'));
  await post(est('Trade:Plumbing|Location:1420 NE 191st St, Fort Lauderdale FL 33301|Type:Residential','English'));
  await post(est('Trade:Rocket Science|Location:somewhere|Type:x','English'));
  const ev=(JSON.parse(fs.readFileSync(DB,'utf8')).__events||[]).filter(e=>e.event==='estimate_run');
  check('3 estimate_run events recorded', ev.length===3, JSON.stringify(ev));
  check('ES Aventura electrical: trade, city, lang', ev[0]&&ev[0].trade==='Electrical'&&ev[0].city==='Aventura'&&ev[0].lang==='es', JSON.stringify(ev[0]));
  check('a street address keeps only the city name', ev[1]&&ev[1].city==='Fort Lauderdale'&&ev[1].trade==='Plumbing'&&ev[1].lang==='en'&&!JSON.stringify(ev[1]).includes('191st'), JSON.stringify(ev[1]));
  check('unknown trade -> Other, unknown place -> no city', ev[2]&&ev[2].trade==='Other'&&ev[2].city===null, JSON.stringify(ev[2]));
  p.kill();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
