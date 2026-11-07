// Nov 7 build D: Data Trade has no photo step; the server grants the credit once
// (the server side is covered end to end in access.test.js).
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d||''}`))};
const s=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const i=s.indexOf('<div id="data-trade-modal"'), modal=s.slice(i,s.indexOf('<!-- Dashboard Screen -->',i));
const fn=n=>{const k=s.indexOf('function '+n+'(');return s.slice(k,s.indexOf('\n}',k)+2);};
const submit=fn('submitDataTrade');
check('no photo check in submit', !/hasPhoto|photo/i.test(submit.replace(/\/\/.*$/gm,'')));
check('no photo upload or photo copy in the modal (EN or ES)', !/type="file"|photo|foto|receipt|recibo/i.test(modal), modal.match(/photo|foto/i)?.[0]);
check('the old photo handler is gone', !/handleTradePhoto|trade-photo/.test(s));
check('still asks for trade, city and cost', /if\(!trade \|\| !city \|\| !cost\)/.test(submit));
check('credit still comes from the server', /\/api\/data-trade-credit/.test(submit));
check('result messages in EN + ES, second try says already used',
  /Thank you\. 1 free estimate unlocked\./.test(submit)&&/Gracias\. Se desbloqueó 1 estimado gratis\./.test(submit)&&/Already used:/.test(submit)&&/Ya usaste tu estimado gratis/.test(submit));
check('modal copy has no em dashes', !/—/.test(modal));
console.log(`\n──────────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
