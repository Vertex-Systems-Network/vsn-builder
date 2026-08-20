import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePluginManifest } from "../app/sdk/validation.js";
import { scanPluginSource } from "../app/sdk/security.js";
import { VSN_BASELINE } from "../app/config/baseline.js";

const target=process.argv[2];
if(!target){console.error("Usage: npm run plugin:validate -- <manifest.json | plugin-directory>");process.exit(2)}
const resolved=path.resolve(process.cwd(),target);let stat;try{stat=await fs.stat(resolved)}catch{console.error(`Plugin path not found: ${resolved}`);process.exit(2)}
const manifestPath=stat.isDirectory()?path.join(resolved,"manifest.json"):resolved;let manifest;try{manifest=JSON.parse(await fs.readFile(manifestPath,"utf8"))}catch(error){console.error(`Invalid manifest JSON: ${error.message}`);process.exit(1)}
const result=validatePluginManifest(manifest,{appVersion:VSN_BASELINE.version});
let forbidden=[];
if(stat.isDirectory()){
  const walk=async(dir)=>{for(const entry of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory()){if(!["node_modules","dist","build"].includes(entry.name))await walk(full)}else if(/\.(mjs|cjs|js|jsx|ts|tsx)$/.test(entry.name)){const hits=scanPluginSource(await fs.readFile(full,"utf8"));for(const hit of hits)forbidden.push(`${path.relative(resolved,full)}: ${hit}`)}}};await walk(resolved);
}
console.log(`VSN ${VSN_BASELINE.version} · Plugin manifest ${manifest.id||"(unknown)"} ${manifest.version||""}`);
for(const warning of result.warnings)console.log(`WARN  ${warning}`);
for(const error of result.errors)console.error(`ERROR ${error}`);
for(const hit of forbidden)console.error(`ERROR Forbidden API signature: ${hit}`);
if(!result.ok||forbidden.length){console.error(`FAIL (${result.errors.length+forbidden.length} issue(s))`);process.exit(1)}
console.log(`PASS · ${result.manifest.widgets.length} widget declaration(s) · ${result.manifest.dataProviders.length} data provider declaration(s)`);
