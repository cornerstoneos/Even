// Multi-county markets (EXPANSION DATA item 4): a job only ever gets its own
// county's permit rows. Offline: the real resolver + permit filter + marketPayload
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
  console.log('\n=== Spec acceptance ===');
  let r=await P.marketPayload('Brandon, FL');
  check(`'Brandon, FL' -> Hillsborough rows, unincorporated (${r.permitScope}, ${munis(r)})`, r.permitScope==='unincorporated'&&munis(r).join()==='Hillsborough County FL'&&r.permitCountyName==='Hillsborough County');
  r=await P.marketPayload('Tampa, FL');
  check(`'Tampa, FL' -> City of Tampa rows only (${r.permitScope}, ${munis(r)})`, munis(r).join()==='City of Tampa FL'&&r.permitScope==='municipality', JSON.stringify(r.permitMissing));
  r=await P.marketPayload('Temple Terrace, FL');
  check(`'Temple Terrace, FL' -> county-fallback with Hillsborough rows (${r.permitScope}, ${munis(r)})`, r.permitScope==='county-fallback'&&munis(r).join()==='Hillsborough County FL');
  for(const t of ['St. Petersburg, FL','Clearwater, FL','Oldsmar, FL','Largo, FL']){
    r=await P.marketPayload(t);
    check(`'${t}' -> never Hillsborough rows (${r.municipality}, ${r.permitCountyName}, ${r.permitScope}, ${(r.permits||[]).length} rows)`, r.market==='Tampa'&&r.permitCountyName==='Pinellas County'&&!hasHills(r));
  }
  console.log('\n=== By zip (the 15-mile radius) ===');
  r=await P.marketPayload('34677');
  check(`Oldsmar zip 34677 -> ${r.municipality} (Pinellas), not Lutz (Hillsborough)`, r.municipality==='Oldsmar'&&!hasHills(r));
  r=await P.marketPayload('33701');
  check(`St. Petersburg zip 33701 -> ${r.municipality}, no Hillsborough rows`, r.municipality==='St. Petersburg'&&!hasHills(r));
  r=await P.marketPayload('33511');
  check(`Brandon zip 33511 -> ${r.municipality}, Hillsborough rows`, r.municipality==='Brandon'&&hasHills(r));
  r=await P.marketPayload('34741');
  check(`Kissimmee zip 34741 -> ${r.municipality} (Osceola), no Orange County rows`, r.municipality==='Kissimmee'&&r.permitCountyName==='Osceola County'&&!(r.permits||[]).some(x=>/Orange County/.test(x.municipality||'')));
  r=await P.marketPayload('32771');
  check(`Sanford zip 32771 -> ${r.municipality} (Seminole), no Orange County rows`, r.municipality==='Sanford'&&!(r.permits||[]).some(x=>/Orange County/.test(x.municipality||'')));

  console.log('\n=== Orlando market ===');
  r=await P.marketPayload('Pine Hills, FL');
  check(`'Pine Hills, FL' -> Orange County rows, unincorporated`, r.permitScope==='unincorporated'&&munis(r).join()==='Orange County FL');
  r=await P.marketPayload('Orlando, FL');
  check(`'Orlando, FL' -> City of Orlando rows only (${munis(r)})`, munis(r).join()==='City of Orlando FL');
  r=await P.marketPayload('Apopka, FL');
  check(`'Apopka, FL' -> county-fallback with Orange County rows`, r.permitScope==='county-fallback'&&munis(r).join()==='Orange County FL');

  console.log('\n=== No city identified: the main county, and it says so ===');
  r=await P.marketPayload('Tampa Bay');
  check(`'Tampa Bay' -> Hillsborough rows, assumed main county (${r.permitScope}, ${r.permitCountyName}, assumed=${r.permitCountyAssumed})`, r.permitScope==='county'&&munis(r).join()==='Hillsborough County FL'&&r.permitCountyAssumed===true);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  check('the estimate says the main county was assumed (EN + ES)', /the main county for this area/.test(html)&&/el condado principal de esta zona/.test(html)&&/assumed to be in '\+md\.permitCountyName/.test(html));

  console.log('\n=== Single-county markets unchanged ===');
  for(const [t,c] of [['Kendall, FL','Miami-Dade County'],['Fort Lauderdale, FL',null],['Wellington, FL',null]]){
    r=await P.marketPayload(t);
    const old=P.filterPermits(batch.find(x=>x.market===r.market).permits, r.municipality, r.permitScope==='unincorporated');
    check(`'${t}': same rows as before the county filter (${r.permitScope}, ${(r.permits||[]).length})`, JSON.stringify(old.permits)===JSON.stringify(r.permits)&&old.scope===r.permitScope);
  }
  console.log('\n=== Same-named places in other states ===');
  r=await P.resolveMarket('Sanford, NC');
  check(`'Sanford, NC' does not land on Sanford FL (${r&&r.market})`, !r||r.municipality!=='Sanford');
  r=await P.resolveMarket('Hollywood, CA');
  check(`'Hollywood, CA' does not land on Hollywood FL`, !r||r.municipality!=='Hollywood');
  console.log(`\n──────────────\n${pass} passed, ${fail} failed\n`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
