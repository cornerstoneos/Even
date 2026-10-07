// Founder's real ES runs, 2026-10-07 (Aventura 100A->200A panel upgrade).
// 1. Spanish runs: the model is told the language, the engine's own text follows it.
// 2. The model's reasoning is never put on screen.
// 3. A trade job can use the city's trade permit row: rows whose method says
//    flat were mislabeled "add-on, do not pick" from their wording, so the model
//    used Aventura's building permit instead of its electrical permit.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const slice=(a,b)=>{const s=html.indexOf(a),e=html.indexOf(b,s);if(s<0||e<0)throw new Error('anchor '+a);return html.slice(s,e);};
const fnSrc=n=>{const s=html.indexOf(`function ${n}(`);if(s<0)throw new Error('missing '+n);return html.slice(s,html.indexOf('\n}',s)+2);};
const deps=["const money0=n=>'$'+Math.round(Number(n)||0).toLocaleString('en-US');",fnSrc('categoryInScope'),fnSrc('isEquipmentRental'),slice('const ANCILLARY_RE=','// Even Suggests tiers')].join('\n');
const E=new Function(deps+'\n'+slice('const LABOR_MULT_DEFAULT=','// ══ END PRICING ENGINE ══')+';return {priceScope,buildCatalog,catalogPromptText,computePermitFee,permitBasis};')();
const batch=JSON.parse(fs.readFileSync(path.join(root,'data/batches/even_master_batch.json'),'utf8'));
const srv=fs.readFileSync(path.join(root,'server.js'),'utf8');
const {filterPermits}=new Function('require',srv.slice(srv.indexOf('const UNKNOWN_MUNI_PERMIT_CAP'),srv.indexOf('const HVHZ_MARKETS'))+';return {filterPermits};')(p=>require(p.startsWith('.')?path.join(root,p):p));
const market=(m,c)=>{const x=batch.find(b=>b.market===m);return {...x,permits:filterPermits(x.permits,c).permits};};
const row=(m,c,re)=>batch.find(b=>b.market===m).permits.find(p=>p.municipality===c&&re.test(p.work_type||''));
const settings={marketAdj:1,laborMult:2.2,laborRate:null,oh:12,profit:22,cushion:8,sqft:1800,hvhz:true};

console.log('\n=== 3. Trade permit rows are offered and priced ===');
const av=E.buildCatalog(market('Miami-Dade','Aventura'),new Set(['Electrical']),{});
const avText=E.catalogPromptText(av);
const eLine=avText.split('\n').find(l=>/Aventura — Electrical Permit - Minimum Fee/.test(l));
check('Aventura electrical permit is offered as a flat fee, not "do not pick"', eLine&&/\(flat fee\)/.test(eLine), eLine);
const pLine=avText.split('\n').find(l=>/Aventura — Plumbing Permit - Minimum Fee/.test(l));
check('Aventura plumbing permit is a flat fee too', pLine&&/\(flat fee\)/.test(pLine), pLine);
const eRef=av.permits.find(e=>/Electrical Permit - Minimum Fee/.test(e.row.work_type)).ref;
const elec=av.labor.find(e=>/^Electricians/.test(e.row.trade)).ref;
const panel={lineItems:[{type:'labor',ref:elec,hours:10,description:'Swap panel'},{type:'permit',ref:eRef,qty:0,description:'Electrical permit'}]};
const pr=E.priceScope(JSON.parse(JSON.stringify(panel)),av,settings).lineItems.filter(l=>l.category==='Permits');
check('Aventura panel job: one permit line, the electrical row, $162.50', pr.length===1&&pr[0].permitRow.work_type==='Electrical Permit - Minimum Fee'&&pr[0].total===162.5, JSON.stringify(pr));
const RULES=slice('  const RULES=`','`;');
check('estimate rules tell the model to use the trade\'s own permit row', /When the city lists a permit row for this job's own trade[^.]*use it/.test(RULES));
// Spot checks: Broward (Margate) and Palm Beach (Tequesta) trade rows are offered, not hidden.
const mg=E.catalogPromptText(E.buildCatalog(market('Broward','Margate'),new Set(['Electrical']),{}));
check('Margate residential electrical and plumbing permits offered (% of value)', /Margate — Permit Fee - Residential Additions\/Alterations - Electrical \(% of job value\)/.test(mg)&&/Margate — Permit Fee - Residential Additions\/Alterations - Plumbing \(% of job value\)/.test(mg));
const tq=E.catalogPromptText(E.buildCatalog(market('Palm Beach','Tequesta'),new Set(['Electrical']),{}));
check('Tequesta electrical/plumbing permit offered (% of value)', /Tequesta — Electrical, Mechanical, Plumbing, Heating and Air Conditioning Permit \(finish work\) \(% of job value\)/.test(tq), tq.split('\n').filter(l=>/Tequesta — (Electrical|Building Permit Fee)/.test(l)).join(' | '));
check('Tequesta main building permit (1% of value) is no longer hidden as an add-on', /Tequesta — Building Permit Fee \(percent of construction valuation\) \(% of job value\)/.test(tq));
const fee=(m,c,re,v)=>E.computePermitFee(row(m,c,re),v,0,1800).fee;
check('Bay Harbor Islands electrical: $150 minimum or 3% (was read as 150%)', fee('Miami-Dade','Bay Harbor Islands',/^Electrical Permit Fees/,20000)===600);
check('Lighthouse Point: the 1.35% is the rate, not the $125', fee('Broward','Lighthouse Point',/^Building Permit Fee \(by construction cost/,20000)===270);
check('surcharges stay add-ons (Fort Lauderdale DBPR)', E.permitBasis(row('Broward','Fort Lauderdale',/^Surcharge - DBPR/))==='addon');
check('a per-linear-foot fence row stays per unit', E.permitBasis(row('Miami-Dade','Miami-Dade County',/^Fence — single family\/duplex\/townhouse, wood and metal/))==='unit');
check('"same as building permit fees" is not a stand-alone fee', E.permitBasis(row('Palm Beach','Royal Palm Beach',/^Mechanical, Plumbing and Electrical Permits/))==='addon');

console.log('\n=== 1. Spanish ===');
const mats=av.materials.filter(e=>/Electrical/.test(e.row.category)).slice(0,1);
const es=E.priceScope({projectName:'Cambio de panel',lineItems:[{type:'material',ref:mats[0].ref,qty:1,description:'Centro de carga de 200A'},{type:'labor',ref:elec,hours:10,description:'Cambiar el panel'},{type:'permit',ref:eRef,qty:0,description:'Permiso eléctrico'},{type:'other',category:'Disposal',description:'Retiro del panel viejo',qty:1,unit:'ea',unitCost:60}]},av,{...settings,lang:'es'});
const en=E.priceScope({projectName:'Panel swap',lineItems:[{type:'material',ref:mats[0].ref,qty:1,description:'200A load center'},{type:'labor',ref:elec,hours:10,description:'Swap the panel'},{type:'permit',ref:eRef,qty:0,description:'Electrical permit'},{type:'other',category:'Disposal',description:'Haul away old panel',qty:1,unit:'ea',unitCost:60}]},av,settings);
check('ES material line uses the Spanish name, catalog name kept on the line', es.lineItems[0].description==='Centro de carga de 200A'&&es.lineItems[0].catalogItem===mats[0].row.item, es.lineItems[0].description);
check('ES permit line is Spanish', es.lineItems.find(l=>l.category==='Permits').description==='Permiso eléctrico (Aventura)');
check('ES "not in our data" label is Spanish', es.lineItems.find(l=>l.estimated).estLabel==='no está en nuestros datos, estimado');
check('same scope in EN and ES prices the same', es.totalBid===en.totalBid, `${es.totalBid} vs ${en.totalBid}`);
check('EN lines unchanged: catalog name and "Permit:" prefix', en.lineItems[0].description===mats[0].row.item&&/^Permit: Aventura Electrical Permit/.test(en.lineItems.find(l=>l.category==='Permits').description));
check('scope prompt asks for Spanish when ES is on', /Language:Spanish/.test(html)&&/LANGUAGE: Spanish\. Write projectName, every trade name, item, keyFact, question and option in Spanish/.test(html));
check('estimate rules require the job language', /LANGUAGE: write projectName, every description, assumption, exclusion and estimatedDays in the Language given with the job/.test(RULES));
check('categories and units stay English for the pricing rules', /category and unit always in English/.test(RULES));
check('demo detection reads Spanish', /demolici\[oó\]n/.test(slice('const LABOR_MULT_DEFAULT=','// ══ END PRICING ENGINE ══')));

console.log('\n=== 2. Model reasoning never on screen ===');
const onThink=slice('const onThinking=','};');
check('onThinking writes only fixed status lines', !/thinkBuf[^;]*textContent|textContent\s*=\s*(tail|flat|thinkBuf)/.test(onThink)&&/THINK_STEPS\[idx\]/.test(onThink), onThink);
check('Spanish status lines exist', /'Buscando las tarifas de permisos…'/.test(html));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
