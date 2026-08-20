import assert from "node:assert/strict";
import fs from "node:fs";

const read=(file)=>fs.readFileSync(file,"utf8");
const exists=(file)=>fs.existsSync(file);
const checks=[];
const versionAtLeast=(value,min)=>{const a=String(value).split(".").map(Number),b=String(min).split(".").map(Number);for(let i=0;i<Math.max(a.length,b.length);i++){const av=a[i]||0,bv=b[i]||0;if(av!==bv)return av>bv;}return true;};
async function check(name,fn){try{await fn();checks.push([name,true]);console.log(`PASS  ${name}`)}catch(error){checks.push([name,false]);console.error(`FAIL  ${name}: ${error.message}`)}}

const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));
const shared=read("app/config/stock-media.js");
const integration=read("app/services/stock-image-integrations.server.js");
const images=read("app/routes/app.stock-images.jsx");
const videos=read("app/routes/app.stock-videos.jsx");
const audio=read("app/routes/app.stock-audio.jsx");
const k3=read("scripts/k3-client-server-boundary-audit.mjs");
const plans=read("app/config/commercialPlans.js");

await check("Version is v2.5.105 or newer",()=>assert.ok(versionAtLeast(pkg.version,"2.5.105")));
await check("Baseline retains Q.6.3 lineage",()=>{assert.ok(versionAtLeast(baseline.version,"2.5.105"));assert.ok(String(baseline.milestone).startsWith("Q.6"))});
await check("Developer Mode report exists",()=>assert.ok(exists("MILESTONE_Q634_DEVELOPER_MODE.md")));
await check("Release report exists",()=>assert.ok(exists("VSN_MILESTONE_Q634_STOCK_ROUTE_BOUNDARY_HOTFIX_REPORT_v2.5.105.md")));
await check("Shared stock media config exists",()=>assert.ok(exists("app/config/stock-media.js")));
await check("Shared stock media config has no server imports",()=>assert.doesNotMatch(shared,/\.server(?:\.[jt]sx?)?["']/));
await check("Shared stock media config has no DB or Prisma imports",()=>assert.doesNotMatch(shared,/db\.server|@prisma|shopify\.server/));
await check("Shared stock media config has no environment or secret access",()=>assert.doesNotMatch(shared,/process\.env|decryptSecret|encryptSecret|secret-vault/));
await check("Shared image provider contract is retained",()=>assert.ok(shared.includes('STOCK_IMAGE_PROVIDERS = Object.freeze(["unsplash", "pexels", "pixabay", "shutterstock", "getty"])')));
await check("Shared video provider contract is retained",()=>assert.ok(shared.includes('STOCK_VIDEO_PROVIDERS = Object.freeze(["pexels", "pixabay", "shutterstock", "getty"])')));
await check("Shared audio provider contract is retained",()=>assert.ok(shared.includes('STOCK_AUDIO_PROVIDERS = Object.freeze(["freesound", "shutterstock"])')));

for(const [label,source,constant] of [["Stock Images",images,"STOCK_IMAGE_PROVIDERS"],["Stock Videos",videos,"STOCK_VIDEO_PROVIDERS"],["Stock Audio",audio,"STOCK_AUDIO_PROVIDERS"]]){
  await check(`${label} imports provider list from client-safe config`,()=>assert.match(source,new RegExp(`import\\s*\\{\\s*${constant}\\s*\\}\\s*from\\s*"\\.\\.\\/config\\/stock-media\\.js"`)));
  await check(`${label} does not import provider list from server integration`,()=>assert.doesNotMatch(source,new RegExp(`import\\s*\\{[^}]*${constant}[^}]*\\}\\s*from\\s*"\\.\\.\\/services\\/stock-image-integrations\\.server\\.js"`)));
  await check(`${label} still keeps provider settings loader server-only`,()=>assert.match(source,/import \{ loadStockProviderPublicSettings \} from "\.\.\/services\/stock-image-integrations\.server\.js"/));
}

await check("Server integration consumes shared provider contract",()=>assert.match(integration,/from "\.\.\/config\/stock-media\.js"/));
await check("Server integration keeps public re-exports for server compatibility",()=>assert.match(integration,/export \{[\s\S]*STOCK_IMAGE_PROVIDERS[\s\S]*\} from "\.\.\/config\/stock-media\.js"/));
await check("Server integration still owns encrypted credentials",()=>assert.match(integration,/decryptSecret|encryptSecret/));
await check("K3 audit now checks stock client/server boundary",()=>assert.ok(k3.includes("stock media provider contract is client-safe")&&k3.includes("does not import ${providerConst} from .server module")));
await check("Q6.3.3 historical audit is future-safe",()=>{const q=read("scripts/milestone-q633-stock-usage-premium-history-audit.mjs");assert.ok(q.includes("Version is v2.5.104 or newer")&&q.includes("Baseline retains Q.6.3 lineage"))});
await check("No new Prisma migration was added",()=>assert.equal(fs.readdirSync("prisma/migrations").some((name)=>/q634|boundary_hotfix/i.test(name)),false));
await check("Exact Shopify billing handles remain unchanged",()=>{for(const handle of ["free","sliver","gold","platenium"])assert.ok(plans.includes(handle),handle)});

const failed=checks.filter(([,ok])=>!ok);
console.log(`\nMilestone Q.6.3.4 Stock Route Boundary hotfix audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
