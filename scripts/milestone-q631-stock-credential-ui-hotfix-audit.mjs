import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { encryptSecret } from "../app/services/secret-vault.server.js";
import { loadStockProviderCredentials, loadStockProviderPublicSettings, saveStockProviderSettings } from "../app/services/stock-image-integrations.server.js";

const read=(file)=>fs.readFileSync(file,"utf8");
const exists=(file)=>fs.existsSync(file);
const versionAtLeast=(value,min)=>{const a=String(value).split(".").map(Number),b=String(min).split(".").map(Number);for(let i=0;i<Math.max(a.length,b.length);i++){const av=a[i]||0,bv=b[i]||0;if(av!==bv)return av>bv;}return true;};
const checks=[];
async function check(name,fn){try{await fn();checks.push([name,true]);console.log(`PASS  ${name}`)}catch(error){checks.push([name,false]);console.error(`FAIL  ${name}: ${error.message}`)}}

const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));
const baselineJs=read("app/config/baseline.js");
const settings=read("app/components/dashboard/pages/Settings.jsx");
const providerUi=read("app/components/dashboard/settings/StockImageIntegrationsSettings.jsx");
const integration=read("app/services/stock-image-integrations.server.js");
const stockRoute=read("app/routes/app.stock-images.jsx");
const stockService=read("app/services/stock-images.server.js");
const css=read("app/styles/dashboard.css");
const env=read(".env.example");
const q63=read("scripts/milestone-q63-stock-image-hub-audit.mjs");
const plans=read("app/config/commercialPlans.js");

await check("Version is v2.5.102 or newer",()=>assert.ok(versionAtLeast(pkg.version,"2.5.102")));
await check("Baseline retains Q.6.3 lineage",()=>{assert.ok(versionAtLeast(baseline.version,"2.5.102"));assert.ok(String(baseline.milestone).startsWith("Q.6"))});
await check("Stock Image Hub schema remains v2 or newer",()=>{const m=baselineJs.match(/stockImageHub:\s*(\d+)/);assert.ok(m&&Number(m[1])>=2)});
await check("Q6.3.1 Developer Mode report exists",()=>assert.ok(exists("MILESTONE_Q631_DEVELOPER_MODE.md")));
await check("Q6.3.1 release report exists",()=>assert.ok(exists("VSN_MILESTONE_Q631_STOCK_CREDENTIAL_UI_HOTFIX_REPORT_v2.5.102.md")));
await check("Dedicated Q6.3.1 QA command exists",()=>assert.equal(pkg.scripts?.["qa:q631"],"node scripts/milestone-q631-stock-credential-ui-hotfix-audit.mjs"));
await check("Q6.3.1 audit is in full release chain",()=>assert.ok(pkg.scripts?.["qa:release"]?.includes("milestone-q631-stock-credential-ui-hotfix-audit.mjs")));
await check("Q6.3 historical audit is future-safe",()=>assert.ok(q63.includes("Version is v2.5.101 or newer")&&q63.includes("startsWith(\"Q.6\")")));

await check("Credential UI is extracted from Settings",()=>assert.ok(settings.includes("StockImageIntegrationsSettings")&&exists("app/components/dashboard/settings/StockImageIntegrationsSettings.jsx")));
await check("Settings uses nested credential drafts",()=>assert.ok(settings.includes("stockCredentials")&&settings.includes("credentials:{...(stockCredentials?.[provider]||{})}")));
await check("Credential paste handler captures value before state update",()=>assert.ok(/const\s+nextValue\s*=\s*event\.currentTarget\.value/.test(providerUi)&&/onChange\(nextValue\)/.test(providerUi)));
await check("Legacy unsafe stockKeys event updater is gone",()=>assert.doesNotMatch(settings,/setStockKeys|stockKeys\[/));
await check("Credential field supports paste/autofill-safe controlled value",()=>assert.ok(providerUi.includes('autoComplete="new-password"')&&providerUi.includes('spellCheck={false}')));
await check("Credential visibility toggle exists",()=>assert.ok(providerUi.includes("EyeOff")&&providerUi.includes("vsn-stock-secret-toggle")));

await check("Unsplash exposes Access Key field",()=>assert.ok(/key:\s*"accessKey",\s*label:\s*"Access Key"/.test(providerUi)));
await check("Unsplash exposes Secret Key field",()=>assert.ok(/key:\s*"secretKey",\s*label:\s*"Secret Key"/.test(providerUi)));
await check("Unsplash Secret Key environment fallback is documented",()=>assert.ok(integration.includes('UNSPLASH_SECRET_ENV = "UNSPLASH_SECRET_KEY"')&&env.includes("UNSPLASH_SECRET_KEY=")));
await check("Unsplash legacy apiKey is accepted as Access Key",()=>assert.ok(/secretObj\.accessKey\s*\|\|\s*secretObj\.apiKey/.test(integration)));
await check("Unsplash Access and Secret Keys are encrypted separately",()=>assert.ok(/nextSecrets\.accessKey\s*=\s*encryptSecret/.test(integration)&&/nextSecrets\.secretKey\s*=\s*encryptSecret/.test(integration)));
await check("Unsplash public settings expose only masked credential state",()=>{assert.ok(integration.includes("maskedAccessKey")&&integration.includes("maskedSecretKey")&&integration.includes("secretConfigured"));const publicBlock=integration.slice(integration.indexOf("function publicProviderSettings"),integration.indexOf("export async function loadStockProviderPublicSettings"));assert.doesNotMatch(publicBlock,/secretKey:\s*row\.secretKey|accessKey:\s*row\.accessKey/)});
await check("Unsplash public search still uses Access Key Client-ID auth",()=>assert.ok(stockService.includes("Client-ID ${auth.apiKey}")));
await check("Unsplash Secret Key is not sent in public stock requests",()=>assert.doesNotMatch(stockService,/auth\.secretKey|UNSPLASH_SECRET_KEY/));
await check("Pexels and Pixabay retain single API key model",()=>assert.ok(/key:\s*"apiKey",\s*label:\s*"API Key"/.test(providerUi)));

await check("Provider cards use one stable vertical settings stack",()=>assert.ok(css.includes(".vsn-stock-provider-settings{display:flex;flex-direction:column")));
await check("Credential inputs can shrink without overflowing grid",()=>assert.ok(css.includes(".vsn-stock-secret-input{display:flex")&&css.includes("min-width:0")&&css.includes("box-sizing:border-box;width:100%")));
await check("Unsplash two-key layout is responsive",()=>assert.ok(css.includes(".vsn-stock-credentials.has-two{grid-template-columns:repeat(2,minmax(0,1fr))")&&css.includes(".vsn-stock-credentials.has-two,.vsn-stock-provider-options,.vsn-stock-provider-options-pixabay{grid-template-columns:1fr}")));
await check("Provider options use responsive minmax grids",()=>assert.ok(css.includes(".vsn-stock-provider-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))")));
await check("Dark mode credential fields are styled",()=>assert.ok(css.includes(".dashboard-root.dark .vsn-stock-secret-input input")));
await check("Provider documentation links are visible",()=>assert.ok(providerUi.includes("API documentation")&&providerUi.includes("https://unsplash.com/documentation")&&providerUi.includes("https://www.pexels.com/api/documentation/")&&providerUi.includes("https://pixabay.com/api/docs/")));

await check("Stock advanced options use stable value helper",()=>assert.ok(/const\s+setAdvancedValue\s*=\s*\(key,value\)/.test(stockRoute)||/const\s+setAdvancedValue\s*=\s*\(key,\s*value\)/.test(stockRoute))&&assert.ok(/setAdvancedValue\("orderBy",\s*e\.currentTarget\.value\)/.test(stockRoute)));
await check("Stock advanced options no longer close over SyntheticEvent in state updater",()=>assert.doesNotMatch(stockRoute,/setAdvanced\([^\n]*e\.currentTarget/));

await check("Encrypted dual Unsplash credentials round-trip and blank save preserves them",async()=>{
  let row=null;
  const db={builderIntegration:{
    findFirst:async()=>row,
    create:async({data})=>{row={id:"row-1",...data,createdAt:new Date(),updatedAt:new Date()};return row;},
    update:async({data})=>{row={...row,...data,updatedAt:new Date()};return row;},
  }};
  await saveStockProviderSettings(db,"qa.myshopify.com",{unsplash:{enabled:true,credentials:{accessKey:"access-123456",secretKey:"secret-654321"},config:{orderBy:"latest",contentFilter:"high"}}});
  const first=await loadStockProviderCredentials(db,"qa.myshopify.com","unsplash");
  assert.equal(first.accessKey,"access-123456");assert.equal(first.secretKey,"secret-654321");assert.equal(first.configured,true);assert.equal(first.secretConfigured,true);
  await saveStockProviderSettings(db,"qa.myshopify.com",{unsplash:{enabled:true,credentials:{accessKey:"",secretKey:""},config:{orderBy:"latest",contentFilter:"high"}}});
  const second=await loadStockProviderCredentials(db,"qa.myshopify.com","unsplash");
  assert.equal(second.accessKey,"access-123456");assert.equal(second.secretKey,"secret-654321");
  const pub=await loadStockProviderPublicSettings(db,"qa.myshopify.com");
  assert.equal(pub.unsplash.configured,true);assert.equal(pub.unsplash.secretConfigured,true);assert.ok(pub.unsplash.maskedAccessKey.endsWith("3456"));assert.ok(pub.unsplash.maskedSecretKey.endsWith("4321"));assert.equal("accessKey" in pub.unsplash,false);assert.equal("secretKey" in pub.unsplash,false);
});

await check("Legacy encrypted Unsplash apiKey loads as Access Key",async()=>{
  const row={id:"legacy",shop:"legacy.myshopify.com",provider:"stock:unsplash",formKey:"stock-images",enabled:true,configJson:"{}",secretJson:JSON.stringify({apiKey:encryptSecret("legacy.myshopify.com","legacy-access")}),updatedAt:new Date()};
  const db={builderIntegration:{findFirst:async()=>row}};
  const loaded=await loadStockProviderCredentials(db,"legacy.myshopify.com","unsplash");
  assert.equal(loaded.accessKey,"legacy-access");assert.equal(loaded.apiKey,"legacy-access");
});

await check("No Prisma migration was added specifically for credential hotfix",()=>assert.equal(fs.readdirSync("prisma/migrations").some((name)=>/q631|credential_ui_hotfix/i.test(name)),false));
await check("Exact Shopify billing handles remain unchanged",()=>{for(const handle of ["free","sliver","gold","platenium"])assert.ok(plans.includes(handle),handle)});

const failed=checks.filter(([,ok])=>!ok);
console.log(`\nMilestone Q.6.3.1 Stock Credential/UI hotfix audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
