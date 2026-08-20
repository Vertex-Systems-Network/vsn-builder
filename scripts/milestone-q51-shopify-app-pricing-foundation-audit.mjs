import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildShopifyAppPricingUrl,
  getShopifyAppPricingConfig,
  getShopifyPlanHandleMap,
  normalizePricingHandle,
  normalizeShopDomain,
  readShopifyAppPricingReturn,
  resolveInternalPlanKeyFromHandle,
  storeHandleFromShop,
} from "../app/services/shopify-app-pricing.server.js";

const read=(file)=>fs.readFileSync(file,"utf8");
const exists=(file)=>fs.existsSync(file);
const checks=[];
function check(name,fn){try{fn();checks.push([name,true]);console.log(`PASS  ${name}`)}catch(error){checks.push([name,false]);console.error(`FAIL  ${name}: ${error.message}`)}}
function withEnv(values,fn){const before={};for(const [key,value] of Object.entries(values)){before[key]=process.env[key];if(value===undefined)delete process.env[key];else process.env[key]=value;}try{return fn();}finally{for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}}

const pkg=JSON.parse(read("package.json"));
const env=read(".env.example");
const plans=read("app/routes/app.plans.jsx");
const dashboard=read("app/components/dashboard/pages/Pricing.jsx");
const license=read("app/components/dashboard/pages/License.jsx");
const indexRoute=read("app/routes/app._index.jsx");
const commercial=read("app/services/commercialization.server.js");
const prodConfig=read("scripts/prepare-shopify-production-config.mjs");
const prodRuntime=read("scripts/validate-production-runtime.mjs");
const service=read("app/services/shopify-app-pricing.server.js");

check("Version retains Q5.1 or later baseline",()=>assert.ok(Number(pkg.version.split(".").at(-1))>=93));
check("Q5.1 audit is in release QA",()=>assert.ok(pkg.scripts?.["qa:release"]?.includes("milestone-q51-shopify-app-pricing-foundation-audit.mjs")));
check("Shopify App Pricing service is packaged",()=>assert.equal(exists("app/services/shopify-app-pricing.server.js"),true));
check("Developer mode report is packaged",()=>assert.equal(exists("MILESTONE_Q51_DEVELOPER_MODE.md"),true));
check("Q5.1 report is packaged",()=>assert.equal(exists("VSN_MILESTONE_Q51_SHOPIFY_APP_PRICING_REPORT_v2.5.93.md"),true));
check("Developer pricing documentation is packaged",()=>assert.equal(exists("docs/developer/shopify-app-pricing.md"),true));

check("Shop domain normalization strips URL path",()=>assert.equal(normalizeShopDomain("https://Cool-Shop.myshopify.com/admin"),"cool-shop.myshopify.com"));
check("Store handle extracts myshopify prefix",()=>assert.equal(storeHandleFromShop("cool-shop.myshopify.com"),"cool-shop"));
check("Non-myshopify domain cannot generate store handle",()=>assert.equal(storeHandleFromShop("shop.example.com"),""));
check("Pricing handle normalization is lower-case",()=>assert.equal(normalizePricingHandle("Pro_Plan"),"pro_plan"));
check("Unsafe pricing handles are rejected",()=>assert.equal(normalizePricingHandle("../pro plan"),""));

check("Hosted pricing URL follows Shopify contract",()=>withEnv({SHOPIFY_APP_HANDLE:"vsn-builder",SHOPIFY_APP_PRICING_URL:undefined,SHOPIFY_MANAGED_PRICING_URL:undefined},()=>assert.equal(buildShopifyAppPricingUrl({shop:"cool-shop.myshopify.com"}),"https://admin.shopify.com/store/cool-shop/charges/vsn-builder/pricing_plans")));
check("Explicit HTTPS pricing URL can override generated URL",()=>withEnv({SHOPIFY_APP_HANDLE:"vsn-builder",SHOPIFY_APP_PRICING_URL:"https://admin.shopify.com/store/test/charges/vsn/pricing_plans"},()=>assert.equal(buildShopifyAppPricingUrl({shop:"cool-shop.myshopify.com"}),"https://admin.shopify.com/store/test/charges/vsn/pricing_plans")));
check("HTTP pricing override is rejected",()=>withEnv({SHOPIFY_APP_HANDLE:undefined,SHOPIFY_APP_PRICING_URL:"http://evil.example/pricing",SHOPIFY_MANAGED_PRICING_URL:undefined},()=>assert.equal(buildShopifyAppPricingUrl({shop:"cool-shop.myshopify.com"}),"")));
check("Legacy managed pricing URL remains fallback only",()=>withEnv({SHOPIFY_APP_HANDLE:undefined,SHOPIFY_APP_PRICING_URL:undefined,SHOPIFY_MANAGED_PRICING_URL:"https://admin.shopify.com/store/legacy/charges/vsn/pricing_plans"},()=>assert.equal(getShopifyAppPricingConfig("cool-shop.myshopify.com").mode,"legacy")));
check("Generated configuration reports generated mode",()=>withEnv({SHOPIFY_APP_HANDLE:"vsn-builder",SHOPIFY_APP_PRICING_URL:undefined,SHOPIFY_MANAGED_PRICING_URL:undefined},()=>assert.equal(getShopifyAppPricingConfig("cool-shop.myshopify.com").mode,"generated")));
check("Unconfigured pricing reports an actionable issue",()=>withEnv({SHOPIFY_APP_HANDLE:undefined,SHOPIFY_APP_PRICING_URL:undefined,SHOPIFY_MANAGED_PRICING_URL:undefined},()=>assert.ok(getShopifyAppPricingConfig("cool-shop.myshopify.com").issues.some((row)=>row.includes("SHOPIFY_APP_HANDLE")))));

check("Default Shopify plan handles map Free/Silver/Gold/Platinum keys",()=>withEnv({SHOPIFY_APP_PRICING_PLAN_FREE_HANDLE:undefined,SHOPIFY_APP_PRICING_PLAN_SILVER_HANDLE:undefined,SHOPIFY_APP_PRICING_PLAN_GOLD_HANDLE:undefined,SHOPIFY_APP_PRICING_PLAN_PLATINUM_HANDLE:undefined,SHOPIFY_APP_PRICING_PLAN_CORE_HANDLE:undefined,SHOPIFY_APP_PRICING_PLAN_PRO_HANDLE:undefined,SHOPIFY_APP_PRICING_PLAN_CRO_HANDLE:undefined,SHOPIFY_APP_PRICING_PLAN_AGENCY_HANDLE:undefined},()=>assert.deepEqual(getShopifyPlanHandleMap(),{core:"free",pro:"sliver",cro:"gold",agency:"platenium"})));
check("Public env plan handle maps back to internal key",()=>withEnv({SHOPIFY_APP_PRICING_PLAN_SILVER_HANDLE:"silver_custom",SHOPIFY_APP_PRICING_PLAN_PRO_HANDLE:undefined},()=>assert.equal(resolveInternalPlanKeyFromHandle("silver_custom"),"pro")));
check("Legacy internal env handle remains supported",()=>withEnv({SHOPIFY_APP_PRICING_PLAN_SILVER_HANDLE:undefined,SHOPIFY_APP_PRICING_PLAN_PRO_HANDLE:"legacy_pro"},()=>assert.equal(resolveInternalPlanKeyFromHandle("legacy_pro"),"pro")));
check("Unknown plan handle does not resolve entitlement",()=>assert.equal(resolveInternalPlanKeyFromHandle("unknown-paid-plan"),null));

check("Pricing return recognizes matching Gold Shopify key",()=>withEnv({SHOPIFY_APP_PRICING_PLAN_GOLD_HANDLE:"gold-plan",SHOPIFY_APP_PRICING_PLAN_CRO_HANDLE:undefined},()=>{const result=readShopifyAppPricingReturn({url:"https://app.example.com/app?view=pricing&plan_handle=gold-plan&shop=cool-shop.myshopify.com"},"cool-shop.myshopify.com");assert.equal(result.planKey,"cro");assert.equal(result.shopMatches,true);assert.equal(result.pendingVerification,true);assert.equal(result.trustedForEntitlements,false);}));
check("Pricing return rejects mismatched shop signal",()=>{const result=readShopifyAppPricingReturn({url:"https://app.example.com/app?plan_handle=pro&shop=other.myshopify.com"},"cool-shop.myshopify.com");assert.equal(result.shopMatches,false);assert.equal(result.pendingVerification,false);});
check("Pricing return without plan_handle is ignored",()=>assert.equal(readShopifyAppPricingReturn({url:"https://app.example.com/app?view=pricing"},"cool-shop.myshopify.com"),null));

check("Dashboard loader exposes Shopify pricing config",()=>assert.ok(indexRoute.includes("getShopifyAppPricingConfig")&&indexRoute.includes("pricingReturn")));
check("Plans loader exposes Shopify pricing config",()=>assert.ok(plans.includes("getShopifyAppPricingConfig")&&plans.includes("readShopifyAppPricingReturn")));
check("Production actions never locally select any tier",()=>assert.ok(plans.includes("if(!developerMode)")&&plans.indexOf("if(!developerMode)")<plans.indexOf("builderSubscription.upsert")));
check("Production action routes to hosted App Pricing",()=>assert.ok(plans.includes("hosted App Pricing page")&&plans.includes("pricing.pricingUrl")));
check("Developer Mode plan simulation remains",()=>assert.ok(plans.includes("simulated for this development store")&&plans.includes("builderSubscription.upsert")));
check("Dashboard does not append undocumented plan query",()=>assert.doesNotMatch(dashboard,/searchParams\.set\(['\"]plan['\"]/));
check("Dashboard does not append undocumented interval query",()=>assert.doesNotMatch(dashboard,/searchParams\.set\(['\"]interval['\"]/));
check("Dashboard labels Shopify as authoritative",()=>assert.ok(dashboard.includes("Shopify’s hosted App Pricing page")&&dashboard.includes("never treats a plan_handle")));
check("License exposes billing provider state",()=>assert.ok(license.includes("Billing provider")&&(license.includes("pending live Shopify contract verification")||license.includes("Partner API verified")||license.includes("verified Shopify contract sync")||license.includes("waiting for Partner API verification"))));
check("Commercialization health uses new pricing config",()=>assert.ok(commercial.includes("getShopifyAppPricingConfig")&&commercial.includes("billingProvider")));

check("Environment documents app handle",()=>assert.ok(env.includes("SHOPIFY_APP_HANDLE=")));
check("Environment documents pricing URL override",()=>assert.ok(env.includes("SHOPIFY_APP_PRICING_URL=")));
check("Environment documents public Shopify plan handles",()=>["FREE","SILVER","GOLD","PLATINUM"].forEach((key)=>assert.ok(env.includes(`SHOPIFY_APP_PRICING_PLAN_${key}_HANDLE=`))));
check("Legacy managed pricing env is explicitly transitional",()=>assert.ok(env.includes("Legacy fallback only")&&env.includes("SHOPIFY_MANAGED_PRICING_URL=")));
check("Production config can persist App Home handle",()=>assert.ok(prodConfig.includes("SHOPIFY_PRODUCTION_APP_HANDLE")&&prodConfig.includes("handle =")));
check("Production runtime validates pricing when commercialization enabled",()=>assert.ok(prodRuntime.includes("commercializationEnabled")&&prodRuntime.includes("Shopify App Pricing is not configured")));
check("No Billing API subscription mutation was introduced",()=>assert.doesNotMatch(service+plans,/appSubscriptionCreate|appSubscriptionCancel\s*\(/));
check("No Q5.1 Prisma migration exists",()=>assert.equal(fs.readdirSync("prisma/migrations").some((name)=>/q51|app_pricing|billing_foundation/i.test(name)),false));

const failed=checks.filter(([,ok])=>!ok);
console.log(`\nMilestone Q5.1 Shopify App Pricing foundation audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
