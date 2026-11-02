// Sidebar: Recents + search (founder 2026-10-31), in a real browser against
// index.html with a fake signed-in Supabase (rows in localStorage).
// Acceptance (tasks/app.md, Oct 31 #2): with 25 saved test jobs, searching a
// client's last name finds that job; Recents order follows last edit; opening a
// recent loads the job and its bids; EN/ES; 375px no sideways scroll; desktop
// layout fine. Also: the dashboard tab bar is gone; signed out sees New estimate
// + 'Sign in to save and search your jobs'.
// Run: node tests/acceptance/sidebar-2026-10-31.js [screenshot dir]
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs'),path=require('path');
const out=process.argv[2]||require('os').tmpdir()+'/even-sidebar';
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

// 25 saved jobs. Job 7 is created early but edited last (its Bid 2); job 12 has a
// note; job 18 a Spanish-trade, address and description to find.
const LAST=['Smith','Johnson','Delgado','Brown','Nguyen','Garcia','Kowalski','Patel','Rossi','Okafor','Lindqvist','Herrera','Moreau','Tanaka','Fischer','Silva','Novak','Abara','Castillo','Dubois','Haddad','Ivanov','Jensen','Kaur','Lopez'];
const T0=Date.parse('2026-10-01T12:00:00Z');
const rows=[];
LAST.forEach((ln,i)=>{
  const id=`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`;
  const created=new Date(T0+i*3600e3).toISOString();
  rows.push({id,user_id:'u-test',job_id:null,bid_no:1,client_name:`Client ${ln}`,project_label:`Job ${i+1}`,location:i%2?'Hollywood':'Miami',trade:i===17?'Plumbing':'Electrical',
    status:i===4?'won':i===9?'lost':'draft',notes:i===11?'Client wants the panel moved to the garage':null,change_note:null,created_at:created,updated_at:created,total_bid:1000+i*100,
    estimate_json:{totalBid:1000+i*100,lineItems:[{type:'other',category:'Labor',description:'Line',qty:1,unit:'ea',unitCost:1000+i*100,total:1000+i*100}]},
    jobAddress:i===17?'412 Ocean Dr, Hollywood':'',scopeText:i===17?'Replace the tankless water heater in the attic':'',projectName:''});
});
// Job 7 (index 6): created early, its Bid 2 edited most recently.
rows.push({id:'00000000-0000-4000-8000-000000000099',user_id:'u-test',job_id:rows[6].id,bid_no:2,client_name:'Client Kowalski',project_label:'Job 7',location:'Miami',trade:'Electrical',status:'draft',notes:null,change_note:'client cut the countertops',
  created_at:new Date(T0+30*3600e3).toISOString(),updated_at:new Date(T0+99*3600e3).toISOString(),total_bid:777,estimate_json:{totalBid:777,lineItems:[{type:'other',category:'Labor',description:'Line',qty:1,unit:'ea',unitCost:777,total:777}]},jobAddress:'',scopeText:'',projectName:''});

(async()=>{
  const b=await chromium.launch();
  for(const [lang,vw] of [['en',{width:375,height:812}],['es',{width:375,height:812}],['en',{width:1280,height:860}]]){
    const es=lang==='es';
    console.log(`\n=== ${lang.toUpperCase()} · ${vw.width}px ===`);
    const ctx=await b.newContext({viewport:vw}); const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/*',async r=>{const u=r.request().url();
      if(u.replace(/[?#].*$/,'')==='https://even-os.com/') return r.fulfill({status:200,contentType:'text/html',body:html});
      if(u.startsWith('https://even-production.up.railway.app')) return r.fulfill({status:200,contentType:'application/json',body:u.includes('/api/builds')?'{"builds":[{"id":"bbbbbbbb-0000-4000-8000-000000000001","label":"Ready job from last night","status":"ready","updatedAt":"2026-10-03T09:00:00Z","total":5000}]}':'{}'});
      return r.continue();});
    await p.goto('https://even-os.com/'); await p.waitForTimeout(700);
    await p.evaluate(FAKE);
    await p.evaluate(({rows,lang})=>{ localStorage.setItem('fakedb',JSON.stringify({estimates:rows})); sbClient=window.__fakeSb();
      currentUser={id:'u-test',email:'pro@example.com'}; isPro=true; estimateCount=1; updateUserBadge(); loadBuilds();
      if(lang==='es') setLang('es',document.querySelectorAll('.lang-btn')[1]); },{rows,lang});
    await p.waitForTimeout(300);
    await p.click('#menu-btn'); await p.waitForTimeout(500);
    check('menu opens from the top-left button', await p.evaluate(()=>document.getElementById('sidebar').classList.contains('open')));
    const nav=await p.textContent('.sb-nav');
    check('New estimate, Jobs, Requests, Settings in the menu', es?['Nuevo estimado','Trabajos','Solicitudes','Configuración'].every(t=>nav.includes(t)):['New estimate','Jobs','Requests','Settings'].every(t=>nav.includes(t)), nav);
    const rec=await p.$$eval('#sb-list .sb-item .t span:first-child',els=>els.map(e=>e.textContent));
    check('Recents: 10 items, newest edit first (Job 7: its Bid 2 was edited last)', rec.length===10&&rec[0]==='Job 7', rec.join(' | '));
    check('a build that finished while away is in Recents as Ready', rec.includes('Ready job from last night')&&(await p.textContent('#sb-list')).includes(es?'Listo':'Ready'));
    check('then by last edit: Job 25, Job 24, ...', rec.indexOf('Job 25')<rec.indexOf('Job 24')&&rec.indexOf('Job 24')<rec.indexOf('Job 23'), rec.join(' | '));
    check('status chips (Won / Lost) show on the job', (await p.textContent('#sb-list')).includes(es?'Abierto':'Open'));
    if(vw.width===375) check('375px: no sideways scroll with the menu open', await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    await p.screenshot({path:`${out}/recents-${lang}-${vw.width}.png`});
    const search=async q=>{ await p.fill('#sb-q',''); await p.type('#sb-q',q,{delay:15}); await p.waitForTimeout(150); return p.$$eval('#sb-list .sb-item .t span:first-child',els=>els.map(e=>e.textContent)); };
    let res=await search('delgado');
    check('search a client\'s last name finds that job, as you type', res.length===1&&res[0]==='Job 3', res.join(' | '));
    check('results title', (await p.textContent('#sb-list-title'))===(es?'Resultados':'Results'));
    res=await search('ocean dr');
    check('search by address', res.length===1&&res[0]==='Job 18', res.join());
    res=await search('tankless attic');
    check('search by job description', res.length===1&&res[0]==='Job 18', res.join());
    res=await search('garage');
    check('search by bid notes', res.length===1&&res[0]==='Job 12', res.join());
    res=await search('countertops');
    check('search finds a later bid\'s change note', res.length===1&&res[0]==='Job 7', res.join());
    res=await search('plomeria');
    check('search by trade, in Spanish words too', res.length===1&&res[0]==='Job 18', res.join());
    res=await search('hollywood');
    check('search by city', res.length===12, res.length);
    res=await search('nobody-by-this-name');
    check('no match says so', res.length===0&&(await p.textContent('#sb-list')).includes(es?'No hay trabajos que coincidan.':'No jobs match.'));
    await p.screenshot({path:`${out}/search-${lang}-${vw.width}.png`});
    await search('kowalski');
    await p.click('#sb-list .sb-item'); await p.waitForTimeout(700);
    const opened=await p.evaluate(()=>({screen:document.querySelector('.screen.active')?.id,bids:window._job&&window._job.bids.length,total:currentEstimate&&currentEstimate.totalBid,open:document.getElementById('sidebar').classList.contains('open')}));
    check('opening a result loads the job and its bids (latest bid on screen), menu closes', opened.screen==='s-estimate'&&opened.bids===2&&opened.total===777&&!opened.open, JSON.stringify(opened));
    await p.click('#menu-btn'); await p.waitForTimeout(300); await p.click('#sb-overlay',{position:{x:vw.width-10,y:400}}); await p.waitForTimeout(300);
    check('tapping outside closes the menu', !(await p.evaluate(()=>document.getElementById('sidebar').classList.contains('open'))));
    await p.click('#menu-btn'); await p.waitForTimeout(300);
    await p.click('.sb-nav button:nth-child(2)'); await p.waitForTimeout(600);
    check('Jobs opens the dashboard, with no bottom tab bar', await p.evaluate(()=>document.querySelector('.screen.active')?.id==='s-dashboard'&&!document.querySelector('.d-tabs')));
    if(vw.width===375) check('375px: dashboard has no sideways scroll', await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    check('no page errors', errs.length===0, errs.join(' | '));
    await ctx.close();
  }
  console.log('\n=== Signed out ===');
  { const ctx=await b.newContext({viewport:{width:375,height:812}}); const p=await ctx.newPage();
    await p.route('**/*',async r=>{const u=r.request().url(); if(u.replace(/[?#].*$/,'')==='https://even-os.com/') return r.fulfill({status:200,contentType:'text/html',body:html}); if(u.startsWith('https://even-production')) return r.fulfill({status:200,contentType:'application/json',body:'{}'}); return r.continue();});
    await p.goto('https://even-os.com/'); await p.waitForTimeout(700);
    await p.click('#menu-btn'); await p.waitForTimeout(300);
    const vis=await p.evaluate(()=>[...document.querySelectorAll('#sidebar button,#sidebar input')].filter(e=>e.offsetParent!==null).map(e=>e.textContent.trim()||e.placeholder));
    check('signed out: New estimate + "Sign in to save and search your jobs" only', vis.includes('New estimate')&&vis.includes('Sign in to save and search your jobs')&&!vis.includes('Jobs')&&!vis.includes('Search jobs'), vis.join(' | '));
    await p.screenshot({path:`${out}/signed-out.png`});
    await ctx.close(); }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
