import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import probe from "../workers/shopify-neon-module-ci-probe.js";

test("real Shopify/PrismaNeon module bundle probe is locked on every HTTP method and path",async()=>{
 for(const path of ["/","/app","/app/pages","/auth","/auth/callback",
   "/webhooks/app/uninstalled","/billing","/__vsn/readiness"]){
  for(const method of ["GET","POST"]){
   const request=new Request("https://vsn-edge.test"+path,{
    method,headers:{
      authorization:"Bearer attacker",
      "x-shopify-hmac-sha256":"forged",
      cookie:"shopifySession=forged",
    },
   });
   const response=await probe.fetch(request,{
    APP_ENV:"production",
    SHOPIFY_API_SECRET:"should-never-be-used",
    DATABASE_URL:"postgresql://should-never-be-used",
   });
   assert.equal(response.status,503,path+" "+method);
   assert.equal(await response.text(),"");
   assert.equal(response.headers.get("cache-control"),"no-store");
   assert.match(response.headers.get("content-security-policy"),/frame-ancestors 'none'/);
  }
 }
});
test("bundle probe directly references official Worker Shopify and Neon factories only",()=>{
 const code=readFileSync("workers/shopify-neon-module-ci-probe.js","utf8");
 for(const expected of ["shopify-worker-sdk-context.js","shopify-worker-session-context.js",
    "worker-shopify-admin-gate.js","db-worker-neon.js"]){
  assert(code.includes(expected));
 }
 assert(!code.includes("shopify.server.js"));
 assert(!code.includes("db.server.js"));
 assert(!code.includes("createWorkerShopifySdkContext(request"));
 assert(!code.includes("createWorkerNeonPrisma(env"));
 const config=readFileSync("wrangler.shopify-neon-module-ci.jsonc","utf8");
 assert(!config.includes('"name": "vsn-builder-staging"'));
 assert(!config.includes('"name": "vsn-builder-production"'));
 assert(!config.includes("SHOPIFY_API_SECRET"));
 assert(!config.includes("DATABASE_URL"));
 assert(!config.includes("DIRECT_URL"));
});
test("actual hosted Worker remains separate, locked and untouched",()=>{
 const app=readFileSync("workers/app.js","utf8");
 assert(!app.includes("shopify-neon-module-ci-probe"));
 assert.match(app,/return locked\(\)/);
});
