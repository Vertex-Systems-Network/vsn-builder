// Strict stand-alone security contract for the GraphQL Tools utilities
// vulnerable dependency family. Either it is absent from the installed
// dependency graph, or EVERY locked copy is patched. This never replaces the
// mandatory npm production + development security audits, which run in CI.
import fs from "node:fs";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";

const NAME="@graphql-tools/utils";
const MIN_PATCH="12.0.1";
export function checkGraphqlToolsLock(pkg,lock) {
 assert(pkg && typeof pkg==="object" && lock && typeof lock==="object");
 assert(Number.isSafeInteger(lock.lockfileVersion) && lock.lockfileVersion>=2 &&
   lock.packages && typeof lock.packages==="object" && !Array.isArray(lock.packages),
   "Missing complete npm lockfile package tree");
 const versions=Object.entries(lock.packages||{})
  .filter(([path])=>path==="node_modules/"+NAME ||
   path.endsWith("/node_modules/"+NAME))
  .map(([path,entry])=>({path,version:entry?.version}));
 if(versions.length===0) {
  // Explicitly certified REMOVAL: Shopify GraphQL codegen no longer depends
  // on GraphQL Tools, so a removed override MUST NOT be required.
  // npm ci and independent audit/codegen CI check lockfile consistency.
  for(const section of ["dependencies","devDependencies",
   "optionalDependencies","peerDependencies"]) {
   assert(!Object.hasOwn(pkg[section]||{},NAME),
    "GraphQL Tools directly declared but absent from lockfile");
  }
  assert(!(pkg.overrides && Object.hasOwn(pkg.overrides,NAME)),
   "Unused GraphQL Tools override must be removed after dependency removal");
  return {state:"absent",copies:0};
 }
 for(const {path,version} of versions) {
  assert(typeof version==="string" &&
   /^12\.(\d+)\.(\d+)(?:[-+].*)?$/.test(version) &&
   version.localeCompare(MIN_PATCH,undefined,{numeric:true})>=0,
   "Unpatched "+NAME+" in lockfile: "+path);
 }
 return {state:"patched",copies:versions.length};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
 const lock=JSON.parse(fs.readFileSync("package-lock.json","utf8"));
 const result=checkGraphqlToolsLock(pkg,lock);
 console.log("PASS GraphQL Tools CVE-2026-104852 contract: "+result.state+
  " ("+result.copies+" locked copies); mandatory npm audits and Shopify codegen remain separately enforced");
}
