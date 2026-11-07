// Nov 7 build C: HB 803 note under Florida permit lines (app screen + cost
// sheet), never outside Florida, never on the client proposal.
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d||''}`))};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fn=n=>{const i=html.indexOf('function '+n+'(');return html.slice(i,html.indexOf('\n}',i)+2);};
const make=(loc)=>new Function('window','appLang','escapeHtml',[fn('permitIsFlorida'),fn('hb803Note'),fn('lineSourceNote'),'return {hb803Note,lineSourceNote};'].join('\n'))({_ctx:{location:loc}},'en',s=>String(s));
const P=require('../lib/pipeline').loadPipeline();
const batch=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','batches','even_master_batch.json'),'utf8'));
// The first permit row the engine prices into a line (some rows are add-ons).
const line=(market)=>{const m=batch.find(x=>x.market===market);const cat=P.buildCatalog(m,null,{});
  for(const e of cat.permits){const l=P.priceScope({lineItems:[{type:'permit',ref:e.ref}]},cat,{marketAdj:1,laborMult:2,oh:0,profit:0,cushion:0,lang:'en',sqft:0}).lineItems.find(l=>l.permitRow); if(l) return l;}};
const fl=line('Broward'), nc=line('Charlotte');
const F=make('Fort Lauderdale, FL');
check('Florida market lines carry fl:true, Charlotte fl:false', fl.permitRow.fl===true&&nc.permitRow.fl===false);
check('EN text with the row date', F.hb803Note(fl,'en')===`Permit fee per the city's posted schedule (as of ${fl.permitRow.date}); may change under Florida HB 803.`, F.hb803Note(fl,'en'));
check('ES text with the row date', F.hb803Note(fl,'es')===`Tarifa de permiso según la tabla publicada por la ciudad (al ${fl.permitRow.date}); puede cambiar por la ley HB 803 de Florida.`, F.hb803Note(fl,'es'));
check('Charlotte: no note, and the screen line has no HB 803', F.hb803Note(nc,'en')===''&&!/HB 803/.test(F.lineSourceNote(nc,0)), F.lineSourceNote(nc,0));
const old={permitRow:{municipality:'Davie',work_type:'Plumbing',date:'2026-10-01'}};
check('estimate saved before the flag: Florida read off the "City, FL" location', make('Davie, FL').hb803Note(old,'en').includes('as of 2026-10-01')&&make('Charlotte, NC').hb803Note(old,'en')==='');
check('cost sheet draws the note', /const hb=hb803Note\(item,L\)/.test(fn('downloadCostSheet')));
check('client proposal never mentions HB 803', !/HB 803|hb803/.test(fn('buildClientProposalPDF')+fn('buildClientProposal')));
check('no em dash in the new copy', !/—/.test(fn('hb803Note')));
console.log(`\n──────────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
