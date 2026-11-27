// Atlanta + Charlotte city lists (founder 2026-11-25): each address gets its own
// county's permit rows, and same-named places elsewhere are not captured. Offline: the real resolver + permit filter + marketPayload
// out of server.js, the master batch as the database, and a fake zip lookup.
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d||''}`))};
const root=path.join(__dirname,'..');
const srv=fs.readFileSync(path.join(root,'server.js'),'utf8');
const a=srv.indexOf('// ─── Market resolution'), z=srv.indexOf('app.get(\'/api/market-data\'');
if(a<0||z<0) throw new Error('anchors moved in server.js');
const batch=JSON.parse(fs.readFileSync(path.join(root,'data/batches/even_master_batch.json'),'utf8'));
// Zip -> lat/lng answers for the zip checks (real zip centroids, rounded).
const ZIPS={'34677':[28.04,-82.67],'33701':[27.77,-82.64],'33511':[27.91,-82.29],'34741':[28.31,-81.42],'32771':[28.81,-81.30],'33602':[27.95,-82.46]};
const fakeFetch=async url=>{const zip=String(url).match(/us\/(\d{5})/)?.[1];const c=ZIPS[zip];
  return {ok:!!c,json:async()=>({places:[{latitude:String(c[0]),longitude:String(c[1])}]})};};
const P=new Function('require','fetch','app','express','MARKETS','MUNICIPALITIES','batch',
  srv.slice(a,z)+`
;getMarketData=async market=>{const m=batch.find(x=>x.market===market);return m?JSON.parse(JSON.stringify(m)):null;};
return {marketPayload,resolveMarket,filterPermits};`)(
  p=>require(p.startsWith('.')?path.join(root,p):p), fakeFetch, {get(){},post(){},use(){}}, {raw:()=>null,json:()=>null},
  require(path.join(root,'data/markets.json')), require(path.join(root,'data/municipalities.json')), batch);
const munis=r=>[...new Set((r.permits||[]).map(x=>x.municipality))];
const hasHills=r=>(r.permits||[]).some(x=>/Hillsborough/.test(x.municipality||''));

(async()=>{
  console.log('\n=== Atlanta + Charlotte counties (2026-11-25) ===');
  let r=await P.marketPayload('Atlanta, GA');
  check(`'Atlanta, GA' -> City of Atlanta rows only (${r.permitScope}, ${munis(r)})`, r.market==='Atlanta'&&munis(r).join()==='City of Atlanta GA'&&r.permitScope==='municipality', JSON.stringify(r.permitMissing));
  r=await P.marketPayload('Marietta, GA');
  check(`'Marietta, GA' -> Cobb County rows, labeled fallback (${r.permitScope}, ${munis(r)})`, r.market==='Atlanta'&&munis(r).join()==='Cobb County GA'&&r.permitScope==='county-fallback'&&r.permitCountyName==='Cobb County');
  r=await P.marketPayload('Lawrenceville, GA');
  check(`'Lawrenceville, GA' -> its own city rows only (${r.permitScope}, ${munis(r)})`, r.market==='Atlanta'&&munis(r).join()==='City of Lawrenceville GA');
  r=await P.marketPayload('Buford, GA');
  check(`'Buford, GA' (Gwinnett, no rows filed) -> no other county's or city's rows (${r.permitScope}, ${(r.permits||[]).length} rows)`, r.market==='Atlanta'&&!(r.permits||[]).length&&r.permitCountyName==='Gwinnett County');
  r=await P.marketPayload('Gastonia, NC');
  check(`'Gastonia, NC' -> Gaston County rows (${r.permitScope}, ${munis(r)})`, r.market==='Charlotte'&&munis(r).join()==='Gaston County NC');
  r=await P.marketPayload('Charlotte, NC');
  check(`'Charlotte, NC' -> Mecklenburg rows incl. the LUESA ordinance (${r.permitScope}, ${munis(r)})`, r.market==='Charlotte'&&(r.permits||[]).some(x=>x.municipality==='Mecklenburg County NC (LUESA)')&&r.permitCountyName==='Mecklenburg County');
  r=await P.marketPayload('Monroe, NC');
  check(`'Monroe, NC' (Union) -> no Mecklenburg rows (${(r.permits||[]).length} rows)`, r.market==='Charlotte'&&!(r.permits||[]).some(x=>/Mecklenburg/.test(x.municipality))&&r.permitCountyName==='Union County');
  r=await P.marketPayload('Rock Hill, SC');
  check(`'Rock Hill, SC' -> Charlotte market, York County (${r.market}, ${r.permitCountyName})`, r.market==='Charlotte'&&r.permitCountyName==='York County');
  console.log('\n=== Same-name places stay where they were ===');
  for(const [t,mk] of [['Dallas','Dallas'],['Dallas, TX','Dallas'],['Lake Park, FL','Palm Beach'],['Lake Park','Palm Beach']]){
    r=await P.marketPayload(t);
    check(`'${t}' -> ${mk} (got ${r.market})`, r.market===mk);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
