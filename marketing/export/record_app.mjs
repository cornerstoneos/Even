// Records a real run of the live app (even-os.com) at phone size in one language. Usage: node run.mjs <en|es> <outdir>
import { chromium } from 'playwright';
import fs from 'fs';
const lang=process.argv[2], OUT=process.argv[3]; fs.mkdirSync(OUT,{recursive:true});
const TXT={en:'Change the 100A panel to 200A in a 2,400 sq ft home in Aventura',
           es:'Cambiar el panel eléctrico de 100 a 200 amperes en una casa de 2,400 pies cuadrados en Aventura'}[lang];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:402,height:874},deviceScaleFactor:2,isMobile:true,hasTouch:true,acceptDownloads:true});
const p=await ctx.newPage(); const T0=Date.now(); const now=()=>(Date.now()-T0)/1000;
fs.mkdirSync(OUT+'/fr',{recursive:true}); const frames=[]; const cdp=await ctx.newCDPSession(p);
let capturing=true; const loopP=(async()=>{ while(capturing){ const t=Date.now(); try{ const lm=await cdp.send('Page.getLayoutMetrics'); const vv=lm.cssVisualViewport; const r=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:88,optimizeForSpeed:true,clip:{x:vv.pageX,y:vv.pageY,width:402,height:874,scale:2}}); const i=frames.length; frames.push(Date.now()/1000); fs.writeFileSync(`${OUT}/fr/${String(i).padStart(5,'0')}.jpg`,Buffer.from(r.data,'base64')); }catch(e){} const dt=Date.now()-t; if(dt<20) await new Promise(r=>setTimeout(r,20-dt)); } })();
const ev=[]; const log=(name,extra={})=>{ev.push({name,t:+now().toFixed(2),...extra}); console.log(name,now().toFixed(1));};
const rect=async(sels)=>p.evaluate((sels)=>{const rs=sels.map(s=>{let up=0;const m=s.match(/^\^(\d)(.*)$/);if(m){up=+m[1];s=m[2];}let e=document.querySelector(s);for(let i=0;i<up&&e;i++)e=e.parentElement;return e;}).filter(Boolean).map(e=>e.getBoundingClientRect());
  if(!rs.length) return null; const x0=Math.min(...rs.map(r=>r.left)),y0=Math.min(...rs.map(r=>r.top)),x1=Math.max(...rs.map(r=>r.right)),y1=Math.max(...rs.map(r=>r.bottom)); return {x0,y0,x1,y1};},sels);
const see=async(sel,block='center')=>{await p.evaluate(([s,bl])=>document.querySelector(s).scrollIntoView({block:bl,behavior:'smooth'}),[sel,block]); await p.waitForTimeout(1100);};
const hold=async(name,sels,ms)=>{const r=await rect(sels); log(name+'_start',{rect:r}); await p.waitForTimeout(ms); log(name+'_end');};
await p.goto(`https://even-os.com/?lang=${lang}`,{waitUntil:'networkidle'}); await p.waitForTimeout(1500); log('start');
// 1. describe the job
await p.click('#scope-text'); await p.keyboard.type(TXT,{delay:38}); await p.waitForTimeout(500);
await hold('scope',['#scope-text'],2600);
await see('#est-location'); await p.click('#est-location'); await p.keyboard.type('Avent',{delay:110}); await p.waitForSelector('.city-opt',{timeout:15000}); await p.waitForTimeout(500);
await hold('city',['#est-location','#city-dropdown'],2400);
await p.click('.city-opt'); await p.waitForTimeout(700);
await see('#est-trade'); await p.selectOption('#est-trade','Electrical'); await p.waitForTimeout(500);
await hold('trade',['#est-trade'],2400);
await p.click("button[onclick*=more-details]"); await p.waitForTimeout(500); await see('#est-sqft'); await p.click('#est-sqft'); await p.keyboard.type('2400',{delay:120}); await p.waitForTimeout(500);
await hold('sqft',['#est-sqft'],1800);
log('step1_end');
// 2. margins
await p.click("button[onclick*=your-settings]"); await p.waitForTimeout(600); log('step2_start');
await see('#lv-profit','center'); await p.waitForTimeout(400);
await hold('margins',['^2#lv-oh','^2#lv-cushion'],3600);
await see('#lv-lmult','center'); await hold('labor',['^2#lv-lmult'],2800);
log('step2_end');
// 3. analyze + questions
await see('#gen-btn'); await hold('analyze',['#gen-btn'],1800); await p.click('#gen-btn'); log('analyze_click');
await p.waitForSelector('#q-list .q-block',{timeout:180000}); await p.waitForTimeout(1500); log('questions_ready');
await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'})); await p.waitForTimeout(300);
const n=await p.evaluate(()=>document.querySelectorAll('#q-list .q-block').length); console.log('questions',n);
const pref=[/same location|misma ubic|^garage|garaje|indoor|interior/i,/^yes|^s[ií]|include|incluy/i,/siemens|no preference|sin preferencia|underground|subterr/i];
for(let i=0;i<n;i++){
  await see(`#qblock-${i}`); if(i===0||i===2){ await hold('q'+i,[`#qblock-${i}`],2000); }
  const chips=await p.$$(`#qchips-${i} .q-chip:not(.q-other-chip)`); let pick=chips[0];
  for(const re of pref){ for(const c of chips){ if(re.test((await c.innerText()).trim())){pick=c;break;} } if(pick!==chips[0]) break; }
  await pick.tap(); await p.waitForTimeout(700);
}
log('answers_done');
await see('#calc-btn'); await hold('calc',['#calc-btn'],1600); await p.click('#calc-btn'); log('calc_click');
await p.waitForFunction(()=>{const e=document.getElementById('pc-price');return e&&/\d/.test(e.textContent)&&e.offsetParent!==null;},null,{timeout:240000}); await p.waitForTimeout(2500); log('result_ready');
// 4. bid
await see('#price-card','start'); await hold('price',['#pc-price'],1800); await hold('range',['#pc-sub'],2200);
for (const [nm,sel] of [['final','#final-bid-input']]){ if(await p.$(sel) && await p.evaluate(s=>document.querySelector(s).offsetParent!==null,sel)){ await see(sel); await hold(nm,[sel],3000);} }
log('step4_end');
// 5. outputs
await see('#est-pdf-grid'); await hold('pdfgrid',['#est-pdf-grid .d-btn.gold','#est-pdf-grid .d-btn.dark'],3400); log('step5_end');
const dl1=p.waitForEvent('download',{timeout:60000}); await p.evaluate(()=>downloadProposalPDF()); const d1=await dl1; await d1.saveAs(OUT+'/proposal.pdf');
const dl2=p.waitForEvent('download',{timeout:60000}); await p.evaluate(()=>downloadCostSheet()); const d2=await dl2; await d2.saveAs(OUT+'/costsheet.pdf');
await p.screenshot({path:OUT+'/final.png'});
fs.writeFileSync(OUT+'/events.json',JSON.stringify(ev,null,1));
capturing=false; await loopP; fs.writeFileSync(OUT+'/frames.json',JSON.stringify({T0:T0/1000,ts:frames})); await ctx.close(); await b.close(); console.log('done',frames.length);
