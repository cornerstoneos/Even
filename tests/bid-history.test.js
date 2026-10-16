// Bid history + Won/Lost (founder 2026-10-13). The "what changed" list is
// computed by bidChanges() in index.html; this runs that exact function on real
// shapes of bids, and checks the rules around it in the page source: a revised
// bid is a copy, removed lines stay in place (flagged) so positions match, the
// client proposal never prints a removed line or the change list, the cost
// tracker saves actuals by the line's real position, outcome lives on the job.
// The browser run (tests/acceptance/bids-2026-10-17.js) covers the screens.
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fnSrc=name=>{const s=html.indexOf(`function ${name}(`);if(s<0) throw new Error('missing '+name);return html.slice(s,html.indexOf('\n}',s)+2);};
const {bidChanges,bidPrice}=new Function(`const round2=n=>Math.round((Number(n)||0)*100)/100;
const fmt=n=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
${fnSrc('bidPrice')}
${fnSrc('bidChanges')}
return {bidChanges,bidPrice};`)();

const bid1={totalBid:10000,lineItems:[
  {category:'Tile',description:'Porcelain floor tile',qty:60,unit:'sqft',unitCost:4,total:240},
  {category:'Cabinets',description:'Vanity cabinet',qty:1,unit:'ea',unitCost:800,total:800},
  {category:'Labor',description:'Tile setter',qty:16,unit:'hr',unitCost:60,total:960},
  {category:'Permits',description:'Permit: Miami Building',qty:1,unit:'permit',unitCost:300,total:300}]};
const bid2=JSON.parse(JSON.stringify(bid1));
bid2.lineItems[0].qty=80; bid2.lineItems[0].total=320;                  // more tile
bid2.lineItems[1].removed=true; bid2.lineItems[1].total=0;             // client cut the vanity
bid2.lineItems[2].qty=20; bid2.lineItems[2].total=1200;                // more labor
bid2.lineItems[3].unitCost=350; bid2.lineItems[3].total=350;           // city fee changed
bid2.lineItems.push({category:'Electrical',description:'2 extra circuits',qty:2,unit:'ea',unitCost:150,total:300});
bid2.totalBid=10450;

console.log('\n=== what changed: Bid 2 vs Bid 1 ===');
const c=bidChanges(bid1,bid2,'en');
check('total vs previous: +$450.00 (+4.5%)', c.diff===450&&c.pct===4.5, JSON.stringify({d:c.diff,p:c.pct}));
const t=c.lines.map(l=>l.text);
check('line added', t.includes('Added: 2 extra circuits ($300.00)'), t.join(' | '));
check('line removed', t.includes('Removed: Vanity cabinet ($800.00)'), t.join(' | '));
check('quantity change', t.includes('Porcelain floor tile: qty 60 → 80'), t.join(' | '));
check('price change', t.includes('Permit: Miami Building: price $300.00 → $350.00'), t.join(' | '));
check('permit fee change in the summary', c.summary.includes('Permit fees: +$50.00'), c.summary.join(' | '));
check('labor change in the summary', c.summary.includes('Labor: +$240.00'), c.summary.join(' | '));
check('nothing invented: exactly 5 line changes + 2 summary lines', c.lines.length===5&&c.summary.length===2, JSON.stringify(c));
const same=bidChanges(bid1,JSON.parse(JSON.stringify(bid1)),'en');
check('an untouched copy shows no changes and the same total', same.lines.length===0&&same.summary.length===0&&same.diff===0);
const withFinal={...bid2,finalBid:11000};
check("the contractor's own price counts as the bid's price", bidChanges(bid2,withFinal,'en').diff===550&&bidPrice(withFinal)===11000);
check('a price-only change is listed (Your price)', bidChanges(bid2,withFinal,'en').summary.includes("Your price: Even's → $11,000.00"), JSON.stringify(bidChanges(bid2,withFinal,'en').summary));
const es=bidChanges(bid1,bid2,'es');
check('Spanish: Agregado / Quitado / cantidad / precio / Permisos / Mano de obra', es.lines.some(l=>l.text.startsWith('Agregado: '))&&es.lines.some(l=>l.text.startsWith('Quitado: '))&&es.lines.some(l=>/cantidad 60 → 80/.test(l.text))&&es.lines.some(l=>/precio \$300\.00 → \$350\.00/.test(l.text))&&es.summary.some(x=>x.startsWith('Permisos: '))&&es.summary.some(x=>x.startsWith('Mano de obra: ')), JSON.stringify(es));
check('no em dashes in the change text', !JSON.stringify([c,es]).includes('—'));

console.log('\n=== rules in the page ===');
const blk=html.slice(html.indexOf('//  BID HISTORY'),html.indexOf('async function redownloadEstimate('));
check('bid history code found', blk.length>3000);
check('no em dashes in the bid history text', !blk.includes('—'), (blk.match(/.{30}—.{30}/)||[])[0]);
for(const [en,esw] of [['Bid history','Historial de ofertas'],['REVISE BID','REVISAR OFERTA'],['What changed','Qué cambió'],["'Bid'","'Oferta'"]]) check(`EN/ES: ${en} / ${esw}`, blk.includes(en)&&blk.includes(esw));
check('Revise copies the LATEST bid and numbers it N+1 under Bid 1', /const latest=fresh\[fresh\.length-1\]/.test(blk)&&/job_id:job\.rootId,bid_no:\(latest\.bid_no\|\|1\)\+1/.test(blk));
check('a new bid is made only by the Revise button (one insert, in reviseBid)', (blk.match(/\.insert\(/g)||[]).length===1&&/async function reviseBid\(\)[\s\S]*\.insert\(payload\)/.test(blk));
check('signed out: a sign-in prompt instead of Revise', /if\(!currentUser\)\{[\s\S]{0,700}openSignupPanel\(\)/.test(blk));
check('deleting a line flags it (positions stay put)', /currentEstimate\.lineItems\[idx\]\.removed=true/.test(html)&&!/lineItems\.splice\(/.test(html));
check('client proposal skips removed lines', /filter\(i=>!i\.removed&&\(\(\+i\.total\|\|0\)>0\|\|i\.category\)\)/.test(html));
check('cost sheet skips removed lines', /forEach\(\(item,i\)=>\{\n    if\(item\.removed\) return;\n    doc\.setFont/.test(html));
const prop=html.slice(html.indexOf('function buildClientProposal('),html.indexOf('function clientProposalText('));
check('the client proposal never reads the bid list or change list', !/_job|bidChanges|change_note/.test(prop));
check('edits persist on the bid being viewed (qty, price, name, final bid)', /li\.total=total; li\.qty=qty; li\.unitCost=uc;/.test(html)&&/update\(\{estimate_json:json,total_bid:total\}\)\.eq\('id',window\._currentEstimateId\)/.test(blk));
check('tracker saves actuals by the line\'s real position', /data-li="\$\{item\._li\}"/.test(html)&&/line_index:li,/.test(html)&&/\.var-row\[data-li="\$\{entry\.line_index\}"\]/.test(html));
check('status is set on every bid of the job', /\.or\(`id\.eq\.\$\{estimateId\},job_id\.eq\.\$\{estimateId\}`\)/.test(html));
check('Won opens the tracker on the final bid', /if\(status==='won'\)\{[\s\S]{0,300}loadSavedEstimate\(estimateId,\{tracker:true\}\)/.test(html)&&/const pick=opts\.exact\?[^;]*:bids\[bids\.length-1\]/.test(html));
check('Lost: optional reason (price, timing, went with someone else, other) saved on the job', /LOST_REASONS=\{price:\['Price','Precio'\],timing:\['Timing','Tiempo'\],competitor:\['Went with someone else','Se fue con otro'\],other:\['Other','Otro'\]\}/.test(html)&&/update\(\{lost_reason:reason\|\|null\}\)\.eq\('id',jobId\)/.test(html));
check('dashboard: one card per job, its latest bid', /const k=r\.job_id\|\|r\.id/.test(html)&&/bidCount:rows\.length/.test(html));
check('a new estimate never writes to the previous job', /window\._currentEstimateId=null; window\._job=null;/.test(html));

console.log(`\n──────────────\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
