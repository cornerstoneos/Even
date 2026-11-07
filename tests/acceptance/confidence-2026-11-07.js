// Weakest in-scope trade caps the confidence tier (Nov 7 build B). Offline, no
// model: the 4 acceptance jobs through the app's own scoring, before vs after.
// Run: node tests/acceptance/confidence-2026-11-07.js [old index.html] [old lib/pipeline.js]
// With an old index.html it prints the before column from that file's code.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','..');
const {loadPipeline}=require(path.join(root,'lib','pipeline'));
// Before column: an older index.html + its own lib/pipeline.js (argv 2 and 3).
const NEW=loadPipeline(), OLD=process.argv[2]?require(path.resolve(process.argv[3])).loadPipeline(path.resolve(process.argv[2])):null;
const batch=JSON.parse(fs.readFileSync(path.join(root,'data','batches','even_master_batch.json'),'utf8'));
// The server's city-first permit filter, loaded from server.js (no copy).
const srv=fs.readFileSync(path.join(root,'server.js'),'utf8');
const fn=n=>{const i=srv.indexOf('function '+n+'(');return srv.slice(i,srv.indexOf('\n}',i)+2);};
const constSrc=n=>{const i=srv.indexOf('const '+n+' =');const e=srv.slice(i,i+3)&&srv.indexOf(srv.slice(i).startsWith('const CORE')?'})();':';',i);return srv.slice(i,e)+(srv.slice(i).startsWith('const CORE')?'})();':';')+'\n';};
const filt=new Function('require',[constSrc('CORE'),constSrc('UNKNOWN_MUNI_PERMIT_CAP'),fn('normalizeMuni'),fn('missingCoreFees'),fn('countyRowsForMissing'),fn('filterPermits'),'return filterPermits;'].join('\n'))(p=>require(path.join(root,p)));
function md(market,city){
  const m=batch.find(x=>x.market===market);
  const f=filt(m.permits,city,false);
  return {...m,permits:f.permits,permitScope:f.scope,municipality:city};
}
// The trade breakdowns are what the scope step returns for these jobs (written
// out here so the run needs no model).
const JOBS=[
  {id:'a',name:'Fort Lauderdale 40 gal water heater',market:'Broward',city:'Fort Lauderdale',trade:'Plumbing',tb:[{trade:'Plumbing'}],expect:'unchanged'},
  {id:'b',name:'Fort Lauderdale full bathroom remodel',market:'Broward',city:'Fort Lauderdale',trade:'General Contractor',
    tb:[{trade:'Demolition'},{trade:'Plumbing'},{trade:'Electrical'},{trade:'Drywall'},{trade:'Tile & Flooring'},{trade:'Painting'}],expect:'medium'},
  {id:'c',name:'Interior repaint 2,000 sf (Fort Lauderdale)',market:'Broward',city:'Fort Lauderdale',trade:'Painting',tb:[{trade:'Interior Painting'}],expect:'not high'},
  {id:'d',name:'Davie plumbing (local supply house rows)',market:'Broward',city:'Davie',trade:'Plumbing',tb:[{trade:'Plumbing'}],expect:'local label'}
];
let fail=0;
const rows=[];
for(const j of JOBS){
  const d=md(j.market,j.city);
  const cats=NEW.scopeMaterialCategories(j.trade,j.tb);
  const before=OLD?OLD.capConfidence(OLD.computeConfidenceTier(d,OLD.scopeMaterialCategories(j.trade,j.tb)),j.trade):'-';
  const after=NEW.capConfidence(NEW.computeConfidenceTier(d,cats,{trade:j.trade,tradeBreakdown:j.tb}),j.trade);
  const q=NEW.tradeMaterialQuality(d.materials,j.trade,j.tb);
  const reason=q.weak.length?`capped by ${[...new Set(q.weak.flatMap(g=>g.cats))].join(', ')} (${q.weak[0].rank===0?'no rows':'retail-based'})`:'all trades pro-tier or better';
  // Label check: price one line from each relevant row through the real engine.
  let label='';
  if(j.id==='d'){
    const cat=NEW.buildCatalog(d,cats,{});
    const loc=cat.materials.find(e=>e.row.tier==='local_supply_house'), sh=cat.materials.find(e=>/supplyhouse\.com/i.test(e.row.source||''));
    const r=NEW.priceScope({lineItems:[{type:'material',ref:loc.ref,qty:1},{type:'material',ref:sh.ref,qty:1}]},cat,{marketAdj:1,laborMult:2,oh:15,profit:20,cushion:6,lang:'en'});
    label=r.lineItems.map(l=>`${l.tier}`).join(' + ');
    j.lines=r.lineItems;
  }
  rows.push({job:`(${j.id}) ${j.name}`,permits:d.permitScope,before:before.toUpperCase(),after:after.toUpperCase(),reason,label});
  const ok=j.expect==='unchanged'?(!OLD||before===after):j.expect==='medium'?after==='medium'&&/Drywall|Flooring|Paint/.test(reason):j.expect==='not high'?after!=='high':true;
  if(!ok){fail++;console.log('FAIL',j.id);}
  j.after=after;
}
console.table(rows);
module.exports={JOBS,rows};
process.exitCode=fail?1:0;
