// The AI scopes, the code prices (decided 2026-10-02). Runs the real pricing engine
// from index.html against the real master batch: the same scope must always give
// the same lines and total, prices come from the catalog (never the model), permits
// are the city's own and computed from its schedule, labor uses the contractor's
// multiplier or their own rate, and overhead/profit are stacked once.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const slice=(startMark,endMark)=>{
  const s=html.indexOf(startMark),e=html.indexOf(endMark,s);
  if(s<0||e<0) throw new Error(`Anchor not found: ${startMark} — update this test.`);
  return html.slice(s,e);
};
const fnSrc=name=>{const s=html.indexOf(`function ${name}(`);const e=html.indexOf('\n}',s)+2;if(s<0) throw new Error('missing '+name);return html.slice(s,e);};
const deps=[
  "const money0=n=>'$'+Math.round(Number(n)||0).toLocaleString('en-US');",
  fnSrc('categoryInScope'),fnSrc('isEquipmentRental'),
  slice('const ANCILLARY_RE=','// Even Suggests tiers'),
].join('\n');
const engine=slice('const LABOR_MULT_DEFAULT=','// ══ END PRICING ENGINE ══');
const E=new Function(deps+'\n'+engine+'\n;return {priceScope,buildCatalog,catalogPromptText,computePermitFee,permitBasis,LABOR_MULT_DEFAULT};')();

const batch=JSON.parse(fs.readFileSync(path.join(root,'data/batches/even_master_batch.json'),'utf8'));
const req=fs.readFileSync(path.join(root,'server.js'),'utf8');
const ss=req.indexOf('const UNKNOWN_MUNI_PERMIT_CAP'),se=req.indexOf('const HVHZ_MARKETS');
const localRequire=p=>require(p.startsWith('.')?path.join(root,p):p);
const {filterPermits}=new Function('require',req.slice(ss,se)+'\n;return {filterPermits};')(localRequire);
const marketFor=(mkt,city)=>{const m=batch.find(x=>x.market===mkt);const f=filterPermits(m.permits,city);return {...m,permits:f.permits,permitScope:f.scope,municipality:city};};

const settings={marketAdj:1,laborMult:2.2,laborRate:null,oh:12,profit:22,cushion:8,sqft:1800,hvhz:true,calibration:null};

console.log('\n=== Test A shape: Plumbing, Fort Lauderdale, water heater ===');
const ftl=marketFor('Broward','Fort Lauderdale');
const cat=E.buildCatalog(ftl,new Set(['Plumbing']),{});
const find=(list,fn)=>list.find(e=>fn(e.row));
const wh=find(cat.materials,r=>/50 Gallon - Energy Saver Electric/.test(r.item));
const plumber=find(cat.labor,r=>/^Plumbers/.test(r.trade));
const tradePermit=find(cat.permits,r=>r.work_type==='Trade Permit');
const masterPermit=find(cat.permits,r=>r.work_type==='Master Permit');
check('catalog has the water heater, plumber wage and FTL trade permit', wh&&plumber&&tradePermit, JSON.stringify({wh:!!wh,plumber:!!plumber,tradePermit:!!tradePermit}));
check('catalog permits are Fort Lauderdale only (city-first)', cat.permits.every(e=>e.row.municipality==='Fort Lauderdale'));
const prompt=E.catalogPromptText(cat);
check('catalog sent to the model carries no prices', !/\$\s?\d/.test(prompt.replace(/\$1,000|\$1\b/g,'')), prompt.match(/.*\$\s?\d.*/)?.[0]);
const scopeA={projectName:'Water heater',lineItems:[
  {type:'material',ref:wh.ref,qty:1,unitCost:1},                         // a model-written price must be ignored
  {type:'labor',ref:plumber.ref,hours:5,description:'Remove old heater, set and connect new, test'},
  {type:'permit',ref:tradePermit.ref,qty:0},
  {type:'permit',ref:masterPermit.ref,qty:0},                            // a second value-based permit must not stack
  {type:'other',category:'Disposal',description:'Haul away old heater',qty:1,unit:'ea',unitCost:50},
],assumptions:['Same location'],exclusions:[]};
const a1=E.priceScope(JSON.parse(JSON.stringify(scopeA)),cat,settings);
const a2=E.priceScope(JSON.parse(JSON.stringify(scopeA)),cat,settings);
check('same scope in → same lines and total out', JSON.stringify(a1)===JSON.stringify(a2));
const whLine=a1.lineItems.find(l=>l.ref===wh.ref);
check('material priced from the catalog mid, not the model', whLine&&whLine.unitCost===wh.row.mid, whLine&&whLine.unitCost);
check('counted item (each) carries no waste', whLine&&whLine.qty===1);
const lab=a1.lineItems.find(l=>l.category==='Labor');
check('labor = BLS median x 2.2 (today\'s level)', lab&&lab.unitCost===Math.round(plumber.row.mid*2.2*100)/100, lab&&lab.unitCost);
const permits=a1.lineItems.filter(l=>l.category==='Permits');
check('exactly one permit line', permits.length===1, permits.map(p=>p.description).join(' | '));
const pre=a1.lineItems.filter(l=>l.category!=='Permits').reduce((t,l)=>t+l.total,0);
const jobValue=Math.round(pre*(1+0.12+0.08)*1.22*100)/100;
check('FTL trade permit = greater of $131 or 1.75% of job value', permits[0]&&permits[0].total===Math.round(Math.max(131,jobValue*0.0175)*100)/100, `${permits[0]&&permits[0].total} vs value ${jobValue}`);
const other=a1.lineItems.find(l=>l.category==='Disposal');
check('a line not in our data is labeled estimated', other&&other.estimated===true&&/not in our data/.test(other.estLabel));
check('overhead and profit stacked once on the subtotal', a1.overhead.amount===Math.round(a1.subtotal*0.12)&&a1.profit.amount===Math.round((a1.subtotal+a1.overhead.amount+a1.contingency.amount)*0.22));
check('total is the sum', Math.abs(a1.totalBid-(a1.subtotal+a1.overhead.amount+a1.contingency.amount+a1.profit.amount))<0.005);
check('permitted job keeps the full risk cushion', a1.contingency.pct===8);

console.log('\n=== Contractor labor settings ===');
const m25=E.priceScope(JSON.parse(JSON.stringify(scopeA)),cat,{...settings,laborMult:2.5});
check('multiplier is the contractor\'s setting', m25.lineItems.find(l=>l.category==='Labor').unitCost===Math.round(plumber.row.mid*2.5*100)/100);
const own=E.priceScope(JSON.parse(JSON.stringify(scopeA)),cat,{...settings,laborRate:45});
const ownLab=own.lineItems.find(l=>l.category==='Labor');
check('their own labor rate replaces the multiplier', ownLab.unitCost===45&&ownLab.priced==='your labor rate');
check('default multiplier is 2.2', E.LABOR_MULT_DEFAULT===2.2);

console.log('\n=== Risk cushion is decided by the scope, in code ===');
const paint=E.buildCatalog(ftl,new Set(['Paint']),{});
const painter=find(paint.labor,r=>/^Painters/.test(r.trade));
const paintRow=paint.materials.find(e=>/^Paint/.test(e.row.category));
const lowRisk=E.priceScope({lineItems:[{type:'material',ref:paintRow.ref,qty:2},{type:'labor',ref:painter.ref,hours:6}]},paint,settings);
check('no permit, no demo, one trade → cushion drops to 4%', lowRisk.contingency.pct===4);
check('bulk material gets its category waste', lowRisk.lineItems[0].qty===2.2, lowRisk.lineItems[0].qty);

console.log('\n=== Permit fee rules ===');
check('percent of value with minimum', E.computePermitFee({rate:0.0175,min_fee:131,method:'greater_of_min_or_percent_of_cost'},4000).fee===131);
check('percent of value above minimum', E.computePermitFee({rate:0.0175,min_fee:131,method:'greater_of_min_or_percent_of_cost'},20000).fee===350);
check('"0.058 per $1" rows are a fraction of value', E.computePermitFee({rate:'0.058 per $1 estimated cost',min_fee:147,method:'per $1 estimated cost'},20000).fee===1160);
check('per sq ft falls back to the job sq ft', E.computePermitFee({rate:'0.1 per sqft',min_fee:0,method:'per sqft'},0,0,1800).fee===180);
check('tiered rows show the minimum and say so', (r=>r.fee===50&&r.approx)(E.computePermitFee({rate:'see table',min_fee:50,method:'tiered'},10000)));
check('add-on fees (percent of permit fee) are never stand-alone', E.permitBasis({method:'percent_of_permit_fees_or_min',rate:0.01})==='addon');

console.log('\n=== HVAC benchmarks against HVAC mechanics, not sheet metal ===');
check('SUB_TRADE_TO_BLS maps HVAC to the HVAC mechanics wage row', /'HVAC':'Heating, Air Conditioning, and Refrigeration Mechanics and Installers'/.test(html));
check('that row exists in every tri-county market', ['Miami-Dade','Broward','Palm Beach'].every(m=>batch.find(x=>x.market===m).labor.some(r=>r.trade==='Heating, Air Conditioning, and Refrigeration Mechanics and Installers')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
