import fs from 'node:fs';
import assert from 'node:assert/strict';
const config=JSON.parse(fs.readFileSync('config/theme-matrix.json','utf8'));
assert.ok(Array.isArray(config.targets)&&config.targets.length>=5,'Theme matrix must define at least five targets.');
const raw=String(process.env.VSN_E2E_THEME_MATRIX||'').trim();
const strict=process.env.NODE_ENV==='production'||process.env.VSN_RELEASE_STRICT==='1';
if(!raw){
  const msg='VSN_E2E_THEME_MATRIX not configured; target definitions are present but live theme URLs were not exercised.';
  if(strict){console.error(`FAIL ${msg}`);process.exit(1);} console.log(`WARN ${msg}`); process.exit(0);
}
let entries=[];try{entries=JSON.parse(raw);}catch{throw new Error('VSN_E2E_THEME_MATRIX must be JSON: [{"name":"Dawn","url":"https://..."}]');}
assert.ok(Array.isArray(entries)&&entries.length>=3,'Live theme matrix requires at least 3 theme URLs.');
for(const entry of entries){const response=await fetch(entry.url,{redirect:'follow'});assert.ok(response.status<500,`${entry.name||entry.url} returned ${response.status}`);console.log(`PASS ${entry.name||entry.url}: ${response.status}`);}
