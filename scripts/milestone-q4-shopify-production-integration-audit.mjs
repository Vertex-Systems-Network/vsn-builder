import fs from "node:fs";
const read=(file)=>fs.readFileSync(file,"utf8");
const checks=[]; const check=(name,ok)=>checks.push([name,Boolean(ok)]);
const pkg=JSON.parse(read("package.json"));
const baseline=read("app/config/baseline.js");
const config=read("app/config/shopifyIntegration.js");
const toml=read("shopify.app.toml");
const server=read("app/shopify.server.js");
const control=read("app/routes/app.control-center.jsx");
const uninstall=read("app/routes/webhooks.app.uninstalled.jsx");
const redact=read("app/routes/webhooks.shop.redact.jsx");
const lifecycle=read("app/services/shop-data-lifecycle.server.js");
const topnav=read("app/components/dashboard/TopNav.jsx");

check("Q4 version sync",Number(pkg.version.split(".").at(-1))>=84&&baseline.includes(`version: "${pkg.version}"`)&&baseline.includes('milestone: "Q.'));
check("Current stable Shopify API contract",config.includes('SHOPIFY_API_VERSION_HANDLE = "2026-07"')&&toml.includes('api_version = "2026-07"')&&server.includes("ApiVersion.July26"));
check("Production config generator packaged",fs.existsSync("scripts/prepare-shopify-production-config.mjs")&&String(pkg.scripts?.["config:production"]||"").includes("prepare-shopify-production-config.mjs"));
check("Production readiness command packaged",fs.existsSync("scripts/shopify-production-readiness.mjs")&&String(pkg.scripts?.["release:production:check"]||"").includes("shopify-production-readiness.mjs"));
const threeTierMigration = fs.existsSync("config/deployment/environments.json");
const productionDeploy = String(pkg.scripts?.["deploy:production"] || "");
const safeBlock = productionDeploy === "node scripts/deployment-blocked.mjs production" &&
  fs.existsSync("scripts/deployment-blocked.mjs") &&
  read("scripts/deployment-blocked.mjs").includes("Direct Shopify CLI deployment/config switching is disabled") &&
  String(pkg.scripts?.["release:production:check"] || "").includes("env:production:check");
check("Production deploy targets named config, or is fail-closed during three-tier migration",
  threeTierMigration ? safeBlock : productionDeploy.includes("--config production"));
check("Production runtime env validation",fs.existsSync("scripts/validate-production-runtime.mjs")&&String(pkg.scripts?.start||"").includes("validate-production-runtime.mjs"));
check("Development config remains tunnel-safe",toml.includes("automatically_update_urls_on_dev = true")&&toml.includes('application_url = "https://example.com"'));
check("Production auth callback contract",config.includes('SHOPIFY_AUTH_CALLBACK_PATH = "/auth/callback"')&&read("scripts/prepare-shopify-production-config.mjs").includes('/auth/callback'));
check("App proxy contract centralized",config.includes('url: "/builder-proxy"')&&config.includes('subpath: "vsn-builder"')&&toml.includes('subpath = "vsn-builder"'));
check("write_app_proxy scope retained",toml.includes("write_app_proxy"));
for(const topic of ["app/uninstalled","app/scopes_update","orders/paid"]) check(`Required webhook ${topic}`,toml.includes(`"${topic}"`));
for(const topic of ["customers/data_request","customers/redact","shop/redact"]) check(`Compliance webhook ${topic}`,new RegExp(`compliance_topics\\s*=\\s*\\[[^\\]]*"${topic.replace("/","\\/")}"`).test(toml));
check("Webhook handlers authenticate with Shopify",["webhooks.app.uninstalled.jsx","webhooks.app.scopes_update.jsx","webhooks.orders.paid.jsx","webhooks.customers.data_request.jsx","webhooks.customers.redact.jsx","webhooks.shop.redact.jsx"].every((file)=>read(`app/routes/${file}`).includes("authenticate.webhook(request)")));
// A signed app/uninstalled webhook is not an installation-generation attestor.
// A delayed pre-reinstall uninstall must NOT delete current merchant data.
// Shopify shop/redact still invokes the shared privacy deletion lifecycle.
check("GDPR shop redaction retains deletion while untrusted uninstall fails closed",
  uninstall.includes("authenticate.webhook(request)") &&
  uninstall.includes("isValidLegacyUninstallEvent(event)") &&
  uninstall.includes("status: 503") &&
  !uninstall.includes("deleteVsnShopData") &&
  !uninstall.includes("shop-data-lifecycle.server") &&
  redact.includes("authenticate.webhook(request)") &&
  redact.includes("deleteVsnShopData") &&
  lifecycle.includes("builderEmailTemplate.deleteMany") &&
  lifecycle.includes("builderWishlist.deleteMany") &&
  lifecycle.includes("builderPage.deleteMany") &&
  lifecycle.includes("session.deleteMany"));
check("Theme app extension live verification retained",topnav.includes("window.shopify.app.extensions()")&&topnav.includes("theme_app_extension")&&topnav.includes("Theme Active"));
check("System Health checks served API version",control.includes("publicApiVersions")&&control.includes("x-shopify-api-version")&&control.includes("apiVersionFallForward"));
check("System Health checks production URL and scopes",control.includes("productionUrlReady")&&control.includes("productionScopesReady")&&control.includes("SHOPIFY_EXPECTED_SCOPES"));
check("Production env documented",read(".env.example").includes("SHOPIFY_PRODUCTION_APP_URL")&&read(".env.example").includes("SHOPIFY_PRODUCTION_CLIENT_ID"));
check("Q4 docs packaged",fs.existsSync("docs/user/production-shopify.md")&&fs.existsSync("docs/developer/shopify-production-integration.md"));

let fail=0; for(const [name,ok] of checks){console.log(`${ok?"PASS":"FAIL"} ${name}`); if(!ok) fail++;}
console.log(`Milestone Q4 audit: ${checks.length-fail}/${checks.length} passed.`); if(fail) process.exit(1);
