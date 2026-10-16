import test from "node:test";
import assert from "node:assert/strict";
import {verifyStagingNeonControlPlane} from "../scripts/phase3-staging-neon-live-proof.mjs";
import targets from "../config/deployment/environments.json" with {type:"json"};

const stage=targets.staging;
const host=stage.neon_endpoint_host;
function credentials(extra={}) {
 return {
  GITHUB_REF:"refs/heads/development",GITHUB_REF_PROTECTED:"true",
  GITHUB_EVENT_NAME:"workflow_dispatch",APP_ENV:"staging",
  NEON_PROJECT_ID:stage.neon_project_id,
  SHOPIFY_BILLING_TEST_MODE:"true",STAGING_MIGRATION_APPROVED:"true",
  VSN_STAGING_BACKUP_EVIDENCE:stage.neon_pre_migration_snapshot_id,
  NEON_API_KEY:"synthetic-not-a-real-api-token",
  DATABASE_URL:`postgresql://synthetic:private@${host.replace(".","-pooler.")}/staging?sslmode=require`,
  DIRECT_URL:`postgresql://synthetic:private@${host}/staging?sslmode=require`,
  ...extra,
 };
}
function fixtures() {
 return {
  branches:[
   {id:stage.neon_default_branch_id,project_id:stage.neon_project_id,default:true,primary:true,protected:false},
   {id:stage.neon_recovery_source_branch_id,project_id:stage.neon_project_id,default:false},
  ],
  snapshots:[{id:stage.neon_pre_migration_snapshot_id,
    source_branch_id:stage.neon_recovery_source_branch_id,created_at:"2026-10-13T21:39:35Z"}],
  endpoints:[{id:stage.neon_endpoint_id,branch_id:stage.neon_default_branch_id,
    project_id:stage.neon_project_id,host:stage.neon_endpoint_host,
    pooler_enabled:true,pooler_mode:"transaction"}],
 };
}
function fakeApi(data=fixtures(),{status=200,truncate=null}={}) {
 let called=[];
 const fn=async(url,req)=>{
  const type=new URL(url).pathname.split("/").at(-1);
  called.push(type);
  assert.equal(req.method,"GET");
  assert.equal(req.redirect,"error");
  assert.equal(req.headers.authorization,"Bearer synthetic-not-a-real-api-token");
  assert.match(url,/\/projects\/shiny-violet-61219572\//);
  return {ok:status===200,status,async json(){
   return {[type]:data[type], ...(truncate===type?{pagination:{next:"next-page"}}:{})};
  }};
 };
 return {fn,called};
}
test("real API snapshot and restored default compute prove shape without any mutations",async()=>{
 const a=fakeApi();
 const result=await verifyStagingNeonControlPlane(credentials(),{fetchImpl:a.fn});
 assert.equal(result.ready,true);
 assert.equal(result.snapshotId,stage.neon_pre_migration_snapshot_id);
 assert.equal(result.defaultBranchId,stage.neon_default_branch_id);
 assert.equal(result.primaryProtected,false);
 assert.equal(result.freeTierPolicyApplied,true);
 assert.deepEqual(a.called.sort(),["branches","endpoints","snapshots"]);
});
test("missing secrets, unprotected branch and invented snapshot block BEFORE API calls",async()=>{
 for(const extra of [
  {NEON_API_KEY:""},{GITHUB_REF_PROTECTED:"false"},
  {GITHUB_REF:"refs/heads/main"},{APP_ENV:"production"},
  {VSN_STAGING_BACKUP_EVIDENCE:"br-wandering-queen-b3mmztjy"},
  {VSN_STAGING_BACKUP_EVIDENCE:"snap-invented-98765432"},
 ]) {
  const a=fakeApi();
  await assert.rejects(verifyStagingNeonControlPlane(credentials(extra),{fetchImpl:a.fn}),
    /Staging Neon control-plane proof blocked/);
  assert.equal(a.called.length,0,"invalid configuration used Neon token");
 }
});
test("real API response must certify original backup, restored branch, endpoint and pooler",async()=>{
 const invalid=[
  a=>{a.snapshots=[]},
  a=>{a.snapshots[0].source_branch_id=stage.neon_default_branch_id},
  a=>{a.snapshots[0].created_at="bad-date"},
  a=>{delete a.branches[0].protected},
  a=>{a.branches[0].protected="true"},
  a=>{a.branches[0].protected=null},
  a=>{a.branches[0].default=false},
  a=>{a.branches[0].id=stage.neon_recovery_source_branch_id},
  a=>{a.branches[1].id="br-unknown"},
  a=>{a.endpoints[0].pooler_enabled=false},
  a=>{a.endpoints[0].branch_id=stage.neon_recovery_source_branch_id},
  a=>{a.endpoints[0].host=targets.production.neon_endpoint_host},
  a=>{a.endpoints[0].project_id=targets.production.neon_project_id},
 ];
 for(const mutate of invalid){
  const a=fixtures();mutate(a);
  await assert.rejects(verifyStagingNeonControlPlane(credentials(),{
   fetchImpl:fakeApi(a).fn,
  }),/Staging Neon control-plane proof blocked/);
 }
});
test("Neon Free-plan Staging is valid only with reviewed source, real snapshot and exact isolated compute",async()=>{
 const branch=fixtures();
 assert.equal(branch.branches[0].protected,false);
 const attestation=await verifyStagingNeonControlPlane(credentials(),{
  fetchImpl:fakeApi(branch).fn,
 });
 assert.equal(attestation.ready,true);
 assert.equal(attestation.primaryProtected,false);
 assert.equal(attestation.freeTierPolicyApplied,true);
 // Even under the Free-plan exception, any other Neon project endpoint
 // or removed source backup is forbidden; no SQL migration is attempted.
 for(const mutate of [
  value=>{value.snapshots[0].source_branch_id=stage.neon_default_branch_id},
  value=>{value.endpoints[0].host=targets.production.neon_endpoint_host},
  value=>{value.branches[0].id=targets.production.neon_default_branch_id},
 ]){
  const data=fixtures();mutate(data);
  await assert.rejects(verifyStagingNeonControlPlane(credentials(),{
   fetchImpl:fakeApi(data).fn,
  }),/Staging Neon control-plane proof blocked/);
 }
 const production=credentials({APP_ENV:"production"});
 const untouched=fakeApi();
 await assert.rejects(verifyStagingNeonControlPlane(production,{fetchImpl:untouched.fn}),/blocked/);
 assert.equal(untouched.called.length,0);
});
test("a protected Neon Staging primary is also valid, but not mandatory on Free",async()=>{
 const branch=fixtures();
 branch.branches[0].protected=true;
 const result=await verifyStagingNeonControlPlane(credentials(),{fetchImpl:fakeApi(branch).fn});
 assert.equal(result.primaryProtected,true);
 assert.equal(result.freeTierPolicyApplied,false);
});

test("Neon API errors, truncated metadata or missing collection fail closed",async()=>{
 await assert.rejects(verifyStagingNeonControlPlane(credentials(),{
  fetchImpl:fakeApi(fixtures(),{status:401}).fn,
 }),/blocked/);
 await assert.rejects(verifyStagingNeonControlPlane(credentials(),{
  fetchImpl:fakeApi(fixtures(),{truncate:"snapshots"}).fn,
 }),/blocked/);
 const bad=fixtures();delete bad.snapshots;
 await assert.rejects(verifyStagingNeonControlPlane(credentials(),{
  fetchImpl:fakeApi(bad).fn,
 }),/blocked/);
});
