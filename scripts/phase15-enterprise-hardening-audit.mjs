import fs from "node:fs";
import { scanBuilderPage, scanBuilderPages } from "../app/builder/healthScanner.js";
import { compileThemeAssets } from "../app/services/theme-assets.server.js";

const read=(file)=>fs.readFileSync(file,"utf8");
let pass=0,fail=0;
const check=(name,ok)=>{if(ok){pass++;console.log(`PASS  ${name}`)}else{fail++;console.error(`FAIL  ${name}`)}};
const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));
const baselineJs=read("app/config/baseline.js");
const flags=read("app/config/featureFlags.js");
const schema=read("prisma/schema.prisma");
const migration=read("prisma/migrations/20260807043000_phase15_enterprise_hardening/migration.sql");
const healthRoute=read("app/routes/app.control-center.jsx");
const host=read("app/components/BuilderPanelHost.jsx");
const templateQa=read("app/components/editor/TemplateQAPanel.jsx");
const assets=read("app/services/theme-assets.server.js");
const storefront=read("app/routes/builder-proxy.$.jsx");
const extension=read("extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js");
const liquid=read("extensions/vsn-page-builder-theme/blocks/vsn-page-renderer.liquid");
const cleanup=read("app/utils/cleanup.server.js");
const enterpriseService=read("app/services/enterprise-hardening.server.js");
const env=read(".env.example");

check("Phase 15 hardening is preserved on v2.5.53 or later",Number(pkg.version.split(".")[2]||0)>=53&&pkg.version===baseline.version&&Number(baseline.phase)>=15&&baselineJs.includes("enterpriseHardening: 1"));
check("Phase 15 schemas are versioned",baselineJs.includes("enterpriseHardening: 1")&&baselineJs.includes("healthAudit: 2"));
check("Enterprise hardening feature flag is centralized",flags.includes("enterpriseHardeningV1")&&flags.includes("VSN_FEATURE_ENTERPRISE_HARDENING")&&env.includes("VSN_FEATURE_ENTERPRISE_HARDENING=true"));
check("Store enterprise settings persist in Prisma",schema.includes("enterpriseJson")&&migration.includes('ADD COLUMN "enterpriseJson" TEXT'));

check("Enterprise settings parser accepts object payloads",enterpriseService.includes('typeof value === "object"')&&enterpriseService.includes("parsed = value"));
check("Enterprise settings normalize retention and environments",enterpriseService.includes("backupRetentionDays")&&enterpriseService.includes("backupRetentionCount")&&enterpriseService.includes("allowedEnvironment")&&enterpriseService.includes("allowedTarget"));

const sampleElements=[
  {id:"globals",type:"global-styles",props:{textColor:"#777777",backgroundColor:"#ffffff"}},
  {id:"settings",type:"template-settings",props:{seoTitle:"",seoDescription:"",canonical:"broken canonical",robots:"noindex"}},
  {id:"h1a",type:"heading",props:{tag:"h1",text:"One"}},
  {id:"h1b",type:"heading",props:{tag:"h1",text:"Two"}},
  {id:"h4",type:"heading",props:{tag:"h4",text:"Jump"}},
  {id:"img",type:"image",props:{src:"https://example.com/hero.jpg",alt:""}},
  {id:"btn",type:"button",props:{text:"",tabIndex:-1},styles:{size:{width:"32px",height:"30px"}}},
  {id:"html",type:"custom-html",props:{html:'<script type="application/ld+json">{broken}</script>',customJs:'eval("bad")'}},
];
const scan=scanBuilderPage({page:{id:"p1",title:"Audit Sample",template:"page",status:"published"},elements:sampleElements});
const codes=new Set(scan.issues.map((x)=>x.code));
check("Accessibility scanner covers heading order",codes.has("A11Y_HEADING_ORDER"));
check("Accessibility scanner covers missing alt",codes.has("A11Y_IMAGE_ALT"));
check("Accessibility scanner covers focusability",codes.has("A11Y_FOCUSABILITY"));
check("Accessibility scanner covers tap targets",codes.has("A11Y_TAP_TARGET"));
check("SEO scanner covers duplicate H1",codes.has("SEO_DUPLICATE_H1"));
check("SEO scanner covers metadata",codes.has("SEO_META_TITLE_MISSING")&&codes.has("SEO_META_DESCRIPTION_MISSING"));
check("SEO scanner covers invalid canonical",codes.has("SEO_CANONICAL_INVALID"));
check("SEO scanner covers indexability",codes.has("SEO_NOINDEX"));
check("SEO scanner validates JSON-LD",codes.has("SEO_SCHEMA_INVALID_JSON"));
check("Performance scanner covers image optimization",codes.has("PERF_IMAGE_FORMAT")&&codes.has("PERF_LAZY_LOADING")&&codes.has("PERF_RESPONSIVE_IMAGE"));
check("Security scanner covers risky custom JavaScript",codes.has("SECURITY_CUSTOM_JS_RISK"));
const aggregate=scanBuilderPages([{id:"p1",title:"A",template:"page",status:"draft",contentJson:JSON.stringify(sampleElements)},{id:"p2",title:"B",template:"page",status:"draft",contentJson:JSON.stringify([{id:"s",type:"template-settings",props:{canonical:"/same"}}])}]);
check("Multi-page scanner returns categorized totals",aggregate.pageCount===2&&aggregate.totals.accessibility>0&&aggregate.totals.seo>0&&aggregate.totals.performance>0&&aggregate.totals.security>0);

check("Editor Template QA uses Phase 15 scanner",templateQa.includes("scanBuilderPage")&&templateQa.includes("Template Health"));
check("System Health merges Phase 15 scanner results",healthRoute.includes("scanBuilderPages")&&healthRoute.includes("healthAudit")&&healthRoute.includes('key:"accessibility"')&&healthRoute.includes('key:"seo"'));
check("System Health reports CSS, JS, image and font budgets",healthRoute.includes("cssBytes")&&healthRoute.includes("jsBytes")&&healthRoute.includes("customFontBytes")&&healthRoute.includes("imageKnownBytesWarning"));
check("System Health UI has Accessibility/SEO/Performance tabs",host.includes('value:"accessibility"')&&host.includes('value:"seo"')&&host.includes('value:"performance"'));
check("System Health UI exposes enterprise safeguards",host.includes("Enterprise safeguards")&&host.includes("Safe Mode")&&host.includes("Used assets only (recommended)"));
check("Health audit can be exported",host.includes("Export audit")&&host.includes("vsn-health-audit-"));
check("Environment promotion stays developer-mode dry-run",healthRoute.includes("dryRun:true")&&healthRoute.includes("it never deploys or changes a production store"));

check("Asset pipeline supports used-assets-only mode",assets.includes('enterprise.assetMode === "compatibility"')&&assets.includes("collectRuntimeDependencies(groups)"));
check("Asset pipeline safely deduplicates generated CSS",assets.includes("dedupeGeneratedCss")&&assets.includes("cssDeduplication"));
check("Asset pipeline creates critical CSS",assets.includes("criticalStyleCss")&&assets.includes("criticalCssBytes"));
check("Asset pipeline prunes unused custom-font variants",assets.includes("fontSubset")&&assets.includes("wantedWeights")&&assets.includes("wantedStyles"));
check("Asset pipeline exposes font preload controls",assets.includes("fontPreload")&&assets.includes("fontPreloads"));

const publishedPage={id:"phase15",title:"Phase15",handle:"phase15",template:"page",status:"published",version:1,publishedVersion:1,publishedJson:JSON.stringify([{id:"h",type:"heading",props:{text:"Hello"}},{id:"custom",type:"html",props:{customJs:"window.__x=1"}}])};
const compiledSafe=compileThemeAssets([publishedPage],{enterprise:{safeMode:true,assetMode:"used-only",criticalCss:true,cssDeduplication:true,fontSubset:true,fontPreload:"auto"}});
check("Safe Mode omits generated custom-JS asset",compiledSafe.manifest.entries[0]?.js==null&&compiledSafe.jsFileCount===0);
check("Compiled manifest includes critical CSS metadata",typeof compiledSafe.manifest.entries[0]?.criticalCss==="string"&&Number.isFinite(compiledSafe.manifest.entries[0]?.criticalCssBytes));

check("Storefront Safe Mode blocks custom-JS endpoint",storefront.includes("VSN Safe Mode: custom JavaScript disabled")&&storefront.includes("data-vsn-safe-mode"));
check("Storefront Image widget creates Shopify responsive srcset",storefront.includes("responsiveImages")&&storefront.includes("srcset")&&storefront.includes("buildImageRenderUrl"));
check("Storefront Image widget supports lazy-loading policy",storefront.includes("enterpriseSettings?.lazyImages"));
check("Theme extension consumes critical CSS before full CSS",extension.includes("injectCriticalStyles")&&extension.includes("data-vsn-critical-css"));
check("Theme extension preloads selected custom fonts",extension.includes("preloadTemplateFonts")&&liquid.includes("fontPreloads"));
check("Liquid asset manifest includes critical CSS",liquid.includes("criticalCss")&&liquid.includes("criticalCssBytes"));

check("Backup cleanup supports age retention",cleanup.includes("backupDays")&&cleanup.includes("oldBackups"));
check("Backup cleanup always protects newest N backups",cleanup.includes("backupRetentionCount")&&cleanup.includes("protectedBackupIds"));
check("Enterprise save triggers storefront asset rebuild",healthRoute.includes("rebuildThemeAssets")&&healthRoute.includes("assetRebuild"));
check("Release QA includes Phase 15",pkg.scripts?.["qa:phase15"]?.includes("phase15-enterprise-hardening-audit.mjs")&&pkg.scripts?.["qa:release"]?.includes("phase15-enterprise-hardening-audit.mjs"));

console.log(`\nPhase 15 enterprise hardening audit: ${pass} PASS / ${fail} FAIL`);
if(fail)process.exit(1);
