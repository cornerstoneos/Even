// The client proposal is the contractor's document (bug 8, 2026-10-06): one price,
// the contractor's business, and nothing internal. Builds the proposal content with
// the real builder from index.html (the preview and the PDF both draw it) from an
// estimate full of internal notes, and searches every word it would print.
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const s=html.indexOf('//  CLIENT PROPOSAL'), e=html.indexOf('function renderProposalPreview(){');
if(s<0||e<0) throw new Error('anchors moved');
const store={};
const env={window:{_finalBid:null,_proposalDetail:'full',_userLogoUrl:null},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;}},currentUser:{email:'owner@acmeplumbing.com'}};
const fmt=n=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const api=new Function('window','localStorage','currentUser','fmt','savePrefs','liveProposalUpdate',html.slice(s,e)+';return {buildClientProposal,clientProposalText,clientSafeText,clientLineText,setBiz};')(env.window,env.localStorage,env.currentUser,fmt,()=>{},()=>{});
const est=()=>({projectName:'Water Heater Replacement',totalBid:2266.45,subtotal:1597.54,
  overhead:{pct:12,amount:192},contingency:{pct:8,amount:128},profit:{pct:22,amount:422},
  lineItems:[
    {category:'Plumbing',description:'50 Gallon Electric Water Heater',qty:1,unit:'each',unitCost:894.42,total:894.42},
    {category:'Plumbing',description:'PEX-b tubing (incl. 10% waste)',qty:22,unit:'ft',unitCost:0.31,total:6.82},
    {category:'Labor',description:'Remove old unit, set new heater, connect and test',qty:5,unit:'hr',unitCost:61.09,total:305.45,priced:'bls x multiplier'},
    {category:'Disposal',description:'Haul away old water heater',qty:1,unit:'ea',unitCost:50,total:50,estimated:true,estLabel:'not in our data, estimated'},
    {category:'Permits',description:'Permit: Fort Lauderdale Trade Permit',qty:1,unit:'permit',unitCost:131,total:131}],
  assumptions:['Delivery, disposal and site protection scaled to job size ($645 to $300). Flat minimums don\'t apply at this scope.',
    'Fort Lauderdale Trade Permit: shown at the schedule\'s minimum fee; the full rule is value. Verify with the building department.',
    'Standard 50 gallon unit used as closest standard equivalent to the existing 40 gallon tank',
    'HVHZ rules apply only to exterior work, not relevant to this interior remodel',
    'Self-performed labor at contractor\'s own hourly rates, no subcontractor markup',
    'Same location and same fuel type as the existing water heater',
    'Existing water and power connections are reused'],
  exclusions:['Drywall repair beyond the closet','Supplier delivery charges per catalog pricing'],
  paymentTerms:'50% deposit required to schedule · 50% upon project completion. Price valid 30 days.'});
const ctx={client:'Maria Lopez',location:'Fort Lauderdale, FL',projectLabel:''};
api.setBiz('company','Acme Plumbing LLC'); api.setBiz('phone','(954) 555-0100'); api.setBiz('license','CFC1234567');

const BANNED=[/\beven\b/i,/even\s*os/i,/\bAI\b/,/\bIA\b/,/ai-estimated/i,/\brange\b/i,/\brango\b/i,/midpoint/i,/overhead/i,/profit/i,/cushion/i,/contingenc/i,/markup/i,/waste/i,/scaled/i,/supplier/i,/verify/i,/catalog/i,/not in our data/i,/\bBLS\b/,/multiplier/i,/HVHZ/,/closest/i,/\$[\d,]+(\.\d\d)?\s*[–-]\s*\$[\d,]+/,/—/];
for(const lang of ['en','es']){
  console.log(`\n=== Client proposal (${lang.toUpperCase()}) ===`);
  for(const finalBid of [null,2500]){
    env.window._finalBid=finalBid;
    const d=est(); const P=api.buildClientProposal(d,ctx,lang); const text=api.clientProposalText(P);
    const hits=BANNED.filter(rx=>rx.test(text)).map(String);
    check(`${finalBid?'with':'no'} final bid: no banned words or ranges anywhere`, !hits.length, hits.join(' ')+'\n'+text);
    check(`${finalBid?'with':'no'} final bid: exactly one price, ${finalBid?'the final bid':'the midpoint'}`,
      P.price===(finalBid||2266) && (text.match(/\$[\d,]+\.\d\d/g)||[]).length===1, (text.match(/\$[\d,]+\.\d\d/g)||[]).join(' '));
  }
  env.window._finalBid=null;
  const P=api.buildClientProposal(est(),ctx,lang), text=api.clientProposalText(P);
  check('shows the contractor: name, phone, email, license', ['Acme Plumbing LLC','(954) 555-0100','owner@acmeplumbing.com','CFC1234567'].every(x=>text.includes(x)));
  check('shows client, job address, date and proposal number', text.includes('Maria Lopez')&&text.includes('Fort Lauderdale, FL')&&/P-\d{6}-\d{4}/.test(P.number)&&P.date);
  check('scope lines are listed without internal notes', text.includes('PEX-b tubing')&&!/incl\.\s*10%/.test(text)&&text.includes('Haul away old water heater'));
  check('only client-relevant conditions are kept', P.assumptions.length===2&&P.assumptions.includes('Existing water and power connections are reused'), JSON.stringify(P.assumptions));
  check('exclusions keep client items, drop internal ones', P.exclusions.length===1&&P.exclusions[0].startsWith('Drywall'), JSON.stringify(P.exclusions));
  check('payment schedule and a dated 30-day validity line', P.payment.includes('50%')&&/30/.test(P.validity)&&/(until|hasta)/.test(P.validity));
  if(lang==='es'){ check('Spanish copy: payment schedule and categories translated', P.payment.startsWith('50% de depósito')&&P.scopeRows.some(r=>r.category==='Plomería')&&P.scopeRows.some(r=>r.category==='Permisos'), P.payment+' '+P.scopeRows.map(r=>r.category)); }
  check('signature lines present', /signature|firma/i.test(P.labels.clientSig)&&/signature|firma/i.test(P.labels.contractorSig));
  check('no overhead, profit or cushion amounts (192, 422, 128) anywhere', !/\b(192|422|128)\b/.test(text));
}
console.log('\n=== Contractor copy is untouched ===');
{ const d=est(); api.buildClientProposal(d,ctx,'en'); check('the estimate keeps all its internal assumptions for the cost sheet', d.assumptions.length===7); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
