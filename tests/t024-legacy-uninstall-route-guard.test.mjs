import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isValidLegacyUninstallEvent} from "../app/services/legacy-shopify-uninstall-guard.js";
const shop="vsn-builder-test.myshopify.com";
const valid=()=>({shop,topic:"APP_UNINSTALLED",
 payload:{id:123,shop_domain:shop,myshopify_domain:shop}});
test("signed uninstall topic and merchant domain require exact Shopify event shape",()=>{
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
test("legacy route invokes Shopify SDK first, then guards before DB deletion",()=>{
 const source=readFileSync("app/routes/webhooks.app.uninstalled.jsx","utf8");
 const auth="authenticate.webhook(request)";
 const guard="isValidLegacyUninstallEvent(event)";
 const deletion="deleteVsnShopData(db, event.shop, { includeSessions: true })";
 assert(source.includes('from "../services/legacy-shopify-uninstall-guard.js"'));
 assert(source.includes(auth)&&source.includes(guard)&&source.includes(deletion));
 assert(source.indexOf(auth)<source.indexOf(guard));
 assert(source.indexOf(guard)<source.indexOf(deletion));
 assert.match(source,/if \(!isValidLegacyUninstallEvent\(event\)\) \{\s*return new Response\(null, \{\s*status: 401/);
 assert.doesNotMatch(source,/console\.log.*(?:shop|topic)/);
});
