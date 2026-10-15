import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createStagingShopifyConfig, normalizeStagingOrigin } from "../scripts/staging-shopify-config.mjs";
const base=readFileSync("shopify.app.toml","utf8");
const prod=base.match(/^client_id\s*=\s*"([0-9a-f]{32})"/m)[1];
const stage={VSN_TARGET_ENV:"staging",SHOPIFY_API_KEY:"aabbccdd00112233445566778899aabb",SHOPIFY_APP_URL:"https://builder-staging.vsn.example.org"};
test("staging config preserves full webhooks and scopes and inserts isolated callback",()=>{
 const generated=createStagingShopifyConfig(base,stage);
 assert.ok(generated.includes('name = "VSN | Builder (Staging)"'));
 assert.ok(generated.includes('application_url = "https://builder-staging.vsn.example.org"'));
 assert.ok(generated.includes('"https://builder-staging.vsn.example.org/auth/callback"'));
 assert.ok(generated.includes("automatically_update_urls_on_dev = false"));
 for (const marker of ["[webhooks]","[app_proxy]","[access_scopes]","customers/data_request","app/uninstalled"])
   assert.ok(generated.includes(marker));
 assert.ok(!generated.includes('client_id = "'+prod+'"'));
 assert.ok(!generated.includes('https://example.com'));
 assert.ok(!generated.includes("SHOPIFY_API_SECRET"));
});
test("production identity and production target are rejected",()=>{
 assert.throws(()=>createStagingShopifyConfig(base,{...stage,SHOPIFY_API_KEY:prod}),/identity/);
 assert.throws(()=>createStagingShopifyConfig(base,{...stage,VSN_TARGET_ENV:"production"}),/staging target/);
 assert.throws(()=>createStagingShopifyConfig(base,{...stage,SHOPIFY_PRODUCTION_CLIENT_ID:stage.SHOPIFY_API_KEY}),/Production ID/);
});
test("callback cannot be ephemeral, insecure, local or contain injected path",()=>{
 for(const url of ["http://builder.example.org","https://example.com","https://dev.trycloudflare.com",
  "https://builder.example.org/callback","https://builder.example.org?token=bad",
  "https://builder.example.org:8443","https://u:pass@builder.example.org","https://app.invalid"]){
  assert.throws(()=>normalizeStagingOrigin(url),undefined,url);
 }
});
test("original config with duplicate identity or missing OAuth callback is rejected",()=>{
 assert.throws(()=>createStagingShopifyConfig(base+'\nclient_id = "'+prod+'"',stage),/exactly one/);
 assert.throws(()=>createStagingShopifyConfig(base.replace(/^redirect_urls.*$/m,""),stage),/exactly one/);
});
test("stage API key shape and missing origin fail closed without echoing secrets",()=>{
 assert.throws(()=>createStagingShopifyConfig(base,{...stage,SHOPIFY_API_KEY:"bad"}),/invalid/);
 assert.throws(()=>createStagingShopifyConfig(base,{...stage,SHOPIFY_APP_URL:""}),/Stage-only HTTPS/);
});
