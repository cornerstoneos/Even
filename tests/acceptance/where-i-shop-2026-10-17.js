// Material list for the supply house (quote engine phase A) + "Where I shop",
// in a real browser against index.html with a fake signed-in Supabase session.
// Acceptance (tasks/app.md): (1) a roofing job's list shows only the material
// rows, same qty/unit as the cost sheet; (2) no dollar amounts anywhere on the
// list (screen, text, PDF); (3) Spanish translates every label; (4) zero
// material lines -> clear message, no empty PDF; pick 84 Lumber as primary ->
// list addressed to 84 Lumber and the send button pre-fills the rep contact;
// no supplier -> generic list; partner lines say "Priced from [supplier] sheet";
// phone layout unbroken.
// Run: node tests/acceptance/where-i-shop-2026-10-17.js [screenshot dir]
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs'),path=require('path');
const out=process.argv[2]||require('os').tmpdir()+'/even-shop';
fs.mkdirSync(out,{recursive:true});
const root=path.join(__dirname,'..','..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const batch=JSON.parse(fs.readFileSync(path.join(root,'data/batches/even_master_batch.json'),'utf8'));
const broward=batch.find(m=>m.market==='Broward');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const FAKE=`window.__fakeSb=function(){
  const load=()=>JSON.parse(localStorage.getItem('fakedb')||'{}');
  class Q{constructor(t){this.t=t;this.f=[];this.op=null;this.one=false;this.ord=null;}
    select(c,o){this.op=this.op||'select';this.head=o&&o.head;return this;}
    insert(r){this.op='insert';this.rows=Array.isArray(r)?r:[r];return this;}
    update(p){this.op='update';this.patch=p;return this;}
    upsert(r,o){this.op='upsert';this.rows=r;this.conf=(o&&o.onConflict)||'id';return this;}
    eq(k,v){this.f.push(r=>String(r[k])===String(v));return this;}
    in(k,vs){this.f.push(r=>vs.map(String).includes(String(r[k])));return this;}
    ilike(k,p){const rx=new RegExp('^'+p.replace(/%/g,'.*')+'$','i');this.f.push(r=>rx.test(r[k]||''));return this;}
    or(e){const ps=e.split(',').map(x=>{const m=x.match(/^(\\w+)\\.eq\\.(.*)$/);return r=>String(r[m[1]])===m[2];});this.f.push(r=>ps.some(p=>p(r)));return this;}
    order(k,o){this.ord=[k,o&&o.ascending===false?-1:1];return this;}
    limit(){return this;} single(){this.one=true;return this;} maybeSingle(){this.one=true;return this;}
    then(res,rej){try{res(this.run());}catch(e){rej(e);}}
    run(){const db=load();const T=db[this.t]=db[this.t]||[];let out;
      if(this.op==='insert'){out=this.rows.map(r=>({id:crypto.randomUUID(),created_at:new Date().toISOString(),bid_no:1,job_id:null,status:'draft',change_note:null,lost_reason:null,notes:null,...JSON.parse(JSON.stringify(r))}));T.push(...out);}
      else if(this.op==='update'){out=T.filter(r=>this.f.every(f=>f(r)));out.forEach(r=>Object.assign(r,JSON.parse(JSON.stringify(this.patch))));}
      else if(this.op==='upsert'){const ks=this.conf.split(',');for(const r of this.rows){const ex=T.find(x=>ks.every(k=>String(x[k])===String(r[k])));if(ex)Object.assign(ex,r);else T.push({id:crypto.randomUUID(),...r});}out=this.rows;}
      else{out=T.filter(r=>this.f.every(f=>f(r)));if(this.ord)out=out.slice().sort((a,b)=>(a[this.ord[0]]>b[this.ord[0]]?1:-1)*this.ord[1]);}
      localStorage.setItem('fakedb',JSON.stringify(db));
      out=JSON.parse(JSON.stringify(out));
      if(this.head) return {count:out.length,data:null,error:null};
      return {data:this.one?(out[0]||null):out,error:this.one&&!out[0]?{message:'no rows'}:null};}}
  return {from:t=>new Q(t),auth:{getSession:async()=>({data:{session:null}}),signOut:async()=>({})}};
};`;

(async()=>{
  const b=await chromium.launch();
  for(const lang of ['en','es']){
    console.log(`\n=== ${lang.toUpperCase()} · phone 375px ===`);
    const ctx=await b.newContext({viewport:{width:375,height:812}}); const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/*',async r=>{const u=r.request().url();
      if(u.replace(/[?#].*$/,'')==='https://even-os.com/') return r.fulfill({status:200,contentType:'text/html',body:html});
      if(u.startsWith('https://even-production.up.railway.app')) return r.fulfill({status:200,contentType:'application/json',body:'{}'});
      return r.continue();});
    await p.goto('https://even-os.com/'); await p.waitForTimeout(700);
    await p.evaluate(FAKE);
    const es=lang==='es', W=x=>es?x[1]:x[0];
    await p.evaluate(({l,md})=>{
      localStorage.setItem('fakedb',JSON.stringify({suppliers:[{id:'V019',name:'84 Lumber',service_area:['Broward'],is_partner:true,active:true},{id:'V020',name:'Express Roofing Supply Corp.',is_partner:false,active:true}]}));
      localStorage.removeItem('even_shops'); window._myShops=[];
      sbClient=window.__fakeSb(); currentUser={id:'u-test',email:'pro@example.com'}; isPro=true; estimateCount=1; window._prefsLoaded=true; updateUserBadge();
      setBiz('company','Rivera Roofing LLC'); setBiz('phone','(954) 555-0100'); setBiz('license','CCC1234567');
      if(l==='es') setLang('es',document.querySelectorAll('.lang-btn')[1]);
      // A roofing job priced by the app's own engine against the real Broward rows.
      const cat=buildCatalog(md,new Set(['Roofing']),{partner:[{supplier_id:'V019',supplier:'84 Lumber',category:'Roofing - Underlayment',item:'Synthetic underlayment 10 sq roll',unit:'roll',price:89.5,source:'84 Lumber sheet',date:'2026-10-15'}]});
      const shingle=cat.materials.find(e=>/shingle/i.test(e.row.item))||cat.materials[0];
      const other=cat.materials.find(e=>e!==shingle&&/roof/i.test(e.row.category||''))||cat.materials[1];
      const roofer=cat.labor.find(e=>/roofer/i.test(e.row.trade))||cat.labor[0];
      const permit=cat.permits.find(e=>/roof/i.test(e.row.work_type||''))||cat.permits[0];
      window._t={shingle:shingle.row.item,other:other.row.item};
      const data=priceScope({projectName:'Roof',lineItems:[
        {type:'material',ref:shingle.ref,qty:48},{type:'material',ref:other.ref,qty:3},{type:'material',ref:'H1',qty:4},
        {type:'labor',ref:roofer.ref,hours:40,description:'Tear off and reroof'},{type:'permit',ref:permit.ref,qty:0},
        {type:'other',category:'Disposal',description:'Dumpster',qty:1,unit:'ea',unitCost:550}]},cat,{marketAdj:1,laborMult:2.2,oh:12,profit:22,cushion:8,sqft:2000,hvhz:true,lang:appLang});
      document.getElementById('est-location').value='Fort Lauderdale';
      currentEstimate=data; window._ctx={location:'Fort Lauderdale',trade:'Roofing'}; navigate('estimate'); renderEstimate(data);
    },{l:lang,md:{...broward,municipality:'Fort Lauderdale',permitScope:'municipality'}});

    // No supply house yet: generic list.
    await p.click('.matlist-btn'); await p.waitForTimeout(200);
    const g=await p.evaluate(()=>{
      const M=window._lastMatList, mats=currentEstimate.lineItems.filter(isMaterialLine);
      return {rows:M.rows,mats:mats.map(l=>({qty:+l.qty,unit:unitLabel(l.unit,appLang)})),all:currentEstimate.lineItems.map(l=>l.category),text:document.getElementById('matlist-body').innerText,shop:M.shop,plain:materialListText(M)};
    });
    check('(1) only material rows (3 of 6 lines: no labor, permit, dumpster)', g.rows.length===3&&g.mats.length===3, JSON.stringify(g.all));
    check('(1) same qty and unit as the cost sheet lines (waste included)', JSON.stringify(g.rows.map(r=>({qty:r.qty,unit:r.unit})))===JSON.stringify(g.mats), JSON.stringify([g.rows,g.mats]));
    check('(2) no dollar amounts on the screen or in the text', !/\$/.test(g.text)&&!/\$/.test(g.plain), g.plain);
    check('no supplier picked: list is generic (no To line)', !g.shop&&!new RegExp(`^${W(['To','Para'])}:`,'m').test(g.plain), g.plain.slice(0,200));
    check('says request for quote, not a purchase order', g.plain.includes(W(['Request for quote, not a purchase order.','Solicitud de cotización, no es una orden de compra.'])));
    check('(3) labels in the right language', es?(/LISTA DE MATERIALES/.test(g.plain)&&/Por favor cotiza estos materiales\./.test(g.plain)&&/Las cantidades ya incluyen el desperdicio\./.test(g.plain)&&/Preparado con Even/.test(g.plain)&&!/Material list|Request for quote|Please quote|Quantities/.test(g.plain)):(/MATERIAL LIST/.test(g.plain)&&/Please quote these materials\./.test(g.plain)), g.plain);
    // PDF: capture what would be saved.
    const pdf=await p.evaluate(async()=>{ let captured=''; const orig=savePDF; savePDF=(doc)=>{captured=doc.output();}; await downloadMaterialListPDF(); savePDF=orig; return captured; });
    const pdfText=(pdf.match(/\((?:[^()\\]|\\.)*\)\s*Tj/g)||[]).join(' ');
    check('(2) PDF has the rows and no dollar amounts', pdf.length>1000&&pdfText.includes(W(['Material list','Lista de materiales']))&&!/\$/.test(pdfText), pdfText.slice(0,300));
    check('PDF says request for quote and Prepared with Even', pdfText.includes(W(['Request for quote, not a purchase order.','Solicitud de cotizaci']))&&pdfText.includes(W(['Prepared with Even','Preparado con Even'])), pdfText.slice(-300));
    await p.screenshot({path:`${out}/matlist-generic-${lang}.png`});
    await p.evaluate(()=>closeMaterialList());

    // Partner line label (this page plays a Pro who picked 84 Lumber).
    const src=await p.evaluate(()=>{ const i=currentEstimate.lineItems.findIndex(l=>l.priced==='partner'); return document.getElementById('ls-'+i)?.textContent||''; });
    check('partner line says where its price came from', src===W(['Priced from 84 Lumber sheet, 2026-10-15','Precio de la lista de 84 Lumber, 2026-10-15']), src);

    // Where I shop: pick 84 Lumber as primary, add the rep's email.
    await p.evaluate(()=>navigate('dashboard')); await p.waitForTimeout(700);
    await p.click(`button[onclick*="set-shops"]`); await p.waitForTimeout(300);
    const opts=await p.$$eval('#shop-options option',o=>o.map(x=>x.value));
    check('picker lists Even\'s supply houses (names only)', opts.includes('84 Lumber'), JSON.stringify(opts));
    await p.fill('#shop-input','84 lumber'); await p.click('.shop-add .bid-btn'); await p.waitForTimeout(200);
    await p.fill('#shop-input','Bob\'s Supply'); await p.click('.shop-add .bid-btn'); await p.waitForTimeout(200);
    await p.fill('.shop-card >> nth=0 >> input[type=email]','rep@84lumber.example'); await p.dispatchEvent('.shop-card >> nth=0 >> input[type=email]','change');
    await p.screenshot({path:`${out}/where-i-shop-${lang}.png`,fullPage:true});
    const sw=await p.evaluate(()=>document.documentElement.scrollWidth);
    check('phone: settings do not scroll sideways', sw<=375, sw);
    const shops=await p.evaluate(()=>window._myShops);
    check('84 Lumber matched to Even\'s list (V019) and primary; a typed-in shop is kept too', shops[0].id==='V019'&&shops[0].primary&&shops[1].id===null&&shops[1].name==="Bob's Supply"&&!shops[1].primary, JSON.stringify(shops));
    await p.waitForTimeout(1700);
    check('shops travel with the account prefs (savePrefs includes them)', /shops: \(window\._myShops\|\|\[\]\)\.slice\(0,20\)/.test(html));

    await p.evaluate(()=>{ navigate('estimate'); }); await p.waitForTimeout(700);   // taps right after a screen change are ignored (bug 1 guard)
    await p.click('.matlist-btn'); await p.waitForTimeout(200);
    const a=await p.evaluate(()=>({text:document.getElementById('matlist-body').innerText,url:materialListSendUrl(window._lastMatList),plain:materialListText(window._lastMatList)}));
    check('list addressed to 84 Lumber', a.text.includes('84 Lumber')&&new RegExp(`^${W(['To','Para'])}: 84 Lumber`,'m').test(a.plain), a.plain.slice(0,200));
    check('send button: "Send to 84 Lumber for a quote"', a.text.includes(W(['SEND TO 84 Lumber FOR A QUOTE','ENVIAR A 84 Lumber PARA COTIZAR'])), a.text);
    const body=decodeURIComponent((a.url||'').split('body=')[1]||'');
    check('send pre-fills an email to the rep with the list (no prices)', /^mailto:rep%4084lumber\.example\?subject=/.test(a.url||'')&&body.includes('84 Lumber')&&!/\$/.test(body), a.url&&a.url.slice(0,120));
    await p.screenshot({path:`${out}/matlist-84-${lang}.png`});
    await p.evaluate(()=>{ window._myShops[0].rep_email=''; window._myShops[0].rep_phone='(954) 555-0199'; });
    check('no rep email but a phone: pre-filled text message', (await p.evaluate(()=>materialListSendUrl(buildMaterialList(currentEstimate,appLang)))).startsWith('sms:9545550199?&body='));
    await p.evaluate(()=>closeMaterialList());

    // (4) zero material lines
    await p.evaluate(()=>{ const d=priceScope({lineItems:[{type:'other',category:'Labor',description:'Service call',qty:2,unit:'hr',unitCost:95}]},buildCatalog(null,null,{}),{marketAdj:1,oh:12,profit:22,cushion:8,lang:appLang}); currentEstimate=d; renderEstimate(d); });
    await p.click('.matlist-btn'); await p.waitForTimeout(200);
    const z=await p.textContent('#matlist-body');
    check('(4) zero materials: clear message, no list or PDF button', z.includes(W(['This estimate has no material lines','Este estimado no tiene materiales']))&&!z.includes('PDF'), z);
    check('no page errors', !errs.length, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(`\n──────────────\n${pass} passed, ${fail} failed  (screenshots: ${out})`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
