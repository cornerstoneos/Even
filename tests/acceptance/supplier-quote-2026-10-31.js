// Supplier quote back into the job (founder 2026-10-27, build 2026-10-31), in a
// real browser against index.html with a fake signed-in Pro Supabase.
// Acceptance (tasks/app.md, Oct 31 #3): enter quotes for 10 lines: the new bid's
// total changes by exactly the sum of the differences (direct cost; the price to
// the client moves by the same amount with overhead, cushion and profit on top);
// Bid 1 unchanged; 'not in stock' lines keep the old price and are flagged; each
// quoted line shows 'Quoted by [supplier], [date]'; a photo/PDF read only
// suggests, nothing is applied without a tap; EN/ES; 375px. (RLS is checked live
// in Postgres, see tasks/app.md.)
// Run: node tests/acceptance/supplier-quote-2026-10-31.js [screenshot dir]
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs'),path=require('path');
const out=process.argv[2]||require('os').tmpdir()+'/even-sq';
fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
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

const r2=n=>Math.round(n*100)/100;
const MATS=[['PEX-A pipe 1/2 in',300,'ft',0.92],['PEX-A pipe 3/4 in',120,'ft',1.45],['Copper stub out 1/2 in',12,'ea',6.4],['Ball valve 3/4 in',4,'ea',18.5],['Water heater 50 gal gas',1,'ea',1189],
  ['Expansion tank 2 gal',1,'ea',54],['Gas flex connector 24 in',2,'ea',21.75],['PVC DWV pipe 2 in',60,'ft',2.1],['PVC sanitary tee 2 in',8,'ea',4.35],['Toilet wax ring kit',2,'ea',9.8],['Shower valve pressure balance',1,'ea',142]];
const lines=MATS.map(([d,q,u,c])=>({type:'material',category:'Plumbing',description:d,qty:q,unit:u,unitCost:c,total:r2(q*c),priced:'catalog'}));
lines.push({type:'labor',category:'Labor',description:'Plumber',qty:16,unit:'hr',unitCost:58,total:928,priced:'bls x multiplier',wage:29});
const sub=lines.reduce((s,l)=>s+l.total,0);
const job={totalBid:0,subtotal:sub,lineItems:lines,overhead:{pct:12,amount:0},contingency:{pct:8,amount:0},profit:{pct:22,amount:0},projectName:'Garcia repipe',assumptions:[]};
job.overhead.amount=sub*0.12; job.contingency.amount=sub*0.08; job.profit.amount=(sub*1.2)*0.22; job.totalBid=sub+job.overhead.amount+job.contingency.amount+job.profit.amount;
const ROOT='00000000-0000-4000-8000-0000000000a1';
// Quote: 10 priced lines (index 0..9), index 10 (shower valve) not in stock.
const QUOTE=[0.81,1.39,6.10,17.25,1099,49.5,19.9,1.98,3.95,8.75];

(async()=>{
  const b=await chromium.launch();
  for(const lang of ['en','es']){
    const es=lang==='es';
    console.log(`\n=== ${lang.toUpperCase()} · phone 375px ===`);
    const ctx=await b.newContext({viewport:{width:375,height:812}}); const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    let scanned=0;
    await p.route('**/*',async r=>{const u=r.request().url();
      if(u.replace(/[?#].*$/,'')==='https://even-os.com/') return r.fulfill({status:200,contentType:'text/html',body:html});
      if(u.startsWith('https://even-production.up.railway.app/api/estimate')){ scanned++;
        const body=JSON.parse(r.request().postData()||'{}');
        const ok=body.even_kind==='price_sheet'&&body.messages[0].content[0].type==='document';
        return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:[{type:'text',text:ok?JSON.stringify([{supplier:'Davie Plumbing & Supply',material:'PEX A PIPE 1/2" X 300',price:0.79,unit:'ft'},{supplier:'Davie Plumbing & Supply',material:'Ball valve 3/4 full port',price:16.9,unit:'ea'},{supplier:'Davie Plumbing & Supply',material:'Rheem 50 gallon gas water heater',price:1075,unit:'ea'}]):'[]'}],stop_reason:'end_turn'})}); }
      if(u.startsWith('https://even-production.up.railway.app')) return r.fulfill({status:200,contentType:'application/json',body:'{}'});
      return r.continue();});
    await p.goto('https://even-os.com/'); await p.waitForTimeout(700);
    await p.evaluate(FAKE);
    await p.evaluate(({job,ROOT,lang})=>{
      localStorage.setItem('fakedb',JSON.stringify({estimates:[{id:ROOT,user_id:'u-test',job_id:null,bid_no:1,client_name:'Garcia',project_label:'Garcia repipe',location:'Davie',trade:'Plumbing',status:'sent',total_bid:job.totalBid,estimate_json:job,change_note:null,created_at:'2026-10-20T12:00:00Z'}]}));
      sbClient=window.__fakeSb(); currentUser={id:'u-test',email:'pro@example.com'}; isPro=true; estimateCount=1; updateUserBadge();
      window._myShops=[{id:'V062',name:'Davie Plumbing & Supply',primary:true}];
      if(lang==='es') setLang('es',document.querySelectorAll('.lang-btn')[1]);
    },{job,ROOT,lang});
    await p.evaluate(id=>loadSavedEstimate(id),ROOT); await p.waitForTimeout(600);
    check('saved Pro job shows "Add supplier quote"', await p.evaluate(()=>!document.getElementById('sq-btn').hidden));
    await p.click('#sq-btn'); await p.waitForTimeout(400);
    const nRows=await p.$$eval('#sq-rows .sq-row',e=>e.length);
    check('one row per material line (11), labor left out', nRows===11, nRows);
    check('supplier defaults to the primary shop from Where I shop', (await p.$eval('#sq-shop',e=>e.selectedOptions[0].textContent))==='Davie Plumbing & Supply');
    // Read a PDF of the quote: suggestions only.
    const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.click('.sq-scan label')]);
    await fc.setFiles({name:'quote-34672.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});
    await p.waitForTimeout(600);
    check('PDF quote goes to the scanner as a document', scanned===1);
    const sugg=await p.$$eval('.sq-sug:not([hidden])',e=>e.map(x=>x.textContent));
    check('scanner suggests matches for lines it recognizes (3)', sugg.length===3&&sugg.some(t=>t.includes('$0.79')), sugg.join(' | '));
    check('nothing applied without a tap: price boxes still empty', await p.$$eval('#sq-rows input[type=number]',e=>e.every(x=>x.value==='')));
    await p.click('#sq-s-0 button'); await p.waitForTimeout(100);
    check('tapping USE fills only that line', await p.$eval('#sq-p-0',e=>e.value)==='0.79'&&await p.$eval('#sq-p-3',e=>e.value)==='');
    // Now the contractor types the quote: 10 prices + 1 not in stock (overrides the scanned 0.79 on line 0).
    for(let i=0;i<10;i++){ await p.fill('#sq-p-'+i,String(QUOTE[i])); }
    await p.check('#sq-o-10');
    const expectDiff=r2(QUOTE.reduce((s,q,i)=>s+(r2(MATS[i][1]*q)-r2(MATS[i][1]*MATS[i][3])),0));
    const sumTxt=await p.textContent('#sq-sum');
    check('summary shows the materials change before overhead and profit', sumTxt.includes(es?'Materiales -':'Materials -')&&sumTxt.includes(Math.abs(expectDiff).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')), sumTxt+' vs '+expectDiff);
    check('375px: no sideways scroll on the quote screen', await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    await p.screenshot({path:`${out}/quote-${lang}.png`});
    await p.click('#sq-apply'); await p.waitForTimeout(900);
    const st=await p.evaluate(()=>{ const db=JSON.parse(localStorage.getItem('fakedb')); return {est:db.estimates,q:db.supplier_quotes||[],cur:currentEstimate,curId:window._currentEstimateId}; });
    const b1=st.est.find(x=>x.bid_no===1), b2=st.est.find(x=>x.bid_no===2);
    check('a new bid (Bid 2) is created under the job, shown on screen', b2&&b2.job_id===ROOT&&st.curId===b2.id, JSON.stringify(st.est.map(x=>[x.bid_no,x.job_id])));
    check("its change note says 'Supplier quote applied: Davie Plumbing & Supply, [date]'", b2&&b2.change_note===(es?'Cotización del proveedor aplicada: ':'Supplier quote applied: ')+'Davie Plumbing & Supply, '+new Date().toISOString().slice(0,10), b2&&b2.change_note);
    const dSub=r2(b2.estimate_json.subtotal-b1.estimate_json.subtotal);
    check(`direct cost changes by exactly the sum of the line differences: ${dSub} = ${expectDiff}`, dSub===expectDiff, `${dSub} vs ${expectDiff}`);
    const factor=(1+0.12+0.08)*(1+0.22);
    check('the price to the client moves by that amount with overhead, cushion and profit on top', Math.abs(r2(b2.estimate_json.totalBid-b1.estimate_json.totalBid)-r2(expectDiff*factor))<=0.01, `${r2(b2.estimate_json.totalBid-b1.estimate_json.totalBid)} vs ${r2(expectDiff*factor)}`);
    check('Bid 1 is unchanged (lines, prices, totals)', JSON.stringify(b1.estimate_json.lineItems)===JSON.stringify(job.lineItems)&&b1.estimate_json.totalBid===job.totalBid&&b1.estimate_json.subtotal===job.subtotal&&b1.total_bid===r2(job.totalBid), JSON.stringify({t:[b1.estimate_json.totalBid,job.totalBid],s:[b1.estimate_json.subtotal,job.subtotal],tb:[b1.total_bid],li:JSON.stringify(b1.estimate_json.lineItems)===JSON.stringify(job.lineItems)}));
    const oos=b2.estimate_json.lineItems[10];
    check("'not in stock' line keeps the old price and is flagged", oos.unitCost===142&&oos.total===142&&oos.notInStock&&oos.notInStock.supplier==='Davie Plumbing & Supply', JSON.stringify(oos));
    const notes=await p.$$eval('#li-body .li-src',e=>e.map(x=>x.textContent));
    check("quoted lines say 'Quoted by Davie Plumbing & Supply, [date]' (10)", notes.filter(t=>t.startsWith(es?'Cotizado por Davie Plumbing':'Quoted by Davie Plumbing')).length===10, notes.join(' | '));
    check('the not-in-stock line says so on screen', notes.some(t=>t.startsWith(es?'Sin existencia en Davie':'Not in stock at Davie')));
    check('11 private quote rows saved for this job, with stock flags', st.q.length===11&&st.q.filter(x=>x.in_stock===false).length===1&&st.q.every(x=>x.job_id===ROOT&&x.bid_id===b2.id&&x.user_id==='u-test')&&st.q.find(x=>x.line_index===0).price===0.81, JSON.stringify(st.q.slice(0,2)));
    const bar=await p.textContent('#bid-bar');
    check('What changed lists the new prices', bar.includes(es?'precio $0.92 → $0.81':'price $0.92 → $0.81'), bar.slice(0,300));
    // Next time: your last quote shows as a hint.
    await p.click('#sq-btn'); await p.waitForTimeout(400);
    const last=await p.textContent('#sq-rows .sq-row[data-i="0"] .sq-last').catch(()=>'');
    check("next time: 'Your last quote: $0.81 at Davie Plumbing & Supply, [date]'", last.includes(es?'Tu última cotización: $0.81 en Davie Plumbing & Supply':'Your last quote: $0.81 at Davie Plumbing & Supply'), last);
    await p.click('#sq-modal .li-del');
    check('375px: estimate screen has no sideways scroll', await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    await p.screenshot({path:`${out}/bid2-${lang}.png`,fullPage:false});
    check('no page errors', errs.length===0, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
