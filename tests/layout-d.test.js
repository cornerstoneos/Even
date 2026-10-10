// Estimate page layout D (decided 2026-10-07/10). Source checks that keep the
// approved design in place; the click-through runs in a browser
// (tests/acceptance/es-2026-10-07.js and the layout-D clicks script).
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d||''}`))};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const est=html.slice(html.indexOf('id="s-estimate"'),html.indexOf('<!-- /s-estimate -->'));
const at=s=>est.indexOf(s);
console.log('\n=== Order (phone reads top to bottom) ===');
check('price card first', at('id="price-card"')>0&&at('id="price-card"')<at('id="work-card"'));
check('labor one-liner under the price card', at('id="est-labor-card"')>at('id="price-card"')&&at('id="est-labor-card"')<at('id="work-card"'));
check('the work, then Finish your proposal, then the downloads', at('id="work-card"')<at('id="proposal-edit-card"')&&at('id="proposal-edit-card"')<at('id="est-pdf-grid"'));
check('payment schedule sits inside Finish your proposal', at('id="pay-sched-section"')>at('id="proposal-edit-card"')&&at('id="pay-sched-section"')<at('id="dl-home"'));
check('conditions, client supplies and detail level are behind More options', at('id="more-options"')<at('id="prop-assumptions"')&&at('id="more-options"')<at('id="prop-supply"'));
console.log('\n=== Wording (user 2026-10-08) ===');
check('Client Proposal: "For your client" / "Para tu cliente"', /data-es="Para tu cliente">For your client</.test(est));
check('Cost Sheet: "Your numbers" / "Tus números"', /data-es="Tus números">Your numbers</.test(est));
check('nothing else under the buttons', !/Downloads as a PDF/.test(est));
check('gold Client Proposal comes before the dark Cost Sheet', est.indexOf('d-btn gold')<est.indexOf('d-btn dark'));
console.log('\n=== Behaviour ===');
check('categories start folded', /cat-div cat-toggle closed/.test(html)&&/id="catg-\$\{ci\}" style="display:none"/.test(html));
check('"What this means" on the price, the work and the proposal', ['info-price','info-work','info-finish'].every(id=>est.includes(`id="${id}" hidden`)));
check('labor: one line + "How it works" (EN/ES)', /ⓘ How it works/.test(html)&&/ⓘ Cómo funciona/.test(html)&&/function renderLaborCard/.test(html));
check('labor explanation is honest about the 2.2 default', /isn't based on local contractor data yet/.test(html));
check('big price = your own price, else the rounded midpoint (same rule as the proposal)', /const price=window\._finalBid\|\|Math\.round\(d\.totalBid\|\|0\)/.test(html));
check('client name can be set on the proposal itself', /id="prop-client"/.test(est)&&/function setProposalClient/.test(html));
check('no em dash in the note placeholder', !/Thank you for the opportunity —/.test(html));
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
