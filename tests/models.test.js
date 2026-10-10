// Models (user 2026-10-10): the server picks the model for every job, from
// Railway env vars (EVEN_MAIN_MODEL / EVEN_LIGHT_MODEL), never from the browser.
// Main jobs default to Claude Opus 5.5 with Anthropic's refusal fallback; light
// jobs default to Claude Haiku 5.5 with thinking off (small output caps). A
// refusal is never cached and comes back to the app as a refusal, not a blank.
const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const G=()=>{delete require.cache[require.resolve('../lib/guard')];return require('../lib/guard');};
const {ESTIMATE_RULES}=G();
const scope=t=>({even_kind:'scope',max_tokens:3000,output_config:{effort:'low'},messages:[{role:'user',content:[{type:'text',text:'Construction estimating. Trade:Electrical|Location:Aventura\nSCOPE: '+t}]}]});
const est=t=>({even_kind:'estimate',max_tokens:24000,stream:true,thinking:{type:'adaptive',display:'summarized'},output_config:{effort:'medium'},messages:[{role:'user',content:[{type:'text',text:ESTIMATE_RULES},{type:'text',text:'CATALOG'},{type:'text',text:`Trade:Electrical|Location:Aventura\nLanguage:English\nSCOPE:${t}\nANSWERS:\nEXTRACTED:[]`}]}]});
const beautify={even_kind:'beautify',max_tokens:500,messages:[{role:'user',content:'You are a professional proposal writer for contractors. Rewrite x'}]};

console.log('\n=== The server decides the model ===');
delete process.env.EVEN_MAIN_MODEL; delete process.env.EVEN_LIGHT_MODEL;
let g=G();
const s1=g.buildRequest(scope('panel'));
check('main jobs default to claude-opus-5-5', s1.body.model==='claude-opus-5-5', s1.body.model);
check('main jobs get the refusal fallback', s1.body.fallbacks==='default');
const b1=g.buildRequest(beautify);
check('light jobs default to claude-haiku-5-5', b1.body.model==='claude-haiku-5-5', b1.body.model);
check('light jobs: thinking off, no fallback (Haiku has none)', b1.body.thinking&&b1.body.thinking.type==='disabled'&&!b1.body.fallbacks, JSON.stringify(b1.body));
const named=g.buildRequest({...scope('panel'),model:'claude-fable-5-1'});
check('a model named by the browser is ignored', named.body.model==='claude-opus-5-5', named.body.model);
check('a non-string model is rejected', g.buildRequest({...scope('x'),model:{evil:1}}).error==='bad_model');
const e1=g.buildRequest(est('panel'));
check('estimate keeps effort medium and summarized thinking', e1.body.output_config.effort==='medium'&&e1.body.thinking.type==='adaptive', JSON.stringify(e1.body.output_config));
process.env.EVEN_MAIN_MODEL='claude-sonnet-5'; process.env.EVEN_LIGHT_MODEL='claude-haiku-4-5';
g=G();
const s2=g.buildRequest(scope('panel')),b2=g.buildRequest(beautify);
check('flip on Railway: EVEN_MAIN_MODEL takes effect', s2.body.model==='claude-sonnet-5', s2.body.model);
check('no fallback sent to a model that does not take it', !s2.body.fallbacks);
check('flip on Railway: EVEN_LIGHT_MODEL takes effect, old Haiku keeps its default thinking', b2.body.model==='claude-haiku-4-5'&&!b2.body.thinking, JSON.stringify(b2.body));
delete process.env.EVEN_MAIN_MODEL; delete process.env.EVEN_LIGHT_MODEL;
check('the browser no longer names a model', !/model:'claude-|model: 'claude-/.test(html));

console.log('\n=== Through the real server (Anthropic mocked) ===');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'even-models-'));
const DB=path.join(dir,'db.json'),LOG=path.join(dir,'log.txt');fs.writeFileSync(LOG,'');
const port=40100+Math.floor(Math.random()*300);
const reqs=()=>fs.readFileSync(LOG,'utf8').split('\n').filter(x=>x.startsWith('req ')).map(x=>JSON.parse(x.slice(4)));
(async()=>{
  const p=await new Promise((res,rej)=>{const c=spawn(process.execPath,[path.join(__dirname,'helpers','scope-cache-server.js')],{env:{...process.env,PORT:String(port),FAKE_DB:DB,FAKE_LOG:LOG,RATE_LIMIT_SCALE:'20'},stdio:['ignore','pipe','pipe']});c.stdout.on('data',d=>{if(/running on port/.test(d))res(c);});c.on('exit',x=>rej(new Error('exit '+x)));});
  const H={'content-type':'application/json',origin:'https://even-os.com','x-even-device':'dev-models-test-000000','x-forwarded-for':'203.0.113.77','user-agent':'ModelsTest','X-Even-Cache':'1'};
  const post=b=>fetch(`http://localhost:${port}/api/estimate`,{method:'POST',headers:H,body:JSON.stringify(b)});
  const health=await (await fetch(`http://localhost:${port}/health`)).json();
  check('/health shows the live models', health.models&&health.models.main==='claude-opus-5-5'&&health.models.light==='claude-haiku-5-5', JSON.stringify(health.models));
  let r=await post(scope('a fresh panel job')); await r.json();
  let last=reqs().pop();
  check('scope went to Anthropic on Opus 5.5 with the fallback beta header', last.model==='claude-opus-5-5'&&last.fallbacks==='default'&&/server-side-fallback-2026-07-01/.test(last.beta)&&/prompt-caching/.test(last.beta), JSON.stringify(last));
  r=await post(scope('REFUSE_ME panel')); const j=await r.json();
  check('a refusal comes back to the app as a refusal', j.stop_reason==='refusal', JSON.stringify(j));
  const n=reqs().length; r=await post(scope('REFUSE_ME panel')); await r.json();
  check('a refusal is never cached (the same request asks again)', reqs().length===n+1&&r.headers.get('x-even-cache')==='miss', r.headers.get('x-even-cache'));
  check('the app turns a refusal into a plain message, both paths', (html.match(/throw refusalError\(\)/g)||[]).length>=3&&/Reword the job description/.test(html)&&/Cambia un poco la descripción/.test(html));
  p.kill();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
