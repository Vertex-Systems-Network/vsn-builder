import assert from "node:assert/strict";
import fs from "node:fs";
import {
  COMMERCIAL_PLANS,
  normalizePlanKey,
  publicPlanKey,
  publicPlanName,
} from "../app/config/commercialPlans.js";
import {
  getShopifyPlanHandleMap,
  resolveInternalPlanKeyFromHandle,
} from "../app/services/shopify-app-pricing.server.js";
import {
  subscriptionMirrorMatchesCurrentPlanHandles,
} from "../app/services/shopify-subscription.server.js";
import {
  BILLING_STATUS_META,
  billingStatusMeta,
  buildBillingLifecycle,
  humanBillingPeriod,
} from "../app/config/billingLifecycle.js";

const read=(file)=>fs.readFileSync(file,"utf8");
const exists=(file)=>fs.existsSync(file);
const checks=[];
async function check(name,fn){try{await fn();checks.push([name,true]);console.log(`PASS  ${name}`)}catch(error){checks.push([name,false]);console.error(`FAIL  ${name}: ${error.message}`)}}
async function withEnv(values,fn){const before={};for(const [key,value] of Object.entries(values)){before[key]=process.env[key];if(value===undefined)delete process.env[key];else process.env[key]=value;}try{return await fn();}finally{for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}}

const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));
const serverBaseline=read("app/config/baseline.js");
const pricingService=read("app/services/shopify-app-pricing.server.js");
const subscriptionService=read("app/services/shopify-subscription.server.js");
const plansRoute=read("app/routes/app.plans.jsx");
const dashboardActions=read("app/services/dashboard-actions.server.js");
const dashboardApp=read("app/components/dashboard/DashboardApp.jsx");
const pricingUi=read("app/components/dashboard/pages/Pricing.jsx");
const licenseUi=read("app/components/dashboard/pages/License.jsx");
const env=read(".env.example");
const docs=read("docs/developer/billing-lifecycle.md");
const noHandleEnv={
  SHOPIFY_APP_PRICING_PLAN_FREE_HANDLE:undefined,
  SHOPIFY_APP_PRICING_PLAN_SILVER_HANDLE:undefined,
  SHOPIFY_APP_PRICING_PLAN_GOLD_HANDLE:undefined,
  SHOPIFY_APP_PRICING_PLAN_PLATINUM_HANDLE:undefined,
  SHOPIFY_APP_PRICING_PLAN_CORE_HANDLE:undefined,
  SHOPIFY_APP_PRICING_PLAN_PRO_HANDLE:undefined,
  SHOPIFY_APP_PRICING_PLAN_CRO_HANDLE:undefined,
  SHOPIFY_APP_PRICING_PLAN_AGENCY_HANDLE:undefined,
};
const currentHandleEnv={...noHandleEnv,
  SHOPIFY_APP_PRICING_PLAN_FREE_HANDLE:"free",
  SHOPIFY_APP_PRICING_PLAN_SILVER_HANDLE:"sliver",
  SHOPIFY_APP_PRICING_PLAN_GOLD_HANDLE:"gold",
  SHOPIFY_APP_PRICING_PLAN_PLATINUM_HANDLE:"platenium",
};
const now=new Date("2026-08-09T06:00:00.000Z");

await check("Version is v2.5.96 or newer",()=>{const [a,b,c]=String(pkg.version).split(".").map(Number);assert.ok(a>2||(a===2&&(b>5||(b===5&&c>=96))))});
await check("Baseline retains Q5.4 or newer billing lineage",()=>{const [a,b,c]=String(baseline.version).split(".").map(Number);assert.ok(a>2||(a===2&&(b>5||(b===5&&c>=96))));assert.ok(/^Q\.5\.[4-9]$/.test(String(baseline.milestone))||/billingLifecycle:\s*2/.test(serverBaseline))});
await check("Q5.4 audit is in release QA",()=>assert.ok(pkg.scripts?.["qa:release"]?.includes("milestone-q54-billing-lifecycle-ux-audit.mjs")));
await check("Q5.4 dedicated command exists",()=>assert.equal(pkg.scripts?.["qa:q54"],"node scripts/milestone-q54-billing-lifecycle-ux-audit.mjs"));
await check("Billing lifecycle config is packaged",()=>assert.equal(exists("app/config/billingLifecycle.js"),true));
await check("Q5.4 developer-mode report is packaged",()=>assert.equal(exists("MILESTONE_Q54_DEVELOPER_MODE.md"),true));
await check("Q5.4 milestone report is packaged",()=>assert.equal(exists("VSN_MILESTONE_Q54_BILLING_LIFECYCLE_UX_REPORT_v2.5.96.md"),true));
await check("Q5.4 developer documentation is packaged",()=>assert.equal(exists("docs/developer/billing-lifecycle.md"),true));

await check("Internal core tier is merchant-facing Free",()=>{assert.equal(COMMERCIAL_PLANS.core.name,"Free");assert.equal(COMMERCIAL_PLANS.core.publicKey,"free")});
await check("Internal pro tier is merchant-facing Silver",()=>{assert.equal(COMMERCIAL_PLANS.pro.name,"Silver");assert.equal(COMMERCIAL_PLANS.pro.publicKey,"silver")});
await check("Internal cro tier is merchant-facing Gold",()=>{assert.equal(COMMERCIAL_PLANS.cro.name,"Gold");assert.equal(COMMERCIAL_PLANS.cro.publicKey,"gold")});
await check("Internal agency tier is merchant-facing Platinum",()=>{assert.equal(COMMERCIAL_PLANS.agency.name,"Platinum");assert.equal(COMMERCIAL_PLANS.agency.publicKey,"platinum")});
await check("Exact Shopify default handles preserve merchant keys",()=>withEnv(noHandleEnv,()=>assert.deepEqual(getShopifyPlanHandleMap(),{core:"free",pro:"sliver",cro:"gold",agency:"platenium"})));
await check("Free alias normalizes to core",()=>assert.equal(normalizePlanKey("free"),"core"));
await check("Silver alias normalizes to pro",()=>assert.equal(normalizePlanKey("silver"),"pro"));
await check("Shopify sliver handle alias normalizes to pro",()=>assert.equal(normalizePlanKey("sliver"),"pro"));
await check("Gold alias normalizes to cro",()=>assert.equal(normalizePlanKey("gold"),"cro"));
await check("Platinum alias normalizes to agency",()=>assert.equal(normalizePlanKey("platinum"),"agency"));
await check("Shopify platenium handle alias normalizes to agency",()=>assert.equal(normalizePlanKey("platenium"),"agency"));
await check("Public plan helper returns Silver",()=>assert.equal(publicPlanName("pro"),"Silver"));
await check("Public plan key helper returns platinum",()=>assert.equal(publicPlanKey("agency"),"platinum"));
await check("Exact Silver Shopify key resolves to internal pro",()=>withEnv(currentHandleEnv,()=>assert.equal(resolveInternalPlanKeyFromHandle("sliver"),"pro")));
await check("Exact Platinum Shopify key resolves to internal agency",()=>withEnv(currentHandleEnv,()=>assert.equal(resolveInternalPlanKeyFromHandle("platenium"),"agency")));
await check("Public plan env overrides legacy internal env",()=>withEnv({...currentHandleEnv,SHOPIFY_APP_PRICING_PLAN_SILVER_HANDLE:"sliver",SHOPIFY_APP_PRICING_PLAN_PRO_HANDLE:"legacy-pro"},()=>assert.equal(getShopifyPlanHandleMap().pro,"sliver")));
await check("Legacy plan env remains fallback-compatible",()=>withEnv({...noHandleEnv,SHOPIFY_APP_PRICING_PLAN_PRO_HANDLE:"legacy-pro"},()=>assert.equal(getShopifyPlanHandleMap().pro,"legacy-pro")));

await check("Active billing status has success tone",()=>assert.equal(BILLING_STATUS_META.active.tone,"success"));
await check("Trial billing status is merchant-readable",()=>assert.equal(billingStatusMeta("trialing").label,"Trial"));
await check("Cancellation status is merchant-readable",()=>assert.equal(billingStatusMeta("canceling").label,"Cancellation scheduled"));
await check("Frozen state is critical",()=>assert.equal(billingStatusMeta("frozen").tone,"critical"));
await check("30-day billing period is humanized",()=>assert.equal(humanBillingPeriod("EVERY_30_DAYS"),"Every 30 days"));
await check("Annual billing period is humanized",()=>assert.equal(humanBillingPeriod("ANNUAL"),"Annual"));

await check("Trial lifecycle exposes remaining days",()=>{const life=buildBillingLifecycle({key:"pro",entitlementVerified:true,developerMode:false,subscription:{status:"trialing",verifiedAt:now.toISOString(),trialEndsAt:"2026-08-12T06:00:00.000Z",billingPeriod:"EVERY_30_DAYS"}},{now});assert.equal(life.currentName,"Silver");assert.equal(life.statusLabel,"Trial");assert.equal(life.trialDaysRemaining,3)});
await check("Pending Gold change is classified as upgrade from Silver",()=>{const life=buildBillingLifecycle({key:"pro",entitlementVerified:true,subscription:{status:"active",verifiedAt:now.toISOString(),pendingPlanKey:"cro",pendingPlanHandle:"gold"}},{now});assert.equal(life.pendingKind,"upgrade");assert.equal(life.pendingName,"Gold");assert.equal(life.pendingHandle,"gold")});
await check("Pending Silver change is classified as downgrade from Gold",()=>{const life=buildBillingLifecycle({key:"cro",entitlementVerified:true,subscription:{status:"active",verifiedAt:now.toISOString(),pendingPlanKey:"pro",pendingPlanHandle:"sliver"}},{now});assert.equal(life.pendingKind,"downgrade");assert.equal(life.pendingName,"Silver")});
await check("Cancellation schedules Free fallback",()=>{const life=buildBillingLifecycle({key:"pro",entitlementVerified:true,subscription:{status:"canceling",verifiedAt:now.toISOString(),cancelAtEndOfCycle:true,pendingPlanKey:"core",pendingPlanHandle:"free",cancelEffectiveOn:"2026-08-31"}},{now});assert.equal(life.pendingKind,"cancellation");assert.equal(life.pendingName,"Free")});
await check("Billing-period-only pending change is retained",()=>{const life=buildBillingLifecycle({key:"pro",entitlementVerified:true,subscription:{status:"active",verifiedAt:now.toISOString(),pendingPlanKey:"pro",pendingBillingPeriod:"ANNUAL"}},{now});assert.equal(life.pendingKind,"plan-update");assert.equal(life.pendingBillingPeriodLabel,"Annual")});
await check("Developer lifecycle is clearly simulation",()=>{const life=buildBillingLifecycle({key:"agency",developerMode:true,subscription:{status:"active"}},{now});assert.equal(life.currentName,"Platinum");assert.equal(life.status,"local");assert.equal(life.statusLabel,"Developer simulation")});

await check("Current Silver cache handle remains reusable",()=>withEnv(currentHandleEnv,()=>assert.equal(subscriptionMirrorMatchesCurrentPlanHandles({status:"active",planKey:"pro",planHandle:"sliver"}),true)));
await check("Old Pro cache handle forces automatic re-verification",()=>withEnv(currentHandleEnv,()=>assert.equal(subscriptionMirrorMatchesCurrentPlanHandles({status:"active",planKey:"pro",planHandle:"pro"}),false)));
await check("Old Agency cache handle forces automatic re-verification",()=>withEnv(currentHandleEnv,()=>assert.equal(subscriptionMirrorMatchesCurrentPlanHandles({status:"trialing",planKey:"agency",planHandle:"agency"}),false)));
await check("Canceled mirrors remain safely cache-compatible",()=>withEnv(currentHandleEnv,()=>assert.equal(subscriptionMirrorMatchesCurrentPlanHandles({status:"canceled",planKey:"core",planHandle:"legacy"}),true)));
await check("Fresh-cache shortcut checks current handle mapping",()=>assert.ok(subscriptionService.includes("subscriptionMirrorIsFresh(existing,now)&&subscriptionMirrorMatchesCurrentPlanHandles(existing)")));

await check("Dashboard License exposes manual Shopify refresh",()=>assert.ok(licenseUi.includes('name="intent" value="billing-refresh"')&&licenseUi.includes("Refresh Shopify status")));
await check("Dashboard refresh shows verification errors",()=>assert.ok(licenseUi.includes("Verification warning")&&licenseUi.includes("lastSyncError")));
await check("Dashboard lifecycle shows trial and current cycle",()=>assert.ok(licenseUi.includes("trialDaysRemaining")&&licenseUi.includes("Current cycle")));
await check("Dashboard lifecycle shows pending upgrade/downgrade",()=>assert.ok(licenseUi.includes("pendingKind")&&licenseUi.includes("Upgrade pending")&&licenseUi.includes("Downgrade pending")));
await check("Dashboard lifecycle shows scheduled cancellation",()=>assert.ok(licenseUi.includes("Cancellation scheduled")&&licenseUi.includes("cancelEffectiveOn")));
await check("Billing manage CTA remains permission-restricted",()=>assert.ok(licenseUi.includes("canManageBilling")&&licenseUi.includes("Billing changes restricted")&&licenseUi.includes("Manage plan in Shopify")));
await check("Dashboard passes sync diagnostics into pricing UI",()=>assert.ok(dashboardApp.includes("subscriptionSync={dashboard?.subscriptionSync}")));
await check("Pricing page labels all four public plans",()=>assert.ok(pricingUi.includes("Free, Silver, Gold & Platinum")));
await check("Standalone Plans route exposes lifecycle card",()=>assert.ok(plansRoute.includes("Shopify billing lifecycle")&&plansRoute.includes("buildBillingLifecycle")));
await check("Standalone Plans route exposes manual refresh",()=>assert.ok(plansRoute.includes('intent==="billing-refresh"')&&plansRoute.includes("Refresh Shopify status")));
await check("Standalone billing refresh requires billing view permission",()=>assert.ok(plansRoute.includes('canAccessBuilderAction(db,session,"billing","view")')));
await check("Dashboard billing refresh requires billing view permission",()=>assert.ok(dashboardActions.includes('canAccessBuilderAction(db, session, "billing", "view")')));
await check("Billing refresh forces verified sync",()=>assert.ok(plansRoute.includes("force:true")&&dashboardActions.includes("force:true")));
await check("Plan changes remain billing-manage restricted",()=>assert.ok(plansRoute.includes('canAccessBuilderAction(db,session,"billing","manage")')));
await check("Plans mutation keeps trusted-origin protection",()=>assert.ok(plansRoute.includes("assertTrustedMutationRequest(request)")));
await check("Shopify plan return remains untrusted",()=>assert.ok(pricingService.includes("trustedForEntitlements: false")));
await check("No legacy Billing API mutation was introduced",()=>assert.doesNotMatch(pricingService+subscriptionService+plansRoute+dashboardActions,/appSubscriptionCreate\s*\(|appSubscriptionCancel\s*\(/));

await check("Environment documents exact Free handle",()=>assert.ok(env.includes("SHOPIFY_APP_PRICING_PLAN_FREE_HANDLE=free")));
await check("Environment documents exact Silver handle spelling",()=>assert.ok(env.includes("SHOPIFY_APP_PRICING_PLAN_SILVER_HANDLE=sliver")));
await check("Environment documents exact Gold handle",()=>assert.ok(env.includes("SHOPIFY_APP_PRICING_PLAN_GOLD_HANDLE=gold")));
await check("Environment documents exact Platinum handle spelling",()=>assert.ok(env.includes("SHOPIFY_APP_PRICING_PLAN_PLATINUM_HANDLE=platenium")));
await check("Developer docs explain stable internal IDs",()=>assert.ok(docs.includes("stable internal ID")&&docs.includes("`core`")&&docs.includes("`agency`")));
await check("Developer docs preserve exact Shopify spelling",()=>assert.ok(docs.includes("`sliver`")&&docs.includes("`platenium`")));
await check("No Q5.4 Prisma migration was added",()=>assert.equal(fs.readdirSync("prisma/migrations").some((name)=>/q54|billing_lifecycle|plan_key_mapping/i.test(name)),false));

const failed=checks.filter(([,ok])=>!ok);
console.log(`\nMilestone Q5.4 Billing Lifecycle UX audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
