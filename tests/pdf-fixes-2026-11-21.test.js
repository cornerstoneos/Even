// PDF fixes from the first real job (L399 Makinton plumbing, ES, 2026-11-17).
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fnSrc=n=>{const s=html.indexOf(`function ${n}(`);return html.slice(s,html.indexOf('\n}',s)+2);};
const proposalJobLine=new Function(fnSrc('proposalJobLine')+';return proposalJobLine;')();
console.log('\n=== job line on the proposal ===');
check('city not repeated when the label already names it', proposalJobLine({jobAddress:'Fort Lauderdale, FL',project:'1316 NE 14th Ave, Fort Lauderdale'})==='1316 NE 14th Ave, Fort Lauderdale');
check('city kept when the label is just a name', proposalJobLine({jobAddress:'Aventura, FL',project:'Smith Kitchen'})==='Aventura, FL  ·  Smith Kitchen');
check('no label: the city alone', proposalJobLine({jobAddress:'Aventura, FL',project:''})==='Aventura, FL');
check('the address is measured in the font it is printed in', /doc\.setFont\('helvetica','normal'\);doc\.setFontSize\(9\.5\);\n\s*const addr=doc\.splitTextToSize\(proposalJobLine\(P\),jw\)/.test(html));
check('no client: the job uses the whole box (PDF and preview)', /jw=P\.client\?half-24:W-M\*2-24/.test(html)&&/grid-template-columns:\$\{P\.client\?'1fr 1fr':'1fr'\}/.test(html));
console.log('\n=== Spanish cost sheet header ===');
check('"UNIDAD" and the unit-cost header no longer overlap (short label)', /\['DESCRIPCIÓN','CANT\.','UNIDAD','C\. UNIT\.','TOTAL',''\]/.test(html));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
