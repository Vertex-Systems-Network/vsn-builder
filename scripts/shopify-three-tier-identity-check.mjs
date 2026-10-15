// Identity uniqueness check. Never log Shopify client IDs.
// Shopify Admin read-only verification on 2026-10-16 established that the
// existing canonical root app is the ONE eventual public VSN Builder app.
// Dev/Staging are separate internal testing identities, NOT public listings.
// This is not Shopify Partner organization ownership or OAuth acceptance.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const source=fs.readFileSync(path.join(root,"shopify.app.toml"),"utf8");
const sourceId=source.match(/^client_id\s*=\s*"([^"]*)"/m)?.[1]||"";
const required=[
 ["Development","SHOPIFY_DEVELOPMENT_CLIENT_ID"],
 ["Staging","SHOPIFY_STAGING_CLIENT_ID"],
 ["Production","SHOPIFY_PRODUCTION_CLIENT_ID"],
];
const raw=required.map(([tier,key])=>({tier,key,value:String(process.env[key]||"").trim()}));
const errors=[];
for(const row of raw) {
 if(!/^[a-f0-9]{32}$/i.test(row.value))
   errors.push(row.tier+" Shopify Client ID missing or invalid format");
 if(row.value && row.tier==="Production" && row.value.toLowerCase()!==sourceId.toLowerCase())
   errors.push("Production Shopify Client ID must match canonical public VSN Builder app");
 if(row.value && row.tier!=="Production" && row.value.toLowerCase()===sourceId.toLowerCase())
   errors.push(row.tier+" Shopify Client ID reuses canonical public Live app");
}
for(let i=0;i<raw.length;i++){
 for(let j=i+1;j<raw.length;j++){
  if(raw[i].value && raw[j].value && raw[i].value.toLowerCase()===raw[j].value.toLowerCase())
   errors.push(raw[i].tier+" and "+raw[j].tier+" must use different Shopify apps");
 }
}
if(errors.length){
 for(const error of errors)console.error("FAIL "+error);
 console.error("Three-tier Shopify identity check BLOCKED.");
 process.exitCode=1;
}else{
 console.log("One-public-app tier identity syntax and uniqueness PASS; actual Partner organization ownership and merchant OAuth are NOT verified.");
}
