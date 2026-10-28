import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {resolveBuilderBranding,VSN_BUILDER_DISPLAY_VERSION} from "../app/config/environment-branding.js";
for (const [id,title,badge] of [["development","VSN | Builder (Development)","Dev"],["staging","VSN | Builder (Staging)","Staging"],["production","VSN | Builder",null]]){
  test(id+" branding matches exact Shopify title and badge",()=>{
    assert.deepEqual(resolveBuilderBranding(id),{title,badge});
    const file=id==="development"?"shopify.app.local.template.toml":id==="staging"?"shopify.app.staging.toml":"shopify.app.production.template.toml";
    assert.match(fs.readFileSync(file,"utf8"),new RegExp('name = "'+title.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+'"'));
  });
}
test("unknown runtime cannot impersonate production",()=>{
 assert.equal(resolveBuilderBranding(undefined).badge,"Dev");
 assert.equal(resolveBuilderBranding("not-real").badge,"Dev");
 assert.equal(VSN_BUILDER_DISPLAY_VERSION,"v1.0.0");
 const source=fs.readFileSync("app/routes/app.jsx","utf8");
 assert.match(source,/resolveBuilderBranding\(process\.env\.APP_ENV\)/);
 assert.match(source,/brand=\{brand\}/);
});
