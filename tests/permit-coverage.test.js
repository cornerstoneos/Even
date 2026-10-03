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
  // Synthetic thin city on top of the real Palm Beach rows, so this test doesn't break each time a real city gets completed.
  const thin=[{municipality:'Thinville',work_type:'Building permit (percentage of valuation)'},{municipality:'Thinville',work_type:'Building department plan review'}];
  const r=filterPermits([...market('Palm Beach').permits,...thin],'Thinville');
  check('thin city (base fee only) → municipality-partial', r.scope==='municipality-partial', `got ${r.scope}`);
  check('names the missing trades', ['electrical','plumbing','mechanical','roofing'].every(t=>r.missing.includes(t)), JSON.stringify(r.missing));
  check('sends the city rows plus county rows for the missing fees', r.permits.some(p=>p.municipality==='Thinville')&&r.permits.some(p=>/county/i.test(p.municipality)));
  check('county stand-ins cover only missing core fees (no county surcharges, registrations)', r.permits.filter(p=>/county/i.test(p.municipality)).every(p=>/electric|wiring|plumb|mechanical|hvac|a\/?c|air condition|refrigeration|roof/i.test(p.work_type||'')));
}

console.log('\n=== City-first: a complete city never gets county permit rows ===');
for(const mk of ['Miami-Dade','Broward','Palm Beach']){
  const rows=market(mk).permits;
  const cities=[...new Set(rows.map(r=>r.municipality).filter(n=>n&&!/county/i.test(n)))];
  let complete=0,bad=[];
  for(const c of cities){
    const r=filterPermits(rows,c);
    if(r.scope!=='municipality') continue;
    complete++;
    if(r.permits.some(p=>/county/i.test(p.municipality||''))||r.permits.some(p=>p.municipality!==c)) bad.push(c);
  }
  check(`${mk}: ${complete} complete cities, none returns county or other-city rows`, complete>0&&!bad.length, bad.join(', '));
}
{
  const r=filterPermits(market('Broward').permits,'Fort Lauderdale');
  check('Fort Lauderdale (Test A city) → only Fort Lauderdale rows', r.permits.length>0&&r.permits.every(p=>p.municipality==='Fort Lauderdale'), JSON.stringify([...new Set(r.permits.map(p=>p.municipality))]));
  const u=filterPermits(market('Miami-Dade').permits,'Kendall',true);
  check('unincorporated Kendall → county schedule, labeled unincorporated', u.scope==='unincorporated'&&u.permits.length>0&&u.permits.every(p=>/county/i.test(p.municipality)), u.scope);
}

console.log('\n=== Rule details ===');
check('contractor registration rows never count as a trade permit',
  missingCoreFees([{work_type:'Building permit fee'},{work_type:'Contractor Registration - Electrical'}]).includes('electrical'));
check('one all-trades base fee covers every trade',
  missingCoreFees([{work_type:'All Trade Permits (Building/Electrical/Plumbing/Mechanical)'}]).length===0);
check('no base fee is reported',
  missingCoreFees([{work_type:'Electrical'},{work_type:'Plumbing'},{work_type:'Mechanical'},{work_type:'Roof'}])[0]==='base permit fee');
check('unresearched city still falls back to county',
  filterPermits(market('Broward').permits,'Nowhereville').scope==='county-fallback');

console.log('\n=== Confidence ===');
const full={materials:[{category:'Electrical',tier:'supplier_direct'}],labor:[{}],permits:[{}]};
check('complete city schedule can reach HIGH', computeConfidenceTier({...full,permitScope:'municipality'},new Set(['Electrical']))==='high');
check('partial city schedule caps at MEDIUM', computeConfidenceTier({...full,permitScope:'municipality-partial'},new Set(['Electrical']))==='medium');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
