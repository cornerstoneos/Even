// Nov 7 build B: the weakest in-scope trade caps the confidence tier; the paint
// "pro" row (Home Depot retail minus 20%) scores as retail; SupplyHouse.com lines
// say "Published distributor price"; local supply-house lines keep their label.
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d||''}`))};
const P=require('../lib/pipeline').loadPipeline();
const batch=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','batches','even_master_batch.json'),'utf8'));
const B=batch.find(m=>m.market==='Broward');
const md={...B,permitScope:'municipality'};   // a complete city
const tier=(trade,tb)=>P.computeConfidenceTier(md,P.scopeMaterialCategories(trade,tb),{trade,tradeBreakdown:tb});

console.log('\n=== Weakest trade caps the tier ===');
check('(a) water heater, Plumbing only: HIGH (unchanged)', tier('Plumbing',[{trade:'Plumbing'}])==='high');
const bath=[{trade:'Demolition'},{trade:'Plumbing'},{trade:'Electrical'},{trade:'Drywall'},{trade:'Tile & Flooring'},{trade:'Painting'}];
check('(b) full bathroom remodel: MEDIUM', tier('General Contractor',bath)==='medium');
const q=P.tradeMaterialQuality(B.materials,'General Contractor',bath);
check('(b) the reason names the weak trades (Drywall, Flooring, Paint), not Plumbing/Electrical',
  ['Drywall','Flooring','Paint'].every(c=>q.weak.some(g=>g.cats.includes(c)))&&!q.weak.some(g=>/Plumbing|Electrical/.test(g.cats.join())), JSON.stringify(q.weak));
check('(b) old rule would have said HIGH: the median over every in-scope row is pro-tier', P.materialSourceQuality(B.materials,P.scopeMaterialCategories('General Contractor',bath))>=3);
check('(c) interior repaint: not HIGH', tier('Painting',[{trade:'Interior Painting'}])!=='high');
check('a trade with no rows at all (Siding) scores 0 and caps the tier', P.tradeMaterialQuality(B.materials,'Plumbing',[{trade:'Siding'}]).rank===0&&tier('Plumbing',[{trade:'Siding'}])==='medium');
check('a job naming no specific trade keeps the old whole-scope median', P.tradeMaterialQuality(B.materials,'General Contractor',[{trade:'Remodel'}]).weakest===null);
check('Spanish trade names score the same way', tier('Plomería',[{trade:'Plomería'},{trade:'Pintura'}])==='medium'&&tier('Plomería',[{trade:'Plomería'}])==='high');
check('no trades passed: the old call still works', P.computeConfidenceTier(md,new Set(['Plumbing']))==='high');

console.log('\n=== Paint row is retail, not pro ===');
const changed=[];for(const m of batch)for(const r of (m.materials||[]))if(P.effectiveTier(r)!==r.tier)changed.push(`${m.market}:${r.category}:${r.item}`);
check(`only the 3 Behr interior paint rows are re-scored (${changed.length})`, changed.length===3&&changed.every(x=>/Paint:Behr Premium interior paint/.test(x)), changed.join(' | '));
check('it scores as retail_adjusted (rank 2, below pro)', P.effectiveTier(B.materials.find(r=>r.category==='Paint'))==='retail_adjusted');
check('SupplyHouse.com and local supply house rows are untouched', B.materials.filter(r=>/supplyhouse\.com/i.test(r.source||'')||r.tier==='local_supply_house').every(r=>P.effectiveTier(r)===r.tier));

console.log('\n=== Line labels ===');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fn=n=>{const i=html.indexOf('function '+n+'(');return html.slice(i,html.indexOf('\n}',i)+2);};
const note=(lang,item)=>new Function('appLang','escapeHtml',fn('lineSourceNote')+';return lineSourceNote;')(lang,s=>String(s))(item,0);
const cat=P.buildCatalog(md,new Set(['Plumbing']),{});
const loc=cat.materials.find(e=>e.row.tier==='local_supply_house'), sh=cat.materials.find(e=>/supplyhouse\.com/i.test(e.row.source||''));
const lines=P.priceScope({lineItems:[{type:'material',ref:loc.ref,qty:1},{type:'material',ref:sh.ref,qty:1}]},cat,{marketAdj:1,laborMult:2,oh:15,profit:20,cushion:6,lang:'en'}).lineItems;
const L=lines.find(l=>l.tier==='local_supply_house'), S=lines.find(l=>/supplyhouse/i.test(l.source));
check(`SupplyHouse.com line: "${note('en',S).replace(/<[^>]+>/g,'')}"`, note('en',S).includes('Published distributor price')&&note('es',S).includes('Precio publicado de distribuidor'));
check(`local supply house line keeps its own label: "${note('en',L).replace(/<[^>]+>/g,'')}"`, note('en',L).includes('Local supply house quote (2026-10-26)')&&note('es',L).includes('Cotización de proveedor local')&&!note('en',L).includes('Published'));
check('the reason line exists in EN and ES', /retail-based prices, caps confidence/.test(html)&&/precios basados en tienda, limita la confianza/.test(html));
check('server builds use the same per-trade rule', /computeConfidenceTier\(md, scopeCats, confTrades\)/.test(fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8')));
console.log(`\n──────────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
