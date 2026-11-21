// CRM channels/outcomes added 2026-11-21: WhatsApp, Facebook personal vs page, 'replied'.
// The database check constraints were changed to the same lists the same day.
const path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const CRM=require('../admin/core.js');
check('core.js exposes the lists', !!CRM);
check('WhatsApp and personal Facebook are channels', CRM.CHANNELS.includes('whatsapp')&&CRM.CHANNELS.includes('fb_personal'));
check('labels tell the Even page and the personal profile apart', CRM.CHANNEL_LABEL.fb==='Facebook (Even page)'&&CRM.CHANNEL_LABEL.fb_personal==='Facebook (personal)');
check('"replied" is an outcome', CRM.OUTCOMES.includes('replied'));
const html=require('fs').readFileSync(path.join(__dirname,'..','admin','index.html'),'utf8');
check('lead and quick-log panels offer the new channels', /\['call', 'whatsapp', 'ig', 'fb', 'fb_personal', 'tiktok'\]/.test(html)&&/'Q:', \['ig', 'fb', 'fb_personal', 'tiktok', 'whatsapp', 'group_post'\]/.test(html));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
