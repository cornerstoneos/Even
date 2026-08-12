#!/usr/bin/env bash
# Test suites live in the repo, not a scratch directory — a scratch cleanup once
# wiped an entire session's worth of them mid-review.
set -u
cd "$(dirname "$0")/.."
fail=0
for f in tests/*.test.js; do
  printf '%-34s ' "$(basename "$f")"
  if out=$(node "$f" 2>&1); then echo "$out" | grep -E 'passed,' | tail -1
  else echo "FAILED"; echo "$out" | tail -20; fail=1; fi
done
node --check server.js && echo "server.js                          syntax OK" || fail=1
node - <<'JS' || fail=1
const fs=require('fs'),os=require('os'),p=require('path'),{execFileSync}=require('child_process');
const s=fs.readFileSync('index.html','utf8');
const blocks=[...s.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
blocks.forEach((m,i)=>{const f=p.join(os.tmpdir(),`even-block-${i}.js`);fs.writeFileSync(f,m[1]);execFileSync('node',['--check',f]);});
console.log(`inline scripts (${blocks.length})                 syntax OK`);
JS
exit $fail
