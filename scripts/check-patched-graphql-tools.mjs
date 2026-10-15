// Strict standalone assertion: patched GraphQL Tools must have no vulnerable
// nested copies. This is NOT a replacement for npm's full development audit.
import fs from "node:fs";
import assert from "node:assert/strict";
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
const lock=JSON.parse(fs.readFileSync("package-lock.json","utf8"));
assert.equal(pkg.overrides?.["@graphql-tools/utils"],"12.0.4","GraphQL Tools patch override drift");
const versions=Object.entries(lock.packages||{})
  .filter(([path])=>path==="node_modules/@graphql-tools/utils"||path.endsWith("/node_modules/@graphql-tools/utils"))
  .map(([path,entry])=>({path,version:entry.version}));
assert(versions.length>0,"No GraphQL Tools utils in lockfile; review codegen dependency removal explicitly");
for(const {path,version}of versions){
 assert(/^12\./.test(version)&&version.localeCompare("12.0.1",undefined,{numeric:true})>=0,
  "Unpatched @graphql-tools/utils in lockfile: "+path+" @"+version);
}
console.log("PASS GraphQL Tools CVE-2026-104852 patch contract: "+versions.length+" copies all >=12.0.1");
