// Street-address lookup (founder 2026-11-28): the Census geocoder's place and
// county decide the permit office; any failure falls back to zip/name matching.
// Offline: the real resolver + marketPayload out of server.js, the master batch as
// the database, fake Census and zip answers.
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d||''}`))};
const root=path.join(__dirname,'..');
const srv=fs.readFileSync(path.join(root,'server.js'),'utf8');
const a=srv.indexOf('// ─── Market resolution'), z=srv.indexOf('app.get(\'/api/market-data\'');
if(a<0||z<0) throw new Error('anchors moved in server.js');
const batch=JSON.parse(fs.readFileSync(path.join(root,'data/batches/even_master_batch.json'),'utf8'));
const CENSUS={ // address (lowercase start) -> [lat, lng, place|null, county, state]
  '123 main st, matthews':[35.116,-80.723,'Matthews','Mecklenburg','NC'],
  '4400 sandy plains':[34.05,-84.45,null,'Cobb','GA'],
  '500 n broad st, monroe':[34.985,-80.549,'Monroe','Union','NC'],
  '2100 ponce de leon blvd, coral gables':[25.751,-80.258,'Coral Gables','Miami-Dade','FL'],
};
const ZIPS={'33184':[25.757,-80.40],'28105':[35.116,-80.723]};
const calls=[];
const fakeFetch=async url=>{url=String(url);
  if(url.includes('geocoding.geo.census.gov')){ calls.push(url);
    const addr=decodeURIComponent(url.match(/address=([^&]*)/)[1]).toLowerCase();
    const k=Object.keys(CENSUS).find(k=>addr.startsWith(k)); if(!k) return {ok:true,json:async()=>({result:{addressMatches:[]}})};
    const [lat,lng,place,county,state]=CENSUS[k];
    return {ok:true,json:async()=>({result:{addressMatches:[{coordinates:{x:lng,y:lat},addressComponents:{state},geographies:{'Incorporated Places':place?[{BASENAME:place}]:[],'Counties':[{BASENAME:county}]}}]}})}; }
  const zip=url.match(/us\/(\d{5})/)?.[1];const c=ZIPS[zip];
  return {ok:!!c,json:async()=>({places:[{latitude:String(c&&c[0]),longitude:String(c&&c[1])}]})};};
const P=new Function('require','fetch','app','express','MARKETS','MUNICIPALITIES','batch',
  srv.slice(a,z)+`
;getMarketData=async market=>{const m=batch.find(x=>x.market===market);return m?JSON.parse(JSON.stringify(m)):null;};
return {marketPayload,resolveMarket,looksLikeStreetAddress};`)(
  p=>require(p.startsWith('.')?path.join(root,p):p), fakeFetch, {get(){},post(){},use(){}}, {raw:()=>null,json:()=>null},
  require(path.join(root,'data/markets.json')), require(path.join(root,'data/municipalities.json')), batch);
const munis=r=>[...new Set((r.permits||[]).map(x=>x.municipality))];
(async()=>{
  console.log('\n=== Street addresses ===');
  check('"123 Main St, Matthews, NC 28105" looks like an address', P.looksLikeStreetAddress('123 Main St, Matthews, NC 28105'));
  check('"Matthews, NC" and "33184" do not', !P.looksLikeStreetAddress('Matthews, NC')&&!P.looksLikeStreetAddress('33184'));
  let r=await P.marketPayload('123 Main St, Matthews, NC 28105');
  check(`Matthews address -> Charlotte, Matthews, Mecklenburg, county-issued (${r.market}, ${r.municipality}, ${r.permitScope})`, r.market==='Charlotte'&&r.municipality==='Matthews'&&r.permitCountyName==='Mecklenburg County'&&r.permitScope==='county-issued');
  r=await P.marketPayload('4400 Sandy Plains Rd, Marietta, GA 30066');
  check(`Mailing city says Marietta but the address is unincorporated Cobb -> Cobb County rows, unincorporated (${r.permitScope}, ${munis(r)})`, r.market==='Atlanta'&&r.permitScope==='unincorporated'&&munis(r).join()==='Cobb County GA');
  r=await P.marketPayload('500 N Broad St, Monroe, NC 28112');
  check(`Monroe address -> City of Monroe's own rows (${r.permitScope}, ${munis(r)})`, munis(r).join()==='City of Monroe NC'&&r.permitScope==='municipality');
  r=await P.marketPayload('2100 Ponce de Leon Blvd, Coral Gables, FL 33134');
  check(`Coral Gables address -> Coral Gables rows (${r.market}, ${r.municipality}, ${r.permitScope})`, r.market==='Miami-Dade'&&r.municipality==='Coral Gables'&&/^municipality/.test(r.permitScope));
  console.log('\n=== Fallbacks ===');
  r=await P.marketPayload('12345 SW 8th St, Miami, FL 33184');
  check(`Census has no match -> falls back to the zip (33184, not house number 12345) (${r.market}, ${r.municipality})`, r.market==='Miami-Dade');
  const n=calls.length; r=await P.marketPayload('123 Main St, Matthews, NC 28105');
  check('same address twice -> Census asked once (cached)', calls.length===n);
  r=await P.marketPayload('Matthews, NC');
  check(`"Matthews, NC" (no street) -> name matching, no Census call (${r.municipality})`, r.municipality==='Matthews'&&calls.length===n);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
