import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
let pass = 0;
let fail = 0;
function check(name, ok) {
  if (ok) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.error(`FAIL  ${name}`); }
}
function has(file, ...tokens) {
  if (!exists(file)) return false;
  const s = read(file);
  return tokens.every((t) => s.includes(t));
}

const schema = read("prisma/schema.prisma");
const proxy = read("app/routes/builder-proxy.$.jsx");
const storefrontForms = read("app/services/storefront-form-submission.server.js");
const sidebar = read("app/components/AppSidebar.jsx");
const host = read("app/components/BuilderPanelHost.jsx");
const settings = read("app/components/dashboard/pages/Settings.jsx");
const presets = read("app/services/library-presets.server.js");
const diagnostics = read("app/routes/app.control-center.jsx");
const renderer = read("extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js");

check("baseline includes Phase 12 or later", Number(JSON.parse(read("BASELINE.json")).phase||0) >= 12);
check("server baseline preserves Phase 12 schemas", /forms:\s*([2-9]|\d{2,})/.test(read("app/config/baseline.js")) && has("app/config/baseline.js", 'managedAssets: 1') && /phase:\s*(1[2-9]|[2-9][0-9])/.test(read("app/config/baseline.js")));
check("Forms 2 feature flag exists and is dev-safe default-off", has("app/config/featureFlags.js", 'VSN_FEATURE_FORMS_AUTOMATION', 'defaultValue: false', 'phase: 12'));
check("Phase 12 migration exists", exists("prisma/migrations/20260807013000_phase12_forms_assets_systems/migration.sql"));
for (const model of ["BuilderFormConfig", "BuilderFormUpload", "BuilderIntegration", "BuilderAutomationLog", "BuilderSvgAsset"]) check(`Prisma model ${model}`, schema.includes(`model ${model}`));
check("Custom fonts support trash", schema.includes("model BuilderCustomFont") && schema.includes("deletedAt DateTime?"));
check("Form submission delivery/retention fields", schema.includes("deliveryStatus String") && schema.includes("retainedUntil DateTime?"));

check("Forms 2 engine exists", has("app/builder/formEngine.js", "normalizeFormAutomationSettings", "formSuccessPayload", "fileAllowed"));
check("Form automation service exists", has("app/services/form-automation.server.js", "verifyTurnstile", "verifyHcaptcha", "deliverFormAutomations"));
check("Turnstile verification wired", storefrontForms.includes("verifyTurnstile") && proxy.includes("handleStorefrontFormSubmission"));
check("hCaptcha verification wired", storefrontForms.includes("verifyHcaptcha") && proxy.includes("handleStorefrontFormSubmission"));
check("Honeypot and rate limiting wired", storefrontForms.includes("honeypot") && storefrontForms.includes("requesterHash"));
check("File uploads persisted", storefrontForms.includes("builderFormUpload.create"));
check("File scanning hook wired", has("app/services/form-automation.server.js", "VSN_FORM_FILE_SCAN_WEBHOOK"));
check("Private form upload download route", has("app/routes/app.form-uploads.$id.jsx", "Content-Disposition", "no-store"));
check("Form settings route", has("app/routes/app.form-settings.jsx", "save-form-config", "add-integration"));
check("Form submissions route", has("app/routes/app.form-submissions.jsx", "builderFormUpload", "uploadsBySubmission"));
check("Submission delivery status is shown in Builder", host.includes("deliveryStatus") && host.includes("Attachments"));
check("Conditional storefront fields", renderer.includes("vsnConditional"));
check("Validation storefront fields", renderer.includes("vsnValidation"));
check("Calculated storefront fields", renderer.includes("vsnCalculations"));
check("Query prefill storefront support", renderer.includes("URLSearchParams"));
check("Success redirect support", renderer.includes("redirect"));
check("Success coupon support", renderer.includes("/discount/"));
check("Form editor controls include captcha", has("app/components/editor/PropertiesPanel.jsx", "Turnstile", "hCaptcha", "Success action"));

check("Campaigns in Builder sidebar", sidebar.includes('id: "campaigns"'));
check("CRO Experiments in Builder sidebar", sidebar.includes('id: "experiments"'));
check("Floating Elements in Builder sidebar", sidebar.includes('id: "floating-elements"'));
check("Campaign panel uses existing route", has("app/services/builder-panels.server.js", "campaignsPanelLoader", "campaignsPanelAction"));
check("Experiment panel uses existing route", has("app/services/builder-panels.server.js", "experimentsPanelLoader", "experimentsPanelAction"));
check("Floating element route exists", has("app/routes/app.floating-elements.jsx", 'template:"floating-element"', "duplicate", "trash"));
check("Floating storefront runtime", has("extensions/vsn-page-builder-theme/assets/vsn-campaigns.js", "floating-element", "campaignFloatingPosition"));

check("Fonts manager in Builder sidebar", sidebar.includes('id: "fonts"'));
check("Fonts route supports edit/trash/restore", has("app/routes/app.fonts.jsx", "update", "trash", "restore"));
check("Typography filters trashed fonts", has("app/services/font-registry.server.js", "deletedAt: null"));
check("SVG manager in Builder sidebar", sidebar.includes('id: "svg-assets"'));
check("SVG route supports update/trash/restore", has("app/routes/app.svg-assets.jsx", "update", "trash", "restore"));
check("SVG sanitizer exists", has("app/services/svg-assets.server.js", "sanitizeSvg"));
check("Editor SVG picker uses managed library", has("app/components/editor/EditorControls.jsx", "/app/builder-panel/svg-assets?mode=picker") || has("app/components/editor/EditorControls.jsx", "/app/svg-assets?mode=picker"));

check("Sync default library action", has("app/services/dashboard-actions.server.js", "sync-library-defaults", "syncDefaultLibrary"));
check("Settings preserves starter sync control on Milestone H+", settings.toLowerCase().includes("sync marketplace starters") && settings.includes("sync-library-defaults"));
check("Default popup templates exist", presets.includes("Starter Popup") && presets.includes("Newsletter Popup") && presets.includes("Exit Offer Popup"));
check("Default floating templates exist", presets.includes("Floating Contact CTA") && presets.includes("Floating Promo Badge"));

check("Diagnostics sidebar entry", sidebar.includes('id: "control-center"'));
check("Diagnostics system info report", diagnostics.includes("buildSystemInfo") && diagnostics.includes("developerMode:true"));
check("Diagnostics UI tabs", (host.includes("Diagnostics & System Information") || host.includes("System Health & Diagnostics") || host.includes('title="System Health"')) && host.includes("Forms & Automation") && (host.includes("Raw report") || host.includes("Raw Report")));
check("Diagnostics never returns configured secret values", !diagnostics.includes("process.env.SHOPIFY_API_SECRET,"));

check("Backup includes managed assets", has("app/routes/app.backups.jsx", "customFonts", "svgAssets", "fileDataBase64"));
check("Backup omits integration secrets", has("app/routes/app.backups.jsx", "integrationSecretsIncluded: false", 'secretJson: "{}"'));
check("Cleanup covers retained form data", has("app/utils/cleanup.server.js", "retainedUntil", "builderFormUpload"));
check("Uninstall cleanup covers Phase 12 records", ["builderFormConfig","builderSvgAsset","builderCustomFont"].every((token)=>(read("app/routes/webhooks.app.uninstalled.jsx")+read("app/services/shop-data-lifecycle.server.js")).includes(token)));

console.log(`\nPhase 12 roadmap audit: ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
