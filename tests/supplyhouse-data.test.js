// Verifies the app correctly handles the SupplyHouse.com batch: the new
// 'supplier_direct' tier, the "Parent - Sub" category convention, the explicit
// invalid_cross_market_copy tier, and the prompt no longer ballooning with every
// material row in the market regardless of trade.
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};

// Tight, contiguous line range (2292-2391) so nothing DOM-touching from
// elsewhere in the file gets pulled into the eval'd module.
const lines=html.split('\n');
const src=lines.slice(2291,2391).join('\n');
const api=new Function(src+'\n;return {materialSourceQuality,computeConfidenceTier,scopeMaterialCategories,inScopeMaterials,categoryInScope,MATERIAL_TIER_RANK};')();
const {materialSourceQuality,computeConfidenceTier,scopeMaterialCategories,categoryInScope,MATERIAL_TIER_RANK}=api;

console.log('\n=== New tier: supplier_direct ===');
check('supplier_direct is ranked, not falling to the ||1 default',
  MATERIAL_TIER_RANK.supplier_direct===3, `got ${MATERIAL_TIER_RANK.supplier_direct}`);
check('ranked alongside pro_distributor, not above local_supply_house',
  MATERIAL_TIER_RANK.supplier_direct===MATERIAL_TIER_RANK.pro_distributor
  && MATERIAL_TIER_RANK.supplier_direct<MATERIAL_TIER_RANK.local_supply_house);

console.log('\n=== Category prefix matching ("Parent - Sub") ===');
for(const [cat,root,want] of [
  ['Electrical - Wire & Cable','Electrical',true],
  ['Electrical - Breakers','Electrical',true],
  ['Plumbing - Water Heaters (Tankless)','Plumbing',true],
  ['HVAC - Air Handlers','HVAC',true],
  ['Electrical','Electrical',true],           // bare category still matches itself
  ['Electricals','Electrical',false],         // no false-positive on a longer word
  ['Plumbing - Water Heaters (Tankless)','Electrical',false],
]) check(`"${cat}" vs root "${root}" → ${want}`, categoryInScope(cat,new Set([root]))===want);
check('null roots (broad trade) matches anything', categoryInScope('Electrical - Wire & Cable',null)===true);

console.log('\n=== Real data: does an electrician now see the new rows? ===');
const batch=require('/tmp/claude-0/-home-user-Even/bf6bc1be-83b9-5741-8a18-57741c0209b4/scratchpad/new_batch.json');
const mia=batch.find(m=>m.market==='Miami-Dade');
const elecCats=scopeMaterialCategories('Electrical',null);
check('Electrical trade resolves to a category set', elecCats&&elecCats.has('Electrical'));
const elecTier=materialSourceQuality(mia.materials,elecCats);
check(`electrician material tier on real Miami-Dade data is pro-tier (got rank ${elecTier})`,
  elecTier>=3, 'all 187 electrical rows would be invisible under the old exact-match code');

const hvacCats=scopeMaterialCategories('HVAC',null);
const hvacTier=materialSourceQuality(mia.materials,hvacCats);
check(`HVAC material tier on real data (got rank ${hvacTier})`, hvacTier>=3);

const plumbCats=scopeMaterialCategories('Plumbing',null);
const plumbTier=materialSourceQuality(mia.materials,plumbCats);
check(`Plumbing material tier including water heaters (got rank ${plumbTier})`, plumbTier>=3);

// A trade this data does NOT cover should still read honestly, not inherit
// the electrical/plumbing/HVAC upgrade.
const roofCats=scopeMaterialCategories('Roofing',null);
const roofTier=materialSourceQuality(mia.materials,roofCats);
check(`Roofing is unaffected — still retail-tier (got rank ${roofTier})`, roofTier<3);

console.log('\n=== Confidence tier end to end (with real permits present) ===');
const withCityPermits={...mia,permitScope:'municipality'};
check('Electrical + city permits → high', computeConfidenceTier(withCityPermits,elecCats)==='high');
check('Roofing + city permits → still medium (data has not improved)', computeConfidenceTier(withCityPermits,roofCats)==='medium');

console.log('\n=== invalid_cross_market_copy rows never reach the model ===');
const chi=batch.find(m=>m.market==='Chicago');
const invalidCount=chi.materials.filter(r=>r.tier==='invalid_cross_market_copy').length;
check(`Chicago batch actually contains invalid rows to test against (${invalidCount} found)`, invalidCount>0);
check('fetchMarketPricing strips invalid_cross_market_copy after fetch',
  /tier!=='invalid_cross_market_copy'/.test(html));
check('the filter runs on the ingestion path, not buried in an unrelated function',
  /window\._hvhzResolved=\(data&&data\.market&&typeof data\.hvhz==='boolean'\)\?data\.hvhz:null;[\s\S]{0,900}tier!=='invalid_cross_market_copy'/.test(html));

console.log('\n=== The prompt is scoped to the job\'s trade, not the whole market ===');
check('buildDynamicPricingBlock takes scopeCats and filters by it',
  /function buildDynamicPricingBlock\(md,adjMultiplier,adjLabel,hvhzNote,scopeCats\)/.test(html));
check('equipment rental is always included regardless of scope',
  /r\.category==='Equipment Rental'\|\|categoryInScope\(r\.category,scopeCats\)/.test(html));
check('scopeCats is computed before the pricing block is built (order matters)',
  html.indexOf('const scopeCats=scopeMaterialCategories')<html.indexOf('buildDynamicPricingBlock(marketData,adjMultiplier,adjLabel,hvhzNote,scopeCats)'));

// Simulate what actually gets built for a painting job vs an electrical job on
// the real 409-row Miami-Dade data, counting rows the way buildDynamicPricingBlock does.
function promptRowCount(materials,cats){
  return materials.filter(r=>r&&(r.category==='Equipment Rental'||categoryInScope(r.category,cats))).length;
}
const paintCats=scopeMaterialCategories('Painting',null);
const paintRows=promptRowCount(mia.materials,paintCats);
const elecRows=promptRowCount(mia.materials,elecCats);
const allRows=mia.materials.length;
console.log(`    Miami-Dade total material rows: ${allRows}`);
console.log(`    sent for a PAINTING job:        ${paintRows}`);
console.log(`    sent for an ELECTRICAL job:     ${elecRows}`);
check('a painting job no longer drags in all 409 rows', paintRows<allRows*0.2, `${paintRows} of ${allRows}`);
check('an electrical job gets meaningfully fewer rows than the full market too',
  elecRows<allRows, `${elecRows} of ${allRows}`);
check('but a painting job still gets its own paint row + equipment rental',
  paintRows>=2);

console.log(`\n──────────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
