// Browser checks (Playwright), not part of tests/run.sh. Usage: node tests/acceptance/<this file> index.html <outDir>
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const fs=require('fs');
const [htmlPath,out]=process.argv.slice(2);
const html=fs.readFileSync(htmlPath,'utf8');
(async()=>{
  const browser=await chromium.launch();
  for(const [name,vp] of [['phone',{width:390,height:844}],['desktop',{width:1440,height:900}]]){
    for(const lang of ['en','es']){
      const ctx=await browser.newContext({viewport:vp,deviceScaleFactor:2}); const page=await ctx.newPage();
      page.on('pageerror',e=>console.log('pageerror',e.message));
      await page.route('**/*',async r=>{const u=r.request().url(); if(u.replace(/[?#].*$/,'')==='https://even-os.com/') return r.fulfill({status:200,contentType:'text/html',body:html});
        try{const h={...r.request().headers()};delete h['accept-encoding'];const resp=await fetch(u,{method:r.request().method(),headers:h});const b=Buffer.from(await resp.arrayBuffer());const rh={};resp.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k))rh[k]=v;});await r.fulfill({status:resp.status,headers:rh,body:b});}catch(e){await r.abort().catch(()=>{});}});
      await page.goto('https://even-os.com/',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(2500);
      await page.evaluate(lang=>{
        if(lang==='es'){ const b=[...document.querySelectorAll('.lang-btn')].find(x=>x.textContent.trim()==='ES'); setLang('es',b); }
        currentUser={id:'x',email:'owner@acmeplumbing.com'};
        localStorage.setItem('even_biz',JSON.stringify({company:'Acme Plumbing LLC',phone:'(954) 555-0100',email:'owner@acmeplumbing.com',license:'CFC1234567'}));
        window._ctx={trade:'Plumbing',location:'Fort Lauderdale, FL',client:'Maria Lopez',projectLabel:''};
        const li=[
          {category:'Plumbing',description:'50 Gallon - Energy Saver Electric Residential Water Heater, 240V',qty:1,unit:'each',unitCost:894.42,total:894.42,priced:'catalog'},
          {category:'Plumbing',description:'3.2 Gallon Expansion Tank',qty:1,unit:'each',unitCost:63.52,total:63.52,priced:'catalog'},
          {category:'Plumbing',description:'1/2" Copper x Male Adapter',qty:2,unit:'each',unitCost:2.08,total:4.16,priced:'catalog'},
          {category:'Plumbing',description:'PEX-b tubing, 1/2 inch (incl. 10% waste)',qty:22,unit:'linear ft',unitCost:0.31,total:6.82,priced:'catalog'},
          {category:'Labor',description:'Disconnect old unit, set new heater, connect water lines, fill and test',qty:5,unit:'hr',unitCost:61.09,total:305.45,priced:'bls x multiplier',wage:27.77},
          {category:'Labor',description:'Verify and reconnect electrical supply to new unit',qty:1,unit:'hr',unitCost:62.02,total:62.02,priced:'bls x multiplier',wage:28.19},
          {category:'Materials',description:'Drain pan for garage install per code',qty:1,unit:'ea',unitCost:35,total:35,estimated:true,estLabel:'not in our data, estimated'},
          {category:'Disposal',description:'Haul away old water heater',qty:1,unit:'ea',unitCost:50,total:50,estimated:true,estLabel:'not in our data, estimated'},
          {category:'Permits',description:'Permit: Fort Lauderdale Trade Permit',qty:1,unit:'permit',unitCost:131,total:131,permitRow:{municipality:'Fort Lauderdale',work_type:'Trade Permit',date:'2026-10-02'}}];
        const d={projectName:'Water Heater Replacement',lineItems:li,subtotal:1597.54,overhead:{pct:12,amount:192},contingency:{pct:8,amount:128,lowRisk:false},profit:{pct:22,amount:422},totalBid:2339.54,confidenceTier:'high',laborBasis:{mode:'multiplier',mult:2.2},
          assumptions:['Delivery, disposal and site protection scaled to job size ($645 to $300). Flat minimums don\'t apply at this scope.','Standard 50 gallon unit used as closest standard equivalent to the existing 40 gallon tank','Same location and same fuel type as the existing water heater','Existing water and electrical connections are reused','No electrical work needed beyond reconnecting the existing circuit'],
          exclusions:['Drywall or finish repair beyond the heater closet','Gas line work'],paymentTerms:'50% deposit required to schedule · 50% upon project completion. Price valid 30 days.'};
        currentEstimate=d; navigate('estimate'); renderEstimate(d);
        document.getElementById('pay-sched-section').style.display='block';
        const pe=document.getElementById('proposal-edit-card'); pe.style.display='block'; populateProposalAssumptions();
        renderProposalPreview();
      },lang);
      await page.waitForTimeout(800);
      const el=page.locator('#proposal-section'); await el.scrollIntoViewIfNeeded();
      await el.screenshot({path:`${out}/proposal-preview-${name}-${lang}.png`});
      await page.locator('#proposal-edit-card').screenshot({path:`${out}/customizer-${name}-${lang}.png`});
      if(name==='phone'){
        const b64=await page.evaluate(async()=>{const J=(window.jspdf||{}).jsPDF; const doc=await buildClientProposalPDF(J); return doc.output('datauristring').split(',')[1];});
        fs.writeFileSync(`${out}/proposal-${lang}.pdf`,Buffer.from(b64,'base64'));
        console.log(lang,'pdf bytes',Buffer.from(b64,'base64').length);
      }
      await ctx.close();
    }
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
