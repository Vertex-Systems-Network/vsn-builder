import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("security-sensitive dependency overrides never pin vulnerable known versions", () => {
 const p=JSON.parse(readFileSync("package.json","utf8"));
 assert.equal(p.overrides?.["minimatch@9.0.9"]?.["brace-expansion"],"2.1.7");
 assert.equal(p.overrides?.["@react-router/serve"]?.morgan,"1.12.1");
});

test("resolved production transitive dependencies use patched packages", () => {
 const lock=JSON.parse(readFileSync("package-lock.json","utf8"));
 const packages=lock.packages||{};
 for(const [name,min] of [["brace-expansion","2.1.7"],["morgan","1.12.1"]]){
   const rows=Object.entries(packages).filter(([path,item])=>path.endsWith("/"+name) && !item.dev && !item.devOptional);
   assert(rows.length > 0, "Expected production dependency "+name);
   for(const [path,item] of rows) {
     const actual=String(item.version||"");
     const major=parseInt(actual.split(".")[0],10);
     const sameMajor=major===parseInt(min.split(".")[0],10);
     if(!sameMajor)continue;
     const parts=actual.split(".").map(Number),floor=min.split(".").map(Number);
     assert(parts[0]>floor[0] || parts[1]>floor[1] || (parts[1]===floor[1]&&parts[2]>=floor[2]),
       path+" is pinned below patched "+min+": "+actual);
   }
 }
});
