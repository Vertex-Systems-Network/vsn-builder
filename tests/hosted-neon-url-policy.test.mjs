import test from "node:test";
import assert from "node:assert/strict";
import {inspectHostedNeonRuntimeUrl,inspectHostedNeonUrlPair} from "../app/services/neon-target-policy.js";

const hosts={
  staging:"ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech",
  production:"ep-jolly-truth-b3xbibzp.c-4.ap-southeast-1.aws.neon.tech",
};
const url=(host,db="neondb",user="builder_user",extra="")=>
  "postgresql://"+encodeURIComponent(user)+":fake-ci-pass@"+host+"/"+db+"?sslmode=require"+extra;
const pooler=host=>host.replace(".c-4.","-pooler.c-4.");
const env=tier=>({
  DATABASE_URL:url(pooler(hosts[tier])),
  DIRECT_URL:url(hosts[tier]),
});

for(const tier of ["staging","production"]){
  test(tier+" accepts only matching pooled runtime and direct migration target",()=>{
    assert.equal(inspectHostedNeonUrlPair(tier,env(tier)).ready,true);
    assert.equal(inspectHostedNeonRuntimeUrl(tier,env(tier).DATABASE_URL).ready,true);
    const directRuntime={DATABASE_URL:url(hosts[tier], "neondb","builder_user","&application_name=local-ci"),
      DIRECT_URL:url(hosts[tier])};
    assert.equal(inspectHostedNeonUrlPair(tier,directRuntime).ready,true);
  });
  test(tier+" refuses opposite tier DIRECT_URL even when runtime DB is correct",()=>{
    const other=tier==="staging"?"production":"staging";
    const report=inspectHostedNeonUrlPair(tier,{
      ...env(tier),DIRECT_URL:env(other).DIRECT_URL,
    });
    assert.equal(report.ready,false);
    assert(report.issues.some(x=>x.includes("direct Neon endpoint")));
  });
  test(tier+" refuses opposite tier DATABASE_URL even when migration DB is correct",()=>{
    const other=tier==="staging"?"production":"staging";
    const report=inspectHostedNeonUrlPair(tier,{
      ...env(tier),DATABASE_URL:env(other).DATABASE_URL,
    });
    assert.equal(report.ready,false);
    assert(report.issues.some(x=>x.includes("runtime Neon endpoint")));
  });
  test(tier+" refuses different DB names and role names",()=>{
    assert(inspectHostedNeonUrlPair(tier,{
      ...env(tier),DIRECT_URL:url(hosts[tier],"different_database"),
    }).issues.some(x=>x.includes("canonical Builder database identity")));
    assert(inspectHostedNeonUrlPair(tier,{
      ...env(tier),DIRECT_URL:url(hosts[tier],"neondb","other_db_user"),
    }).issues.includes("Runtime and migration database roles differ"));
  });
  test(tier+" rejects a same-compute alternate DB for both runtime and migration",()=>{
    for(const pathname of ["brovexa","other_tenant","%6eeondb","neondb%00",""]){
      const bad=url(pooler(hosts[tier]),pathname);
      assert.equal(inspectHostedNeonRuntimeUrl(tier,bad).ready,false);
      const pair=inspectHostedNeonUrlPair(tier,{
        DATABASE_URL:bad,
        DIRECT_URL:url(hosts[tier],pathname),
      });
      assert.equal(pair.ready,false);
      assert(pair.issues.some(x=>x.includes("canonical Builder database identity")));
    }
  });
  test(tier+" rejects TLS downgrade, wrong port, fake host and pooled migration",()=>{
    const valid=env(tier);
    for(const [key,value] of [
      ["DIRECT_URL",valid.DIRECT_URL.replace("sslmode=require","sslmode=disable")],
      ["DIRECT_URL",valid.DIRECT_URL+"&sslmode=disable"],
      ["DATABASE_URL",valid.DATABASE_URL+"&sslmode=disable"],
      ["DIRECT_URL",valid.DIRECT_URL+"&sslmode=require"],
      ["DATABASE_URL",valid.DATABASE_URL+"#ignored-connection-fragment"],
      ["DIRECT_URL",valid.DIRECT_URL.replace(".neon.tech/",".neon.tech:6432/")],
      ["DIRECT_URL",valid.DIRECT_URL.replace(hosts[tier],pooler(hosts[tier]))],
      ["DATABASE_URL",valid.DATABASE_URL.replace(hosts[tier].slice(0,3),"xx-")],
      ["DATABASE_URL",valid.DATABASE_URL.replace("postgresql:","file:")],
    ]){
      assert.equal(inspectHostedNeonUrlPair(tier,{...valid,[key]:value}).ready,false,key);
    }
  });
  test(tier+" does not leak credentials or connection string in diagnostics",()=>{
    const bad={...env(tier),DIRECT_URL:"postgresql://sensitive_user:sensitive_password@evil.example.test/a?sslmode=disable"};
    const report=inspectHostedNeonUrlPair(tier,bad);
    assert.equal(report.ready,false);
    assert(!JSON.stringify(report).includes("sensitive_user"));
    assert(!JSON.stringify(report).includes("sensitive_password"));
    assert(!JSON.stringify(report).includes("evil.example.test"));
  });
  test(tier+" forbids missing or identical direct URL",()=>{
    const cfg=env(tier);
    assert.equal(inspectHostedNeonUrlPair(tier,{DATABASE_URL:cfg.DATABASE_URL}).ready,false);
    assert.equal(inspectHostedNeonUrlPair(tier,{DATABASE_URL:cfg.DIRECT_URL,DIRECT_URL:cfg.DIRECT_URL}).ready,false);
  });
}
test("unknown tiers cannot become an authorized migration target",()=>{
  assert.equal(inspectHostedNeonUrlPair("development",env("staging")).ready,false);
  assert.equal(inspectHostedNeonRuntimeUrl("test",env("staging").DATABASE_URL).ready,false);
});
