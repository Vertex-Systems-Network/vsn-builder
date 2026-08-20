import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { encryptSecret, decryptSecret, maskSecret } from "../app/services/secret-vault.server.js";
import { defaultTemplatesViewSettings, normalizeTemplatesViewSettings } from "../app/services/templates-view-settings.server.js";

const read=(file)=>fs.readFileSync(file,"utf8");
const exists=(file)=>fs.existsSync(file);
const versionAtLeast=(value,min)=>{const a=String(value).split(".").map(Number),b=String(min).split(".").map(Number);for(let i=0;i<Math.max(a.length,b.length);i++){const av=a[i]||0,bv=b[i]||0;if(av!==bv)return av>bv;}return true;};
const checks=[];
async function check(name,fn){try{await fn();checks.push([name,true]);console.log(`PASS  ${name}`)}catch(error){checks.push([name,false]);console.error(`FAIL  ${name}: ${error.message}`)}}

const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));
const baselineJs=read("app/config/baseline.js");
const schema=read("prisma/schema.prisma");
const migrationPath="prisma/migrations/20260810093000_milestone_q63_stock_image_hub/migration.sql";
const migration=read(migrationPath);
const stockRoute=read("app/routes/app.stock-images.jsx");
const stockService=read("app/services/stock-images.server.js");
const integration=read("app/services/stock-image-integrations.server.js");
const vault=read("app/services/secret-vault.server.js");
const settings=read("app/components/dashboard/pages/Settings.jsx");
const providerSettingsUi=read("app/components/dashboard/settings/StockImageIntegrationsSettings.jsx");
const dashboard=read("app/components/Dashboard.jsx");
const pages=read("app/routes/app.pages.jsx");
const dataKit=read("app/components/ui/VsnDataViewKit.jsx");
const home=read("app/components/dashboard/pages/Home.jsx");
const dashPrefs=read("app/services/dashboard-preferences.server.js");
const sidebar=read("app/components/dashboard/Sidebar.jsx");
const appRoute=read("app/routes/app.jsx");
const permissions=read("app/utils/builder-permissions.js");
const lifecycle=read("app/services/shop-data-lifecycle.server.js");
const toml=read("shopify.app.toml");
const env=read(".env.example");

await check("Version is v2.5.101 or newer",()=>assert.ok(versionAtLeast(pkg.version,"2.5.101")));
await check("Baseline retains Q.6.3 lineage",()=>{assert.ok(versionAtLeast(baseline.version,"2.5.101"));assert.ok(String(baseline.milestone).startsWith("Q.6"))});
await check("Baseline schema registers Stock Image Hub",()=>assert.match(baselineJs,/stockImageHub:\s*[1-9]\d*/));
await check("Q6.3 dedicated QA command exists",()=>assert.equal(pkg.scripts?.["qa:q63"],"node scripts/milestone-q63-stock-image-hub-audit.mjs"));
await check("Q6.3 audit is in full release QA",()=>assert.ok(pkg.scripts?.["qa:release"]?.includes("milestone-q63-stock-image-hub-audit.mjs")));
await check("Q6.3 Developer Mode report exists",()=>assert.ok(exists("MILESTONE_Q63_DEVELOPER_MODE.md")));
await check("Q6.3 release report exists",()=>assert.ok(exists("VSN_MILESTONE_Q63_STOCK_IMAGE_HUB_REPORT_v2.5.101.md")));
await check("Stock Images user documentation exists",()=>assert.ok(exists("docs/user/stock-image-hub.md")));
await check("Provider contract documentation exists",()=>assert.ok(exists("docs/developer/stock-image-provider-contracts.md")));

await check("Dashboard aside z-index is 99",()=>assert.match(sidebar,/zIndex:\s*99/));
await check("List view control appears before Grid",()=>assert.ok(dataKit.indexOf('aria-label="List view"') < dataKit.indexOf('aria-label="Grid view"')));
await check("Templates default view is List",()=>assert.equal(defaultTemplatesViewSettings().viewMode,"list"));
await check("Templates records-per-page defaults to 12",()=>assert.equal(defaultTemplatesViewSettings().pageSize,12));
await check("Templates custom page size clamps to 100",()=>assert.equal(normalizeTemplatesViewSettings({pageSize:999}).pageSize,100));
await check("Templates view settings support Grid persistence",()=>assert.equal(normalizeTemplatesViewSettings({viewMode:"grid"}).viewMode,"grid"));
await check("Templates loader reads persistent settings",()=>assert.ok(pages.includes("loadTemplatesViewSettings")));
await check("Templates action saves persistent settings",()=>assert.ok(pages.includes('intent === "save-template-view-settings"')&&pages.includes("saveTemplatesViewSettings")));
await check("Templates UI debounces server preference save",()=>assert.ok(dashboard.includes("onSaveViewSettings")&&dashboard.includes("window.setTimeout")));
await check("Dashboard client preferences use schema v2",()=>assert.ok(home.includes("DASHBOARD_PREFS_VERSION = 2")));
await check("Dashboard server preferences use schema v2",()=>assert.ok(dashPrefs.includes("version: 2")));

await check("Secret vault uses AES-256-GCM",()=>assert.ok(vault.includes('createCipheriv("aes-256-gcm"')&&vault.includes("getAuthTag")));
await check("Production secret vault fails closed without master key",()=>assert.ok(vault.includes('NODE_ENV === "production"')&&vault.includes("secret encryption key is not configured")));
await check("Encrypted provider secret round-trip works",()=>{const v=encryptSecret("qa-shop.myshopify.com","secret-12345");assert.notEqual(v,"secret-12345");assert.equal(decryptSecret("qa-shop.myshopify.com",v),"secret-12345");assert.equal(maskSecret("secret-12345"),"••••2345")});
await check("Public stock settings never serialize raw apiKey",()=>{const start=integration.indexOf("export async function loadStockProviderPublicSettings");const end=integration.indexOf("export async function saveStockProviderSettings");assert.doesNotMatch(integration.slice(start,end),/apiKey:\s*row\.apiKey/) });
await check("Per-shop provider integrations use BuilderIntegration with legacy/new form keys",()=>assert.ok(integration.includes("builderIntegration")&&/formKey\s*:\s*"stock-(images|media)"/.test(integration)));
await check("Optional environment fallbacks exist for all providers",()=>{for(const key of ["UNSPLASH_ACCESS_KEY","PEXELS_API_KEY","PIXABAY_API_KEY"])assert.ok(integration.includes(key)&&env.includes(key))});
await check("Dedicated VSN secret encryption env is documented",()=>assert.ok(env.includes("VSN_SECRET_ENCRYPTION_KEY")));
await check("Settings can test saved provider credentials",()=>assert.ok(integration.includes("testStockProviderCredential")&&settings.includes("test-stock-provider")));
await check("Settings exposes all three providers",()=>{for(const p of ["unsplash","pexels","pixabay"])assert.ok(settings.includes(p))});
await check("Settings uses password inputs for provider keys",()=>assert.ok(/type=\{visible\?"text":"password"\}/.test(providerSettingsUi)||providerSettingsUi.includes('type="password"')));

await check("Stock Images route authenticates admin requests",()=>assert.ok(stockRoute.includes("authenticate.admin(request)")));
await check("Stock Images route enforces view permission",()=>assert.ok(/canAccessBuilderAction\(db,\s*session,\s*"stockImages",\s*"view"\)/.test(stockRoute)));
await check("Favorites require stock favorite permission",()=>assert.ok(/"stockImages",\s*"favorite"/.test(stockRoute)));
await check("Import/update requires stock import permission",()=>assert.ok(/"stockImages",\s*"import"/.test(stockRoute)));
await check("Permanent Shopify deletion requires delete permission",()=>assert.ok(/"stockImages",\s*"delete"/.test(stockRoute)));
await check("Stock Images system is registered in role matrix",()=>assert.ok(permissions.includes('key:"stockImages"')&&permissions.includes('"stock-images":"stockImages"')));
await check("Stock Images is available in app navigation",()=>assert.ok(sidebar.includes("'stock-images'")&&appRoute.includes('"stock-images": "/app/stock-images"')));
await check("Stock Images navigation count is DB-backed",()=>assert.ok(appRoute.includes("stockImageCount")&&appRoute.includes('kind: "stock-image"')));

await check("Unified search supports all providers",()=>{for(const p of ["unsplash","pexels","pixabay"])assert.ok(stockService.includes(p))});
await check("Blank Unsplash discovery uses official photo listing",()=>assert.ok(stockService.includes("https://api.unsplash.com/photos?")&&stockService.includes("discovery: true")));
await check("Blank Pexels discovery uses official curated feed",()=>assert.ok(stockService.includes("https://api.pexels.com/v1/curated?")&&stockService.includes("discovery: true")));
await check("Search-all results are round-robin aligned",()=>assert.ok(stockService.includes("roundRobin(settled, perPage)")));
await check("Provider failures are isolated instead of failing all results",()=>assert.ok(stockService.includes("Promise.all(providers.map")&&stockService.includes("error instanceof Error")));
await check("Common orientation/color filters are normalized",()=>assert.ok(stockService.includes("normalizeOrientation")&&stockService.includes("common.color")));
await check("Unsplash uses official search endpoint and Client-ID auth",()=>assert.ok(stockService.includes("api.unsplash.com/search/photos")&&stockService.includes("Client-ID ${auth.apiKey}")));
await check("Unsplash supports order_by and content_filter",()=>assert.ok(stockService.includes("order_by")&&stockService.includes("content_filter")));
await check("Unsplash discovery hotlinks returned image urls",()=>assert.ok(stockService.includes("photo.urls?.regular")&&stockService.includes("photo.urls?.small")));
await check("Unsplash import fires download_location tracking",()=>assert.ok(stockService.includes("downloadLocation")&&stockService.includes("trackUnsplashDownload")));
await check("Unsplash attribution URLs include VSN referral UTM",()=>assert.ok(stockService.includes('utm_source: "vsn_builder"')&&stockService.includes('utm_medium: "referral"')));
await check("Pexels uses Authorization header",()=>assert.ok(stockService.includes("api.pexels.com/v1/search")&&stockService.includes("Authorization: auth.apiKey")));
await check("Pexels exposes size and locale filters",()=>assert.ok(stockService.includes('params.set("size"')&&stockService.includes('params.set("locale"')));
await check("Pexels max page size is capped at 80",()=>assert.ok(stockService.includes('provider === "pexels" ? 80')));
await check("Stock provider attribution and contributor UI exists",()=>assert.ok(stockRoute.includes("author")&&stockRoute.includes("View on {providerLabel}")));
await check("Pixabay search supports API options",()=>{for(const token of ["image_type","category","min_width","min_height","safesearch","editors_choice","order","lang","colors"])assert.ok(stockService.includes(token),token)});
await check("Pixabay search cache TTL is exactly 24 hours",()=>assert.ok(stockService.includes("pixabay: 86_400_000")));
await check("Expired stock search cache is pruned",()=>assert.ok(stockService.includes("builderStockSearchCache.deleteMany")));
await check("Pixabay remote URLs are not persisted for standalone favorites",()=>assert.ok(stockService.includes('if (provider === "pixabay") previewUrl = ""')));
await check("Stock cards render a placeholder when no preview is available",()=>assert.ok(stockRoute.includes("vsn-stock-image-placeholder")&&stockRoute.includes("Preview unavailable")));

await check("Import re-fetches provider item server-side by provider ID",()=>assert.ok(stockService.includes("providerPhoto(db, shop, provider, providerId)")));
await check("Remote image downloads require HTTPS provider-owned hosts",()=>assert.ok(stockService.includes("assertSourceUrl")&&stockService.includes('url.protocol !== "https:"')));
await check("Remote redirect host is revalidated",()=>assert.ok(stockService.includes("assertSourceUrl(provider, response.url || url)")));
await check("Image MIME allowlist exists",()=>assert.ok(stockService.includes('image/jpeg')&&stockService.includes('image/png')&&stockService.includes('image/webp')&&stockService.includes('image/gif')));
await check("Image import stays below Shopify Files image limits",()=>assert.ok(stockService.includes("18 * 1024 * 1024")&&stockService.includes("18_000_000")&&stockService.includes("safeImageTarget")));
await check("Shopify staged upload is used",()=>assert.ok(stockService.includes("stagedUploadsCreate")&&stockService.includes('resource: "IMAGE"')));
await check("Staged resourceUrl is passed into fileCreate",()=>assert.ok(stockService.includes("resourceUrl")&&stockService.includes("fileCreate(files:$files)")));
await check("Shopify fileCreate uses duplicate-safe mode",()=>assert.ok(stockService.includes('duplicateResolutionMode: "APPEND_UUID"')));
await check("Shopify update is READY-gated",()=>assert.ok(stockService.includes('status !== "READY"')&&stockService.includes("fileUpdate(files:$files)")));
await check("Shopify delete uses permanent fileDelete",()=>assert.ok(stockService.includes("fileDelete(fileIds:$ids)")));
await check("UI requires confirmation before permanent Shopify deletion",()=>assert.ok(stockRoute.includes("Delete imported image from Shopify Files?")&&stockRoute.includes('tone:"danger"')));
await check("App declares read_files and write_files",()=>assert.ok(toml.includes("read_files")&&toml.includes("write_files")));

await check("Stock favorites/imports use VSN library records",()=>assert.ok(stockService.includes('kind: "stock-image"')&&stockService.includes("BuilderLibraryItem")==false));
await check("Library distinguishes favorites and Shopify imports",()=>assert.ok(stockService.includes("favorites: items.filter")&&stockService.includes("imports: items.filter")));
await check("Delete preserves favorite reference when applicable",()=>assert.ok(stockService.includes("if (!existing.isFavorite)")&&stockService.includes('fileStatus: "DELETED"')));
await check("Shop data cleanup deletes transient stock search cache",()=>assert.ok(lifecycle.includes("builderStockSearchCache.deleteMany")));

await check("Templates persistent setting column exists in Prisma",()=>assert.match(schema,/templatesViewJson\s+String\?/));
await check("Stock search cache Prisma model exists",()=>assert.ok(schema.includes("model BuilderStockSearchCache")));
await check("Stock cache has per-shop/provider/cacheKey uniqueness",()=>assert.ok(schema.includes("@@unique([shop, provider, cacheKey])")));
await check("Q6.3 migration exists",()=>assert.ok(exists(migrationPath)));
await check("Q6.3 migration is additive only",()=>{assert.match(migration,/ALTER TABLE "BuilderShopSetting" ADD COLUMN "templatesViewJson"/);assert.match(migration,/CREATE TABLE "BuilderStockSearchCache"/);assert.doesNotMatch(migration,/DROP TABLE|DROP COLUMN|DELETE FROM/i)});
await check("Packaged SQLite has templatesViewJson",()=>{const db=new DatabaseSync("prisma/dev.sqlite");const cols=db.prepare("PRAGMA table_info('BuilderShopSetting')").all().map((row)=>row.name);db.close();assert.ok(cols.includes("templatesViewJson"))});
await check("Packaged SQLite has stock search cache table",()=>{const db=new DatabaseSync("prisma/dev.sqlite");const row=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='BuilderStockSearchCache'").get();db.close();assert.equal(row?.name,"BuilderStockSearchCache")});
await check("Packaged SQLite records Q6.3 migration checksum",()=>{const checksum=crypto.createHash("sha256").update(fs.readFileSync(migrationPath)).digest("hex");const db=new DatabaseSync("prisma/dev.sqlite");const row=db.prepare("SELECT checksum FROM _prisma_migrations WHERE migration_name=?").get("20260810093000_milestone_q63_stock_image_hub");db.close();assert.equal(row?.checksum,checksum)});

await check("Exact Shopify billing handles remain unchanged",()=>{const plans=read("app/config/commercialPlans.js");for(const h of ["free","sliver","gold","platenium"])assert.ok(plans.includes(h),h)});

const failed=checks.filter(([,ok])=>!ok);
console.log(`\nMilestone Q.6.3 Stock Image Hub audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
