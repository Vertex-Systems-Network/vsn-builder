// Phase 1 identity uniqueness check. Do NOT log or persist client IDs.
// The inputs should be supplied only by authorized, protected environments.
// This does not verify Shopify Partner ownership/installation.
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
 if(row.value && row.value.toLowerCase()===sourceId.toLowerCase())
   errors.push(row.tier+" Shopify Client ID reuses unclassified default app");
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
 console.log("Three-tier Shopify identity syntax and uniqueness PASS; actual Partner ownership and merchant OAuth are NOT verified.");
}
