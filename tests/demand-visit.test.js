// Demand map (founder 2026-11-28): 'visit' events store only "City, ST" from the
// web host's geo lookup. Offline: visitCity out of server.js + the client hook.
const fs=require('fs'),path=require('path');
let pass=0,fail=0;const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d||''}`))};
const root=path.join(__dirname,'..');
const srv=fs.readFileSync(path.join(root,'server.js'),'utf8');
const clip=srv.match(/const clip = [^\n]+/)[0];
const vc=srv.slice(srv.indexOf('function visitCity'),srv.indexOf('app.post(\'/api/event\''));
const visitCity=new Function(clip+'\n'+vc+'\nreturn visitCity;')();
check('US visitor -> "Gastonia, NC"', visitCity({city:'Gastonia',region:'NC',country:'US'})==='Gastonia, NC');
check('outside the US -> "Toronto, CA"', visitCity({city:'Toronto',region:'ON',country:'CA'})==='Toronto, CA');
check('no city -> nothing stored', visitCity({region:'FL',country:'US'})===null);
check('junk is stripped', visitCity({city:'<script>Miami</script>',region:'FL"',country:'US'})==='scriptMiamiscript, FL');
check('server accepts the visit event', /CLIENT_EVENTS = new Set\(\[[^\]]*'visit'/.test(srv));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
check('app sends at most one visit a day, only on even-os.com', html.includes('even_visit_day')&&html.includes('even-os'+'\\.com$/.test(location.hostname)'));
const fn=fs.readFileSync(path.join(root,'netlify/functions/geo.mjs'),'utf8');
check('geo function never returns the IP', !/\bip\b/i.test(fn.replace(/IP is never|the IP/g,''))&&/path: '\/api\/geo'/.test(fn));
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
