// T040: Auditable Shopify listing preparation. This validator never submits or
// publishes an app, nor treats draft copy as real Partner Dashboard evidence.
import {readFileSync,existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {COMMERCIAL_PLANS,PLAN_ORDER} from "../app/config/commercialPlans.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const draft="docs/launch/shopify-builder-app-store-listing-draft.md";
const outputs=[
 ["App icon","docs/launch/assets/vsn-builder-app-icon.png"],
 ...[1,2,3,4,5].map(n=>["Desktop screenshot "+n,
   "docs/launch/assets/vsn-builder-screenshot-"+n+".png"]),
];
const pricing=[
 ["starter",30,null],["sliver",100,null],["gold",150,null],["platinum",350,3000],
];
export function inspectListingDraft({rootDir=root}={}){
 const failures=[],pending=[];
 const filename=path.join(rootDir,draft);
 if(!existsSync(filename))return {draftValid:false,ready:false,failures:["MISSING_LISTING_DRAFT"],pending};
 const md=readFileSync(filename,"utf8");
 if(!md.includes("**App name:** VSN | Builder"))failures.push("WRONG_APP_NAME");
 if(!md.includes("ONE eventual public"))failures.push("ONE_PUBLIC_APP_POLICY_MISSING");
 if(!md.includes("NOT submitted"))failures.push("DRAFT_NOT_MARKED");
 if(PLAN_ORDER.join(",")!==pricing.map(x=>x[0]).join(","))
  failures.push("CANONICAL_PLAN_ORDER_CHANGED");
 if(COMMERCIAL_PLANS.free!==undefined)failures.push("FREE_TIER_FORBIDDEN");
 for(const [id,month,year] of pricing){
  const config=COMMERCIAL_PLANS[id];
  if(config?.shopifyHandle!==id || config.monthlyUsd!==month ||
     config.annualUsd!==year || config.trialDays!==10)failures.push("PLAN_"+id+"_MISMATCH");
  const escaped=id[0].toUpperCase()+id.slice(1);
  const money=year===null?"—":String(year);
  if(!md.includes("| "+escaped+" | `"+id+"` | "+month+" | "+money+" | 10 days |"))
   failures.push("DRAFT_PLAN_"+id+"_MISMATCH");
 }
 if(!md.includes("**Privacy Policy public HTTPS URL:** NOT VERIFIED"))
  failures.push("PRIVACY_POLICY_UNVERIFIED_NOTICE_MISSING");
 if(!md.includes("**Support landing public HTTPS URL:** NOT VERIFIED"))
  failures.push("SUPPORT_UNVERIFIED_NOTICE_MISSING");
 for(const [name,asset] of outputs)if(!existsSync(path.join(rootDir,asset)))
  pending.push("MISSING_"+name.toUpperCase().replaceAll(" ","_"));
 for(const item of ["VERIFIED_PRIVACY_POLICY_URL","VERIFIED_PUBLIC_SUPPORT_URL",
  "PARTNER_OWNER_AND_PLAN_PROOF","REAL_SHOPIFY_E2E_SHOP_PROOF",
  "EXACT_RELEASE_SHA_AND_ROLLBACK_PROOF","SHOPIFY_REVIEWER_ACCESS_PROOF"]){
  // These external validations can only be confirmed by authorized live
  // evidence; never substitute repository copy, a URL guess, or a mock.
  pending.push(item);
 }
 return {draftValid:failures.length===0,ready:failures.length===0 && pending.length===0,
  failures,pending,onePublicApp:true,paidPlans:pricing.map(x=>x[0])};
}
const script=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(script){
 const state=inspectListingDraft();
 console.log("T040 draft copy: "+(state.draftValid?"VALID":"INVALID")+
  "; Shopify release-listing READY: "+(state.ready?"YES":"NO")+
  "; missing evidence: "+state.pending.length);
 for(const f of state.failures)console.error("::error::T040_"+f);
 for(const p of state.pending)console.log("PENDING "+p);
 if(!state.draftValid || (process.argv.includes("--assert-ready")&&!state.ready))process.exitCode=1;
}
