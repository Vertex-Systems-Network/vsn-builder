// T040: source-only listing readiness. Metadata flags are NOT authenticated
// Partner Dashboard proof, real screenshots or live Shopify acceptance.
import {readFileSync} from "node:fs";
import {inspectRealListingPng,canonicalListingImagePath} from "./t040-shopify-screenshot-evidence.mjs";
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
// A public policy must be an actual public HTTPS page, not loopback,
// RFC1918, special-use DNS, credentials-in-URL or a homepage placeholder.
// These checks validate URL SHAPE only; external HTTP/Shopify attestations
// remain mandatory separately and can never be inferred from config flags.
const https=url=>{
 if(typeof url!=="string" || url.length>2048)return false;
 try{
  const parsed=new URL(url);
  const hostname=parsed.hostname.toLowerCase().replace(/\.$/,"");
  if(parsed.protocol!=="https:" || parsed.username || parsed.password ||
     parsed.search || parsed.hash || parsed.port || !hostname.includes(".") ||
     /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
     hostname.startsWith("[") ||
     /(?:^|\.)(?:localhost|local|internal|test|example|invalid)$/.test(hostname) ||
     /(?:^|\.)example\.(?:com|net|org)$/.test(hostname) ||
     !/^[-a-z0-9.]+$/.test(hostname) ||
     !parsed.pathname || parsed.pathname==="/")return false;
  return true;
 }catch{return false}
};
export function inspectListingReadiness(config,{screenshotProbe=inspectRealListingPng}={}){
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
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(gates.support_email||"")) ||
    /(?:^|\.)(?:example|test|invalid|local|localhost|internal)$/i.test(
      String(gates.support_email||"").split("@").at(-1)))
  missing.push("support_email");
 const pictures=Array.isArray(gates.screenshots)?gates.screenshots:[];
 // Exactly five privately captured PNGs, each 1600x900, with distinct
 // CONTENT hashes. Image bytes alone NEVER prove real Shopify app UI or
 // correct merchant feature behavior; external E2E is still mandatory.
 const namesValid=pictures.length===SCREENS &&
   new Set(pictures).size===SCREENS &&
   pictures.every(canonicalListingImagePath);
 const images=namesValid?pictures.map(p=>{
   try{return screenshotProbe(p)}catch{return null}
 }):[];
 const contentsValid=namesValid && images.every(x=>
   x && x.format==="png" && x.width===1600 && x.height===900 &&
   typeof x.sha256==="string" && /^[a-f0-9]{64}$/.test(x.sha256)) &&
   new Set(images.map(x=>x.sha256)).size===SCREENS;
 if(!contentsValid)
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
 if(strict && (!proof.metadataComplete || !proof.externallyVerified)){
  // Declaring all flags 'true' cannot self-attest Shopify Partner ownership,
  // live URLs, screenshot provenance, real billing, or merchant E2E.
  // This CLI does not yet have an authenticated external issuer. Fail CLOSED.
  const missing=[...proof.missing,...(!proof.externallyVerified?["external_partner_and_merchant_attestation"]:[])];
  console.error("::error::T040 NOT READY; missing independently certified listing evidence: "+missing.join(", "));
  process.exitCode=1;
  return;
 }
 console.log("T040 listing draft and four paid plan metadata: PASS; external Shopify Partner/screenshot/privacy/support certification: NOT VERIFIED.");
};
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))main();
