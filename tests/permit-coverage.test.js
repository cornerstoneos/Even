// Verifies a city only earns city-level permit grounding (and so HIGH confidence)
// when its core fees are on file, not just because one row exists. Runs the real
// server.js filterPermits against the real master batch.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};

// Extracted by stable anchor strings, same approach as supplyhouse-data.test.js —
// server.js starts listening on require, so it can't be imported whole.
const srv=fs.readFileSync(path.join(root,'server.js'),'utf8');
const s=srv.indexOf('const UNKNOWN_MUNI_PERMIT_CAP');
const e=srv.indexOf('const HVHZ_MARKETS');
if(s<0||e<0) throw new Error('Anchor strings not found in server.js -- update this test.');
const localRequire=p=>require(p.startsWith('.')?path.join(root,p):p);
const {filterPermits,missingCoreFees}=new Function('require',srv.slice(s,e)+'\n;return {filterPermits,missingCoreFees};')(localRequire);

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const hs=html.indexOf('const CONFIDENCE_RANGE=');
const he=html.indexOf('\n}',html.indexOf('function computeConfidenceTier(marketData,categories){'))+2;
const {computeConfidenceTier}=new Function(html.slice(hs,he)+'\n;return {computeConfidenceTier};')();

const batch=JSON.parse(fs.readFileSync(path.join(root,'data/batches/even_master_batch.json'),'utf8'));
const market=m=>batch.find(x=>x.market===m);

console.log('\n=== Complete city schedules keep city-level scope ===');
for(const [mkt,city] of [['Broward','Hallandale Beach'],['Miami-Dade','Hialeah'],['Palm Beach','Boca Raton'],['Broward','Fort Lauderdale']]){
  const r=filterPermits(market(mkt).permits,city);
  check(`${city} → municipality`, r.scope==='municipality', `got ${r.scope}, missing ${JSON.stringify(r.missing)}`);
}

console.log('\n=== Thin city schedules are partial, with the gaps named ===');
{
  const r=filterPermits(market('Palm Beach').permits,'North Palm Beach');
  check('North Palm Beach (4 rows) → municipality-partial', r.scope==='municipality-partial', `got ${r.scope}`);
  check('names the missing trades', ['electrical','plumbing','mechanical','roofing'].every(t=>r.missing.includes(t)), JSON.stringify(r.missing));
  check('still sends the city rows plus county baseline', r.permits.some(p=>p.municipality==='North Palm Beach')&&r.permits.some(p=>/county/i.test(p.municipality)));
}

console.log('\n=== Rule details ===');
check('contractor registration rows never count as a trade permit',
  missingCoreFees([{work_type:'Building permit fee'},{work_type:'Contractor Registration - Electrical'}]).includes('electrical'));
check('one all-trades base fee covers every trade',
  missingCoreFees([{work_type:'All Trade Permits (Building/Electrical/Plumbing/Mechanical)'}]).length===0);
check('no base fee is reported',
  missingCoreFees([{work_type:'Electrical'},{work_type:'Plumbing'},{work_type:'Mechanical'},{work_type:'Roof'}])[0]==='base permit fee');
check('unresearched city still falls back to county',
  filterPermits(market('Broward').permits,'Parkland').scope==='county-fallback');

console.log('\n=== Confidence ===');
const full={materials:[{category:'Electrical',tier:'supplier_direct'}],labor:[{}],permits:[{}]};
check('complete city schedule can reach HIGH', computeConfidenceTier({...full,permitScope:'municipality'},new Set(['Electrical']))==='high');
check('partial city schedule caps at MEDIUM', computeConfidenceTier({...full,permitScope:'municipality-partial'},new Set(['Electrical']))==='medium');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
