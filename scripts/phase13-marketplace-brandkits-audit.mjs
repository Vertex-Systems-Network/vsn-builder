import fs from "node:fs";
import path from "node:path";
import { BUILTIN_MARKETPLACE_PAGES, BUILTIN_MARKETPLACE_SECTIONS, BUILTIN_MARKETPLACE_CATALOG } from "../app/data/marketplaceCatalog.js";

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
const exists=(p)=>fs.existsSync(path.join(root,p));
let pass=0,fail=0;
function check(name,ok){if(ok){pass++;console.log(`PASS  ${name}`);}else{fail++;console.error(`FAIL  ${name}`);}}
function has(file,...tokens){if(!exists(file))return false;const text=read(file);return tokens.every((token)=>text.includes(token));}

const schema=read("prisma/schema.prisma");
const host=read("app/components/BuilderPanelHost.jsx");
const sidebar=read("app/components/AppSidebar.jsx");
const market=read("app/services/marketplace.server.js");
const brand=read("app/services/brand-kits.server.js");
const backup=read("app/routes/app.backups.jsx");
const diagnostics=read("app/routes/app.control-center.jsx");
const baselineJson=JSON.parse(read("BASELINE.json"));
const serverBaseline=read("app/config/baseline.js");

check("baseline remains Phase 13 or later",Number(baselineJson.phase)>=13);
check("server baseline preserves Phase 13 schemas",serverBaseline.includes("marketplace: 1")&&/brandKits:\s*(?:[1-9]|[1-9]\d+)/.test(serverBaseline)&&/phase:\s*(?:1[3-9]|[2-9]\d)/.test(serverBaseline));
check("Phase 13 feature flag is developer-safe default-off",has("app/config/featureFlags.js","VSN_FEATURE_MARKETPLACE_BRAND_KITS","defaultValue: false","phase: 13"));
check("Phase 13 Prisma migration exists",exists("prisma/migrations/20260807030000_phase13_marketplace_brand_kits/migration.sql"));
check("BuilderBrandKit model exists",schema.includes("model BuilderBrandKit"));
check("BuilderMarketplaceFavorite model exists",schema.includes("model BuilderMarketplaceFavorite"));
check("BuilderMarketplaceInstall model exists",schema.includes("model BuilderMarketplaceInstall"));
check("Library metadata supports marketplace versioning",["sourceKey","sourceVersion","compatibilityJson","screenshotJson","qualityScore"].every((x)=>schema.includes(x)));

check("100+ built-in Page Templates",BUILTIN_MARKETPLACE_PAGES.length>=100);
check("300+ built-in Sections",BUILTIN_MARKETPLACE_SECTIONS.length>=300);
check("combined catalog is 400+ editable items",BUILTIN_MARKETPLACE_CATALOG.length>=400);
for(const industry of ["fashion","beauty","electronics","food","saas","luxury","real-estate","single-product","b2b","landing-cro"])check(`industry catalog: ${industry}`,BUILTIN_MARKETPLACE_CATALOG.some((x)=>x.industry===industry));
check("catalog items use editable VSN content",BUILTIN_MARKETPLACE_CATALOG.every((x)=>x.content&&typeof x.content==="object"));
check("catalog includes Free and Pro tiers",BUILTIN_MARKETPLACE_CATALOG.some((x)=>x.planTier==="free")&&BUILTIN_MARKETPLACE_CATALOG.some((x)=>x.planTier==="pro"));
check("catalog includes screenshot metadata",BUILTIN_MARKETPLACE_CATALOG.every((x)=>x.screenshot?.viewport));
check("catalog includes compatibility metadata",BUILTIN_MARKETPLACE_CATALOG.every((x)=>x.compatibility?.minBuilderVersion));
check("catalog includes quality scoring",BUILTIN_MARKETPLACE_CATALOG.every((x)=>Number.isFinite(x.qualityScore)));

check("Marketplace is in Builder left sidebar",sidebar.includes('id: "marketplace"'));
check("Brand Kits are in Builder left sidebar",sidebar.includes('id: "brand-kits"'));
check("Marketplace panel is routed through Builder host",has("app/services/builder-panels.server.js","marketplacePanelLoader","marketplacePanelAction"));
check("Brand Kit panel is routed through Builder host",has("app/services/builder-panels.server.js","brandKitsPanelLoader","brandKitsPanelAction"));
check("Builder direct panel links are valid",has("app/routes/app.pages.jsx","BUILDER_PANEL_IDS","requestedPanel"));

check("Marketplace search exists",host.includes("Search marketplace"));
check("Marketplace category filter exists",host.includes("All categories"));
check("Marketplace industry filter exists",host.includes("All industries"));
check("Marketplace style filter exists",host.includes("All styles"));
check("Marketplace Free/Pro filter exists",host.includes("Free + Pro"));
check("Marketplace color filter exists",host.includes("All colors"));
check("Marketplace layout filter exists",host.includes("All layouts"));
check("Marketplace Live Preview exists",host.includes("Live preview")&&host.includes("LibraryDesignPreview"));
check("Marketplace Favorites exists",host.includes('value:"favorites"'));
check("Marketplace Recent exists",host.includes('value:"recent"'));
check("Marketplace Recommended exists",host.includes('value:"recommended"'));
check("Marketplace paged browse exists",(host.includes("Load more")&&host.includes("setLimit"))||(host.includes("const pageSize=24")&&host.includes("const totalPages")&&host.includes(">Previous</")&&host.includes(">Next</")));

check("Remote catalog is optional",market.includes("VSN_TEMPLATE_CATALOG_URL")&&market.includes("not-configured"));
check("Remote catalog failure falls back to built-in catalog",market.includes("BUILTIN_MARKETPLACE_CATALOG")&&host.includes("Built-in catalog remains available"));
check("Marketplace install is version aware",market.includes("catalogVersion")&&market.includes("sourceVersion"));
check("Marketplace import is compatibility guarded",market.includes("isCatalogItemCompatible"));
check("Marketplace import stores rollback snapshot",market.includes("rollbackJson")&&market.includes("rollbackMarketplaceInstall"));
check("Marketplace import hashes content",market.includes("createHash")&&market.includes("contentHash"));
check("Marketplace import deduplicates asset manifest",market.includes("new Set()")&&market.includes("assetManifestJson"));
check("Marketplace install does not hard overwrite arbitrary merchant item",market.includes("sourceKey:item.catalogId")&&market.includes("existingInstall"));

check("Brand Kit supports logo",brand.includes("logoUrl"));
check("Brand Kit supports colors",brand.includes("colorsJson")&&host.includes("Primary"));
check("Brand Kit supports typography",brand.includes("typographyJson")&&host.includes("Body font family"));
check("Brand Kit font selector consumes system/Google/custom font registry",has("app/routes/app.brand-kits.jsx","SYSTEM_FONTS","FALLBACK_GOOGLE_FONTS","builderCustomFont","fontFamilies"));
check("Brand Kit supports spacing tokens",brand.includes("spacingJson")&&host.includes("Spacing base"));
check("Brand Kit supports border radius",brand.includes("radiusJson")&&host.includes("Radius small"));
check("Brand Kit supports shadows",brand.includes("shadowsJson")&&host.includes("Shadow large"));
check("Brand Kit applies to existing Global Design",brand.includes("designTokensJson")&&host.includes("Apply as Global Design"));
check("Brand Kit applies to saved templates",brand.includes("applyBrandKitToLibraryItem")&&host.includes("Apply Kit"));
check("Brand Kit CRUD supports trash/restore/delete",has("app/routes/app.brand-kits.jsx",'intent==="trash"','intent==="restore"','intent==="delete"'));
check("Brand Kit updates are shop scoped",brand.includes("where:{id,shop}"));

check("Library transfer keeps Marketplace metadata",has("app/utils/library-transfer.js","sourceKey","sourceVersion","qualityScore","compatibilityJson","screenshotJson"));
check("Library import keeps Marketplace metadata",has("app/routes/app.library.jsx","sourceKey","sourceVersion","planTier"));
check("Backup includes Phase 13 Brand Kits",backup.includes("brandKits"));
check("Backup includes Marketplace favorites/installs",backup.includes("marketplaceFavorites")&&backup.includes("marketplaceInstalls"));
check("Uninstall cleans Phase 13 records",["builderMarketplaceFavorite","builderMarketplaceInstall","builderBrandKit"].every((token)=>(read("app/routes/webhooks.app.uninstalled.jsx")+read("app/services/shop-data-lifecycle.server.js")).includes(token)));
check("Diagnostics reports Brand Kits and Marketplace",diagnostics.includes("brandKits")&&diagnostics.includes("marketplaceInstalls")&&diagnostics.includes("marketplaceFavorites"));
check("Diagnostics reports remote catalog configuration without secret exposure",diagnostics.includes("templateCatalogConfigured")&&!diagnostics.includes("templateCatalogUrl: process.env.VSN_TEMPLATE_CATALOG_URL"));
check("Marketplace UI CSS exists",has("app/styles/builder.css","vsn-marketplace-grid","vsn-marketplace-preview","vsn-marketplace-filters"));
check("Brand Kit UI CSS exists",has("app/styles/builder.css","vsn-brandkit-layout","vsn-brandkit-preview","vsn-brandkit-color-grid"));

console.log(`\nPhase 13 Marketplace + Brand Kits audit: ${pass} PASS / ${fail} FAIL`);
if(fail)process.exit(1);
