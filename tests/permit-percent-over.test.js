// base_plus_percent_over permit rows (tasks/app.md item 7): fee = base + rate% of
// the amount over the threshold ("over $X" in notes), in the bracket row whose
// range holds the job's value. DC and Raleigh (units unconfirmed) keep the older
// reading and are listed as unreadable.
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d||''}`))};
const P=require('../lib/pipeline').loadPipeline();
const batch=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','batches','even_master_batch.json'),'utf8'));
const mk=n=>batch.find(m=>m.market===n);
const rowsOf=(market,muni)=>mk(market).permits.filter(r=>r.municipality===muni);
// Price a job of exactly `value` (no overhead/profit/cushion) with `pick` chosen
// by the model and the rest of the city's rows in the catalog for bracket switching.
function line(market,muni,pickWt,value){
  const rows=rowsOf(market,muni);
  const cat=P.buildCatalog({...mk(market),permits:rows},null,{});
  const ref=cat.permits.find(e=>(e.row.work_type||'').startsWith(pickWt)).ref;
  const est=P.priceScope({lineItems:[{type:'other',category:'Building',description:'Work',qty:1,unit:'job',unitCost:value},{type:'permit',ref}]},cat,
    {marketAdj:1,laborMult:2,oh:0,profit:0,cushion:0,sqft:0,lang:'en'});
  return est.lineItems.find(l=>l.priced==='permit schedule');
}

console.log('\n=== Spec acceptance ===');
let l=line('Broward','Pembroke Pines','Building Permit Fee - $1,000,000.01',2000000);
check(`Pembroke Pines $2M = 37,929.67 + 2.77% x 1,000,000 = $65,629.67 (got $${l&&l.total}; was $55,400)`, l&&l.total===65629.67);
l=line('Palm Beach','West Palm Beach','Building Permit (No Zoning Review) - $250,001',750000);
check(`WPB no-zoning $750,000 = 13,500 + 2.55% x 250,000 = $19,875, from the $500,001-$1M bracket even though the model picked $250,001-$500,000 (got $${l&&l.total} on "${l&&l.permitRow.work_type}")`, l&&l.total===19875&&/\$500,001-\$1,000,000/.test(l.permitRow.work_type));
l=line('Palm Beach','West Palm Beach','Permit Fee (With Zoning Review) - Over $10,000,000',12000000);
check(`WPB with-zoning $12M = 131,750 + 1.15% x 2,000,000 = $154,750 (got $${l&&l.total})`, l&&l.total===154750);
l=line('Broward','Hallandale Beach','Sign Permit',11000);
check(`Hallandale Beach sign at $11,000 = 42 + 1.5% x 10,000 = $192 (got $${l&&l.total})`, l&&l.total===192);

console.log('\n=== Brackets and edges ===');
l=line('Broward','Pembroke Pines','Building Permit Fee - $1,000,000.01',3000000);
check(`Pembroke Pines $3M stays in $1M-$3M: 37,929.67 + 2.77% x 2M = $93,329.67 = the next bracket's base (got $${l&&l.total})`, l&&l.total===93329.67);
l=line('Broward','Pembroke Pines','Building Permit Fee - $1,000,000.01',4000000);
check(`Pembroke Pines $4M moves to over-$3M: 93,329.67 + 2.08% x 1M = $114,129.67 (got $${l&&l.total})`, l&&l.total===114129.67&&/Over \$3,000,000/.test(l.permitRow.work_type));
l=line('Palm Beach','West Palm Beach','Building Permit (No Zoning Review) - $500,001',1000000);
check(`WPB no-zoning $1,000,000 stays in $500,001-$1,000,000: 13,500 + 2.55% x 500,000 = $26,250 (got $${l&&l.total})`, l&&l.total===26250);
l=line('Palm Beach','West Palm Beach','Building Permit (No Zoning Review) - $500,001',1000001);
check(`WPB no-zoning $1,000,001 moves to $1M-$5M: 26,250 + 2.45% x 1 = $26,250.02 (got $${l&&l.total})`, l&&l.total===26250.02);
l=line('Sacramento','City of Sacramento CA','Commercial Building Permit — $10M and above',12000000);
check(`Sacramento $12M = 56,692 + 0.462% x 2M = $65,932 (got $${l&&l.total})`, l&&l.total===65932);

console.log('\n=== DC and Raleigh unchanged (units unconfirmed) ===');
// Expected = what the engine priced before item 7 (run on commit b712923).
for(const [market,muni,wt,v,before] of [['Washington DC','District of Columbia (DOB)','Alteration/repair — construction $1,001',200000,400],
  ['Washington DC','District of Columbia (DOB)','Alteration/repair — construction over',2000000,20000],
  ['Raleigh','City of Raleigh NC','New Commercial Building Permit — Tier 2',2000000,120000],
  ['Raleigh','City of Raleigh NC','New Commercial Building Permit — Tier 3',12000000,120000]]){
  const r=rowsOf(market,muni).find(x=>x.work_type.startsWith(wt));
  l=line(market,muni,wt,v);
  check(`${market} "${r.work_type}" at $${v.toLocaleString()}: unchanged ($${l&&l.total}, before $${before})`, l&&l.total===before);
}
const unread=[];for(const m of batch)for(const r of m.permits)if(/percent_over/i.test(String(r.method||''))&&!/^base_plus_percent_over$/i.test(String(r.method).trim()))unread.push(`${m.market}: ${r.work_type} (${r.method})`);
check(`not repriced (listed): ${unread.length} rows: ${unread.join('; ')}`, unread.length===5&&unread.every(x=>/^(Washington DC|Raleigh)/.test(x)));
const pctOver=[];for(const m of batch)for(const r of m.permits)if(/^base_plus_percent_over$/i.test(String(r.method||'').trim()))pctOver.push(m.market);
check(`repriced rows: ${pctOver.length} (WPB 10, Pembroke Pines 2, Hallandale 1, Sacramento 5)`, pctOver.length===18);
console.log(`\n──────────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
