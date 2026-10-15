import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {
 TARGET_BRANCH,TARGET_REPO,inspectEffectiveDevelopmentProtection,
 verifyEffectiveDevelopmentProtection
} from "../scripts/t013-effective-development-protection.mjs";

const branch=(protectedBranch=true,name=TARGET_BRANCH)=>({
 name,protected:protectedBranch,protection:{enabled:protectedBranch}
});
const rules=()=>[
 {type:"pull_request",parameters:{required_approving_review_count:1}},
 {type:"required_status_checks",parameters:{required_status_checks:[
  {context:"verify",integration_id:15368},
  {context:"dependency-graph",integration_id:15368},
 ]}},
 {type:"non_fast_forward"},
 {type:"deletion"},
];
const inspect=(b=branch(),r=rules())=>inspectEffectiveDevelopmentProtection(b,r);

test("real effective development rules with reviews and CI are scope-limited PASS",()=>{
 const proof=inspect();
 assert.equal(proof.ready,true);
 assert.deepEqual(proof.reasons,[]);
 assert.equal(proof.branch,"development");
 assert.equal(proof.statusCheckCount,2);
 assert(proof.explicitlyNotCertified.includes("environment_reviewers"));
 assert(proof.explicitlyNotCertified.includes("effective_ruleset_bypass"));
});
test("a protected main ruleset cannot count as development branch protection",()=>{
 for(const b of [branch(false),branch(true,"main"),null,{protected:true}]){
  const proof=inspect(b,rules());
  assert.equal(proof.ready,false);
  assert(proof.reasons.includes("DEVELOPMENT_BRANCH_NOT_PROTECTED"));
 }
});
test("no rules, malformed rules or force push permitted NEVER certify protection",()=>{
 for(const r of [[],{},null,rules().filter(x=>x.type!=="non_fast_forward"),
  rules().filter(x=>x.type!=="deletion")]){
  const proof=inspect(branch(),r);
  assert.equal(proof.ready,false);
 }
});
test("required human PR approval and actual status checks cannot be absent",()=>{
 const cases=[
  [{type:"pull_request",parameters:{required_approving_review_count:0}},"NO_REQUIRED_HUMAN_APPROVAL"],
  [{type:"pull_request",parameters:{}},"NO_REQUIRED_HUMAN_APPROVAL"],
  [{type:"required_status_checks",parameters:{required_status_checks:[]}},"NO_REQUIRED_CI_CHECKS"],
  [{type:"required_status_checks",parameters:{required_status_checks:[{context:""}]}},"NO_REQUIRED_CI_CHECKS"],
 ];
 for(const [bad,reason] of cases){
  const r=rules().map(item=>item.type===bad.type?bad:item);
  assert(inspect(branch(),r).reasons.includes(reason));
 }
});
test("the verifier sends exactly 2 read-only requests and never trusts supplied repo name",async()=>{
 const calls=[];
 const secret="synthetic-never-print-read-token";
 const fetcher=async(url,opts)=>{
  calls.push({url,method:opts.method,redirect:opts.redirect,accept:opts.headers.Accept,
   auth:opts.headers.Authorization});
  return {ok:true,json:async()=>url.endsWith("/branches/development")?branch():rules()};
 };
 const result=await verifyEffectiveDevelopmentProtection({
  token:secret,fetcher,repo:TARGET_REPO
 });
 assert.equal(result.ready,true);
 assert.equal(calls.length,2);
 assert(calls.every(x=>x.method==="GET"&&x.redirect==="error"));
 assert(calls.every(x=>x.auth==="Bearer "+secret));
 assert(calls.every(x=>x.url.startsWith("https://api.github.com/repos/"+TARGET_REPO+"/")));
 assert.doesNotMatch(JSON.stringify(result),/synthetic-never-print/);
 await assert.rejects(verifyEffectiveDevelopmentProtection({
  token:secret,repo:"attacker/alternate",fetcher,
 }),/REPOSITORY_MISMATCH/);
});
test("GitHub 403/404 or a missing token fail closed without leaking response",async()=>{
 const token="synthetic-never-leak";
 const err=()=>({ok:false,status:403,text:async()=>token,json:async()=>({token})});
 await assert.rejects(verifyEffectiveDevelopmentProtection({token,fetcher:async()=>err()}),
  e=>e.message==="T013_GITHUB_PROTECTION_API_UNAVAILABLE"&&!e.message.includes(token));
 await assert.rejects(verifyEffectiveDevelopmentProtection({token:"",fetcher:async()=>err()}),
  /READ_TOKEN_MISSING/);
});
test("CLI refuses unprotected or incorrect workflow refs before touching GitHub API",()=>{
 for(const env of [
  {GITHUB_REPOSITORY:TARGET_REPO,GITHUB_REF:"refs/heads/development",GITHUB_REF_PROTECTED:"false"},
  {GITHUB_REPOSITORY:TARGET_REPO,GITHUB_REF:"refs/heads/main",GITHUB_REF_PROTECTED:"true"},
  {GITHUB_REPOSITORY:"other/private",GITHUB_REF:"refs/heads/development",GITHUB_REF_PROTECTED:"true"},
 ]){
  const out=spawnSync(process.execPath,["scripts/t013-effective-development-protection.mjs"],{
   env:{PATH:process.env.PATH,...env,GITHUB_TOKEN:"synthetic-never-print"},
   encoding:"utf8",timeout:3000
  });
  assert.equal(out.status,1);
  assert.match(out.stderr,/T013_GITHUB_PROTECTION_WRONG_OR_UNPROTECTED_REF/);
  assert.doesNotMatch(out.stderr,/synthetic-never-print/);
 }
});
