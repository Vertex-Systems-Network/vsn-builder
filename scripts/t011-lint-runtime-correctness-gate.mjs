// Strict, non-waived ESLint gate for correctness defects fixed in T011.
// We run the ACTUAL repository ESLint configuration; no rules are disabled.
// The full 4k+ baseline must be remediated separately before global lint PASS.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const targets=[
  {path:"app/components/editor/Canvas.jsx",rules:["react-hooks/rules-of-hooks"]},
  {path:"app/routes/app.editor-media.jsx",rules:["no-undef"]},
  {path:"app/data/sectionPresets.js",rules:["no-sparse-arrays"]},
];
const paths=targets.map(t=>t.path);
const result=spawnSync(process.execPath,[
  "./node_modules/eslint/bin/eslint.js","--no-cache",
  "--format","json",...paths,
],{encoding:"utf8",timeout:45000,maxBuffer:16*1024*1024});
assert.equal(result.error,undefined,String(result.error));
if(result.signal)throw Error("ESLint interrupted: "+result.signal);
assert.ok([0,1].includes(result.status),"ESLint invocation failed: "+String(result.stderr).slice(0,800));
let report;
try{report=JSON.parse(result.stdout)}catch{
  throw Error("ESLint did not return valid JSON: "+String(result.stderr).slice(0,800));
}
assert.equal(report.length,targets.length,"Every changed runtime source must be linted");
const failures=[];
let unrelated=0;
for(const file of report){
  const target=targets.find(t=>file.filePath.replaceAll("\\","/").endsWith("/"+t.path));
  assert.ok(target,"Unexpected linted source "+file.filePath);
  for(const message of file.messages){
    if(message.severity!==2)continue;
    if(target.rules.includes(message.ruleId)){
      failures.push(target.path+":"+message.line+" "+message.ruleId+" "+message.message);
    }else unrelated++;
  }
}
assert.deepEqual(failures,[],"New/remaining runtime-correctness ESLint violations");
console.log("PASS: actual configured ESLint verifies all "+targets.length+" targeted runtime defects");
console.log("Existing unrelated ESLint errors remain visible as debt: "+unrelated);
