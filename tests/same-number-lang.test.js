// Same job = same number in English and Spanish (founder 2026-11-21). The 11/11
// recordings ran one Aventura panel job in EN ($5,219) and ES ($9,240): the
// prompts differed by language, so the AI scoped the job twice. Now both prompts
// are identical whatever the app language (the AI always returns both languages)
// and the app picks the words. Checked here on the real index.html code.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const slice=(a,b)=>{const s=html.indexOf(a),e=html.indexOf(b,s);if(s<0||e<0)throw new Error('anchor '+a);return html.slice(s,e);};
const fnSrc=n=>{const s=html.indexOf(`function ${n}(`);if(s<0)throw new Error('missing '+n);return html.slice(s,html.indexOf('\n}',s)+2);};
const deps=["const money0=n=>'$'+Math.round(Number(n)||0).toLocaleString('en-US');",fnSrc('categoryInScope'),fnSrc('isEquipmentRental'),slice('const ANCILLARY_RE=','// Even Suggests tiers')].join('\n');
const E=new Function(deps+'\n'+slice('const LABOR_MULT_DEFAULT=','// ══ END PRICING ENGINE ══')+';'+slice('// ══ SHARED PIPELINE ══','// ══ END SHARED PIPELINE ══')+';return {priceScope,buildCatalog,localizeEstimateJSON,scopePromptText,estimatePromptBlocks};')();
const L=new Function('let appLang="es";'+fnSrc('localizeScopeData')+fnSrc('buildChipOptions')+';return {localizeScopeData,buildChipOptions};')();
const batch=JSON.parse(fs.readFileSync(path.join(root,'data/batches/even_master_batch.json'),'utf8'));

console.log('\n=== 1. the prompts do not change with the app language ===');
const job={trade:'Electrical',location:'Aventura, FL',projtype:'Residential — Single Family',sqft:'2400',scope:'Change the 100A panel to 200A',nDocs:0,nImages:0};
check('scope prompt is identical in EN and ES', E.scopePromptText({...job,lang:'en'})===E.scopePromptText({...job,lang:'es'}));
check('scope prompt asks for the _es twins', /question_es/.test(E.scopePromptText({...job,lang:'es'}))&&/options_es/.test(E.scopePromptText({...job,lang:'en'})));
const ctx={trade:'Electrical',location:'Aventura, FL',projtype:'Residential',sqft:'2400',laborType:'own',bidType:'lump'};
const pb=l=>JSON.stringify(E.estimatePromptBlocks({ctx,scope:'x',ansText:'Q: a\nA: b',tradeBreakdown:[],pricingBlock:'P',lang:l}));
check('estimate prompt is identical in EN and ES', pb('en')===pb('es'));
check('estimate prompt no longer carries a Language line', !/Language:/.test(pb('es')));

console.log('\n=== 2. one bilingual answer prices the same and reads right in each language ===');
const md=batch.find(b=>b.market==='Miami-Dade');
const cat=E.buildCatalog(md,new Set(['Electrical']),{});
const mat=cat.materials.find(e=>/Electrical/.test(e.row.category)), lab=cat.labor.find(e=>/^Electricians/.test(e.row.trade));
const ai={projectName:'Panel upgrade',projectName_es:'Cambio de panel',lineItems:[{type:'material',ref:mat.ref,qty:1,description:'200A load center',description_es:'Centro de carga de 200A'},{type:'labor',ref:lab.ref,hours:10,description:'Swap the panel',description_es:'Cambiar el panel'},{type:'other',category:'Disposal',description:'Haul away old panel',description_es:'Retiro del panel viejo',qty:1,unit:'ea',unitCost:60}],
  assumptions:['Same location.'],assumptions_es:['Mismo lugar.'],exclusions:['Wall repair.'],exclusions_es:['Reparación de paredes.'],estimatedDays:'2-3 days',estimatedDays_es:'2-3 días'};
const S={marketAdj:1,laborMult:2.2,laborRate:null,oh:12,profit:22,cushion:8,sqft:2400,hvhz:true};
const en=E.priceScope(JSON.parse(JSON.stringify(ai)),cat,{...S,lang:'en'}), es=E.priceScope(JSON.parse(JSON.stringify(ai)),cat,{...S,lang:'es'});
check('same total in EN and ES', en.totalBid===es.totalBid&&en.totalBid>0, `${en.totalBid} vs ${es.totalBid}`);
check('ES shows the Spanish words', es.lineItems[0].description==='Centro de carga de 200A'&&es.lineItems.find(l=>l.category==='Labor').description==='Cambiar el panel', JSON.stringify(es.lineItems.map(l=>l.description)));
check('EN keeps the catalog name on material lines', en.lineItems[0].description===mat.row.item, en.lineItems[0].description);
const lz=E.localizeEstimateJSON(ai,'es');
check('ES project name, assumptions, exclusions, days are Spanish', lz.projectName==='Cambio de panel'&&lz.assumptions[0]==='Mismo lugar.'&&lz.exclusions[0]==='Reparación de paredes.'&&lz.estimatedDays==='2-3 días');
const old=E.localizeEstimateJSON({projectName:'Solo inglés',lineItems:[{description:'x'}]},'es');
check('an answer with no Spanish twins still works (falls back)', old.projectName==='Solo inglés'&&old.lineItems[0].description==='x');

console.log('\n=== 3. the questions show in Spanish but answers go out in English ===');
const sc={projectName:'Panel',projectName_es:'Panel ES',tradeBreakdown:[{trade:'Electrical',trade_es:'Electricidad',items:['Swap panel'],items_es:['Cambiar panel']}],keyFacts:['200A'],keyFacts_es:['200A'],
  questions:[{id:'q1',question:'Where is the panel?',question_es:'¿Dónde está el panel?',options:['Garage','Exterior wall'],options_es:['Garaje','Pared exterior']}]};
const shown=L.localizeScopeData(sc,'es');
check('question and options shown in Spanish', shown.questions[0].question==='¿Dónde está el panel?'&&shown.questions[0].options[1]==='Pared exterior');
check('trade shown in Spanish, raw scope keeps English for the catalog', shown.tradeBreakdown[0].trade==='Electricidad'&&sc.tradeBreakdown[0].trade==='Electrical');
const q=shown.questions[0], a='Pared exterior', i=q.options.indexOf(a);
check('a Spanish pick maps to the English option', q._en.question==='Where is the panel?'&&q._en.options[i]==='Exterior wall');
const fb={question:'¿Quién saca el permiso?',_en:{question:'Who pulls the permit?',options:[]},options:[]};
check('fallback chips: same position in both languages', L.buildChipOptions(fb,'es')[0]==='Sí, sacaré permiso'&&L.buildChipOptions(fb,'en')[0]==='Yes, pulling permit');
check('the answer builder sends the English question and option', /Q: \$\{en\.question\}\\nA: \$\{aEn\}/.test(html));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
