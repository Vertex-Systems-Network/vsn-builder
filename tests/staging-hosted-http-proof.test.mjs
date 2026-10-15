import test from "node:test";
import assert from "node:assert/strict";
import { probeStagingHostedRuntime } from "../scripts/staging-hosted-http-proof.mjs";

const origin = "https://stage-builder.example.org";
const ready = {
  service: "VSN Builder", tier: "staging",
  merchantAppReady: true, shopifyOauthReady: true,
  persistentSessionsReady: true, merchantRoutesReady: true,
};
const health = {
  service: "VSN Builder", tier: "staging", liveness: true,
  merchantAppReady: true,
};
const json = (payload, status=200) => Response.json(payload, {status, headers: {
  "cache-control": "no-store", "x-content-type-options": "nosniff",
}});
const response = (status, headers={}) => new Response(null, {
  status, headers: { "cache-control":"no-store", ...headers },
});
const fixture = (overrides={}) => {
  const captured = [];
  const fetchImpl = async (url,options) => {
    captured.push({path: url.pathname, origin: url.origin, options});
    return (overrides[url.pathname] || {
      "/healthz": json(health),
      "/readyz": json(ready),
      "/app": response(302, {location:origin+"/auth/login"}),
    }[url.pathname]);
  };
  return {fetchImpl,captured};
};

test("only observed healthy staging liveness, merchant readiness and app routing count", async()=>{
  const mock=fixture();
  const report=await probeStagingHostedRuntime(origin,{fetchImpl:mock.fetchImpl});
  assert.deepEqual([report.liveness,report.merchantReady,report.merchantRoute], [true,true,true]);
  assert.deepEqual(mock.captured.map(row=>row.path),["/healthz","/readyz","/app"]);
  for(const c of mock.captured){
    assert.equal(c.origin,origin);
    assert.equal(c.options.redirect,"manual");
    assert.equal(c.options.credentials,"omit");
    assert.equal(c.options.method,"GET");
    assert.equal(c.options.headers.authorization,undefined);
    assert.equal(c.options.headers.cookie,undefined);
  }
});
test("placeholder Worker health does not constitute a hosted Shopify merchant application", async()=>{
  const mock=fixture({
    "/healthz": json({...health,merchantAppReady:false}),
    "/readyz": response(503),
    "/app": response(503),
  });
  const report=await probeStagingHostedRuntime(origin,{fetchImpl:mock.fetchImpl});
  assert.equal(report.liveness,true);
  assert.equal(report.merchantReady,false);
  assert.equal(report.merchantRoute,false);
  assert.equal(report.readyStatus,503);
});
test("JSON 200 without OAuth and sessions is not readiness", async()=>{
  const mock=fixture({"/readyz":json({...ready,shopifyOauthReady:false})});
  const proof=await probeStagingHostedRuntime(origin,{fetchImpl:mock.fetchImpl});
  assert.equal(proof.merchantReady,false);
});
test("wrong tier, content type and caching block liveness", async()=>{
  for(const bad of [
    json({...health,tier:"production"}),
    new Response("ok",{status:200,headers:{"content-type":"text/plain"}}),
    Response.json(health),
  ]){
    const proof=await probeStagingHostedRuntime(origin,{fetchImpl:fixture({"/healthz":bad}).fetchImpl});
    assert.equal(proof.liveness,false);
    assert.equal(proof.merchantReady,false);
    assert.equal(proof.merchantRoute,false);
  }
});
test("unsafe external redirects, locked routes and missing no-store are rejected",async()=>{
  for(const bad of [
    response(302,{location:"https://evil.example.org/steal"}),
    response(503),
    new Response("<html>ok</html>",{status:200,headers:{"content-type":"text/html"}}),
  ]){
    const proof=await probeStagingHostedRuntime(origin,{fetchImpl:fixture({"/app":bad}).fetchImpl});
    assert.equal(proof.merchantRoute,false);
  }
});
test("malformed and ephemeral URLs perform no fetch, errors reveal no secrets",async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;throw Error("secret DATABASE_URL=postgresql://never-leak");};
  for(const value of ["http://stage-builder.example.org", "https://example.com",
    "https://fake.trycloudflare.com", "https://user:secret@stage-builder.example.org"]){
    const proof=await probeStagingHostedRuntime(value,{fetchImpl});
    assert.equal(proof.liveness,false);
    assert.equal(proof.origin,null);
  }
  assert.equal(calls,0);
  const proof=await probeStagingHostedRuntime(origin,{fetchImpl});
  assert.equal(proof.liveness,false);
  assert.equal(proof.readyStatus,null);
  assert.equal(proof.merchantStatus,null);
  assert.equal(JSON.stringify(proof).includes("DATABASE_URL"),false);
});
test("oversized JSON body cannot claim readiness",async()=>{
  const large={...ready,filler:"x".repeat(12000)};
  const mock=fixture({"/readyz":json(large)});
  const proof=await probeStagingHostedRuntime(origin,{fetchImpl:mock.fetchImpl});
  assert.equal(proof.merchantReady,false);
});
