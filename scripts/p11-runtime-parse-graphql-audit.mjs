import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');

const root=process.cwd();
let passed=0, failed=0;
function check(ok,label,detail=''){
  if(ok){passed++; console.log(`PASS ${label}`);} else {failed++; console.error(`FAIL ${label}${detail?`: ${detail}`:''}`);}
}

const extensions=new Set(['.js','.jsx','.ts','.tsx']);
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(extensions.has(path.extname(entry.name)))files.push(full);}}
walk(path.join(root,'app'));

const malformed=[];
for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  const lines=source.split(/\r?\n/);
  lines.forEach((line,index)=>{if(/#graphql\s+(query|mutation|subscription)\b/.test(line)) malformed.push(`${path.relative(root,file)}:${index+1}`);});
}
check(malformed.length===0,'No same-line #graphql operation markers',malformed.join(', '));

const docsFile=path.join(root,'app/components/dashboard/documentation/DocsContent.jsx');
const docsSource=fs.readFileSync(docsFile,'utf8');
const docsAst=ts.createSourceFile(docsFile,docsSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
const docsErrors=docsAst.parseDiagnostics||[];
check(docsErrors.length===0,'Documentation JSX parses cleanly',docsErrors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join(' | '));
check(docsSource.includes('return <div className="vsn-doc-stack">'),'FAQ fallback uses explicit container instead of fragile fragment');

const emailFile=path.join(root,'app/services/email-builder.server.js');
const emailSource=fs.readFileSync(emailFile,'utf8');
for(const op of ['VsnEmailPreviewShop','VsnEmailPreviewProduct','VsnEmailPreviewOrder']){
  check(new RegExp(`#graphql(?:\\\\n|\\s*\\n\\s*)query\\s+${op}\\b`).test(emailSource),`Email preview ${op} starts after #graphql newline`);
}

const baseline=JSON.parse(fs.readFileSync(path.join(root,'BASELINE.json'),'utf8'));
check(Number(String(baseline.version).split('.').at(-1))>=79,'Baseline is v2.5.79 or later');
check(/^(P\.|Q\.)/.test(String(baseline.milestone||'')),'Baseline retains the post-roadmap P/Q lineage');

console.log(`\nP.1.1 runtime hotfix audit: ${passed}/${passed+failed} PASS`);
if(failed) process.exit(1);
