// T040: source-only listing readiness. Metadata flags are NOT authenticated
// Partner Dashboard proof, real screenshots or live Shopify acceptance.
import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {COMMERCIAL_PLANS,PLAN_ORDER,PAID_TRIAL_DAYS} from "../app/config/commercialPlans.js";
const CONFIG="config/shopify-listing-readiness.json";
const SOURCE="docs/launch/shopify-builder-app-store-draft.md";
const needs=[
 "shopify_partner_ownership","public_app_identity","plan_publication",
 "stable_live_https","reviewer_access","real_shopify_oauth_e2e",
 "real_shopify_billing_e2e","real_theme_browser_e2e","production_release_accepted",
];
const SCREENS=5;
const https=url=>{try{return new URL(url).protocol==="https:" && Boolean(new URL(url).hostname) &&
 !/(?:^|\.)(example\.com|example\.org|example\.net|invalid|localhost)$/.test(new URL(url).hostname)}catch{return false}};
export function inspectListingReadiness(config,{screenshotExists=existsSync}={}){
 const errors=[];
 if(config.public_app!=="VSN | Builder"||config.public_app_count!==1)
  errors.push("Must have exactly ONE named public Shopify app");
 if(config.commerce?.free_plan!==false)errors.push("Free tier forbidden");
 if(JSON.stringify(config.commerce?.plan_ids)!==JSON.stringify(PLAN_ORDER))
  errors.push("Public canonical plan IDs do not match source");
 if(config.commerce?.trial_days!==PAID_TRIAL_DAYS)errors.push("Incorrect Shopify trial length");
 for(const id of PLAN_ORDER){
  if(config.commerce?.monthly_usd?.[id]!==COMMERCIAL_PLANS[id].monthlyUsd)
   errors.push("Wrong monthly plan price "+id);
 }
 if(config.commerce?.annual_usd?.platinum!==3000 ||
    Object.keys(config.commerce?.annual_usd||{}).length!==1)
  errors.push("Platinum annual pricing mismatch");
 const gates=config.verified||{};
 const missing=needs.filter(k=>gates[k]!==true);
 if(!https(gates.privacy_policy_url))missing.push("privacy_policy_url");
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(gates.support_email||"")))
  missing.push("support_email");
 const pictures=Array.isArray(gates.screenshots)?gates.screenshots:[];
 if(pictures.length<SCREENS || new Set(pictures).size!==pictures.length ||
    pictures.some(p=>typeof p!=="string" || !p.startsWith("docs/launch/evidence/") ||
      !/\.(?:png|jpe?g|webp)$/i.test(p)||!screenshotExists(p)))
   missing.push("five_real_distinct_capture_files");
 if(config.release?.submitted===true)errors.push("Draft manifest must not claim a submitted Shopify review");
 if(config.release?.submission_allowed===true && (errors.length||missing.length))
   errors.push("Premature Shopify submission flag");
 return {validDraft:errors.length===0,metadataComplete:errors.length===0&&missing.length===0,
  missing,errors,externallyVerified:false};
}
const main=()=>{
 const config=JSON.parse(readFileSync(CONFIG,"utf8"));
 const copy=readFileSync(SOURCE,"utf8");
 const proof=inspectListingReadiness(config);
 if(!copy.includes("DRAFT, NOT PUBLISHABLE") ||
    !copy.includes("Shopify App Store") ||
    !copy.includes("Privacy and data mapping") ||
    !copy.includes("Five real, distinct screenshots"))
   proof.errors.push("Missing mandatory merchant copy / draft disclosure");
 for(const e of proof.errors)console.error("::error::T040 "+e);
 if(proof.errors.length){process.exitCode=1;return}
 const strict=process.argv.includes("--strict");
 if(strict && !proof.metadataComplete){
  console.error("::error::T040 NOT READY; missing independently certified listing evidence: "+proof.missing.join(", "));
  process.exitCode=1;
  return;
 }
 console.log("T040 listing draft and four paid plan metadata: PASS; external Shopify Partner/screenshot/privacy/support certification: NOT VERIFIED.");
};
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))main();
