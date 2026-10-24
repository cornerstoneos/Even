// Admin sales CRM (founder spec 2026-10-23): the math behind /admin and the walls
// that keep it away from contractors. Database lock (RLS) is checked live in Supabase;
// these tests cover the page logic and that the contractor app never loads admin code.
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const CRM=require('../admin/core.js');
const root=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

console.log('\n=== Rolling daily target ===');
const T=(d,n)=>Array.from({length:n},()=>({touch_date:d}));
// Week of Mon 2026-10-19 .. Sat 2026-10-24. Goal 630, floor 10.
let r=CRM.rollingTarget({today:'2026-10-19',goal:630,floor:10,touches:[]});
check('Monday with nothing done: 630 / 6 days = 105', r.target===105&&r.left===6, JSON.stringify(r));
r=CRM.rollingTarget({today:'2026-10-21',goal:630,floor:10,touches:[...T('2026-10-19',100),...T('2026-10-20',50)]});
check('Wednesday after 150: (630-150) / 4 = 120', r.target===120&&r.left===4, JSON.stringify(r));
r=CRM.rollingTarget({today:'2026-10-21',goal:630,floor:10,touches:[...T('2026-10-19',100),...T('2026-10-21',40)]});
check('today\'s own touches do not move today\'s target', r.target===Math.ceil(530/4)&&r.doneWeek===140, JSON.stringify(r));
r=CRM.rollingTarget({today:'2026-10-24',goal:630,floor:10,touches:T('2026-10-20',700)});
check('goal already beaten: never below the floor of 10', r.target===10, JSON.stringify(r));
r=CRM.rollingTarget({today:'2026-10-25',goal:630,floor:10,touches:[]});
check('Sunday is a day off', r.dayOff===true&&r.target===0, JSON.stringify(r));
r=CRM.rollingTarget({today:'2026-10-26',goal:630,floor:10,touches:T('2026-10-24',300)});
check('last week\'s touches do not count toward this week', r.target===105&&r.doneWeek===0, JSON.stringify(r));
check('week starts Monday (Sunday belongs to the week before)', CRM.weekStart('2026-10-25')==='2026-10-19'&&CRM.weekStart('2026-10-19')==='2026-10-19');
check('Eastern date at 11pm ET is still that day', CRM.etToday(new Date('2026-10-24T03:30:00Z'))==='2026-10-23');

console.log('\n=== Rates per channel ===');
const tc=[{channel:'call',outcome:'no answer'},{channel:'call',outcome:'yes'},{channel:'call',outcome:'appointment'},{channel:'call',outcome:'sale'},
  {channel:'ig',outcome:'no answer'},{channel:'ig',outcome:'no answer'}];
const rt=CRM.channelRates(tc);
check('calls: yes rate counts yes + appointment + sale', rt.call.yesRate===0.75, rt.call.yesRate);
check('calls: appointment rate counts appointment + sale', rt.call.apptRate===0.5, rt.call.apptRate);
check('calls: close rate and touches per sale', rt.call.closeRate===0.25&&rt.call.touchesPerSale===4, JSON.stringify(rt.call));
check('a channel with no sale shows no touches-per-sale (not infinity)', rt.ig.touchesPerSale===null&&rt.tiktok.touches===0);

console.log('\n=== Stage and follow-up rules ===');
check('first touch moves New to Contacted', CRM.stageAfter('New','no answer')==='Contacted');
check('appointment moves to Demo, sale to Customer, not interested to Lost',
  CRM.stageAfter('Contacted','appointment')==='Demo'&&CRM.stageAfter('Demo','sale')==='Customer'&&CRM.stageAfter('Contacted','not interested')==='Lost');
check('a Customer is never moved back', CRM.stageAfter('Customer','not interested')==='Customer'&&CRM.stageAfter('Customer','no answer')==='Customer');
check('no answer follows up in 3 days; sale and not interested get none',
  CRM.defaultFollowUp('no answer','2026-10-23')==='2026-10-26'&&CRM.defaultFollowUp('sale','2026-10-23')===null&&CRM.defaultFollowUp('not interested','2026-10-23')===null);
const due=CRM.followUpsDue([
  {lead_id:'L1',created_at:'1',next_follow_up:'2026-10-20'},
  {lead_id:'L1',created_at:'2',next_follow_up:'2026-10-30'},   // newer touch pushed it out
  {lead_id:'L2',created_at:'1',next_follow_up:'2026-10-23'},
  {lead_id:'L3',created_at:'1',next_follow_up:'2026-10-22'},   // blocked (do not contact)
  {lead_id:null,created_at:'1',next_follow_up:'2026-10-01'}],'2026-10-23','lead_id',id=>id!=='L3');
check('follow-ups due use only the latest touch per lead and skip blocked leads', due.length===1&&due[0].lead_id==='L2', JSON.stringify(due));

console.log('\n=== By city + IDs + CSV ===');
const bc=CRM.byCity([{id:'L1',city:'Miami',stage:'Customer'},{id:'L2',city:'Miami',stage:'New'},{id:'L3',city:null,stage:'New'}],
  [{lead_id:'L1',outcome:'sale'},{lead_id:'L2',outcome:'no answer'},{lead_id:null,outcome:'yes'}],[{city:'Miami',status:'complete'}]);
const mia=bc.find(x=>x.city==='Miami');
check('by city: leads, touches, yeses, customers, permit coverage', mia&&mia.leads===2&&mia.touches===2&&mia.yeses===1&&mia.customers===1&&mia.coverage==='complete', JSON.stringify(bc));
check('leads with no city are grouped, not dropped', bc.some(x=>x.city==='(no city)'&&x.leads===1));
check('next ID continues the L### / V### numbering', CRM.nextId('L',[{id:'L009'},{id:'L337'}])==='L338'&&CRM.nextId('V',[])==='V001');
const csv=CRM.toCSV([{a:'x, "y"',b:'=HYPERLINK("bad")',c:['p','q'],d:null}],['a','b','c','d']);
check('CSV quotes commas and quotes, joins lists', csv.includes('"x, ""y"""')&&csv.includes('"p; q"'), csv);
check('CSV defuses spreadsheet formulas', csv.includes(`"'=HYPERLINK(""bad"")"`), csv);

console.log('\n=== Contractors never get admin code ===');
const app=root('index.html');
check('the contractor app does not load or link the admin page', !/admin\/core\.js|\/admin\/|crm_/.test(app));
const adm=root('admin/index.html');
check('admin page loads its logic from admin/core.js', /<script src="core\.js"><\/script>/.test(adm));
check('admin page checks access with the database gate before loading data', adm.indexOf("rpc('crm_can_access')")>0&&adm.indexOf("rpc('crm_can_access')")<adm.indexOf('await loadAll()'));
check('admin page is not indexed by search engines', /noindex/.test(adm)&&/\/admin\/\*[\s\S]*X-Robots-Tag: noindex/.test(root('_headers')));
check('admin page holds no lead data (no phone numbers in the source)', !/\(\d{3}\) \d{3}-\d{4}/.test(adm));
check('admin page uses only the public key (no service key)', !/service_role|SUPABASE_SERVICE/.test(adm));
const blocks=[...adm.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
let ok=true; for(const m of blocks){try{new Function(m[1]);}catch(e){ok=false;}}
check('admin page script parses', ok&&blocks.length===1);

console.log(`\n──────────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
