// Bid history + Won/Lost, in a real browser against index.html with a fake
// signed-in Supabase session (a small in-page stand-in for the supabase-js query
// builder, rows kept in localStorage so a page reload keeps them).
// Acceptance (tasks/app.md): save a job, Revise twice, each bid keeps its own
// numbers after reload; change list matches the real differences; mark Won,
// tracker shows the final bid's lines; mark Lost with reason, it persists;
// signed-out users see a sign-in prompt instead of Revise; phone layout
// unbroken; EN + ES.
// Run: node tests/acceptance/bids-2026-10-17.js [screenshot dir]
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs'),path=require('path');
const out=process.argv[2]||require('os').tmpdir()+'/even-bids';
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
    const boot=async()=>{
      await p.goto('https://even-os.com/'); await p.waitForTimeout(700);
      await p.evaluate(FAKE);
      await p.evaluate(l=>{ sbClient=window.__fakeSb(); currentUser={id:'u-test',email:'pro@example.com'}; isPro=true; estimateCount=1; updateUserBadge();
        if(l==='es') setLang('es',document.querySelectorAll('.lang-btn')[1]); },lang);
    };
    await boot();
    const es=lang==='es', W=x=>es?x[1]:x[0];
    // Bid 1: a priced estimate from the app's own engine, saved like a Pro run.
    const bid1=await p.evaluate(async()=>{
      document.getElementById('est-location').value='Miami'; document.getElementById('est-trade').value='Remodeling'; document.getElementById('est-project-label').value='Smith bathroom';
      const cat=buildCatalog(null,null,{});
      const data=priceScope({projectName:'Bath',lineItems:[
        {type:'other',category:'Tile',description:'Porcelain floor tile',qty:60,unit:'sqft',unitCost:4},
        {type:'other',category:'Cabinets',description:'Vanity cabinet',qty:1,unit:'ea',unitCost:800},
        {type:'other',category:'Labor',description:'Tile setter',qty:16,unit:'hr',unitCost:60}]},cat,{marketAdj:1,laborMult:2.2,oh:12,profit:22,cushion:8,sqft:0,hvhz:false,lang:appLang});
      currentEstimate=data; navigate('estimate'); renderEstimate(data); await saveEstimateToCloud(data);
      return {total:data.totalBid,id:window._currentEstimateId};
    });
    let txt=await p.textContent('#bid-bar');
    check('saved job shows Bid history with Bid 1 and Revise', txt.includes(W(['Bid history','Historial de ofertas']))&&txt.includes(W(['Bid 1','Oferta 1']))&&txt.includes(W(['REVISE BID','REVISAR OFERTA'])), txt);

    // Revise #1 -> Bid 2: more tile, vanity cut, one new line, a reason.
    await p.click('#revise-btn'); await p.waitForTimeout(400);
    await p.evaluate(()=>{
      const q=document.getElementById('qty-0'); q.value='80'; q.dispatchEvent(new Event('change'));
      delLine(1);
      addLine(); const n=currentEstimate.lineItems.length-1;
      const row=document.getElementById('lr-'+n); row.querySelector('input').value='2 extra circuits';
      document.getElementById('qty-'+n).value='2'; const uc=document.getElementById('uc-'+n); uc.value='150'; uc.dispatchEvent(new Event('change'));
    });
    await p.waitForTimeout(1800);
    await p.fill('.bid-reason','client cut the vanity'); await p.dispatchEvent('.bid-reason','change'); await p.waitForTimeout(300);
    txt=await p.textContent('#bid-bar');
    check('Revise made Bid 2 (copy of Bid 1)', txt.includes(W(['Bid 2','Oferta 2'])), txt);
    check('change list: quantity change', txt.includes(W(['Porcelain floor tile: qty 60 → 80','Porcelain floor tile: cantidad 60 → 80'])), txt);
    check('change list: removed line', txt.includes(W(['Removed: Vanity cabinet','Quitado: Vanity cabinet'])), txt);
    check('change list: added line', txt.includes(W(['Added: 2 extra circuits','Agregado: 2 extra circuits'])), txt);
    const bid2=await p.evaluate(()=>({total:currentEstimate.totalBid,id:window._currentEstimateId}));
    const diffWant=Math.round(bid2.total)-Math.round(bid1.total), diffStr=(diffWant<0?'-$':'+$')+Math.abs(diffWant).toFixed(2);
    check(`header shows the real total difference (${diffStr})`, txt.replace(/,/g,'').includes(diffStr), txt);
    check('removed line is gone from the screen and the proposal', await p.evaluate(()=>!document.getElementById('lr-1')&&!JSON.stringify(buildClientProposal(currentEstimate,window._ctx,appLang)).includes('Vanity cabinet')));

    // Revise #2 -> Bid 3: the contractor sets their own price.
    await p.click('#revise-btn'); await p.waitForTimeout(400);
    await p.fill('#final-bid-input','9999'); await p.dispatchEvent('#final-bid-input','input'); await p.waitForTimeout(1800);
    txt=await p.textContent('#bid-bar');
    check('Bid 3 shows the price change vs Bid 2', txt.includes(W(['Bid 3 vs Bid 2','Oferta 3 vs Oferta 2']))&&txt.replace(/,/g,'').includes('9999')&&txt.includes(W(['Your price:','Tu precio:']))&&!txt.includes(W(['No changes yet','Todavía no hay cambios'])), txt);
    await p.screenshot({path:`${out}/bids-estimate-${lang}.png`,fullPage:true});
    const sw1=await p.evaluate(()=>document.documentElement.scrollWidth);
    check('phone: estimate screen does not scroll sideways', sw1<=375, sw1);

    // Reload: each bid keeps its own numbers.
    await boot();
    await p.evaluate(id=>loadSavedEstimate(id),bid1.id); await p.waitForTimeout(500);
    const after=await p.evaluate(()=>({cur:window._job.bids.find(b=>b.id===window._currentEstimateId).bid_no,bids:window._job.bids.map(b=>({n:b.bid_no,total:+b.total_bid,final:b.estimate_json.finalBid||null,lines:b.estimate_json.lineItems.length,note:b.change_note}))}));
    check('after reload the job opens on its latest bid (Bid 3)', after.cur===3, JSON.stringify(after));
    check('Bid 1 kept its numbers', after.bids[0].total===Math.round(bid1.total*100)/100&&after.bids[0].lines===3, JSON.stringify(after.bids[0]));
    check('Bid 2 kept its numbers and reason', after.bids[1].total===Math.round(bid2.total*100)/100&&after.bids[1].lines===4&&after.bids[1].note==='client cut the vanity', JSON.stringify(after.bids[1]));
    check('Bid 3 kept its own price', after.bids[2].final===9999, JSON.stringify(after.bids[2]));
    await p.click(`.bid-chip >> nth=0`); await p.waitForTimeout(400);
    const v1=await p.evaluate(()=>({qty:currentEstimate.lineItems[0].qty,vanity:!!document.getElementById('lr-1'),price:document.getElementById('pc-price').textContent,prop:JSON.stringify(buildClientProposal(currentEstimate,window._ctx,appLang))}));
    check('viewing Bid 1: its original lines (qty 60, vanity there)', v1.qty===60&&v1.vanity, JSON.stringify(v1).slice(0,200));
    check('proposal prints the bid on screen and no change list', v1.prop.includes('Vanity cabinet')&&!/client cut the vanity|Qué cambió|What changed/.test(v1.prop));
    txt=await p.textContent('#bid-bar');
    check('earlier bid: says Revise copies the latest', txt.includes(W(['Revise copies the latest one (Bid 3)','Revisar copia la más reciente (Oferta 3)'])), txt);

    // Dashboard: one card per job; Won -> tracker on the final bid.
    await p.evaluate(()=>navigate('dashboard')); await p.waitForTimeout(600);
    const cards=await p.$$eval('#dashboard-list .job-card',els=>els.map(e=>e.textContent.replace(/\s+/g,' ')));
    check('dashboard: one card for the job, tagged Bid 3', cards.length===1&&cards[0].includes(W(['Bid 3','Oferta 3'])), JSON.stringify(cards));
    await p.screenshot({path:`${out}/bids-dashboard-${lang}.png`,fullPage:true});
    const sw2=await p.evaluate(()=>document.documentElement.scrollWidth);
    check('phone: dashboard does not scroll sideways', sw2<=375, sw2);
    await p.selectOption('#dashboard-list .status-select','won'); await p.waitForTimeout(900);
    const won=await p.evaluate(()=>({id:window._currentEstimateId,screen:document.querySelector('.screen.active').id,bid:window._job.bids.find(b=>b.id===window._currentEstimateId).bid_no,
      rows:[...document.querySelectorAll('#var-body .var-row')].map(r=>({li:+r.dataset.li,d:r.querySelector('span').textContent})),
      status:JSON.parse(localStorage.getItem('fakedb')).estimates.map(e=>e.status)}));
    check('Won: every bid of the job is Won', won.status.length===3&&won.status.every(s=>s==='won'), JSON.stringify(won.status));
    check('Won opens the estimate screen on the final bid (Bid 3)', won.screen==='s-estimate'&&won.bid===3, JSON.stringify(won));
    check("tracker shows the final bid's lines (3 lines, vanity not there)", won.rows.length===3&&!won.rows.some(r=>/Vanity/.test(r.d))&&won.rows.some(r=>/2 extra circuits/.test(r.d)), JSON.stringify(won.rows));
    await p.evaluate(()=>{ const row=document.querySelector('#var-body .var-row[data-li="3"]'); const i=row.querySelector('input'); i.value='420'; i.dispatchEvent(new Event('change')); });
    await p.waitForTimeout(1600);
    const ce=await p.evaluate(()=>JSON.parse(localStorage.getItem('fakedb')).cost_entries||[]);
    check('an actual cost is saved on the final bid at the line\'s real position', ce.length===1&&ce[0].line_index===3&&ce[0].estimate_id===won.id, JSON.stringify(ce));

    // Lost with a reason persists.
    await p.evaluate(()=>navigate('dashboard')); await p.waitForTimeout(600);
    await p.click('#dash-filter button >> nth=2'); await p.waitForTimeout(200);   // All (a Won job leaves the Open list)
    await p.selectOption('#dashboard-list .status-select','lost'); await p.waitForTimeout(300);
    await p.selectOption('#dashboard-list .job-lost select','price'); await p.waitForTimeout(300);
    await boot(); await p.evaluate(()=>navigate('dashboard')); await p.waitForTimeout(700);
    await p.click('#dash-filter button >> nth=2'); await p.waitForTimeout(200);
    const lost=await p.evaluate(()=>({sel:document.querySelector('#dashboard-list .job-lost select')?.value,shown:!document.querySelector('#dashboard-list .job-lost').hidden,db:JSON.parse(localStorage.getItem('fakedb')).estimates.find(e=>!e.job_id).lost_reason}));
    check('Lost with reason "price" persists after reload', lost.sel==='price'&&lost.shown&&lost.db==='price', JSON.stringify(lost));

    // Signed out: a sign-in prompt instead of Revise.
    await p.evaluate(()=>{ currentEstimate=JSON.parse(localStorage.getItem('fakedb')).estimates[0].estimate_json; currentUser=null; isPro=false; window._job=null; navigate('estimate'); renderEstimate(currentEstimate); });
    txt=await p.textContent('#bid-bar');
    check('signed out: sign-in prompt, no Revise', txt.includes(W(['SIGN IN','INICIAR SESIÓN']))&&!txt.includes(W(['REVISE BID','REVISAR OFERTA'])), txt);
    check('no page errors', !errs.length, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(`\n──────────────\n${pass} passed, ${fail} failed  (screenshots: ${out})`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
