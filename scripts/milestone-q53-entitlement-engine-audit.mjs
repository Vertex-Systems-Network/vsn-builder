import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { COMMERCIAL_PLANS } from "../app/config/commercialPlans.js";
import { ENTITLEMENT_FEATURES, ENTITLEMENT_QUOTAS, ENTITLEMENT_VERSION } from "../app/config/entitlements.js";
import {
  getEntitlementSnapshot,
  getFeatureDecisionFromPlan,
  getMinimumPlanDecisionFromPlan,
  getQuotaDecisionFromUsage,
  resolveEntitlementPlan,
  serializeEntitlementSnapshot,
} from "../app/services/entitlements.server.js";

const read=(file)=>fs.readFileSync(file,"utf8");
const exists=(file)=>fs.existsSync(file);
const checks=[];
async function check(name,fn){try{await fn();checks.push([name,true]);console.log(`PASS  ${name}`)}catch(error){checks.push([name,false]);console.error(`FAIL  ${name}: ${error.message}`)}}
async function withEnv(values,fn){const before={};for(const [key,value] of Object.entries(values)){before[key]=process.env[key];if(value===undefined)delete process.env[key];else process.env[key]=value;}try{return await fn();}finally{for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}}
const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));
const serverBaseline=read("app/config/baseline.js");
const service=read("app/services/entitlements.server.js");
const config=read("app/config/entitlements.js");
const planServer=read("app/utils/plan.server.js");
const pages=read("app/routes/app.pages.jsx");
const marketplace=read("app/routes/app.marketplace.jsx");
const experiments=read("app/routes/app.experiments.jsx");
const ai=read("app/services/ai-builder.server.js");
const collaboration=read("app/services/collaboration.server.js");
const backups=read("app/routes/app.backups.jsx");
const controls=read("app/routes/app.control-center.jsx");
const plugins=read("app/routes/app.plugins.jsx");
const library=read("app/routes/app.library.jsx");
const builder=read("app/routes/app.builder.$id.jsx");
const builderEntitlements=read("app/services/builder-runtime-entitlements.server.js");
const dashboard=read("app/routes/app._index.jsx");
const plans=read("app/routes/app.plans.jsx");
const home=read("app/components/dashboard/pages/Home.jsx");
const license=read("app/components/dashboard/pages/License.jsx");
const now=new Date("2026-08-09T04:00:00.000Z");
const trustedRow={provider:"shopify-app-pricing",status:"active",planKey:"cro",verifiedAt:new Date("2026-08-09T03:59:00.000Z")};
function subscriptionDb(row){return {builderSubscription:{findUnique:async()=>row}};}
function usageDb(row=trustedRow){return {
  builderSubscription:{findUnique:async()=>row},
  builderPage:{count:async()=>4},
  builderMarketplaceInstall:{count:async()=>2},
  builderAiUsage:{count:async()=>3},
  builderExperiment:{count:async()=>1},
  builderShopSetting:{findUnique:async()=>({collaborationRolesJson:JSON.stringify({"a@example.com":"designer","b@example.com":"approver"})})},
};}

await check("Version retains Q5.3 or later baseline",()=>{const [major,minor,patch]=String(pkg.version).split(".").map(Number);assert.ok(major>2||(major===2&&(minor>5||(minor===5&&patch>=95))))});
await check("Baseline retains Q5.3 or later contract",()=>{const milestone=String(baseline.milestone||"");assert.ok(/^Q\.5\.[3-9]$/.test(milestone)||/entitlementEngine:\s*2/.test(serverBaseline))});
await check("Q5.3 audit is in release QA",()=>assert.ok(pkg.scripts?.["qa:release"]?.includes("milestone-q53-entitlement-engine-audit.mjs")));
await check("Entitlement config is packaged",()=>assert.equal(exists("app/config/entitlements.js"),true));
await check("Entitlement service is packaged",()=>assert.equal(exists("app/services/entitlements.server.js"),true));
await check("Q5.3 developer-mode report is packaged",()=>assert.equal(exists("MILESTONE_Q53_DEVELOPER_MODE.md"),true));
await check("Q5.3 milestone report is packaged",()=>assert.equal(exists("VSN_MILESTONE_Q53_ENTITLEMENT_ENGINE_REPORT_v2.5.95.md"),true));
await check("Entitlement developer documentation is packaged",()=>assert.equal(exists("docs/developer/entitlement-engine.md"),true));
await check("Entitlement contract version is 2",()=>assert.equal(ENTITLEMENT_VERSION,2));
await check("Named feature registry covers commercial systems",()=>["collaboration","croExperiments","marketplacePro","globalLibrary","backups","developerSdk","enterpriseControls","localization","forms"].forEach((key)=>assert.ok(ENTITLEMENT_FEATURES[key])));
await check("Named quota registry covers commercial capacities",()=>["pages","marketplaceInstalls","aiGenerations","croExperiments","collaborationSeats"].forEach((key)=>assert.ok(ENTITLEMENT_QUOTAS[key])));

await check("Production ignores VSN_DEFAULT_PLAN paid override",()=>withEnv({NODE_ENV:"production",VSN_DEFAULT_PLAN:"agency",SHOPIFY_SUBSCRIPTION_MAX_STALE_SECONDS:"86400"},async()=>{const plan=await resolveEntitlementPlan(subscriptionDb(null),"shop.myshopify.com",{now});assert.equal(plan.key,"core");assert.equal(plan.entitlementSource,"production-core-fallback");assert.equal(plan.entitlementVerified,false)}));
await check("Production trusts a fresh verified Shopify mirror",()=>withEnv({NODE_ENV:"production",VSN_DEFAULT_PLAN:"core",SHOPIFY_SUBSCRIPTION_MAX_STALE_SECONDS:"86400"},async()=>{const plan=await resolveEntitlementPlan(subscriptionDb(trustedRow),"shop.myshopify.com",{now});assert.equal(plan.key,"cro");assert.equal(plan.entitlementSource,"shopify-verified");assert.equal(plan.entitlementVerified,true)}));
await check("Unverified local production row fails closed to Core",()=>withEnv({NODE_ENV:"production",SHOPIFY_SUBSCRIPTION_MAX_STALE_SECONDS:"86400"},async()=>{const plan=await resolveEntitlementPlan(subscriptionDb({...trustedRow,provider:null}),"shop.myshopify.com",{now});assert.equal(plan.key,"core");assert.equal(plan.entitlementVerified,false)}));
await check("Developer default plan remains a simulation only",()=>withEnv({NODE_ENV:"development",VSN_DEFAULT_PLAN:"pro"},async()=>{const plan=await resolveEntitlementPlan(subscriptionDb(null),"shop.myshopify.com",{now});assert.equal(plan.key,"pro");assert.equal(plan.entitlementSource,"developer-default")}));
await check("Developer active local row remains supported",()=>withEnv({NODE_ENV:"development",VSN_DEFAULT_PLAN:"core"},async()=>{const plan=await resolveEntitlementPlan(subscriptionDb({status:"active",planKey:"agency"}),"shop.myshopify.com",{now});assert.equal(plan.key,"agency");assert.equal(plan.entitlementSource,"developer-simulation")}));

await check("Core collaboration is denied",()=>assert.equal(getFeatureDecisionFromPlan({...COMMERCIAL_PLANS.core,key:"core"},"collaboration").allowed,false));
await check("Pro collaboration is allowed",()=>assert.equal(getFeatureDecisionFromPlan({...COMMERCIAL_PLANS.pro,key:"pro"},"collaboration").allowed,true));
await check("Core backup is denied",()=>assert.equal(getFeatureDecisionFromPlan({...COMMERCIAL_PLANS.core,key:"core"},"backups").allowed,false));
await check("Agency enterprise controls are allowed",()=>assert.equal(getFeatureDecisionFromPlan({...COMMERCIAL_PLANS.agency,key:"agency"},"enterpriseControls").allowed,true));
await check("Numeric CRO feature follows plan capacity",()=>{assert.equal(getFeatureDecisionFromPlan({...COMMERCIAL_PLANS.pro,key:"pro"},"croExperiments").allowed,false);assert.equal(getFeatureDecisionFromPlan({...COMMERCIAL_PLANS.cro,key:"cro"},"croExperiments").allowed,true)});
await check("Minimum-plan decisions use tier order",()=>{assert.equal(getMinimumPlanDecisionFromPlan({...COMMERCIAL_PLANS.core,key:"core"},"pro").allowed,false);assert.equal(getMinimumPlanDecisionFromPlan({...COMMERCIAL_PLANS.cro,key:"cro"},"pro").allowed,true)});
await check("Page quota allows capacity edge",()=>assert.equal(getQuotaDecisionFromUsage({...COMMERCIAL_PLANS.core,key:"core"},"pages",4,{extra:1}).allowed,true));
await check("Page quota denies overflow",()=>{const d=getQuotaDecisionFromUsage({...COMMERCIAL_PLANS.core,key:"core"},"pages",5,{extra:1});assert.equal(d.allowed,false);assert.equal(d.code,"VSN_QUOTA_EXCEEDED")});
await check("Unlimited Agency Marketplace quota remains unlimited",()=>{const d=getQuotaDecisionFromUsage({...COMMERCIAL_PLANS.agency,key:"agency"},"marketplaceInstalls",5000,{extra:1});assert.equal(d.allowed,true);assert.equal(d.unlimited,true);assert.equal(d.remaining,null)});
await check("Zero CRO quota reports not included",()=>{const d=getQuotaDecisionFromUsage({...COMMERCIAL_PLANS.pro,key:"pro"},"croExperiments",0,{extra:1});assert.equal(d.code,"VSN_QUOTA_NOT_INCLUDED")});

await check("Snapshot centralizes stable usage counters",()=>withEnv({NODE_ENV:"production",SHOPIFY_SUBSCRIPTION_MAX_STALE_SECONDS:"86400"},async()=>{const snap=await getEntitlementSnapshot(usageDb(),"shop.myshopify.com",{now});assert.equal(snap.quotas.pages.used,4);assert.equal(snap.quotas.marketplaceInstalls.used,2);assert.equal(snap.quotas.aiGenerations.used,3);assert.equal(snap.quotas.croExperiments.used,1);assert.equal(snap.quotas.collaborationSeats.used,3)}));
await check("Collaboration seats use owner plus persisted assignments",()=>assert.ok(service.includes("return 1 + Object.keys(assignments).filter(Boolean).length")));
await check("AI quota exposes monthly reset boundary",()=>withEnv({NODE_ENV:"production",SHOPIFY_SUBSCRIPTION_MAX_STALE_SECONDS:"86400"},async()=>{const snap=await getEntitlementSnapshot(usageDb(),"shop.myshopify.com",{now});assert.match(snap.quotas.aiGenerations.resetAt,/2026-09-01T00:00:00.000Z/)}));
await check("Serialized snapshot strips internal subscription identifiers",()=>withEnv({NODE_ENV:"production",SHOPIFY_SUBSCRIPTION_MAX_STALE_SECONDS:"86400"},async()=>{const db=usageDb({...trustedRow,shopifyAppId:"secret-app",shopifyShopId:"secret-shop",legacySubscriptionId:"secret-sub",snapshotJson:'{"secret":true}'});const serialized=serializeEntitlementSnapshot(await getEntitlementSnapshot(db,"shop.myshopify.com",{now}));const text=JSON.stringify(serialized);assert.doesNotMatch(text,/secret-app|secret-shop|secret-sub|snapshotJson/)}));

await check("Pages create uses centralized page quota",()=>assert.ok(pages.includes('getQuotaDecision(db, session.shop, "pages"')||pages.includes('getQuotaDecision(db,session.shop,"pages"')));
await check("Marketplace uses minimum tier and centralized install quota",()=>assert.ok(marketplace.includes("getMinimumPlanDecision")&&marketplace.includes('"marketplaceInstalls"')));
await check("CRO uses centralized feature and quota decisions",()=>assert.ok(experiments.includes('"croExperiments"')&&experiments.includes("getFeatureDecision")&&experiments.includes("getQuotaDecision")));
await check("AI provider calls are protected by centralized quota",()=>assert.ok(ai.includes('"aiGenerations"')&&ai.includes("getQuotaDecision")));
await check("Collaboration uses feature plus stable seat quota",()=>assert.ok(collaboration.includes('"collaboration"')&&collaboration.includes('"collaborationSeats"')));
await check("Backup actions enforce centralized feature",()=>assert.ok(backups.includes('getFeatureDecision(db, session.shop, "backups"')||backups.includes('getFeatureDecision(db,session.shop,"backups"')));
await check("Enterprise controls enforce centralized feature",()=>assert.ok(controls.includes('"enterpriseControls"')&&controls.includes("getFeatureDecision")));
await check("Developer SDK enforces centralized feature",()=>assert.ok(plugins.includes('"developerSdk"')&&plugins.includes("getFeatureDecision")));
await check("Global Library writes enforce centralized feature",()=>assert.ok(library.includes('"globalLibrary"')&&library.includes("getFeatureDecision")));
await check("Builder runtime receives collaboration/localization entitlements",()=>assert.ok(builder.includes("getBuilderRuntimeEntitlements")&&builder.includes("entitlements")&&builderEntitlements.includes('"collaboration"')&&builderEntitlements.includes('"localization"')));
await check("Legacy quotaAllows is absent from mutation routes/services",()=>{const roots=["app/routes","app/services"];const bad=[];for(const root of roots){for(const file of fs.readdirSync(root)){if(!/\.(jsx?|mjs)$/.test(file))continue;const full=path.join(root,file);if(read(full).includes("quotaAllows("))bad.push(full)}}assert.deepEqual(bad,[])});
await check("plan.server is now a compatibility facade",()=>assert.ok(planServer.includes("getEntitlementSnapshot")&&planServer.includes("resolveEntitlementPlan")));
await check("Plans loader exposes canonical entitlement snapshot",()=>assert.ok(plans.includes("getEntitlementSnapshot")&&plans.includes("serializeEntitlementSnapshot")));
await check("Dashboard loader exposes canonical entitlement snapshot",()=>assert.ok(dashboard.includes("getEntitlementSnapshot")&&dashboard.includes("serializeEntitlementSnapshot")));
await check("Dashboard page usage reads centralized quota shape",()=>assert.ok(home.includes("planUsage?.pages?.used")));
await check("License UI identifies entitlement authority",()=>assert.ok(license.includes("Entitlement authority")));
await check("Production fail-closed rule is explicit in source",()=>assert.ok(service.includes("Production must fail closed")&&service.includes("VSN_DEFAULT_PLAN is intentionally ignored")));
await check("No Q5.3 Prisma migration was added",()=>assert.equal(fs.readdirSync("prisma/migrations").some((name)=>/q53|entitlement/i.test(name)),false));
await check("Q5.3 does not create Shopify Billing API charges",()=>assert.doesNotMatch(service+pages+marketplace+experiments,/appSubscriptionCreate\s*\(/));
await check("Entitlement registry maps quotas to commercial plan fields",()=>{assert.ok(config.includes('planField: "maxPages"'));assert.ok(config.includes('planField: "templateQuota"'));assert.ok(config.includes('planField: "aiMonthly"'));assert.ok(config.includes('planField: "teamMembers"'))});

const failed=checks.filter(([,ok])=>!ok);
console.log(`\nMilestone Q5.3 Entitlement Engine 2.0 audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
