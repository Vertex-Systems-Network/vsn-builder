import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { STOCK_AUDIO_IMPORT_PROVIDERS, STOCK_AUDIO_PROVIDERS, STOCK_IMAGE_IMPORT_PROVIDERS, STOCK_IMAGE_PROVIDERS, STOCK_VIDEO_IMPORT_PROVIDERS, STOCK_VIDEO_PROVIDERS } from "../app/services/stock-image-integrations.server.js";

const read=(file)=>fs.readFileSync(file,"utf8");
const exists=(file)=>fs.existsSync(file);
const checks=[];
const versionAtLeast=(value,min)=>{const a=String(value).split(".").map(Number),b=String(min).split(".").map(Number);for(let i=0;i<Math.max(a.length,b.length);i++){const av=a[i]||0,bv=b[i]||0;if(av!==bv)return av>bv;}return true;};
async function check(name,fn){try{await fn();checks.push([name,true]);console.log(`PASS  ${name}`)}catch(error){checks.push([name,false]);console.error(`FAIL  ${name}: ${error.message}`)}}

const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));
const baselineJs=read("app/config/baseline.js");
const schema=read("prisma/schema.prisma");
const migrationPath="prisma/migrations/20260810114500_milestone_q633_stock_usage_history/migration.sql";
const migration=read(migrationPath);
const integration=read("app/services/stock-image-integrations.server.js");
const premium=read("app/services/stock-premium-providers.server.js");
const usage=read("app/services/stock-api-usage.server.js");
const history=read("app/services/stock-search-history.server.js");
const usageModal=read("app/components/stock/StockApiUsageModal.jsx");
const historyUi=read("app/components/stock/StockSearchHistory.jsx");
const settingsUi=read("app/components/dashboard/settings/StockImageIntegrationsSettings.jsx");
const settingsPage=read("app/components/dashboard/pages/Settings.jsx");
const dashboardActions=read("app/services/dashboard-actions.server.js");
const appIndex=read("app/routes/app._index.jsx");
const imageRoute=read("app/routes/app.stock-images.jsx");
const videoRoute=read("app/routes/app.stock-videos.jsx");
const audioRoute=read("app/routes/app.stock-audio.jsx");
const imageService=read("app/services/stock-images.server.js");
const videoService=read("app/services/stock-videos.server.js");
const audioService=read("app/services/stock-audio.server.js");
const mediaShopify=read("app/services/stock-media-shopify.server.js");
const env=read(".env.example");
const plans=read("app/config/commercialPlans.js");
const q632=read("scripts/milestone-q632-stock-media-expansion-audit.mjs");

await check("Version is v2.5.104 or newer",()=>assert.ok(versionAtLeast(pkg.version,"2.5.104")));
await check("Baseline retains Q.6.3 lineage",()=>{assert.ok(versionAtLeast(baseline.version,"2.5.104"));assert.ok(String(baseline.milestone).startsWith("Q.6"))});
await check("Stock image schema advanced to v4",()=>assert.ok(baselineJs.includes("stockImageHub: 4")));
await check("Stock video schema advanced to v2",()=>assert.ok(baselineJs.includes("stockVideoHub: 2")));
await check("Stock audio schema advanced to v2",()=>assert.ok(baselineJs.includes("stockAudioHub: 2")));
await check("API usage schema registered",()=>{const match=baselineJs.match(/stockApiUsage:\s*(\d+)/);assert.ok(match&&Number(match[1])>=1)});
await check("Search history schema registered",()=>assert.ok(baselineJs.includes("stockSearchHistory: 1")));
await check("Premium stock search schema registered",()=>assert.ok(baselineJs.includes("premiumStockSearch: 1")));
await check("Q6.3.3 developer report exists",()=>assert.ok(exists("MILESTONE_Q633_DEVELOPER_MODE.md")));
await check("Q6.3.3 release report exists",()=>assert.ok(exists("VSN_MILESTONE_Q633_STOCK_USAGE_PREMIUM_HISTORY_REPORT_v2.5.104.md")));
await check("Dedicated Q6.3.3 QA command exists",()=>assert.equal(pkg.scripts?.["qa:q633"],"node scripts/milestone-q633-stock-usage-premium-history-audit.mjs"));
await check("Q6.3.3 is in full release QA",()=>assert.ok(pkg.scripts?.["qa:release"]?.includes("milestone-q633-stock-usage-premium-history-audit.mjs")));
await check("Q6.3.2 audit is version future-safe",()=>assert.ok(q632.includes("v2.5.103 or newer")&&q632.includes("startsWith(\"Q.6\")")));

await check("Staged upload still owns original filename",()=>assert.ok(mediaShopify.includes("stagedUploadsCreate")&&mediaShopify.includes("filename, mimeType: contentType")));
await check("Stock media fileCreate omits filename for staged originalSource",()=>{const block=mediaShopify.slice(mediaShopify.indexOf("export async function createShopifyMediaFile"),mediaShopify.indexOf("export async function updateShopifyMediaFile"));assert.ok(block.includes("originalSource: stagedUrl"));assert.doesNotMatch(block,/originalSource:\s*stagedUrl[^\]}]*filename/) });
await check("Stock media fileUpdate omits filename for staged originalSource",()=>{const block=mediaShopify.slice(mediaShopify.indexOf("export async function updateShopifyMediaFile"),mediaShopify.indexOf("export async function deleteShopifyMediaFile"));assert.ok(block.includes("originalSource: stagedUrl"));assert.doesNotMatch(block,/originalSource:\s*stagedUrl[^\]}]*filename/) });
await check("Filename mismatch reason is documented in source",()=>assert.ok(mediaShopify.includes("MISMATCHED_FILENAME_AND_ORIGINAL_SOURCE")));
await check("Stock image fileCreate also avoids explicit staged filename",()=>{const block=imageService.slice(imageService.indexOf("async function createShopifyFile"),imageService.indexOf("async function updateShopifyFile"));assert.ok(block.includes("originalSource: stagedUrl"));assert.doesNotMatch(block,/filename\s*[,}]/)});

await check("API usage Prisma model exists",()=>assert.ok(schema.includes("model BuilderStockApiUsage")));
await check("API usage is unique per shop/provider/media kind",()=>assert.ok(schema.includes("@@unique([shop, provider, mediaKind])")));
await check("Search history Prisma model exists",()=>assert.ok(schema.includes("model BuilderStockSearchHistory")));
await check("Search history is unique per shop/media/fingerprint",()=>assert.ok(schema.includes("@@unique([shop, mediaKind, fingerprint])")));
await check("Q6.3.3 migration exists",()=>assert.ok(exists(migrationPath)));
await check("Q6.3.3 migration is additive",()=>{assert.doesNotMatch(migration,/DROP\s+TABLE|DROP\s+COLUMN|DELETE\s+FROM/i);assert.match(migration,/CREATE TABLE "BuilderStockApiUsage"/);assert.match(migration,/CREATE TABLE "BuilderStockSearchHistory"/)});
await check("Usage tracker counts requests/success/errors",()=>assert.ok(usage.includes("requestCount:{increment:1}")&&usage.includes("successCount:{increment:success?1:0}")&&usage.includes("errorCount:{increment:success?0:1}")));
await check("Usage tracker captures provider rate-limit headers",()=>assert.ok(usage.includes('x-ratelimit-limit')&&usage.includes('x-ratelimit-remaining')&&usage.includes('x-ratelimit-reset')));
await check("Provider fetch wrapper records network errors",()=>assert.ok(usage.includes("recordStockApiUsage")&&usage.includes("catch(error)")));
await check("Usage summary groups by provider",()=>assert.ok(usage.includes("byProvider")&&usage.includes("media:[]")));
await check("Settings loads stock usage",()=>assert.ok(appIndex.includes("loadStockApiUsageSummary")&&appIndex.includes("stockUsage")));
await check("Credential test returns refreshed stock usage",()=>assert.ok(dashboardActions.includes("loadStockApiUsageSummary")&&dashboardActions.includes("stockUsage")));
await check("Settings provider cards render Usage rows",()=>assert.ok(settingsUi.includes("UsageRow")&&settingsUi.includes("requestCount")&&settingsUi.includes("successCount")&&settingsUi.includes("errorCount")));
await check("Usage popup component exists",()=>assert.ok(usageModal.includes("API usage")&&usageModal.includes("totalRequests")));
await check("Images screen exposes Usage popup mode",()=>assert.ok(imageRoute.includes('mode==="usage"')&&imageRoute.includes("StockApiUsageModal")&&imageRoute.includes("Usage")));
await check("Videos screen exposes Usage popup mode",()=>assert.ok(videoRoute.includes('mode==="usage"')&&videoRoute.includes("StockApiUsageModal")&&videoRoute.includes("Usage")));
await check("Audio screen exposes Usage popup mode",()=>assert.ok(audioRoute.includes('mode==="usage"')&&audioRoute.includes("StockApiUsageModal")&&audioRoute.includes("Usage")));

await check("Search history hashes reusable params",()=>assert.ok(history.includes('createHash("sha256")')&&history.includes("paramsJson")));
await check("Search history tracks reuse count",()=>assert.ok(history.includes("useCount:{increment:1}")));
await check("Search history is bounded and old records are pruned",()=>assert.ok(history.includes("90*86400000")&&history.includes("take:Math.max(1,Math.min(30")));
await check("Search history UI supports rerun",()=>assert.ok(historyUi.includes("onApply")&&historyUi.includes("RotateCcw")));
await check("Search history UI supports clear",()=>assert.ok(historyUi.includes("onClear")&&historyUi.includes("Clear")));
await check("Images record and load image history",()=>assert.ok(imageRoute.includes('recordStockSearchHistory(db,session.shop,"image"')&&imageRoute.includes('listStockSearchHistory(db,session.shop,"image"')));
await check("Videos record and load video history",()=>assert.ok(videoRoute.includes('recordStockSearchHistory(db,session.shop,"video"')&&videoRoute.includes('listStockSearchHistory(db,session.shop,"video"')));
await check("Audio records and loads audio history",()=>assert.ok(audioRoute.includes('recordStockSearchHistory(db,session.shop,"audio"')&&audioRoute.includes('listStockSearchHistory(db,session.shop,"audio"')));
await check("Each stock screen can clear only its own history",()=>assert.ok(imageRoute.includes('clearStockSearchHistory(db,session.shop,"image"')&&videoRoute.includes('clearStockSearchHistory(db,session.shop,"video"')&&audioRoute.includes('clearStockSearchHistory(db,session.shop,"audio"')));

await check("Settings capabilities use spaced dot delimiter",()=>assert.ok(settingsUi.includes('capabilities.join(" . ")')));
await check("Old provider badge string is removed from Settings",()=>assert.doesNotMatch(settingsPage,/Unsplash\s*·\s*Pexels\s*·\s*Pixabay\s*·\s*Freesound/));
await check("Unsplash has Images per-page setting",()=>assert.ok(settingsUi.includes('label="Images per page"')&&settingsUi.includes("imagePageSize")));
await check("Pexels has Images/Videos per-page settings",()=>{const block=settingsUi.slice(settingsUi.indexOf('provider==="pexels"'),settingsUi.indexOf('provider==="pixabay"'));assert.ok(block.includes("imagePageSize")&&block.includes("videoPageSize"))});
await check("Pixabay has Images/Videos per-page settings",()=>{const block=settingsUi.slice(settingsUi.indexOf('provider==="pixabay"'),settingsUi.indexOf('provider==="freesound"'));assert.ok(block.includes("imagePageSize")&&block.includes("videoPageSize"))});
await check("Freesound retains Audio per-page setting",()=>assert.ok(settingsUi.includes('label="Audio per page"')&&settingsUi.includes("audioPageSize")));
await check("Shutterstock has Images/Videos/Audio per-page settings",()=>{const block=settingsUi.slice(settingsUi.indexOf('provider==="shutterstock"'),settingsUi.lastIndexOf("return <div"));assert.ok(block.includes("imagePageSize")&&block.includes("videoPageSize")&&block.includes("audioPageSize"))});
await check("Getty/iStock has Images/Videos per-page settings",()=>assert.ok(settingsUi.includes("Getty/iStock")&&settingsUi.includes("imagePageSize")&&settingsUi.includes("videoPageSize")));
await check("Images screen has working per-page control",()=>assert.ok(imageRoute.includes("vsn-stock-per-page")&&imageRoute.includes("setPerPage")&&imageRoute.includes("pageSizeFor")));
await check("Videos screen has working per-page control",()=>assert.ok(videoRoute.includes("vsn-stock-per-page")&&videoRoute.includes("setPerPage")&&videoRoute.includes("pageSizeFor")));
await check("Audio screen has working per-page control",()=>assert.ok(audioRoute.includes("vsn-stock-per-page")&&audioRoute.includes("setPerPage")&&audioRoute.includes("pageSizeFor")));

await check("Provider Settings link to credential creation docs",()=>assert.ok(settingsUi.includes("Get/create API credentials")&&settingsUi.includes("definition.create")));
await check("Provider Settings link to API documentation",()=>assert.ok(settingsUi.includes("API documentation")&&settingsUi.includes("definition.docs")));
await check("Unsplash credential creation URL is registered",()=>assert.ok(settingsUi.includes("unsplash.com/oauth/applications")));
await check("Pexels credential creation URL is registered",()=>assert.ok(settingsUi.includes("pexels.com/api/")));
await check("Pixabay API docs credential URL is registered",()=>assert.ok(settingsUi.includes("pixabay.com/api/docs/")));
await check("Freesound apply URL is registered",()=>assert.ok(settingsUi.includes("freesound.org/apiv2/apply/")));

await check("Shutterstock is registered for image search",()=>assert.ok(STOCK_IMAGE_PROVIDERS.includes("shutterstock")));
await check("Shutterstock is registered for video search",()=>assert.ok(STOCK_VIDEO_PROVIDERS.includes("shutterstock")));
await check("Shutterstock is registered for audio search",()=>assert.ok(STOCK_AUDIO_PROVIDERS.includes("shutterstock")));
await check("Shutterstock image API search endpoint exists",()=>assert.ok(premium.includes('path=kind==="video"?"videos":kind==="audio"?"audio":"images"')&&premium.includes("api.shutterstock.com/v2/${path}/search")));
await check("Shutterstock supports Consumer Key/Secret auth",()=>assert.ok(integration.includes("consumerKey")&&integration.includes("consumerSecret")&&premium.includes("Basic ${token}")));
await check("Shutterstock optional OAuth bearer auth exists",()=>assert.ok(integration.includes("oauthToken")&&premium.includes("Bearer ${auth.oauthToken}")));
await check("Shutterstock env credentials are documented",()=>assert.ok(env.includes("SHUTTERSTOCK_CONSUMER_KEY=")&&env.includes("SHUTTERSTOCK_CONSUMER_SECRET=")&&env.includes("SHUTTERSTOCK_API_TOKEN=")));
await check("Shutterstock result import is license-gated",()=>assert.ok(premium.includes('provider:"shutterstock"')&&premium.includes("importAllowed:false")&&premium.includes("licenseRequired:true")));
await check("Shutterstock is not in direct Shopify import provider allowlists",()=>{assert.ok(!STOCK_IMAGE_IMPORT_PROVIDERS.includes("shutterstock"));assert.ok(!STOCK_VIDEO_IMPORT_PROVIDERS.includes("shutterstock"));assert.ok(!STOCK_AUDIO_IMPORT_PROVIDERS.includes("shutterstock"))});

await check("Getty/iStock is registered for image search",()=>assert.ok(STOCK_IMAGE_PROVIDERS.includes("getty")));
await check("Getty/iStock is registered for video search",()=>assert.ok(STOCK_VIDEO_PROVIDERS.includes("getty")));
await check("Getty/iStock is not registered for audio",()=>assert.ok(!STOCK_AUDIO_PROVIDERS.includes("getty")));
await check("Getty creative image/video search endpoint exists",()=>assert.ok(premium.includes("api.gettyimages.com/v3/search/${resource}/creative")));
await check("Getty API key header is used",()=>assert.ok(premium.includes('"Api-Key":auth.apiKey')));
await check("Getty env credentials are documented",()=>assert.ok(env.includes("GETTY_API_KEY=")&&env.includes("GETTY_API_SECRET=")));
await check("Getty/iStock result import is license-gated",()=>assert.ok(premium.includes('provider:"getty"')&&premium.includes("importAllowed:false")&&premium.includes("licenseRequired:true")));
await check("Getty/iStock is not in direct Shopify import provider allowlists",()=>{assert.ok(!STOCK_IMAGE_IMPORT_PROVIDERS.includes("getty"));assert.ok(!STOCK_VIDEO_IMPORT_PROVIDERS.includes("getty"));});

await check("Pixabay remains image/video only in documented integration",()=>assert.ok(STOCK_IMAGE_PROVIDERS.includes("pixabay")&&STOCK_VIDEO_PROVIDERS.includes("pixabay")&&!STOCK_AUDIO_PROVIDERS.includes("pixabay")));
await check("Settings explains Pixabay website audio is not in public API",()=>assert.ok(settingsUi.includes("website Music/Sound Effects are not exposed by this public API")));
await check("Audio service uses Freesound/Shutterstock only",()=>assert.ok(audioService.includes('freesound:"Freesound", shutterstock:"Shutterstock"')&&!audioService.includes('pixabay:"Pixabay"')));
await check("Premium audio direct import stays fail-closed",()=>assert.ok(audioService.includes("requires a licensed final-download workflow before Shopify import")));
await check("Pexels/Pixabay direct video imports remain supported",()=>{assert.ok(STOCK_VIDEO_IMPORT_PROVIDERS.includes("pexels"));assert.ok(STOCK_VIDEO_IMPORT_PROVIDERS.includes("pixabay"))});
await check("Unsplash/Pexels/Pixabay direct image imports remain supported",()=>{for(const key of ["unsplash","pexels","pixabay"])assert.ok(STOCK_IMAGE_IMPORT_PROVIDERS.includes(key));});
await check("Freesound direct audio import remains commercially gated",()=>assert.ok(STOCK_AUDIO_IMPORT_PROVIDERS.includes("freesound")&&audioService.includes("commercialApiLicensed")));

await check("Migration checksum is recorded in packaged SQLite",()=>{const db=new DatabaseSync("prisma/dev.sqlite"),row=db.prepare("SELECT checksum FROM _prisma_migrations WHERE migration_name=?").get("20260810114500_milestone_q633_stock_usage_history");db.close();const checksum=crypto.createHash("sha256").update(migration).digest("hex");assert.equal(row?.checksum,checksum)});
await check("Packaged SQLite has API usage table",()=>{const db=new DatabaseSync("prisma/dev.sqlite"),row=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='BuilderStockApiUsage'").get();db.close();assert.equal(row?.name,"BuilderStockApiUsage")});
await check("Packaged SQLite has search history table",()=>{const db=new DatabaseSync("prisma/dev.sqlite"),row=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='BuilderStockSearchHistory'").get();db.close();assert.equal(row?.name,"BuilderStockSearchHistory")});
await check("Exact Shopify billing handles remain unchanged",()=>{for(const handle of ["free","sliver","gold","platenium"])assert.ok(plans.includes(handle),handle)});

const failed=checks.filter(([,ok])=>!ok);
console.log(`\nMilestone Q.6.3.3 Stock Usage/Premium/History audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
