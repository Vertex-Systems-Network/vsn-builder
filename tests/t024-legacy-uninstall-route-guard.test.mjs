import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {isValidLegacyUninstallEvent} from "../app/services/legacy-shopify-uninstall-guard.js";

const shop="vsn-builder-test.myshopify.com";
const valid=()=>({shop,topic:"APP_UNINSTALLED",
 payload:{id:123,shop_domain:shop,myshopify_domain:shop}});
const source=readFileSync("app/routes/webhooks.app.uninstalled.jsx","utf8");

test("SDK-authenticated uninstall must have exact topic and shop",()=>{
 assert.equal(isValidLegacyUninstallEvent(valid()),true);
 assert.equal(isValidLegacyUninstallEvent({...valid(),payload:{id:123}}),true);
 for(const bad of [null,{},[],false,
  {...valid(),topic:"CUSTOMERS_REDACT"},
  {...valid(),topic:"APP_SCOPES_UPDATE"},
  {...valid(),shop:"other.example.com"},
  {...valid(),shop:"shop.myshopify.com.evil.test"},
  {...valid(),shop:"A.myshopify.com"},
  {...valid(),shop:"a".repeat(65)+".myshopify.com"},
  {...valid(),shop:"-invalid.myshopify.com"},
  {...valid(),payload:null},{...valid(),payload:[]},
  {...valid(),payload:{shop_domain:"different.myshopify.com"}},
  {...valid(),payload:{myshopify_domain:"different.myshopify.com"}},
  {...valid(),payload:{shop_domain:shop,myshopify_domain:"other.myshopify.com"}},
  {...valid(),payload:{shop_domain:42}},
 ])assert.equal(isValidLegacyUninstallEvent(bad),false,JSON.stringify(bad));
});

// Execute the actual JSX action implementation with isolated SDK-authenticated
// events: source-level strings alone cannot prove a route is non-destructive.
function actionForEvent(event,operations){
 const isolated=source
  .replace(/^import .*;\s*$/gm,"")
  .replace("export const action =","const action =")
  +"\nthis.action=action;";
 const sandbox={
  authenticate:{webhook:async(request)=>{
   operations.push({op:"sdk-authenticate",request});
   return event;
  }},
  isValidLegacyUninstallEvent,
  Response,
 };
 runInNewContext(isolated,sandbox,{timeout:1000});
 return sandbox.action;
}
test("real legacy Node uninstall action refuses deletion even for signed old or current event",async()=>{
 const events=[
  valid(),
  {...valid(),payload:{id:123}},
  {...valid(),webhookId:"old-generation-uninstall"},
  {...valid(),webhookId:"current-generation-uninstall"},
 ];
 for(const event of events){
  const operations=[];
  const response=await actionForEvent(event,operations)({request:{synthetic:true}});
  assert.equal(response.status,503);
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.equal(response.headers.get("retry-after"),"60");
  assert.equal(await response.text(),"");
  assert.deepEqual(operations.map(x=>x.op),["sdk-authenticate"]);
 }
});
test("invalid topic/shop after authenticated SDK response is denied without any database access",async()=>{
 const invalid=[
  {...valid(),topic:"ORDERS_CREATE"},
  {...valid(),shop:"attacker.myshopify.com",payload:{shop_domain:shop}},
  {...valid(),payload:{shop_domain:"foreign.myshopify.com"}},
  {...valid(),payload:null},
 ];
 for(const event of invalid){
  const operations=[];
  const response=await actionForEvent(event,operations)({request:{}});
  assert.equal(response.status,401);
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.equal(operations.length,1);
 }
});
test("legacy uninstall route never imports or calls destructive cleanup without trusted generation proof",()=>{
 assert.match(source,/authenticate\.webhook\(request\)/);
 assert.match(source,/isValidLegacyUninstallEvent\(event\)/);
 assert.doesNotMatch(source,/deleteVsnShopData|\.deleteMany\(|\.\$transaction\(/);
 assert.doesNotMatch(source,/from ["']\.\.\/db\.server|from ["']\.\.\/services\/shop-data-lifecycle/);
 assert.doesNotMatch(source,/console\.(?:log|info|error).*\b(?:shop|topic)/);
 assert(source.indexOf("authenticate.webhook(request)")<source.indexOf("isValidLegacyUninstallEvent(event)"));
 assert.match(source,/status:\s*503/);
});
