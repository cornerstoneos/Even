// Landscaping + Pools (founder decided 2026-10-17). Runs the app's own pricing
// code (lib/pipeline.js loads it from index.html) on the real Broward rows:
// a pool remodel and a sod + irrigation job each price their equipment / sod /
// irrigation lines from the catalog, put labor on the stated BLS rows (Pools:
// Plumbers + Construction Laborers; Landscaping: Construction Laborers), mark
// anything missing as estimated, carry the "limited data" label, and never
// reach HIGH confidence. Other trades are untouched.
const fs=require('fs'),path=require('path');
const {loadPipeline}=require('../lib/pipeline');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const root=path.join(__dirname,'..');
const P=loadPipeline();
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const batch=JSON.parse(fs.readFileSync(path.join(root,'data/batches/even_master_batch.json'),'utf8'));
const md={...batch.find(m=>m.market==='Broward'),municipality:'Fort Lauderdale',permitScope:'municipality'};
const S={marketAdj:1,laborMult:2.2,oh:12,profit:22,cushion:8,sqft:0,hvhz:true,lang:'en'};
const find=(list,rx,f='item')=>list.find(e=>rx.test(e.row[f]||''));

console.log('\n=== Pools: remodel ===');
let cats=P.scopeMaterialCategories('Pools',[{trade:'Pool remodel'}]);
check('Pools buys from Pool (+ Plumbing for pipe and fittings)', cats&&cats.has('Pool')&&cats.has('Plumbing')&&cats.size===2, cats&&[...cats]);
let cat=P.buildCatalog(md,cats,{trade:'Pools'});
check('labor: only Plumbers and Construction Laborers', cat.labor.length===2&&cat.labor.every(e=>/^(Plumbers|Construction Laborers)/.test(e.row.trade)), cat.labor.map(e=>e.row.trade).join(' | '));
const pump=cat.materials.find(e=>/^Pool - Pumps/.test(e.row.category)), filt=cat.materials.find(e=>/^Pool - Filters/.test(e.row.category)), light=cat.materials.find(e=>/^Pool - Lighting/.test(e.row.category));
check('pool equipment is in the catalog (pump, filter, light)', pump&&filt&&light);
const plumber=find(cat.labor,/^Plumbers/,'trade'), laborer=find(cat.labor,/^Construction Laborers/,'trade');
let d=P.priceScope({lineItems:[{type:'material',ref:pump.ref,qty:1},{type:'material',ref:filt.ref,qty:1},{type:'material',ref:light.ref,qty:1},
  {type:'labor',ref:plumber.ref,hours:8,description:'Set pump and filter, plumb equipment pad'},{type:'labor',ref:laborer.ref,hours:24,description:'Drain, prep and acid wash'},
  {type:'other',category:'Pool',description:'Pool resurfacing (white marcite)',qty:450,unit:'sqft',unitCost:7}]},cat,S);
const pl=d.lineItems;
check('pump, filter, light priced from the catalog', pl.filter(l=>l.priced==='catalog').length===3&&pl.find(l=>l.ref===pump.ref).unitCost===Math.round(pump.row.mid*1.10*100)/100||pl.find(l=>l.ref===pump.ref).unitCost===pump.row.mid, JSON.stringify(pl.slice(0,3).map(l=>[l.description,l.unitCost])));
check('labor on Plumbers + Construction Laborers (BLS median x 2.2)', pl.filter(l=>l.category==='Labor').map(l=>l.laborTrade).join('|')===`${plumber.row.trade}|${laborer.row.trade}`&&pl.find(l=>l.laborTrade===plumber.row.trade).unitCost===Math.round(plumber.row.mid*2.2*100)/100, JSON.stringify(pl.filter(l=>l.category==='Labor')));
check('resurfacing (not in our data) is marked estimated', pl.find(l=>/marcite/.test(l.description)).estimated===true);
let tier=P.capConfidence(P.computeConfidenceTier(md,cats),'Pools');
check(`confidence is not HIGH (${tier})`, tier!=='high');
check('capConfidence turns HIGH into MEDIUM for Pools and Landscaping only', P.capConfidence('high','Pools')==='medium'&&P.capConfidence('high','Landscaping')==='medium'&&P.capConfidence('high','Plumbing')==='high');

console.log('\n=== Landscaping: sod + irrigation ===');
cats=P.scopeMaterialCategories('Landscaping',[{trade:'Landscaping'},{trade:'Irrigation'}]);
check('Landscaping buys from Landscaping + Irrigation', cats&&cats.has('Landscaping')&&cats.has('Irrigation')&&cats.size===2, cats&&[...cats]);
cat=P.buildCatalog(md,cats,{trade:'Landscaping'});
check('labor: only Construction Laborers', cat.labor.length===1&&/^Construction Laborers/.test(cat.labor[0].row.trade), cat.labor.map(e=>e.row.trade).join(' | '));
const sod=cat.materials.find(e=>/^Landscaping - Sod/.test(e.row.category)), head=cat.materials.find(e=>/^Irrigation - Spray Heads/.test(e.row.category)), ctl=cat.materials.find(e=>/^Irrigation - Controllers/.test(e.row.category));
check('sod and irrigation parts are in the catalog', sod&&head&&ctl);
d=P.priceScope({lineItems:[{type:'material',ref:sod.ref,qty:20},{type:'material',ref:head.ref,qty:12},{type:'material',ref:ctl.ref,qty:1},
  {type:'labor',ref:cat.labor[0].ref,hours:30,description:'Strip old lawn, lay sod, trench and set heads'},
  {type:'other',category:'Landscaping',description:'Mulch for beds',qty:10,unit:'ea',unitCost:6}]},cat,S);
check('sod, heads and controller priced from the catalog', d.lineItems.filter(l=>l.priced==='catalog').length===3);
check('labor on Construction Laborers', d.lineItems.filter(l=>l.category==='Labor').every(l=>/^Construction Laborers/.test(l.laborTrade)));
check('mulch (not in our data) marked estimated', d.lineItems.find(l=>/Mulch/.test(l.description)).estimated===true);
check(`confidence not HIGH (${P.capConfidence(P.computeConfidenceTier(md,cats),'Landscaping')})`, P.capConfidence(P.computeConfidenceTier(md,cats),'Landscaping')!=='high');

console.log('\n=== Spanish names map too; other trades unchanged ===');
check('ES words map (piscina, paisajismo, riego, césped)', P.scopeMaterialCategories('Pools',[{trade:'Remodelación de piscina'}])?.has('Pool')&&P.scopeMaterialCategories('x',[{trade:'Paisajismo'}])?.has('Landscaping')&&P.scopeMaterialCategories('x',[{trade:'Riego'}])?.has('Irrigation')&&P.scopeMaterialCategories('x',[{trade:'Césped nuevo'}])?.has('Landscaping'));
const plain=P.buildCatalog(md,new Set(['Plumbing']),{trade:'Plumbing'}), noTrade=P.buildCatalog(md,new Set(['Plumbing']),{});
check('a normal trade keeps all 20 labor rows and the same prompt as before', plain.labor.length===20&&P.catalogPromptText(plain)===P.catalogPromptText(noTrade));

console.log('\n=== screens and labels ===');
check('dropdown: Landscaping / Paisajismo, Pools / Piscinas', /<option value="Landscaping" data-es="Paisajismo">Landscaping<\/option>/.test(html)&&/<option value="Pools" data-es="Piscinas">Pools<\/option>/.test(html));
check('label text EN + ES exactly as decided', P.LIMITED_LABEL.en==='Limited local data for this trade. Check materials and labor.'&&P.LIMITED_LABEL.es==='Datos locales limitados para este oficio. Revisa materiales y mano de obra.');
check('label shown on the estimate and under the trade picker', /id="limited-note"/.test(html)&&/id="trade-limited"/.test(html)&&/if\(limitedTrade\(ctx\.trade\)\) data\.limitedTrade=ctx\.trade;/.test(html));
check('both trades on the quote link and the trade stats', /'Landscaping', 'Pools'\];/.test(fs.readFileSync(path.join(root,'server.js'),'utf8'))&&/'Landscaping','Pools'\];/.test(html)&&/'Pools':'Piscinas'/.test(fs.readFileSync(path.join(root,'q.html'),'utf8')));
console.log(`\n──────────────\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
