import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const config=JSON.parse(readFileSync("config/deployment/environments.json","utf8"));
const expected={
 local:["local-testing-iashboek.myshopify.com","f6156da0bd799053f2f0bd0f9e10983c"],
 staging:["staging-oath3rth.myshopify.com","0ecd6b7151485b41ea65924fe827806a"],
 production:["vertex-systems-network.myshopify.com","997eae5a9961f21d131e5f31bbbe31d3"],
};
test("only existing three connected Shopify shops, fixed per tier",()=>{
 assert.deepEqual(config.promotion_order,["local","staging","production"]);
 const ids=[],domains=[];
 for(const [tier,[domain,key]] of Object.entries(expected)){
  assert.equal(config[tier].shop_domain,domain);
  assert.equal(config[tier].shopify_client_id,key);
  assert.equal(config[tier].shop_policy,"reuse_existing_only");
  assert.match(domain,/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/);
  assert.match(key,/^[a-f0-9]{32}$/);
  ids.push(key);domains.push(domain);
 }
 assert.equal(new Set(ids).size,3,"never reuse a Shopify app between tiers");
 assert.equal(new Set(domains).size,3,"never target the wrong Shopify store");
});
test("Dev CLI template reuses registered app; no bogus generated installation",()=>{
 const local=readFileSync("shopify.app.local.template.toml","utf8");
 assert.match(local,/ALREADY registered VSN Builder \(Development\)/);
 assert.match(local,/local-testing-iashboek\.myshopify\.com/);
 assert.match(local,/Do NOT create a new Dev store/);
 assert.match(local,/client_id = "__SHOPIFY_LOCAL_CLIENT_ID__"/);
 assert.doesNotMatch(local,/A new dedicated Dev app ID is required/);
 assert.equal(config.local.source_branch,"development");
 assert.equal(config.local.database_provider,"sqlite");
 assert.equal(config.staging.source_branch,"development");
 assert.equal(config.production.source_branch,"main");
});
test("no Live Shopify/Neon deploy or new store installation claimed by this mapping",()=>{
 assert.equal(config.staging.cloudflare_worker,"vsn-builder-staging");
 assert.equal(config.production.cloudflare_worker,"vsn-builder-production");
 assert.equal(config.staging.neon_project_id,"shiny-violet-61219572");
 assert.equal(config.production.neon_project_id,"nameless-violet-68750490");
 assert.notEqual(config.local.shopify_client_id,config.staging.shopify_client_id);
 assert.notEqual(config.production.shopify_client_id,config.staging.shopify_client_id);
});
