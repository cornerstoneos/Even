// base_plus_percent permit rows (tasks/app.md item 6, Surfside Res. 2026-3494):
// fee = base (min_fee) + construction cost x rate%. Only the first percentage is
// priced; a row whose notes carry higher tiers says so on the estimate line.
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d||''}`))};
const P=require('../lib/pipeline').loadPipeline();
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const batch=JSON.parse(fs.readFileSync(path.join(root,'data','batches','even_master_batch.json'),'utf8'));
const md=batch.find(m=>m.market==='Miami-Dade');
const surf=md.permits.filter(r=>/surfside/i.test(r.municipality||''));
const row=wt=>surf.find(r=>(r.work_type||'').startsWith(wt));
// A job of exactly `value` (no overhead/profit/cushion), with one permit row picked.
function permitLine(r,value,lang='en'){
  const cat=P.buildCatalog({...md,permits:[r]},null,{});
  const est=P.priceScope({lineItems:[{type:'other',category:'Building',description:'Work',qty:1,unit:'job',unitCost:value},{type:'permit',ref:'P1'}]},cat,
    {marketAdj:1,laborMult:2,oh:0,profit:0,cushion:0,sqft:0,lang});
  return est.lineItems.find(l=>l.priced==='permit schedule');
}
const fn=n=>{const i=html.indexOf('function '+n+'(');return html.slice(i,html.indexOf('\n}',i)+2);};
const note=(item,lang)=>new Function('appLang','escapeHtml','window',fn('permitIsFlorida')+fn('hb803Note')+fn('lineSourceNote')+';return lineSourceNote;')(lang,s=>String(s),{_ctx:{location:'Surfside, FL'}})(item,0).replace(/<[^>]+>/g,'');

console.log('\n=== Spec acceptance ===');
const alt=row('Building permit, alterations up to $200,000');
let l=permitLine(alt,20000);
check(`Surfside H30A/H30B alteration at $20,000 = 150 + 1.5% x 20,000 = $450 (got $${l&&l.total})`, l&&l.total===450);
const nc=row('Building permit, new construction — zoning districts H30C/H40');
l=permitLine(nc,1000000);
check(`Surfside new construction H40 at $1M = 350 + 2.5% x 1,000,000 = $25,350 (got $${l&&l.total})`, l&&l.total===25350);
check('the base is no longer dropped (old rule gave max(25,000, 350) = $25,000)', l&&l.total!==25000);

console.log('\n=== First tier only, said on the line ===');
check('the H40 row has higher tiers in its notes (2.0% over $50M), so the line is flagged', l&&l.permitRow.firstTierOnly===true);
const en=note(l,'en'), es=note(l,'es');
check(`EN line note: "${en}"`, /first percentage/.test(en)&&/HB 803/.test(en));
check(`ES line note: "${es}"`, /primer porcentaje/.test(es)&&/HB 803/.test(es));
check('no em dash in the new line note', !/—/.test(en.split('HB 803.')[1]||'')&&!/—/.test(es.split('Florida.')[1]||''));
const h30a=row('Building permit, new construction — zoning districts H30A/H30B');
l=permitLine(h30a,300000);
check(`H30A/H30B new construction at $300,000 = 350 + 7,500 = $7,850, flagged (1.5% over $5M) (got $${l&&l.total})`, l&&l.total===7850&&l.permitRow.firstTierOnly===true);
l=permitLine(alt,20000);
check('the H30A/H30B alteration row has no higher tier ("above $200,000" switches formula): flagged only if its notes say "over/above $"', l&&(l.permitRow.firstTierOnly===true)===/\b(over|above)\s+\$/i.test(alt.notes));

console.log('\n=== Nothing else moves ===');
const uses=[];for(const m of batch)for(const r of m.permits)if(/^base_plus_percent$/i.test(String(r.method||'').trim()))uses.push(`${m.market}: ${r.municipality} (${r.rate})`);
check(`base_plus_percent rows: ${uses.join(' | ')}`, uses.filter(x=>/Surfside/.test(x)).length===4);
// Pembroke Pines' over-$3M row was tagged base_plus_percent with a bare 0.0208;
// the item 7 data pass re-filed it as base_plus_percent_over (rate 2.08, "over
// $3,000,000"), so it now prices per the schedule: $93,329.67 + 2.08% of the
// amount over $3M.
const pp=batch.find(m=>m.market==='Broward').permits.find(r=>r.municipality==='Pembroke Pines'&&/Over \$3,000,000/.test(r.work_type));
const cat=P.buildCatalog({...batch.find(m=>m.market==='Broward'),permits:[pp]},null,{});
const ppl=P.priceScope({lineItems:[{type:'other',category:'Building',description:'Work',qty:1,unit:'job',unitCost:5000000},{type:'permit',ref:'P1'}]},cat,{marketAdj:1,laborMult:2,oh:0,profit:0,cushion:0,sqft:0,lang:'en'}).lineItems.find(x=>x.priced==='permit schedule');
check(`Pembroke Pines over-$3M row at $5M = 93,329.67 + 2.08% x 2,000,000 = $134,929.67 (got $${ppl&&ppl.total}; was $104,000 before item 7)`, ppl&&ppl.total===134929.67&&pp.method==='base_plus_percent_over');
check('only Surfside rows remain base_plus_percent', uses.length===4&&uses.every(x=>/Surfside/.test(x)), uses.join(' | '));
const pc=row('Planning review fee');
l=permitLine(pc,20000);
check(`a percent_of_cost_with_min row is unchanged: 0.75% x 20,000 = $150 vs $75 min (got $${l&&l.total})`, l&&l.total===150);
console.log(`\n──────────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
