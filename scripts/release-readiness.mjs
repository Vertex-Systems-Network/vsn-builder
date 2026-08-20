import fs from "node:fs";

const checks = [];
const strict = process.env.NODE_ENV === "production" || process.env.VSN_RELEASE_STRICT === "1";
const add = (name, ok, detail = "", productionOnly = false) => checks.push({ name, ok, detail, productionOnly });
const productionConfigPath = process.env.VSN_PRODUCTION_CONFIG_FILE || "shopify.app.production.toml";
const configPath = process.env.VSN_SHOPIFY_CONFIG_FILE || (strict && fs.existsSync(productionConfigPath) ? productionConfigPath : "shopify.app.toml");
const toml = fs.readFileSync(configPath, "utf8");
const productionConfigSelected = configPath !== "shopify.app.toml";

add("Application URL configured", !toml.includes('application_url = "https://example.com"'), `Replace example.com before production deploy (${configPath})`, true);
add("Auth URL configured", !toml.includes('redirect_urls = [ "https://example.com/api/auth" ]') && /redirect_urls\s*=\s*\[\s*"https:\/\/[^"]+\/auth\/callback"/.test(toml), `Production OAuth callback must end in /auth/callback (${configPath})`, true);
add("Production config selected in strict release", !strict || productionConfigSelected, "Generate shopify.app.production.toml with npm run config:production before a strict production release", true);
add("Production dev URL mutation disabled", !strict || /automatically_update_urls_on_dev\s*=\s*false/.test(toml), "Production config must set automatically_update_urls_on_dev = false", true);
add("Shopify API version 2026-07", /\[webhooks\][\s\S]*api_version\s*=\s*"2026-07"/.test(toml));
add("Mandatory compliance webhooks", ["customers/data_request","customers/redact","shop/redact"].every((topic)=>new RegExp(`compliance_topics\\s*=\\s*\\[[^\\]]*\"${topic.replace("/","\\/")}\"`).test(toml)));
add("App proxy configured", toml.includes("[app_proxy]") && toml.includes('subpath = "vsn-builder"'));
add("Uninstall webhook configured", toml.includes("app/uninstalled"));
add("Scopes include products", toml.includes("read_products"));
add("Prisma migration exists", fs.existsSync("prisma/migrations/20260803_phase8_operational_readiness/migration.sql"));
add("Operational cleanup script exists", fs.existsSync("scripts/cleanup.mjs"));
add("Scheduled cleanup endpoint exists", fs.existsSync("app/routes/internal.cleanup.jsx"));
add("QA script exists", fs.existsSync("scripts/qa.mjs"));
add("E2E smoke script exists", fs.existsSync("scripts/e2e-smoke.mjs"));
add("Milestone A baseline metadata exists", fs.existsSync("BASELINE.json") && fs.existsSync("app/config/baseline.js"));
add("Central feature flags exist", fs.existsSync("app/config/featureFlags.js") && fs.existsSync("app/services/feature-flags.server.js"));
add("Schema migration registry exists", fs.existsSync("app/builder/schemaMigrations.js"));
add("Package integrity gate exists", fs.existsSync("scripts/package-integrity.mjs"));
add("Phase 1 production confidence audit exists", fs.existsSync("scripts/phase1-production-confidence-audit.mjs"));
add("Playwright live E2E suite exists", fs.existsSync("playwright.config.mjs") && fs.existsSync("tests/e2e/shopify-live.spec.mjs"));
add("CI workflow exists", fs.existsSync(".github/workflows/ci.yml"));
add("Phase 2 native Shopify audit exists", fs.existsSync("scripts/phase2-native-shopify-audit.mjs"));
add("Phase 10 collaboration migration exists", fs.existsSync("prisma/migrations/20260806203000_phase10_collaboration_review/migration.sql"));
add("Phase 10 collaboration audit exists", fs.existsSync("scripts/phase10-collaboration-audit.mjs"));
add("Phase 11 localization migration exists", fs.existsSync("prisma/migrations/20260806214500_phase11_localization_markets/migration.sql"));
add("Phase 11 localization audit exists", fs.existsSync("scripts/phase11-localization-audit.mjs"));
add("Phase 11 localization service exists", fs.existsSync("app/services/localization.server.js") && fs.existsSync("app/builder/localizationEngine.js"));
add("Localization scopes configured", ["read_locales", "read_markets", "read_translations", "write_translations"].every((scope) => toml.includes(scope)));
add("Phase 12 Forms 2.0 migration exists", fs.existsSync("prisma/migrations/20260807013000_phase12_forms_assets_systems/migration.sql"));
add("Phase 12 roadmap audit exists", fs.existsSync("scripts/phase12-forms-automation-audit.mjs"));
add("Phase 12 form automation service exists", fs.existsSync("app/services/form-automation.server.js") && fs.existsSync("app/builder/formEngine.js"));
add("Managed fonts and SVG routes exist", fs.existsSync("app/routes/app.fonts.jsx") && fs.existsSync("app/routes/app.svg-assets.jsx"));
add("Floating Elements route exists", fs.existsSync("app/routes/app.floating-elements.jsx"));
add("Native VSN section app block exists", fs.existsSync("extensions/vsn-page-builder-theme/blocks/native-vsn-section.liquid"));
add("Theme section rendering bridge exists", fs.readFileSync("extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js","utf8").includes("initializeThemeSectionBridges"));
add("Phase 13 Marketplace/Brand Kits migration exists", fs.existsSync("prisma/migrations/20260807030000_phase13_marketplace_brand_kits/migration.sql"));
add("Phase 13 Marketplace/Brand Kits audit exists", fs.existsSync("scripts/phase13-marketplace-brandkits-audit.mjs"));
add("Phase 13 built-in Marketplace catalog exists", fs.existsSync("app/data/marketplaceCatalog.js") && fs.existsSync("app/services/marketplace.server.js"));
add("Phase 13 Brand Kit service exists", fs.existsSync("app/services/brand-kits.server.js") && fs.existsSync("app/routes/app.brand-kits.jsx"));
add("Phase 13 stabilization audit exists", fs.existsSync("scripts/phase13-stabilization-audit.mjs") && fs.existsSync("VSN_PHASE13_STABILIZATION_REPORT_v2.5.49.md"));
add("Phase 14 Developer SDK audit exists", fs.existsSync("scripts/phase14-sdk-audit.mjs") && fs.existsSync("VSN_MILESTONE_D_PHASE14_DEVELOPER_SDK_REPORT_v2.5.50.md"));
add("Phase 14 runtime stabilization audit exists", fs.existsSync("scripts/phase14-stabilization-audit.mjs") && fs.existsSync("VSN_PHASE14_STABILIZATION_REPORT_v2.5.51.md"));
add("Phase 14 data/runtime stabilization audit exists", fs.existsSync("scripts/phase14-data-runtime-audit.mjs") && fs.existsSync("VSN_PHASE14_DATA_RUNTIME_FIX_REPORT_v2.5.52.md") && fs.existsSync("app/routes/app.builder-panel.$panel.jsx"));
add("Phase 14 public SDK modules exist", ["app/sdk/index.js", "app/sdk/registry.js", "app/sdk/runtime.js", "app/sdk/validation.js", "app/sdk/security.js", "app/sdk/dataProviders.server.js"].every((file) => fs.existsSync(file)));
add("Phase 14 Plugin SDK dashboard exists", fs.existsSync("app/routes/app.plugins.jsx") && fs.existsSync("app/components/editor/SdkControlPanel.jsx"));
add("Phase 14 SDK docs and examples exist", fs.existsSync("docs/sdk/README.md") && fs.existsSync("examples/plugins/announcement-card/plugin.jsx") && fs.existsSync("examples/plugins/remote-data/provider.server.js"));
add("Phase 14 plugin validation/test CLI exists", fs.existsSync("scripts/vsn-plugin-validate.mjs") && fs.existsSync("scripts/vsn-sdk-test.mjs"));
add("Phase 15 enterprise hardening migration exists", fs.existsSync("prisma/migrations/20260807043000_phase15_enterprise_hardening/migration.sql"));
add("Phase 15 health scanner exists", fs.existsSync("app/builder/healthScanner.js") && fs.existsSync("app/services/enterprise-hardening.server.js"));
add("Phase 15 enterprise hardening audit exists", fs.existsSync("scripts/phase15-enterprise-hardening-audit.mjs") && fs.existsSync("VSN_MILESTONE_E_PHASE15_ENTERPRISE_HARDENING_REPORT_v2.5.53.md"));

add("Phase 16 commercialization configuration exists", fs.existsSync("app/config/commercialPlans.js") && fs.existsSync("app/services/commercialization.server.js"));
add("Phase 16 commercialization audit exists", fs.existsSync("scripts/phase16-commercialization-audit.mjs") && fs.existsSync("VSN_MILESTONE_E_PHASE16_PACKAGING_GTM_REPORT_v2.5.54.md"));
add("Phase 16 launch demos and migration docs exist", ["docs/demos/sample-store.md","docs/demos/native-section.md","docs/demos/loop-builder.md","docs/demos/cro.md","docs/demos/ai-editable-output.md","docs/migrations/pagefly.md","docs/migrations/gempages.md","docs/migrations/replo.md"].every((file)=>fs.existsSync(file)));
add("Phase 16 production billing remains Shopify-managed", fs.existsSync("app/services/shopify-app-pricing.server.js") && fs.readFileSync("app/routes/app.plans.jsx","utf8").includes("hosted App Pricing page") && fs.readFileSync("app/routes/app.plans.jsx","utf8").includes("Developer Mode"));


let failed = false;
for (const check of checks) {
  const blocking = !check.ok && (!check.productionOnly || strict);
  const label = check.ok ? "PASS" : blocking ? "FAIL" : "WARN";
  console.log(`${label} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
  if (blocking) failed = true;
}
if (failed) process.exitCode = 1;
