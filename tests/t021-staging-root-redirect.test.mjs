import test from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/app.js";

const env={APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true"};
const base="https://vsn-builder-staging.vertexsystemsnetwork.workers.dev/";

test("Staging embedded App URL forwards the signed launch query to authenticated app",async()=>{
  const res=await worker.fetch(new Request(base+"?shop=demo-store.myshopify.com&host=abc&hmac=x&embedded=1"),env);
  assert.equal(res.status,302);
  assert.equal(res.headers.get("location"),"/app?shop=demo-store.myshopify.com&host=abc&hmac=x&embedded=1");
  assert.equal(res.headers.get("cache-control"),"no-store");
});
test("Staging root drops non-canonical shops and never redirects off-origin",async()=>{
  for(const shop of ["evil.com","https://x.myshopify.com","a.myshopify.com.evil.com"]){
    const res=await worker.fetch(new Request(base+"?shop="+encodeURIComponent(shop)),env);
    assert.equal(res.headers.get("location"),"/auth/login",shop);
  }
});
test("Production root is not redirected",async()=>{
  const res=await worker.fetch(new Request(base),{...env,APP_ENV:"production",VSN_WORKER_NAME:"vsn-builder-production"});
  assert.notEqual(res.status,302);
});
