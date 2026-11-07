// Spanish link + header crowding (Nov 7 build A). The browser check is
// tests/acceptance/header-lang-2026-11-07.js; these guard the wiring.
const fs=require('fs'),path=require('path');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d||''}`))};
const s=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fn=name=>{const i=s.indexOf('function '+name+'(');return i<0?'':s.slice(i,s.indexOf('\n}',i)+2);};
// Load initialLang alone with a fake location/localStorage.
const pick=(search,saved,throws)=>new Function('location','localStorage',fn('initialLang')+';return initialLang();')(
  {search},{getItem(){if(throws)throw new Error('blocked');return saved;}});
check('?lang=es opens Spanish', pick('?lang=es',null)==='es');
check('the link wins over the saved choice', pick('?lang=en','es')==='en'&&pick('?lang=es','en')==='es');
check('no link: the saved choice', pick('','es')==='es');
check('no link, nothing saved: English', pick('',null)==='en');
check('junk values are ignored', pick('?lang=fr','xx')==='en');
check('storage blocked: no crash, link still works', pick('?lang=es',null,true)==='es'&&pick('',null,true)==='en');
const sl=fn('setLang');
check('setLang remembers the choice inside try/catch', /try\{\s*localStorage\.setItem\('even_lang',lang\);\s*\}catch/.test(sl), sl.slice(0,200));
check('the start-up applies the language on DOMContentLoaded', /addEventListener\('DOMContentLoaded',\(\)=>\{\s*const l=initialLang\(\)/.test(s));
check('topbar grid gives the wordmark only the middle space', /grid-template-columns:auto minmax\(0,1fr\) auto/.test(s));
check('wordmark steps aside when it does not fit (fitTopbar after the badge updates)', /function fitTopbar\(\)/.test(s)&&/updateAuthPanel\(\);\s*fitTopbar\(\);/.test(s));
check('phones: theme and folder icons leave the header, theme is in the menu',
  /@media\(max-width:480px\)\{[\s\S]{0,300}\.topbar \.theme-btn,#dashboard-topbar-btn\{display:none!important\}/.test(s)&&/onclick="toggleTheme\(\)"><i data-lucide="moon"[^>]*><\/i><span data-es="Modo claro \/ oscuro">Light \/ dark mode/.test(s));
console.log(`\n──────────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
