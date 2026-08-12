// Verifies the prompt restructure: block order, breakpoint placement, and that no
// prompt content was lost in the split.
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;
const check=(n,c,d)=>{c?(pass++,console.log(`  PASS  ${n}`)):(fail++,console.log(`  FAIL  ${n}\n         ${d}`))};

const api=new Function(html.slice(html.indexOf('function applyCacheBreakpoint'),html.indexOf('async function callClaude('))+
  '\n;return {applyCacheBreakpoint};')();
const {applyCacheBreakpoint}=api;

console.log('\n=== Cache breakpoint placement ===');
const blocks=[{type:'text',text:'RULES'},{type:'text',text:'MARKET',cache_control:{type:'ephemeral'}},{type:'text',text:'JOB'}];
let body={};
applyCacheBreakpoint(body,[{role:'user',content:blocks}],true);
check('caller-placed breakpoint is respected, not overwritten',body.messages===undefined,
  'helper rewrote a payload that already had a breakpoint');
check('breakpoint is on MARKET (block 1), not RULES',!!blocks[1].cache_control&&!blocks[0].cache_control);
check('the volatile JOB block is NOT cached',!blocks[2].cache_control);

body={};
applyCacheBreakpoint(body,[{role:'user',content:'plain string prompt'}],true);
check('a plain string prompt still gets wrapped and cached',
  body.messages[0].content[0].cache_control?.type==='ephemeral');

body={};
const unmarked=[{type:'text',text:'a'},{type:'text',text:'b'}];
applyCacheBreakpoint(body,[{role:'user',content:unmarked}],true);
check('unmarked blocks fall back to caching the first',
  body.messages[0].content[0].cache_control?.type==='ephemeral'&&!body.messages[0].content[1].cache_control);

body={};
applyCacheBreakpoint(body,[{role:'user',content:blocks}],false);
check('useCache=false writes nothing',body.messages===undefined);
body={};
applyCacheBreakpoint(body,[{role:'assistant',content:'x'}],true);
check('non-user first message is left alone',body.messages===undefined);
body={};
applyCacheBreakpoint(body,[],true);
check('empty messages is safe',body.messages===undefined);

console.log('\n=== Prompt content survived the split ===');
const src=html.slice(html.indexOf('  const RULES=`'),html.indexOf('  const promptBlocks=['));
for(const frag of [
  'HARD RULE: when direct labor + material cost is under $5,000',
  'Material delivery & logistics is a real supplier delivery charge',
  'Debris removal scales to actual debris volume',
  'MARGIN PROTECTORS',
  'Compute all math correctly',
  '"projectName":"string"',
  'punch list & touch-up labor',
]) check(`RULES still carries: "${frag.slice(0,44)}…"`, src.includes(frag));
for(const frag of ['SCOPE:${scope}','ANSWERS:${ansText}','EXTRACTED:','Trade:${ctx.trade}','${calibrationNote}',
                   'getSupplierPromptContext()','getSubPromptContext()'])
  check(`JOB still carries: ${frag}`, src.includes(frag));
check('MARKET block is the pricing block', /const MARKET=`\$\{pricingBlock\}`/.test(src));

console.log('\n=== Order is stable → volatile ===');
const iR=src.indexOf('const RULES'), iM=src.indexOf('const MARKET'), iJ=src.indexOf('const JOB');
check(`RULES(${iR}) < MARKET(${iM}) < JOB(${iJ})`, iR<iM&&iM<iJ);
check('scope text is NOT inside the cached prefix',
  src.indexOf('SCOPE:${scope}')>src.indexOf('const JOB'));

console.log('\n=== Request config ===');
check("estimate runs at medium effort", /const ESTIMATE_EFFORT='medium'/.test(html));
check('streaming call passes effort + onThinking',
  /callClaudeStream\(\[\{role:'user',content:promptBlocks\}\],12000,onDelta,true,\{effort:ESTIMATE_EFFORT,onThinking\}\)/.test(html));
check('non-streaming fallback passes effort too',
  /callClaude\(\[\{role:'user',content:promptBlocks\}\],12000,true,ESTIMATE_EFFORT\)/.test(html));
check('thinking summary requested only when a consumer exists',
  /if\(opts\.onThinking\) body\.thinking=\{type:'adaptive',display:'summarized'\}/.test(html));
check('thinking_delta is consumed by the stream parser',
  /delta\?\.type==='thinking_delta'/.test(html));

console.log('\n=== Progress bar arithmetic ===');
check('scripted phases now end at 20%, not 56%', /let progShown=20/.test(html));
check('line items span 60→96%', /setProg\(60\+Math\.min\(rendered\/EXPECT,1\)\*36/.test(html));
check('thinking creep is time-based, capped below the line-item floor',
  /if\(thinkBuf\)\{ setProg\(Math\.min\(progShown\+1\.6,58\)\); return; \}/.test(html));
check('thinking text never opens mid-word', /if\(sp>0&&sp<40\) tail=tail\.slice\(sp\+1\)/.test(html));
check('scripted phase 1 ends at 10%, phase 2 at 20% — no rewind into phase 3',
  /phase1Lines\.length\*10/.test(html) && /10\+Math\.round\(\(i\+1\)\/phase2Lines\.length\*10\)/.test(html));
check('backstop creep capped below the thinking band', /Math\.min\(progShown\+0\.8,44\)/.test(html));
check('monotonic guard still present', /progShown=Math\.max\(progShown,v\)/.test(html));

console.log(`\n──────────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
