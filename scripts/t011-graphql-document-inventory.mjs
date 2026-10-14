import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, extname } from "node:path";
const roots=["app","extensions"];
const extensions=new Set([".js",".jsx",".ts",".tsx",".graphql",".gql"]);
const skip=new Set(["node_modules","build",".git","dist",".react-router"]);
const files=[];
function visit(dir) {
  let entries;
  try { entries=readdirSync(dir,{withFileTypes:true}); } catch { return; }
  for (const item of entries) {
    if(item.isSymbolicLink() || skip.has(item.name)) continue;
    const path=join(dir,item.name);
    if(item.isDirectory()) visit(path);
    else if(item.isFile() && extensions.has(extname(item.name))) files.push(path);
  }
}
for(const root of roots) visit(root);
const entries=[];
for(const file of files.sort()) {
  const content=readFileSync(file,"utf8");
  if(file.endsWith(".graphql")||file.endsWith(".gql")) {
    entries.push({file:relative(".",file),kind:"document-file",count:1});
    continue;
  }
  // Inventory only; embedded templates require a real GraphQL parser before codegen.
  const patterns=[/\b(?:gql|graphql)\s*`/g,/\b(?:query|mutation|subscription|fragment)\s+[A-Za-z_][A-Za-z0-9_]*/g];
  const hits=patterns.map(pattern=>[...content.matchAll(pattern)].length);
  const shopifyMarkers=[...content.matchAll(/#graphql\b/g)].length;
  if(hits.some(Boolean)||shopifyMarkers) entries.push({file:relative(".",file),kind:"candidate",taggedTemplates:hits[0],operationTokens:hits[1],shopifyMarkers});
}
const summary={scannedFiles:files.length,candidateFiles:entries.length,documentFiles:entries.filter(e=>e.kind==="document-file").length,entries};
writeFileSync("t011-graphql-operation-inventory.json",JSON.stringify(summary,null,2)+"\n");
console.log("T011 GraphQL source inventory:",JSON.stringify({scannedFiles:summary.scannedFiles,candidateFiles:summary.candidateFiles,documentFiles:summary.documentFiles}));
console.log("NOTE: Inventory is not a replacement for Shopify schema validation or typed GraphQL code generation.");
