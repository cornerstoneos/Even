// Texas suburbs (2026-11-28): Collin County towns were their own empty markets (0 materials, 0 labor);
// now cities inside Dallas/Fort Worth/Houston/Austin/San Antonio. Copied harness from atl-clt-counties.
// (was: Atlanta + Charlotte city lists, founder 2026-11-25): each address gets its own
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
const ZIPS={'75024':[33.08,-96.80],'75069':[33.20,-96.64],'75002':[33.10,-96.67],'77494':[29.74,-95.82],'76092':[32.94,-97.15],'34677':[28.04,-82.67],'33701':[27.77,-82.64],'33511':[27.91,-82.29],'34741':[28.31,-81.42],'32771':[28.81,-81.30],'33602':[27.95,-82.46]};
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
  console.log('\n=== Texas suburbs (2026-11-28) ===');
  const M=require(path.join(root,'data/markets.json'));
  check('no empty Prosper/Frisco/McKinney markets left', !M.some(m=>['Prosper','Frisco','McKinney'].includes(m.market)));
  check('every markets.json market has a batch entry', M.every(m=>batch.some(b=>b.market===m.market)), M.filter(m=>!batch.some(b=>b.market===m.market)).map(m=>m.market).join());
  for(const [t,mk,city] of [['Plano, TX 75024','Dallas','Plano'],['Frisco, TX','Dallas','Frisco'],['McKinney, TX 75069','Dallas','McKinney'],['Allen, TX 75002','Dallas','Allen'],['Prosper, TX','Dallas','Prosper'],['Katy, TX 77494','Houston','Katy'],['Southlake, TX 76092','Fort Worth','Southlake'],['Round Rock, TX','Austin','Round Rock'],['New Braunfels, TX','San Antonio','New Braunfels'],['Sugar Land, TX','Houston','Sugar Land']]){
    const r=await P.marketPayload(t);
    check(`'${t}' -> ${mk}, materials + labor present, no big-city rows borrowed (${r.market}, ${(r.materials||[]).length}/${(r.labor||[]).length}, ${munis(r)})`,
      r.market===mk&&(r.materials||[]).length>0&&(r.labor||[]).length>0&&!munis(r).some(x=>/^City of (Dallas|Houston|Fort Worth|Austin|San Antonio) TX$/.test(x)));
  }
  for(const [t,mk] of [['Dallas, TX','Dallas'],['Houston, TX','Houston'],['Fort Worth, TX','Fort Worth'],['Austin, TX','Austin'],['San Antonio, TX','San Antonio']]){
    const r=await P.marketPayload(t);
    check(`'${t}' keeps its own city rows (${r.permitScope}, ${munis(r)})`, r.market===mk&&munis(r).join()===`City of ${mk} TX`);
  }
  for(const [t,mk] of [['Weston, FL','Broward'],['Fairview, NC','Charlotte'],['Westlake, FL','Palm Beach']]){
    const r=await P.marketPayload(t);
    check(`same-name '${t}' stays ${mk} (got ${r.market})`, r.market===mk);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
