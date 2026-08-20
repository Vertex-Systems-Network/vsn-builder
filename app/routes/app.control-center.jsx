import { isRouteErrorResponse, useFetcher, useLoaderData, useRouteError } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { builderActor, canBuilder, getBuilderRole } from "../utils/builder-permissions.js";
import { cleanupBuilderData } from "../utils/cleanup.server";
import { VSN_BASELINE } from "../config/baseline.js";
import ecosystemManifest from "../config/ecosystem-manifest.json";
import { FEATURE_FLAGS } from "../config/featureFlags.js";
import { getServerFeatureFlags } from "../services/feature-flags.server.js";
import { getWidgetDefinitions, loadWidgetSettings, summarizeWidgets } from "../services/widget-settings.server.js";
import { ensureBuiltinSdkPlugins } from "../sdk/builtinPlugins.js";
import { registerCoreShopifyDataProviders } from "../sdk/dataProviders.server.js";
import { listVsnDataProviders, listVsnPlugins, listVsnSdkErrors, listVsnWidgets } from "../sdk/registry.js";
import { VSN_SDK_API_VERSION } from "../sdk/version.js";
import { scanBuilderPages } from "../builder/healthScanner.js";
import { compileThemeAssets, rebuildThemeAssets } from "../services/theme-assets.server.js";
import { parseEnterpriseSettings, saveEnterpriseSettings, sanitizedEnterpriseSettings } from "../services/enterprise-hardening.server.js";
import { getCommercializationStatus } from "../services/commercialization.server.js";
import { getFeatureDecision } from "../services/entitlements.server.js";
import { getRuntimeSchemaHealth } from "../services/database-health.server.js";
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";
import {
  SHOPIFY_API_VERSION_HANDLE,
  SHOPIFY_APP_PROXY,
  SHOPIFY_AUTH_CALLBACK_PATH,
  SHOPIFY_COMPLIANCE_WEBHOOK_TOPICS,
  SHOPIFY_EXPECTED_SCOPES,
  SHOPIFY_REQUIRED_WEBHOOK_TOPICS,
  isProductionHttpsUrl,
  normalizeShopifyScopes,
} from "../config/shopifyIntegration.js";

const DEFAULT_TOKENS = {
  primaryColor: "#008060", secondaryColor: "#6d7175", accentColor: "#008060", textColor: "#1a1a1a", backgroundColor: "#ffffff", surfaceColor: "#ffffff", mutedSurfaceColor: "#f6f6f7", borderColor: "#e3e3e3",
  fontFamily: "Inter, system-ui, sans-serif", headingFontFamily: "inherit", headingScale: "1.25",
  spacingXs: "4px", spacingSm: "8px", spacingMd: "16px", spacingLg: "24px", spacingXl: "40px", spacingBase: "4",
  radiusSm: "6px", radiusMd: "10px", radiusLg: "18px",
  shadowSm: "0 1px 2px rgba(0,0,0,.08)", shadowMd: "0 8px 24px rgba(0,0,0,.12)", shadowLg: "0 20px 50px rgba(0,0,0,.16)",
  containerSm: "960px", containerMd: "1200px", containerLg: "1440px",
  headingPreset: "700 42px/1.15 Inter, system-ui, sans-serif",
  bodyPreset: "400 16px/1.6 Inter, system-ui, sans-serif",
  buttonBackground: "#1a1a1a", buttonTextColor: "#ffffff", buttonRadius: "10px", buttonPadding: "12px 20px",
  formBackground: "#ffffff", formTextColor: "#202223", formBorderColor: "#c9cccf", formRadius: "8px",
};

function parse(value, fallback) { try { return JSON.parse(value || ""); } catch { return fallback; } }

function scopeList(value) { return [...new Set(String(value||"").split(",").map((item)=>item.trim()).filter(Boolean))]; }
async function checkShopifyFilesAccess(admin, session) {
  const currentScopes=scopeList(session?.scope);
  const configuredScopes=scopeList(process.env.SCOPES);
  const acceptableScopes=["read_files","read_themes","read_images"];
  const currentCapability=acceptableScopes.find((scope)=>currentScopes.includes(scope))||null;
  const configuredCapability=acceptableScopes.find((scope)=>configuredScopes.includes(scope))||null;
  if(!currentCapability){
    return {
      status:"permission-required",
      working:false,
      currentCapability:null,
      configuredCapability,
      currentScopes,
      configuredScopes,
      missingConfiguredScopes:configuredScopes.filter((scope)=>!currentScopes.includes(scope)),
      message:"The current Shopify session cannot read Files. Re-run shopify app dev, approve the requested permissions, then refresh the embedded app.",
    };
  }
  try{
    const response=await admin.graphql(`#graphql
      query VsnFilesHealthCheck {
        files(first: 1, sortKey: UPDATED_AT, reverse: true) {
          nodes { __typename id fileStatus }
        }
      }`);
    const payload=await response.json();
    const errors=payload?.errors||[];
    if(errors.length){
      const rawMessage=errors.map((error)=>error?.message).filter(Boolean).join(" ")||"Shopify Files API returned an error.";
      const isPermission=/access|scope|permission|denied/i.test(rawMessage);
      const message=isPermission
        ? `Shopify rejected Files access for this session even though ${currentCapability} is present. Re-open/re-authorize the embedded app and retry.`
        : `Shopify Files API is reachable, but the health query was rejected. ${rawMessage}`;
      return {status:isPermission?"permission-required":"api-error",working:false,currentCapability,configuredCapability,currentScopes,configuredScopes,missingConfiguredScopes:configuredScopes.filter((scope)=>!currentScopes.includes(scope)),message};
    }
    const sample=payload?.data?.files?.nodes?.[0]||null;
    return {status:"available",working:true,currentCapability,configuredCapability,currentScopes,configuredScopes,missingConfiguredScopes:configuredScopes.filter((scope)=>!currentScopes.includes(scope)),sampleFileType:sample?.__typename||null,sampleFileStatus:sample?.fileStatus||null,message:`Shopify Files API is available through ${currentCapability}.`};
  }catch(error){
    return {status:"request-failed",working:false,currentCapability,configuredCapability,currentScopes,configuredScopes,missingConfiguredScopes:configuredScopes.filter((scope)=>!currentScopes.includes(scope)),message:error instanceof Error?error.message:"Shopify Files health check failed."};
  }
}
function nowLabel(value) { return value ? new Date(value).toLocaleString() : "—"; }

async function checkShopifyApiVersion(admin) {
  try {
    const response = await admin.graphql(`#graphql
      query VsnProductionApiVersionCheck {
        publicApiVersions { handle supported }
      }`);
    const servedVersion = response.headers?.get?.("x-shopify-api-version") || null;
    const payload = await response.json();
    const versions = payload?.data?.publicApiVersions || [];
    const configured = versions.find((row) => row?.handle === SHOPIFY_API_VERSION_HANDLE) || null;
    return {
      configuredVersion: SHOPIFY_API_VERSION_HANDLE,
      servedVersion,
      supported: configured?.supported === true,
      fallForward: Boolean(servedVersion && servedVersion !== SHOPIFY_API_VERSION_HANDLE),
      error: payload?.errors?.map((row)=>row?.message).filter(Boolean).join(" ") || null,
    };
  } catch (error) {
    return { configuredVersion: SHOPIFY_API_VERSION_HANDLE, servedVersion:null, supported:false, fallForward:false, error:error instanceof Error ? error.message : "API version check failed." };
  }
}

function productionRuntimeReadiness(session) {
  const appUrl = String(process.env.SHOPIFY_APP_URL || "").trim();
  const currentScopes = normalizeShopifyScopes(session?.scope);
  const configuredScopes = normalizeShopifyScopes(process.env.SCOPES);
  const scopeSource = configuredScopes.length ? configuredScopes : SHOPIFY_EXPECTED_SCOPES;
  return {
    nodeEnvironment: process.env.NODE_ENV || "development",
    appUrl,
    productionUrlReady: isProductionHttpsUrl(appUrl),
    authCallbackPath: SHOPIFY_AUTH_CALLBACK_PATH,
    appProxy: SHOPIFY_APP_PROXY,
    apiVersion: SHOPIFY_API_VERSION_HANDLE,
    requiredWebhooks: SHOPIFY_REQUIRED_WEBHOOK_TOPICS,
    complianceWebhooks: SHOPIFY_COMPLIANCE_WEBHOOK_TOPICS,
    expectedScopes: SHOPIFY_EXPECTED_SCOPES,
    configuredScopes: scopeSource,
    currentScopes,
    missingRuntimeScopes: SHOPIFY_EXPECTED_SCOPES.filter((scope)=>!currentScopes.includes(scope)),
    missingConfiguredScopes: SHOPIFY_EXPECTED_SCOPES.filter((scope)=>!scopeSource.includes(scope)),
  };
}


const HEALTH_GUIDES = {
  database: {
    why: "The Builder needs a working Prisma database connection for every managed system.",
    impact: "Pages may load partially and assets, campaigns or settings can appear empty even when the UI is available.",
    steps: ["Confirm DATABASE_URL points to the intended development database.", "Run `npx prisma generate`, then `npx prisma migrate deploy` from this exact app version.", "Restart the development server; do not use prisma db push/reset against merchant data."],
    verify: "Run System Health again and confirm Database connection is green with a latency value."
  },
  identity: {
    why: "Owner/staff permissions require an online Shopify staff session, not only the offline shop session.",
    impact: "Publishing and role-sensitive controls may be disabled or the current user can be classified too conservatively.",
    steps: ["Open VSN from Shopify Admin instead of a copied tunnel URL.", "If scopes or session settings changed, restart `shopify app dev`.", "Approve the updated permissions when Shopify prompts, then close and reopen the embedded app."],
    verify: "System Health should show Online staff session and the correct owner/staff identity."
  },
  migrations: {
    why: "The Prisma schema and the database migration history must match the running package.",
    impact: "Newer engines can save or read incomplete data, producing empty lists or route errors.",
    steps: ["Back up the development database.", "Run `npx prisma generate`.", "Run `npx prisma migrate deploy`; never reset a database just to clear a migration warning.", "Restart VSN."],
    verify: "The latest migration name should be visible here without a warning."
  },
  renderer: {
    why: "Canvas, preview and storefront must resolve the same VSN schema.",
    impact: "A renderer mismatch can make the editor look correct while storefront output differs.",
    steps: ["Run the renderer regression QA from the package.", "Check the first affected page in Canvas, Preview and Storefront.", "Disable only the failing custom widget/plugin while debugging rather than replacing the shared renderer."],
    verify: "The shared renderer check and visual comparison should both pass."
  },
  widgets: {
    why: "Widget definitions and capabilities must register before the editor builds its insert/control panels.",
    impact: "Widgets can disappear or expose the wrong controls.",
    steps: ["Open Developer SDK and check plugin/widget registration errors.", "Confirm the Widget Registry contains the expected built-in count.", "Disable the last custom extension if registration started failing after it was added."],
    verify: "Registered and active widget counts should be non-zero and expected categories should be present."
  },
  builderData: {
    why: "All Builder managers use the same authenticated resource/data layer.",
    impact: "Fonts, SVGs, Campaigns, CRO, Forms or Marketplace may look empty even when records exist.",
    steps: ["Confirm the database check passes first.", "Apply the packaged Prisma migrations.", "Reload only the failing Builder screen and inspect its human-readable route error.", "If one table alone fails, compare that model with the packaged Prisma schema before changing data."],
    verify: "Every listed Builder data store should report readable with a count."
  },
  shopifyFiles: {
    why: "Shopify media resolution requires a current session with a supported Files read capability and a resolvable Shopify file ID.",
    impact: "Image/SVG selections from Shopify Files cannot be resolved into usable media URLs.",
    steps: ["Check Current permissions below for `read_files`, `read_themes` or `read_images`.", "If the configured scopes changed, restart `shopify app dev` and approve the permissions.", "Close and reopen the embedded app to create a fresh online session.", "Refresh Shopify Files in the media picker and select the file again."],
    verify: "Run System Health again; Shopify Files access should show Available and the accepted capability used by the session."
  },
  shopifyProduction: {
    why: "Production release depends on a stable Shopify API version, a real HTTPS app origin and a scope/webhook contract that matches the deployed app configuration.",
    impact: "A stale API target or mismatched production config can cause OAuth, webhooks, app proxy requests or Admin API calls to fail only after deployment.",
    steps: ["Generate the named production config with `npm run config:production`.", "Run `npm run release:production:check` and resolve every failure.", "Confirm the published theme shows Theme Active, then deploy with `npm run deploy:production`.", "If API fall-forward is reported, upgrade the configured Shopify API version before release."],
    verify: "System Health should show the configured API version as supported with no fall-forward and the production readiness command should pass."
  },
  developerSdk: {
    why: "A plugin can be isolated without crashing VSN, but inactive or failed registrations still need attention.",
    impact: "Only the affected custom widgets/providers may be unavailable.",
    steps: ["Open Developer → Plugin SDK and review the latest isolation error.", "Validate the plugin manifest and compatibility range.", "Run the SDK self-test, then disable the failing plugin until it passes."],
    verify: "All registered plugins should show Active and the SDK self-test should pass."
  },
  commercialization: {
    why: "Plans, quotas and onboarding share one entitlement source.",
    impact: "Features can be incorrectly gated if plan state cannot be resolved.",
    steps: ["Open Plans and confirm the current development entitlement.", "In Developer Mode, select the intended simulated tier.", "Do not activate production billing while this project is still in Developer Mode."],
    verify: "The current plan and all usage counters should render without warnings."
  },
  accessibility: {
    why: "The page scanner found content or interaction patterns that can block keyboard, screen-reader or low-vision users.",
    impact: "Accessibility quality and compliance risk increase on affected pages.",
    steps: ["Open the Accessibility tab and start with Error-level findings.", "Fix missing labels/alt text, heading order and keyboard/focus problems in the editor.", "Re-scan before publishing."],
    verify: "Affected page findings should disappear and the accessibility score should increase."
  },
  seo: {
    why: "One or more Builder pages have discoverability/indexing metadata issues.",
    impact: "Search engines can receive duplicate, incomplete or conflicting page signals.",
    steps: ["Open the SEO tab and fix Error-level findings first.", "Review H1, title/description, canonical and indexability settings for each affected page.", "Validate any custom JSON-LD before republishing."],
    verify: "Re-run the scan and confirm no critical SEO findings remain."
  },
  performance: {
    why: "A generated asset or page-level budget is approaching the configured warning threshold.",
    impact: "Large DOM, CSS, JavaScript, images or font payloads can slow storefront interaction and Core Web Vitals.",
    steps: ["Open Performance and identify the largest budget first.", "Optimize images/fonts and remove unused custom code or third-party blocks.", "Keep used-assets-only, CSS deduplication and responsive images enabled unless compatibility requires otherwise."],
    verify: "Rebuild assets and re-run Health; the affected budget should return below warning level."
  },
  security: {
    why: "The scanner found a custom-code or storefront pattern that needs review.",
    impact: "Unsafe custom JavaScript or URLs can affect storefront integrity.",
    steps: ["Open the Security/Health finding and identify the exact page/widget.", "Remove or rewrite the risky custom code.", "Enable Safe Mode while investigating if the storefront is unstable."],
    verify: "Re-scan and confirm the security finding is gone before disabling Safe Mode."
  },
  templates: {
    why: "A page/template has a structural or assignment problem in its stored VSN schema.",
    impact: "Publishing, dynamic resource resolution or migration can fail for that template.",
    steps: ["Open the affected page from the finding.", "Repair invalid JSON/resource assignments or duplicate defaults without deleting unrelated records.", "Save a new revision and run the scan again."],
    verify: "Template structure should report no Error-level findings."
  }
};

async function buildSystemInfo(shop, session, admin, diagnostics, widgetSummary, pageRows = [], setting = null) {
  const started = Date.now();
  ensureBuiltinSdkPlugins();
  registerCoreShopifyDataProviders();
  const sdkPlugins = listVsnPlugins();
  const sdkWidgets = listVsnWidgets();
  const sdkProviders = listVsnDataProviders();
  const sdkErrors = listVsnSdkErrors();
  const countSafe = async (operation) => { try { return await operation(); } catch { return null; } };
  const enterprise = parseEnterpriseSettings(setting?.enterpriseJson);
  const healthAudit = scanBuilderPages(pageRows);
  const fontRows = await db.builderCustomFont.findMany({ where:{shop,deletedAt:null}, select:{id:true,family:true,weight:true,style:true,mimeType:true,fileData:true} }).catch(()=>[]);
  const customFontBytes = fontRows.reduce((sum,row)=>sum + Number(row.fileData?.length || row.fileData?.byteLength || 0),0);
  const compiledAssets = compileThemeAssets(pageRows, { designTokens:parse(setting?.designTokensJson,{}), customFonts:fontRows.map(({fileData,...row})=>row), enterprise });
  const assetEntries = compiledAssets?.manifest?.entries || [];
  const assetPerformance = {
    architecture: compiledAssets.architecture,
    publishedTemplates: compiledAssets.pageCount,
    cssFiles: compiledAssets.cssFileCount,
    jsFiles: compiledAssets.jsFileCount,
    cssBytes: assetEntries.reduce((sum,row)=>sum+Number(row.cssBytes||0),0),
    jsBytes: assetEntries.reduce((sum,row)=>sum+Number(row.jsBytes||0),0),
    criticalCssBytes: assetEntries.reduce((sum,row)=>sum+Number(row.criticalCssBytes||0),0),
    customFontBytes,
    runtimeDependencies:[...new Set(assetEntries.flatMap((row)=>row.dependencies||[]))],
    usedAssetsOnly:enterprise.assetMode==="used-only",
    cssDeduplication:enterprise.cssDeduplication!==false,
    criticalCss:enterprise.criticalCss!==false,
    fontSubset:enterprise.fontSubset!==false,
    fontPreload:enterprise.fontPreload,
  };
  let database = { status:"ok", latencyMs:0 };
  const dbStarted = Date.now(); try { await db.$queryRawUnsafe("SELECT 1"); database.latencyMs=Date.now()-dbStarted; } catch (error) { database={status:"error",latencyMs:Date.now()-dbStarted,error:error instanceof Error?error.message:"Database query failed"}; }
  const [pages,library,fonts,fontTrash,svgs,svgTrash,campaigns,floating,experiments,submissions,spam,uploads,integrations,automationLogs,translations,comments,presence,backups,supportTickets,brandKits,marketplaceInstalls,marketplaceFavorites] = await Promise.all([
    countSafe(()=>db.builderPage.count({where:{shop,deletedAt:null}})), countSafe(()=>db.builderLibraryItem.count({where:{shop,source:"local",deletedAt:null}})), countSafe(()=>db.builderCustomFont.count({where:{shop,deletedAt:null}})), countSafe(()=>db.builderCustomFont.count({where:{shop,deletedAt:{not:null}}})), countSafe(()=>db.builderSvgAsset.count({where:{shop,deletedAt:null}})), countSafe(()=>db.builderSvgAsset.count({where:{shop,deletedAt:{not:null}}})),
    countSafe(()=>db.builderPage.count({where:{shop,deletedAt:null,template:{in:["popup","modal","drawer","flyout","announcement-overlay"]}}})), countSafe(()=>db.builderPage.count({where:{shop,deletedAt:null,template:"floating-element"}})), countSafe(()=>db.builderExperiment.count({where:{shop}})), countSafe(()=>db.builderFormSubmission.count({where:{shop}})), countSafe(()=>db.builderFormSubmission.count({where:{shop,isSpam:true}})), countSafe(()=>db.builderFormUpload.count({where:{shop}})), countSafe(()=>db.builderIntegration.count({where:{shop}})), countSafe(()=>db.builderAutomationLog.count({where:{shop}})), countSafe(()=>db.builderPageTranslation.count({where:{shop}})), countSafe(()=>db.builderComment.count({where:{shop}})), countSafe(()=>db.builderPresence.count({where:{shop}})), countSafe(()=>db.builderBackup.count({where:{shop}})), countSafe(()=>db.builderSupportTicket.count({where:{shop}})), countSafe(()=>db.builderBrandKit.count({where:{shop,deletedAt:null}})), countSafe(()=>db.builderMarketplaceInstall.count({where:{shop}})), countSafe(()=>db.builderMarketplaceFavorite.count({where:{shop}})),
  ]);
  let migrations={count:null,latest:null}; try { const rows=await db.$queryRawUnsafe('SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC'); migrations={count:Array.isArray(rows)?rows.length:null,latest:Array.isArray(rows)&&rows[0]?{name:rows[0].migration_name,finishedAt:rows[0].finished_at}:null}; } catch {}
  const schemaHealth=await getRuntimeSchemaHealth(db,{fresh:true}).catch((error)=>({ready:false,expectedMigrationApplied:false,expectedMigration:null,latestMigration:null,missingTables:[],databaseError:error instanceof Error?error.message:"Schema health check failed.",features:{}}));
  const flags=getServerFeatureFlags(); const flagInfo=Object.fromEntries(Object.entries(FEATURE_FLAGS).map(([key,def])=>[key,{enabled:Boolean(flags[key]),phase:def.phase,env:def.env}]));
  const envBoolean=(key)=>Boolean(String(process.env[key]||"").trim());
  const memory=process.memoryUsage?.()||{};
  const role=getBuilderRole(session); const onlineUser=session?.onlineAccessInfo?.associated_user||session?.onlineAccessInfo?.associatedUser||null;
  const structuralIssues=diagnostics?.issues||[]; const structuralErrors=structuralIssues.filter(x=>x.level==="error").length; const structuralWarnings=structuralIssues.filter(x=>x.level==="warning").length;
  const filesAccess=await checkShopifyFilesAccess(admin,session);
  const apiVersionStatus=await checkShopifyApiVersion(admin);
  const productionIntegration=productionRuntimeReadiness(session);
  const commercialization=await getCommercializationStatus(db,shop).catch(()=>null);
  const dataStores={pages,library,fonts,fontTrash,svgs,svgTrash,campaigns,floating,experiments,submissions,integrations,brandKits,marketplaceInstalls,marketplaceFavorites};
  const failedDataStores=Object.entries(dataStores).filter(([,value])=>value===null).map(([key])=>key);
  const dataStoreHealthy=failedDataStores.length===0;
  const categoryHasError=(category)=>healthAudit.issues.some((issue)=>issue.category===category&&issue.level==="error");
  const categoryHasWarning=(category)=>healthAudit.issues.some((issue)=>issue.category===category&&issue.level==="warning");
  const coreChecks=[
    {key:"database",label:"Database connection",status:database.status==="ok"?"pass":"fail",detail:database.status==="ok"?`${database.latencyMs} ms response`:database.error||"Database unavailable"},
    {key:"identity",label:"Shopify staff identity",status:session?.isOnline&&onlineUser?"pass":"warning",detail:session?.isOnline&&onlineUser?(onlineUser?.account_owner||onlineUser?.accountOwner?"Store owner detected":"Authenticated staff member detected"):"Online staff session is not available yet; refresh/re-authorize the embedded app."},
    {key:"migrations",label:"Database migrations",status:schemaHealth.ready&&schemaHealth.expectedMigrationApplied?"pass":schemaHealth.databaseError?"fail":"warning",detail:schemaHealth.ready&&schemaHealth.expectedMigrationApplied?`${schemaHealth.latestMigration||migrations.latest?.name||"Latest migration applied"}`:`${schemaHealth.expectedMigration||"Packaged migration"} required${schemaHealth.missingTables?.length?` · missing ${schemaHealth.missingTables.join(", ")}`:""}`},
    {key:"renderer",label:"Shared renderer architecture",status:"pass",detail:"Canvas, Preview and Storefront share the VSN schema/renderer pipeline."},
    {key:"widgets",label:"Widget registry",status:(widgetSummary?.totalCount||0)>0?"pass":"fail",detail:`${widgetSummary?.activeCount??0} active of ${widgetSummary?.totalCount??0} registered widgets`},
    {key:"builderData",label:"Builder data stores",status:dataStoreHealthy?"pass":"fail",detail:dataStoreHealthy?"Pages, Library, Fonts, SVGs, Campaigns, CRO, Forms and Marketplace tables are readable.":`These Builder data stores could not be read: ${failedDataStores.map((key)=>key.replace(/([a-z])([A-Z])/g,"$1 $2")).join(", ")}. Apply the packaged Prisma migrations and restart the app.`},
    {key:"shopifyFiles",label:"Shopify Files access",status:filesAccess.working?"pass":filesAccess.status==="permission-required"?"warning":"fail",detail:filesAccess.message},
    {key:"shopifyProduction",label:"Shopify production integration",status:apiVersionStatus.supported&&!apiVersionStatus.fallForward&&productionIntegration.missingConfiguredScopes.length===0?"pass":"warning",detail:`API ${SHOPIFY_API_VERSION_HANDLE}${apiVersionStatus.servedVersion?` served ${apiVersionStatus.servedVersion}`:""} · ${productionIntegration.missingConfiguredScopes.length?`${productionIntegration.missingConfiguredScopes.length} configured scope(s) missing`:"scope contract complete"} · ${productionIntegration.productionUrlReady?"production URL active":"development URL active"}`},
    {key:"developerSdk",label:"Developer SDK runtime",status:sdkPlugins.every((plugin)=>plugin.status==="active")?"pass":"warning",detail:`API v${VSN_SDK_API_VERSION} · ${sdkPlugins.length} plugin(s) · ${sdkWidgets.length} SDK widget(s) · ${sdkProviders.length} provider(s)`},
    {key:"commercialization",label:"Plans & launch system",status:commercialization?.plan?.allWidgets&&Array.isArray(commercialization?.onboarding?.tracks)&&commercialization.onboarding.tracks.length===5?"pass":"warning",detail:commercialization?`${commercialization.plan.name} · ${commercialization.onboarding.tracks.length} onboarding workflow(s) · ${commercialization.developerMode?"Developer plan simulation enabled":commercialization.billingConfigured?"Shopify billing configured":"Production billing destination not configured"}`:"Commercialization status could not be loaded."},
    {key:"accessibility",label:"Accessibility scanner",status:categoryHasError("accessibility")?"fail":categoryHasWarning("accessibility")?"warning":"pass",detail:healthAudit.totals.accessibility?`${healthAudit.totals.accessibility} accessibility finding(s) across ${healthAudit.pageCount} page(s)`:"No accessibility findings detected"},
    {key:"seo",label:"SEO scanner",status:categoryHasError("seo")?"fail":categoryHasWarning("seo")?"warning":"pass",detail:healthAudit.totals.seo?`${healthAudit.totals.seo} SEO finding(s) across Builder pages`:"No SEO findings detected"},
    {key:"performance",label:"Performance budgets",status:assetPerformance.cssBytes>500000||assetPerformance.jsBytes>250000||healthAudit.totals.knownImageBytes>5000000||assetPerformance.customFontBytes>10000000?"warning":"pass",detail:`${Math.round(assetPerformance.cssBytes/1024)} KB compiled CSS · ${Math.round(assetPerformance.jsBytes/1024)} KB custom JS · ${Math.round(healthAudit.totals.knownImageBytes/1024)} KB known images · ${Math.round(assetPerformance.customFontBytes/1024)} KB custom fonts`},
    {key:"security",label:"Storefront security scan",status:categoryHasError("security")?"fail":categoryHasWarning("security")?"warning":"pass",detail:healthAudit.totals.security?`${healthAudit.totals.security} security/custom-code warning(s)`:(enterprise.safeMode?"Safe Mode enabled; custom JavaScript is disabled.":"No high-risk Builder code patterns detected")},
    {key:"templates",label:"Template structure",status:structuralErrors?"fail":structuralWarnings?"warning":"pass",detail:structuralIssues.length?`${structuralErrors} error(s), ${structuralWarnings} warning(s)`:"No structural page/template issues detected"},
  ];
  for (const check of coreChecks) check.guide = HEALTH_GUIDES[check.key] || { why:"This subsystem needs attention.", impact:"The affected Builder capability can be limited until the warning is resolved.", steps:["Review the detailed status shown in System Health.","Resolve the underlying configuration or data issue, then reload the affected screen."], verify:"Run System Health again and confirm this check passes." };
  let score=100; for(const check of coreChecks){if(check.status==="fail")score-=25;if(check.status==="warning")score-=7;} score=Math.max(0,Math.min(100,score));
  const healthStatus=score>=90?"healthy":score>=70?"needs-attention":"critical";
  return {
    generatedAt:new Date().toISOString(), durationMs:Date.now()-started, developerMode:true,
    health:{score,status:healthStatus,checks:coreChecks},
    application:{name:"VSN Builder",version:VSN_BASELINE.version,milestone:VSN_BASELINE.milestone,phase:VSN_BASELINE.phase,baseline:VSN_BASELINE.name,completedPhases:VSN_BASELINE.completedPhases,schema:VSN_BASELINE.schema,environment:process.env.NODE_ENV||"development"},
    engines:{renderer:"Shared VSN schema renderer",widgetRegistry:"Central widget registry + capability map",queryLoop:"Query / Loop Engine",components:"Components / Symbols / Variants",responsive:"Responsive Engine 2.0",interactions:"Trigger → Conditions → Timeline → Actions",campaigns:"Campaign + Popup + Floating runtime",cro:"CRO Experiments + attribution",ai:"Structured VSN AI Builder",collaboration:"Review + roles + revision conflicts",localization:"Locales + Shopify Markets",forms:"Forms 2.0 + Automation",marketplace:"Templates Marketplace + Brand Kits",developerSdk:"Public Widget SDK + Plugin Runtime + Data Providers",enterpriseHardening:"Accessibility + SEO + Performance + Enterprise controls",commercialization:"Plans + quotas + onboarding + launch demos + go-to-market docs",wishlist:"Anonymous + authenticated Wishlist Commerce runtime",email:"Email Studio 2.2 + reusable symbols + saved blocks + Shopify commerce + responsive visibility + version history + marketplace + AI + compatibility diagnostics",documentation:"Task-based user/developer docs + generated ecosystem manifest",ecosystemQa:"Release contract drift + documentation coverage audits"},
    widgets:{total:widgetSummary?.totalCount??0,active:widgetSummary?.activeCount??0,disabled:widgetSummary?.disabledCount??0,categories:widgetSummary?.categoryCounts||{}},
    developerSdk:{apiVersion:VSN_SDK_API_VERSION,plugins:sdkPlugins.length,activePlugins:sdkPlugins.filter((plugin)=>plugin.status==="active").length,sdkWidgets:sdkWidgets.length,dataProviders:sdkProviders.length,isolationEvents:sdkErrors.length},
    permissions:{builderRole:role,ownerDetected:role==="admin",onlineStaffSession:Boolean(session?.isOnline&&onlineUser),canPublish:canBuilder(role,"publish"),canDelete:canBuilder(role,"delete"),canManageSettings:canBuilder(role,"settings")},
    runtime:{node:process.version,platform:process.platform,arch:process.arch,uptimeSeconds:Math.round(process.uptime()),memoryMb:{rss:Math.round((memory.rss||0)/1048576),heapUsed:Math.round((memory.heapUsed||0)/1048576),heapTotal:Math.round((memory.heapTotal||0)/1048576)}},
    database:{...database,migrations,schema:schemaHealth,dataStores:Object.fromEntries(Object.entries(dataStores).map(([key,value])=>[key,{readable:value!==null,count:value}]))},
    shopify:{shop,apiVersion:SHOPIFY_API_VERSION_HANDLE,apiVersionStatus,productionIntegration,scope:String(session?.scope||""),currentScopes:scopeList(session?.scope),configuredScopes:scopeList(process.env.SCOPES),missingConfiguredScopes:scopeList(process.env.SCOPES).filter((scope)=>!scopeList(session?.scope).includes(scope)),onlineStaffSession:Boolean(session?.isOnline),appUrlConfigured:envBoolean("SHOPIFY_APP_URL"),apiKeyConfigured:envBoolean("SHOPIFY_API_KEY"),apiSecretConfigured:envBoolean("SHOPIFY_API_SECRET"),scopesConfigured:envBoolean("SCOPES"),appProxyPath:SHOPIFY_APP_PROXY.storefrontPath,filesAccess},
    services:{openAiConfigured:envBoolean("OPENAI_API_KEY"),turnstileSecretConfigured:envBoolean("VSN_TURNSTILE_SECRET_KEY"),hcaptchaSecretConfigured:envBoolean("VSN_HCAPTCHA_SECRET_KEY"),fileScanWebhookConfigured:envBoolean("VSN_FORM_FILE_SCAN_WEBHOOK"),emailWebhookConfigured:envBoolean("VSN_FORM_EMAIL_WEBHOOK_URL"),sentryConfigured:envBoolean("SENTRY_DSN"),templateCatalogConfigured:envBoolean("VSN_TEMPLATE_CATALOG_URL")},
    featureFlags:flagInfo,
    content:{pages,library,campaigns,floating,experiments,translations,brandKits,marketplaceInstalls,marketplaceFavorites}, assets:{fonts,fontTrash,svgs,svgTrash}, forms:{submissions,spam,uploads,integrations,automationLogs}, collaboration:{comments,presence}, operations:{backups,supportTickets},
    phase16:commercialization,
    phase15:{
      healthAudit:{generatedAt:healthAudit.generatedAt,score:healthAudit.score,pageCount:healthAudit.pageCount,totals:healthAudit.totals,pages:healthAudit.reports.map((report)=>({pageId:report.pageId,title:report.title,template:report.template,status:report.status,score:report.score,summary:report.summary,accessibility:report.accessibility,seo:report.seo,performance:report.performance,security:report.security})),issues:healthAudit.issues.slice(0,200)},
      performance:assetPerformance,
      enterprise:sanitizedEnterpriseSettings(enterprise),
      budgets:{domNodesWarning:800,domNodesCritical:1500,cssWarningBytes:500000,customJsWarningBytes:250000,imageKnownBytesWarning:5000000,tapTargetPx:44},
      protections:{safeMode:enterprise.safeMode,backupRetentionDays:enterprise.backupRetentionDays,backupRetentionCount:enterprise.backupRetentionCount,environment:enterprise.environment,promotionTarget:enterprise.promotionTarget},
    },
    diagnostics:{issueCount:structuralIssues.length,errorCount:structuralErrors,warningCount:structuralWarnings},
  };
}

async function buildDiagnostics(shop, session) {
  const pages = await db.builderPage.findMany({ where: { shop, deletedAt: null }, orderBy: { updatedAt: "desc" } });
  const issues = [];
  const defaults = new Map();
  for (const page of pages) {
    if (page.isDefault) defaults.set(page.template, (defaults.get(page.template) || 0) + 1);
    if (page.status === "published" && !page.publishedJson) issues.push({ level: "error", code: "PUBLISHED_JSON_MISSING", pageId: page.id, message: `${page.title}: published but publishedJson is empty` });
    if (["collection", "product", "blog", "article"].includes(page.template) && !page.isDefault && (!page.resourceHandle || !page.resourceId)) issues.push({ level: "warning", code: "RESOURCE_ASSIGNMENT_MISSING", pageId: page.id, message: `${page.title}: specific ${page.template} template has no complete resource assignment` });
    try { if (page.contentJson) JSON.parse(page.contentJson); } catch { issues.push({ level: "error", code: "INVALID_CONTENT_JSON", pageId: page.id, message: `${page.title}: invalid contentJson` }); }
  }
  for (const [template, count] of defaults) if (count > 1) issues.push({ level: "error", code: "MULTIPLE_DEFAULTS", message: `${template}: ${count} default templates found` });
  const healthScan = scanBuilderPages(pages);
  for (const finding of healthScan.issues.slice(0,300)) issues.push({ level:finding.level === "info" ? "warning" : finding.level, code:finding.code, pageId:finding.pageId || null, message:`${finding.pageTitle ? `${finding.pageTitle}: ` : ""}${finding.message}` });
  const scope = String(session?.scope || "");
  const currentScopes=scopeList(scope);
  if (!currentScopes.includes("read_products")) issues.push({ level: "warning", code: "SCOPE_READ_PRODUCTS", message: "Product browsing is limited because read_products is not visible in the current Shopify session. Re-authorize the app if product pickers fail." });
  if (!["read_files","read_themes","read_images"].some((item)=>currentScopes.includes(item))) issues.push({ level: "warning", code: "SCOPE_FILES_READ", message: "Shopify Files cannot be resolved because the current session has none of the supported Files read scopes (read_files, read_themes, read_images). Re-run shopify app dev, approve the requested access, then reopen the embedded app." });
  return {
    checkedAt: new Date().toISOString(),
    pageCount: pages.length,
    publishedCount: pages.filter((p) => p.status === "published").length,
    draftCount: pages.filter((p) => p.status !== "published").length,
    appProxyExpected: "/apps/vsn-builder",
    scope,
    healthScore: healthScan.score,
    healthTotals: healthScan.totals,
    issues,
  };
}

export async function loader({ request }) {
  const { session, admin } = await authenticate.admin(request);
  const role = getBuilderRole(session);
  const [pages, revisions, logs, setting, diagnosticEvents] = await Promise.all([
    db.builderPage.findMany({ where: { shop: session.shop, deletedAt: null }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, handle: true, template: true, status: true, isDefault: true, resourceId: true, resourceHandle: true, updatedAt: true, publishedAt: true, contentJson: true, publishedJson: true, version: true, publishedVersion: true } }),
    db.builderRevision.findMany({ where: { shop: session.shop }, orderBy: { createdAt: "desc" }, take: 80 }),
    db.builderAuditLog.findMany({ where: { shop: session.shop }, orderBy: { createdAt: "desc" }, take: 80 }),
    db.builderShopSetting.findUnique({ where: { shop: session.shop } }),
    db.builderDiagnosticEvent.findMany({ where: { shop: session.shop }, orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  const diagnostics = await buildDiagnostics(session.shop, session);
  const widgetSummary = await loadWidgetSettings(admin).catch((error) => { console.warn("VSN diagnostics widget settings fallback:", error instanceof Error ? error.message : error); return summarizeWidgets(getWidgetDefinitions()); });
  const [requestLogs, cleanupRuns, systemInfo] = await Promise.all([
    db.builderRequestLog.findMany({ where: { shop: session.shop }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.builderCleanupRun.findMany({ where: { shop: session.shop }, orderBy: { createdAt: "desc" }, take: 10 }),
    buildSystemInfo(session.shop, session, admin, diagnostics, widgetSummary, pages, setting),
  ]);
  const releaseReadiness = {
    appUrlConfigured: Boolean(process.env.SHOPIFY_APP_URL),
    apiKeyConfigured: Boolean(process.env.SHOPIFY_API_KEY),
    apiSecretConfigured: Boolean(process.env.SHOPIFY_API_SECRET),
    scopesConfigured: Boolean(process.env.SCOPES),
    proxyPath: SHOPIFY_APP_PROXY.storefrontPath,
    apiVersion: SHOPIFY_API_VERSION_HANDLE,
    apiVersionSupported: systemInfo?.shopify?.apiVersionStatus?.supported === true,
    apiVersionFallForward: systemInfo?.shopify?.apiVersionStatus?.fallForward === true,
    productionUrlReady: systemInfo?.shopify?.productionIntegration?.productionUrlReady === true,
    productionScopesReady: (systemInfo?.shopify?.productionIntegration?.missingConfiguredScopes || []).length === 0,
    runtimeScopesReady: (systemInfo?.shopify?.productionIntegration?.missingRuntimeScopes || []).length === 0,
    complianceWebhookCount: SHOPIFY_COMPLIANCE_WEBHOOK_TOPICS.length,
    requiredWebhookCount: SHOPIFY_REQUIRED_WEBHOOK_TOPICS.length,
    ecosystemManifest: ecosystemManifest.version === VSN_BASELINE.version && ecosystemManifest.milestone === VSN_BASELINE.milestone,
    documentationCoverage: ecosystemManifest.counts.userDocs >= 14 && ecosystemManifest.counts.developerDocs >= 12,
    documentedWidgets: ecosystemManifest.counts.widgets,
    documentedMotionPresets: ecosystemManifest.counts.motionBuiltins,
    documentedEmailBlocks: ecosystemManifest.counts.emailBlocks,
  };
  return {
    shop: session.shop,
    role,
    actor: builderActor(session),
    permissions: { publish: canBuilder(role, "publish"), delete: canBuilder(role, "delete"), settings: canBuilder(role, "settings"), restore: canBuilder(role, "restore") },
    pages: pages.map((p) => ({ ...p, hasUnpublishedChanges: String(p.contentJson || "[]") !== String(p.publishedJson || "[]") })), revisions, logs, diagnosticEvents,
    designTokens: { ...DEFAULT_TOKENS, ...Object.fromEntries(Object.entries(parse(setting?.designTokensJson, {})).filter(([key,value]) => key !== "__vsn2" && ["string","number","boolean"].includes(typeof value))) },
    onboarding: { themeExtensionEnabled: false, appProxyVerified: true, firstTemplateCreated: pages.length > 0, defaultTemplateSet: pages.some((p) => p.isDefault), storefrontTested: false, ...parse(setting?.onboardingJson, {}) },
    diagnostics, requestLogs, cleanupRuns, releaseReadiness, systemInfo,
  };
}

export async function action({ request }) {
  assertTrustedMutationRequest(request);
  const { session, admin } = await authenticate.admin(request);
  const role = getBuilderRole(session);
  const actor = builderActor(session);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const deny = (message) => Response.json({ success: false, error: message }, { status: 403 });

  if (intent === "save-tokens") {
    if (!canBuilder(role, "settings")) return deny("Only an admin can change design tokens.");
    const tokens = parse(String(form.get("tokens") || "{}"), {});
    const currentSetting = await db.builderShopSetting.findUnique({ where: { shop: session.shop }, select: { designTokensJson:true } }).catch(()=>null);
    const currentTokens = parse(currentSetting?.designTokensJson, {});
    const payload = { ...tokens, ...(currentTokens?.__vsn2 ? { __vsn2: currentTokens.__vsn2 } : {}) };
    await db.builderShopSetting.upsert({ where: { shop: session.shop }, create: { shop: session.shop, designTokensJson: JSON.stringify(payload) }, update: { designTokensJson: JSON.stringify(payload) } });
    await db.builderAuditLog.create({ data: { shop: session.shop, actor, role, action: "design_tokens.updated" } });
    return Response.json({ success: true, message: "Design tokens saved." });
  }
  if (intent === "save-onboarding") {
    if (!canBuilder(role, "settings")) return deny("Only an admin can update setup checks.");
    const onboarding = parse(String(form.get("onboarding") || "{}"), {});
    await db.builderShopSetting.upsert({ where: { shop: session.shop }, create: { shop: session.shop, onboardingJson: JSON.stringify(onboarding) }, update: { onboardingJson: JSON.stringify(onboarding) } });
    return Response.json({ success: true, message: "Setup checklist updated." });
  }
  if (intent === "restore-revision") {
    if (!canBuilder(role, "restore")) return deny("Only an admin can restore revisions.");
    const revisionId = String(form.get("revisionId") || "");
    const revision = await db.builderRevision.findFirst({ where: { id: revisionId, shop: session.shop } });
    if (!revision) return Response.json({ success: false, error: "Revision not found." }, { status: 404 });
    const page = await db.builderPage.findFirst({ where: { id: revision.pageId, shop: session.shop, deletedAt: null } });
    if (!page) return Response.json({ success: false, error: "Page not found." }, { status: 404 });
    await db.$transaction([
      db.builderRevision.create({ data: { shop: session.shop, pageId: page.id, title: `Before restore: ${page.title}`, contentJson: page.contentJson || "[]", kind: "pre-restore", createdBy: actor } }),
      db.builderPage.update({ where: { id: page.id }, data: { contentJson: revision.contentJson, title: revision.title.replace(/^Before restore: /, "") || page.title, status: "draft" } }),
      db.builderAuditLog.create({ data: { shop: session.shop, pageId: page.id, actor, role, action: "revision.restored", details: revision.id } }),
    ]);
    return Response.json({ success: true, message: "Revision restored as a draft." });
  }
  if (intent === "run-cleanup") {
    if (!canBuilder(role, "settings")) return deny("Only an admin can run cleanup.");
    const setting = await db.builderShopSetting.findUnique({where:{shop:session.shop},select:{enterpriseJson:true}}).catch(()=>null);
    const enterprise = parseEnterpriseSettings(setting?.enterpriseJson);
    const stats = await cleanupBuilderData(session.shop,{backupDays:enterprise.backupRetentionDays,backupRetentionCount:enterprise.backupRetentionCount});
    await db.builderAuditLog.create({ data: { shop: session.shop, actor, role, action: "maintenance.cleanup", details: JSON.stringify(stats) } });
    return Response.json({ success: true, message: `Cleanup complete: ${Object.values(stats).reduce((a,b)=>a+b,0)} record(s) removed.`, stats });
  }
  if (intent === "clear-request-logs") {
    if (!canBuilder(role, "settings")) return deny("Only an admin can clear request logs.");
    const result = await db.builderRequestLog.deleteMany({ where: { shop: session.shop } });
    return Response.json({ success: true, message: `${result.count} request log(s) cleared.` });
  }

  if (intent === "save-enterprise-hardening") {
    if (!canBuilder(role, "settings")) return deny("Only a Builder Admin can change enterprise hardening settings.");
    const entitlement = await getFeatureDecision(db, session.shop, "enterpriseControls");
    if (!entitlement.allowed) return Response.json({success:false,error:entitlement.message,code:entitlement.code,entitlement},{status:403});
    let payload = {}; try { payload = JSON.parse(String(form.get("settings") || "{}")); } catch { return Response.json({success:false,error:"Enterprise settings JSON is invalid."},{status:400}); }
    const next = await saveEnterpriseSettings(session.shop,payload);
    const assetBuild = await rebuildThemeAssets({ admin, session, db }).catch((error)=>({success:false,error:error instanceof Error?error.message:"Theme asset rebuild failed."}));
    await db.builderAuditLog.create({data:{shop:session.shop,actor,role,action:"enterprise_hardening.updated",details:JSON.stringify({safeMode:next.safeMode,assetMode:next.assetMode,environment:next.environment,promotionTarget:next.promotionTarget,assetRebuild:Boolean(assetBuild?.success)})}});
    const assetMessage = assetBuild?.success ? " Storefront assets were rebuilt." : assetBuild?.requiresReauthorization ? ` Settings saved, but theme assets need Shopify permission: ${(assetBuild.missingScopes||[]).join(", ")}.` : assetBuild?.error ? ` Settings saved; theme asset rebuild needs attention: ${assetBuild.error}` : "";
    return Response.json({success:true,intent,message:`Enterprise hardening settings saved.${assetMessage}`,enterprise:sanitizedEnterpriseSettings(next),assetBuild});
  }
  if (intent === "prepare-promotion") {
    if (!canBuilder(role, "settings")) return deny("Only a Builder Admin can prepare environment promotion data.");
    const entitlement = await getFeatureDecision(db, session.shop, "enterpriseControls");
    if (!entitlement.allowed) return Response.json({success:false,error:entitlement.message,code:entitlement.code,entitlement},{status:403});
    const setting = await db.builderShopSetting.findUnique({where:{shop:session.shop},select:{enterpriseJson:true}}).catch(()=>null);
    const enterprise = parseEnterpriseSettings(setting?.enterpriseJson);
    const target = ["development","staging","production"].includes(String(form.get("target")||"")) ? String(form.get("target")) : enterprise.promotionTarget;
    const report = await buildDiagnostics(session.shop,session);
    const blocking = report.issues.filter((issue)=>issue.level==="error").length;
    return Response.json({success:true,intent,message:blocking?`Promotion preview created with ${blocking} blocking issue(s).`:`Promotion preview is ready for ${target}.`,promotion:{dryRun:true,developerMode:true,from:enterprise.environment,target,blockingIssues:blocking,generatedAt:new Date().toISOString(),note:"Developer Mode only prepares a sanitized promotion manifest; it never deploys or changes a production store."}});
  }

  if (intent === "run-diagnostics") {
    const report = await buildDiagnostics(session.shop, session);
    await db.builderDiagnosticEvent.deleteMany({ where: { shop: session.shop, code: { startsWith: "SCAN_" } } });
    if (report.issues.length === 0) await db.builderDiagnosticEvent.create({ data: { shop: session.shop, level: "info", code: "SCAN_HEALTHY", message: "Diagnostics scan found no structural template issues." } });
    for (const issue of report.issues) await db.builderDiagnosticEvent.create({ data: { shop: session.shop, level: issue.level, code: `SCAN_${issue.code}`, message: issue.message, pageId: issue.pageId || null } });
    return Response.json({ success: true, message: `Diagnostics complete: ${report.issues.length} issue(s).`, report });
  }
  return Response.json({ success: false, error: "Unsupported action." }, { status: 400 });
}

function Card({ title, children, action }) {
  return <section className="rounded-xl border border-[#e3e3e3] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold text-[#1a1a1a]">{title}</h2>{action}</div>{children}</section>;
}

export default function ControlCenter() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const saveTokens = (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const tokens = Object.fromEntries([...form.entries()].filter(([key]) => key !== "intent")); fetcher.submit({ intent: "save-tokens", tokens: JSON.stringify(tokens) }, { method: "post" }); };
  const saveOnboarding = (next) => fetcher.submit({ intent: "save-onboarding", onboarding: JSON.stringify(next) }, { method: "post" });
  return <div className="min-h-screen bg-[#f6f6f7] px-6 py-6 text-[#1a1a1a]">
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Release & Diagnostics Center</h1><p className="mt-1 text-sm text-[#6d6d6d]">Versioning, permissions, design tokens, setup and health checks for {data.shop}.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Role: {data.role}</span></div>
      {fetcher.data?.message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{fetcher.data.message}</div>}
      {fetcher.data?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{fetcher.data.error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="1. Versioning / Revisions"><div className="mb-3 grid grid-cols-2 gap-2">{data.pages.slice(0,6).map((p) => <div key={p.id} className="rounded-lg bg-[#fafafa] px-3 py-2 text-xs"><b className="block truncate">{p.title}</b><span className={p.hasUnpublishedChanges ? "text-amber-700" : "text-emerald-700"}>{p.hasUnpublishedChanges ? "Draft differs from published" : "Draft matches published"}</span></div>)}</div><div className="max-h-80 space-y-2 overflow-auto">{data.revisions.length ? data.revisions.map((r) => <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#eee] p-3"><div><div className="text-sm font-medium">{r.title}</div><div className="text-xs text-[#888]">{r.kind} · {nowLabel(r.createdAt)}</div></div><s-button disabled={!data.permissions.restore || busy} onClick={() => fetcher.submit({ intent: "restore-revision", revisionId: r.id }, { method: "post" })} className="rounded-md border px-2.5 py-1.5 text-xs disabled:opacity-40">Restore</s-button></div>) : <p className="text-sm text-[#777]">Save or publish a template to create its first server revision.</p>}</div></Card>

        <Card title="2. Import / Export"><div className="space-y-3 text-sm text-[#555]"><p>Export remains available from each template's ⋮ menu. Import is available on the Pages screen and regenerates widget IDs before creating a draft.</p><s-button href="/app/pages" variant="primary">Open Pages / Import</s-button></div></Card>

        <Card title="3. Permissions & Audit"><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-[#fafafa] p-3">Publish <b>{data.permissions.publish ? "Allowed" : "Blocked"}</b></div><div className="rounded-lg bg-[#fafafa] p-3">Delete <b>{data.permissions.delete ? "Allowed" : "Blocked"}</b></div><div className="rounded-lg bg-[#fafafa] p-3">Settings <b>{data.permissions.settings ? "Allowed" : "Blocked"}</b></div><div className="rounded-lg bg-[#fafafa] p-3">Restore <b>{data.permissions.restore ? "Allowed" : "Blocked"}</b></div></div><div className="mt-4 max-h-48 overflow-auto border-t pt-3">{data.logs.map((log) => <div key={log.id} className="mb-2 text-xs text-[#666]"><b>{log.action}</b> · {log.actor || "user"} · {nowLabel(log.createdAt)}</div>)}</div></Card>

        <Card title="4. Design Tokens"><form onSubmit={saveTokens} className="grid grid-cols-2 gap-3">{Object.entries(data.designTokens).map(([key, value]) => <label key={key} className="text-xs text-[#666]"><span className="mb-1 block">{key}</span><s-text-field name={key} label={key} labelAccessibilityVisibility="exclusive" value={value} disabled={!data.permissions.settings} /></label>)}<s-button type="submit" disabled={!data.permissions.settings || busy} className="col-span-2 rounded-lg bg-[#008060] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Save design tokens</s-button></form></Card>

        <Card title="5. Setup Wizard"><div className="space-y-2">{[["themeExtensionEnabled", "Theme app extension enabled"],["appProxyVerified", "App proxy configured"],["firstTemplateCreated", "First template created"],["defaultTemplateSet", "Default template assigned"],["storefrontTested", "Live storefront tested"]].map(([key,label]) => <label key={key} className="flex items-center justify-between rounded-lg border border-[#eee] px-3 py-2 text-sm"><span>{label}</span><s-checkbox checked={!!data.onboarding[key]} disabled={!data.permissions.settings} onChange={(e) => saveOnboarding({ ...data.onboarding, [key]: e.currentTarget.checked })} /></label>)}</div></Card>

        <Card title="6. Diagnostics Center" action={<s-button disabled={busy} onClick={() => fetcher.submit({ intent: "run-diagnostics" }, { method: "post" })} className="rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs font-semibold text-white">Run scan</s-button>}><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-[#fafafa] p-3"><b className="block text-xl">{data.diagnostics.pageCount}</b><span className="text-xs text-[#777]">Templates</span></div><div className="rounded-lg bg-[#fafafa] p-3"><b className="block text-xl">{data.diagnostics.publishedCount}</b><span className="text-xs text-[#777]">Published</span></div><div className="rounded-lg bg-[#fafafa] p-3"><b className="block text-xl">{data.diagnostics.issues.length}</b><span className="text-xs text-[#777]">Issues</span></div></div><div className="mt-4 max-h-56 space-y-2 overflow-auto">{data.diagnostics.issues.length ? data.diagnostics.issues.map((issue, i) => <div key={`${issue.code}-${i}`} className={`rounded-lg border px-3 py-2 text-xs ${issue.level === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}><b>{issue.code}</b>: {issue.message}</div>) : <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">No structural template issues detected.</div>}</div></Card>

        <Card title="7. Operations / Cleanup" action={<s-button disabled={busy || !data.permissions.settings} onClick={() => fetcher.submit({ intent: "run-cleanup" }, { method: "post" })} className="rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Run cleanup</s-button>}><p className="text-sm text-[#666]">Retention cleanup removes stale non-publish revisions, old request logs, old non-error diagnostics and orphan revisions.</p><div className="mt-3 space-y-2">{data.cleanupRuns?.slice(0,5).map((run)=><div key={run.id} className="rounded-lg bg-[#fafafa] px-3 py-2 text-xs"><b>{new Date(run.createdAt).toLocaleString()}</b><div className="mt-1 text-[#666]">{run.statsJson || "{}"}</div></div>)}{!data.cleanupRuns?.length && <div className="text-xs text-[#777]">No cleanup runs yet.</div>}</div></Card>

        <Card title="8. Observability" action={<s-button disabled={busy || !data.permissions.settings} onClick={() => fetcher.submit({ intent: "clear-request-logs" }, { method: "post" })} className="rounded-lg border border-[#ddd] px-3 py-2 text-xs font-semibold disabled:opacity-40">Clear logs</s-button>}><p className="text-sm text-[#666]">Structured request events expose route, status and duration. Recent persisted events appear below.</p><div className="mt-3 max-h-56 space-y-2 overflow-auto">{data.requestLogs?.slice(0,12).map((log)=><div key={log.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-[#fafafa] px-3 py-2 text-xs"><div><b>{log.method} {log.route}</b><div className="text-[#777]">{log.requestId}</div></div><div className="text-right"><b>{log.status ?? "—"}</b><div className="text-[#777]">{log.durationMs ?? 0}ms</div></div></div>)}{!data.requestLogs?.length && <div className="text-xs text-[#777]">Request logs populate as observed routes execute.</div>}</div></Card>

        <Card title="9. Release Readiness"><div className="space-y-2">{Object.entries(data.releaseReadiness || {}).map(([key,value])=><div key={key} className="flex items-center justify-between rounded-lg bg-[#fafafa] px-3 py-2 text-xs"><span>{key}</span><b className={value === true ? "text-emerald-700" : value === false ? "text-red-700" : "text-[#555]"}>{String(value)}</b></div>)}</div><div className="mt-3 flex flex-wrap gap-2"><s-button href="/app/native-shopify" variant="primary">Open Native Shopify Bridge</s-button><s-button href="/app/onboarding" variant="secondary">Open setup wizard</s-button></div><p className="mt-3 text-xs text-[#777]">Also run <code>npm run release:check</code>, <code>npm run migration:check</code> and <code>npm run e2e</code> before production deployment.</p></Card>
      </div>
    </div>
  </div>;
}


export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? String(error.data || error.statusText || "Release diagnostics request failed.")
    : error instanceof Error
      ? error.message
      : "Release & Diagnostics Center could not be loaded.";

  return (
    <div className="min-h-screen bg-[#f6f6f7] px-6 py-10 text-[#1a1a1a]">
      <div className="mx-auto max-w-2xl rounded-xl border border-[#e3e3e3] bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#b42318]">Diagnostics error {status}</p>
        <h1 className="mt-2 text-xl font-semibold">Release & Diagnostics Center could not load</h1>
        <p className="mt-2 break-words text-sm text-[#6d7175]">{message}</p>
        <p className="mt-3 text-xs text-[#6d7175]">If this follows a package update, run Prisma generate and migrations, then retry.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <s-button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-[#008060] px-4 py-2 text-sm font-medium text-white">Retry</s-button>
          <s-button href="/app/pages" variant="secondary">Back to templates</s-button>
        </div>
      </div>
    </div>
  );
}
