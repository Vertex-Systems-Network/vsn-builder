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


test("stalled Staging readiness JSON body fails closed within one deadline, without awaiting cancel",async()=>{
 let cancelled=false;
 const stuck=new ReadableStream({
  start(controller){
   controller.enqueue(new TextEncoder().encode('{"service":"VSN Builder",'));
  },
  cancel(){cancelled=true;return new Promise(()=>{});},
 });
 const mock=fixture({"/readyz":new Response(stuck,{status:200,headers:{
   "content-type":"application/json","cache-control":"no-store",
 }})});
 const started=Date.now();
 const proof=await probeStagingHostedRuntime(origin,{
   fetchImpl:mock.fetchImpl,timeoutMs:100,
 });
 checkElapsed();
 function checkElapsed(){
   assert(Date.now()-started<1800,"stalled response body cannot hang readiness");
 }
 assert.equal(cancelled,true);
 assert.equal(proof.liveness,true);
 assert.equal(proof.merchantReady,false);
 assert.equal(proof.readyStatus,200,"HTTP 200 alone must never constitute readiness");
 assert.equal(proof.merchantRoute,true,"an independent /app HTTP response can still be observed");
 assert.deepEqual(mock.captured.map(x=>x.path),["/healthz","/readyz","/app"]);
});
test("slow trickle cannot reset the total hosted readiness JSON deadline",async()=>{
 let pulls=0,cancelled=false;
 const trickle=new ReadableStream({
  async pull(controller){
   await new Promise(resolve=>setTimeout(resolve,38));
   pulls++;
   controller.enqueue(new Uint8Array([32]));
  },
  cancel(){cancelled=true;return new Promise(()=>{});},
 });
 const mock=fixture({"/readyz":new Response(trickle,{status:200,headers:{
   "content-type":"application/json","cache-control":"no-store",
 }})});
 const started=Date.now();
 const proof=await probeStagingHostedRuntime(origin,{
   fetchImpl:mock.fetchImpl,timeoutMs:150,
 });
 assert(Date.now()-started<1900,"slow JSON chunks cannot refresh per-chunk timeout");
 assert(pulls>=2,"fixture must deliver multiple chunks");
 assert.equal(cancelled,true);
 assert.equal(proof.merchantReady,false);
 assert.equal(proof.readyStatus,200);
});
test("stalled Staging health body cannot falsely establish liveness",async()=>{
 let cancelled=false;
 const stream=new ReadableStream({
   start(){},
   cancel(){cancelled=true;return new Promise(()=>{});},
 });
 const mock=fixture({"/healthz":new Response(stream,{status:200,headers:{
   "content-type":"application/json","cache-control":"no-store",
 }})});
 const started=Date.now();
 const proof=await probeStagingHostedRuntime(origin,{
   fetchImpl:mock.fetchImpl,timeoutMs:90,
 });
 assert(Date.now()-started<1800,"stalled /healthz body must not block the job");
 assert.equal(cancelled,true);
 assert.equal(proof.liveness,false);
 assert.equal(proof.merchantReady,false);
 assert.equal(proof.merchantRoute,false);
});
