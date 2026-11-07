// base_plus_per_1000 permit rows (EXPANSION DATA item 5): base fee + rate for each
// $1,000 or fraction ABOVE the bracket's start, and the bracket row is the one
// whose range holds the job's value. Checked against each row's own schedule text.
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d||''}`))};
const P=require('../lib/pipeline').loadPipeline();
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fn=n=>{const i=html.indexOf('function '+n+'(');return html.slice(i,html.indexOf('\n}',i)+2);};
const E=new Function('round2','permitBasis','permitNum',
  fn('permitMoney')+fn('permitBracket')+"const isBasePlusPer1000=row=>/^base_plus_per_1000$/i.test(String(row&&row.method||'').trim());const isBasePlusPercent=row=>/^base_plus_percent$/i.test(String(row&&row.method||'').trim());const isBasePlusPercentOver=row=>/^base_plus_percent_over$/i.test(String(row&&row.method||'').trim());"+fn('percentOverThreshold')+fn('permitBracketRow')+fn('computePermitFee')+';return {permitBracket,permitBracketRow,computePermitFee};')(
  n=>Math.round(n*100)/100,()=>'per1000',v=>v==null||v===''?null:(typeof v==='number'?v:parseFloat(String(v).replace(/[$,]/g,''))));
const batch=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','batches','even_master_batch.json'),'utf8'));
const mk=n=>batch.find(m=>m.market===n);
const row=(market,wt)=>mk(market).permits.find(r=>(r.work_type||'').startsWith(wt));
const fee=(r,v)=>E.computePermitFee(r,v,0,0).fee;

console.log('\n=== Spec acceptance ===');
const reroof=row('Orlando','Re-roof, residential');
const i27=reroof.notes.indexOf('$27');
check(`Orange County re-roof at $15,000 = $27 + $5 x 14 = $97 (got $${fee(reroof,15000)}); schedule text: "${reroof.notes.slice(i27,i27+75)}"`, fee(reroof,15000)===97);
const sf1=row('San Francisco','New Construction permit fee — $2,001'), sf2=row('San Francisco','New Construction permit fee — $50,001');
check(`San Francisco new construction at $100,000 = 1089 + 10.19 x 50 = $1,598.50 (got $${fee(sf2,100000)})`, fee(sf2,100000)===1598.5);

console.log('\n=== Bracket edges ($50,000 vs $50,001) ===');
const sfRows=mk('San Francisco').permits.map(r=>({row:r}));
const pick=v=>E.permitBracketRow(sf1,v,sfRows);
check(`$50,000 stays in $2,001-$50,000: 273 + 17.01 x 48 = $1,089.48 (got $${fee(pick(50000),50000)})`, pick(50000)===sf1&&fee(pick(50000),50000)===1089.48);
check(`$50,001 moves to $50,001-$200,000: 1089 + 10.19 x 1 = $1,099.19 (got $${fee(pick(50001),50001)})`, pick(50001)===sf2&&fee(pick(50001),50001)===1099.19);
check('the model picked the low bracket for a $100,000 job: the engine prices the $50,001-$200,000 row', pick(100000)===sf2&&fee(pick(100000),100000)===1598.5);
const den1=row('Denver','Building Permit — $2,000 to');
check(`Denver $25,000 stays in "$2,000 to $25,000": 35 + 8 x 23 = $219 (got $${fee(den1,25000)})`, fee(den1,25000)===219&&E.permitBracketRow(den1,25000,mk('Denver').permits)===den1);
check('"or fraction": $15,000.50 Orange re-roof = $27 + $5 x 15 = $102', fee(reroof,15000.5)===102);
check('below the base bracket: base fee only (Orange re-roof at $800 = $27)', fee(reroof,800)===27);

console.log('\n=== Whole job through the engine ===');
const md={...mk('Orlando'),permits:[reroof]};
const cat=P.buildCatalog(md,new Set(['Roofing']),{});
const est=P.priceScope({lineItems:[{type:'other',category:'Roofing',description:'Re-roof',qty:1,unit:'job',unitCost:15000},{type:'permit',ref:'P1'}]},cat,{marketAdj:1,laborMult:2,oh:0,profit:0,cushion:0,sqft:0,lang:'en'});
const pl=est.lineItems.find(l=>l.priced==='permit schedule');
check(`Orange re-roof job valued $15,000 gets a $97 permit line (got $${pl&&pl.total})`, pl&&pl.total===97);

console.log('\n=== Rows with no readable bracket keep the old reading (listed, not guessed) ===');
const unread=[];for(const m of batch)for(const r of m.permits)if(/^base_plus_per_1000$/i.test(String(r.method||'').trim())&&!E.permitBracket(r))unread.push(`${m.market}: ${r.work_type}`);
check(`unreadable rows: ${unread.length} (${unread.join('; ')})`, unread.length===9&&unread.every(x=>/^(Boston|Orlando: Irrigation|Charleston: Mechanical)/.test(x)), unread.join(' | '));
check('Boston Amendment at $5,000 still max(10 x 5, 20) = $50', fee(row('Boston','Amendment'),5000)===50);

console.log('\n=== South Florida untouched ===');
check('no tri-county permit row uses base_plus_per_1000, so no South Florida fee can change',
  ['Miami-Dade','Broward','Palm Beach'].every(n=>!mk(n).permits.some(r=>/^base_plus_per_1000$/i.test(String(r.method||'').trim()))));
console.log(`\n──────────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
