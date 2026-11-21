// Questions screen, option A (founder 2026-11-21): an "estimate so far" card in the
// loading screen's checklist style fills in as each question is answered.
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fnSrc=n=>{const s=html.indexOf(`function ${n}(`);return html.slice(s,html.indexOf('\n}',s)+2);};
const qTopic=new Function(fnSrc('qTopic')+';return qTopic;')();
check('topic drops the number, ¿ and ?', qTopic('2. ¿Dónde está el panel?')==='Dónde está el panel');
check('long topics are cut on a word with …', /…$/.test(qTopic('Is this a straight swap in the same location or does the panel need to be relocated to a new wall?'))&&qTopic('Is this a straight swap in the same location or does the panel need to be relocated to a new wall?').length<=46);
// Run the card renderer against a fake DOM.
const els={}; const el=id=>els[id]||(els[id]={hidden:false,textContent:'',innerHTML:'',style:{}});
const ctx={document:{getElementById:el},appLang:'es',window:{_scopeData:null},escapeHtml:s=>String(s),localizeScopeData:d=>d};
const render=new Function('document','appLang','window','escapeHtml','localizeScopeData',fnSrc('qTopic')+fnSrc('renderQBuild')+';return renderQBuild;')(ctx.document,'es',ctx.window,ctx.escapeHtml,ctx.localizeScopeData);
const qs=[{question:'¿Dónde está el panel?'},{question:'¿Incluye permiso?'}];
render(qs,{'¿Dónde está el panel?':'Garaje'},1);
check('card shows the count in Spanish', el('qb-count').textContent==='1 de 2');
check('answered row is checked and shows the answer', /d-chk done"><i><\/i><span>Garaje<\/span><small>Dónde está el panel<\/small>/.test(el('qb-list').innerHTML));
check('next unanswered question spins', /d-chk work"><i><\/i><span>Incluye permiso/.test(el('qb-list').innerHTML));
check('no dollar amounts on the card', !/\$\d/.test(el('qb-list').innerHTML));
render(qs,{'¿Dónde está el panel?':'Garaje','¿Incluye permiso?':'Sí'},2);
check('all answered: ready-to-build row', /Listo para generar/.test(el('qb-list').innerHTML)&&el('qb-bar').style.width==='100%');
render([],{},0);
check('no questions: card hidden', el('q-build').hidden===true);
check('card sits between the questions and the Build button', html.indexOf('id="q-build"')>html.indexOf('id="q-list"')&&html.indexOf('id="q-build"')<html.indexOf('id="calc-btn"'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
