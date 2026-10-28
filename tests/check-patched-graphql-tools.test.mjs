import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checkGraphqlToolsLock} from "../scripts/check-patched-graphql-tools.mjs";

const name="@graphql-tools/utils";
const base=()=>({lockfileVersion:3,packages:{"":{name:"vsn-page-builder",version:"1.0.0"}}});
const withCopy=(version,path="node_modules/@graphql-tools/utils")=>{
 const lock=base();
 lock.packages[path]={version};
 return lock;
};

test("actual merged development lockfile certifies fully removed vulnerability family",()=>{
 const pkg=JSON.parse(readFileSync("package.json","utf8"));
 const lock=JSON.parse(readFileSync("package-lock.json","utf8"));
 assert.deepEqual(checkGraphqlToolsLock(pkg,lock),{state:"absent",copies:0});
});
test("complete removal is accepted only with no direct declaration or abandoned override",()=>{
 assert.deepEqual(checkGraphqlToolsLock({},base()),{state:"absent",copies:0});
 for(const section of ["dependencies","devDependencies","optionalDependencies","peerDependencies"]){
  assert.throws(()=>checkGraphqlToolsLock({
   [section]:{[name]:"^12.0.4"}},base()),/directly declared/);
 }
 assert.throws(()=>checkGraphqlToolsLock({
  overrides:{[name]:"12.0.4"}},base()),/Unused GraphQL Tools override/);
});
test("a newly introduced GraphQL Tools copy must be patched, including nested copies",()=>{
 const lock=withCopy("12.0.4");
 lock.packages["node_modules/example/node_modules/"+name]={version:"12.0.2"};
 assert.deepEqual(checkGraphqlToolsLock({},lock),{state:"patched",copies:2});
 for(const version of ["11.9.99","12.0.0","12.0.1-beta.1","",null,"12.0.0-rc","13.0.0"]){
  assert.throws(()=>checkGraphqlToolsLock({},withCopy(version)),/Unpatched/);
 }
 const nested=withCopy("12.0.4");
 nested.packages["node_modules/parent/node_modules/"+name]={version:"11.0.0"};
 assert.throws(()=>checkGraphqlToolsLock({},nested),/Unpatched/);
});
test("malformed or deleted npm lockfile tree never passes missing dependency check",()=>{
 for(const invalid of [{},{packages:{}},{lockfileVersion:3,packages:[]},
  {lockfileVersion:1,packages:{}}]){
  assert.throws(()=>checkGraphqlToolsLock({},invalid),/Missing complete/);
 }
});
