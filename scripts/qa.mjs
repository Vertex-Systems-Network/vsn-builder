import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const roots = ['app', 'extensions'];
const errors = [];
const warnings = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const sourceFiles = roots.flatMap(walk).filter((file) => /\.(js|jsx)$/.test(file));
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const kind = file.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  for (const diagnostic of source.parseDiagnostics || []) {
    const pos = source.getLineAndCharacterOfPosition(diagnostic.start || 0);
    errors.push(`${file}:${pos.line + 1}:${pos.character + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
  }
  if (/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp|svg)/i.test(text) && !file.includes('root.jsx')) {
    warnings.push(`${file}: contains a remote image URL; verify it cannot become a storefront 404.`);
  }
}

const required = [
  'app/routes/builder-proxy.$.jsx',
  'app/routes/app.builder.$id.jsx',
  'app/components/editor/PageEditor.jsx',
  'app/components/editor/ElementsSidebar.jsx',
  'app/data/sectionPresets.js',
  'extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js',
];
for (const file of required) if (!fs.existsSync(file)) errors.push(`Missing required file: ${file}`);

const proxy = fs.readFileSync('app/routes/builder-proxy.$.jsx', 'utf8');
for (const marker of ['specific', 'isDefault', 'renderExtendedWidget', 'localization-switcher', 'sticky-add-to-cart']) {
  if (!proxy.includes(marker)) warnings.push(`Proxy QA marker not found: ${marker}`);
}

const presets = fs.readFileSync('app/data/sectionPresets.js', 'utf8');
const presetCount = (presets.match(/id:\s*"[^"]+"\s*,\s*category:/g) || []).length;
if (presetCount < 16) warnings.push(`Only ${presetCount} section presets detected; expected at least 16.`);

console.log(`VSN QA checked ${sourceFiles.length} JS/JSX files.`);
console.log(`Section presets detected: ${presetCount}`);
if (warnings.length) {
  console.log('\nWarnings:');
  warnings.forEach((warning) => console.log(`- ${warning}`));
}
if (errors.length) {
  console.error('\nErrors:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('\nQA PASS: no syntax-level blocking errors detected.');

// Phase 6 checks
const phase6Required = [
  "customer-name", "customer-login", "customer-logout", "dynamicSource",
  "data-vsn-condition-rule", "vsn-cart-progress", "vsn-entrance"
];
const phase6Files = [
  "app/builder/widgetRegistry.js",
  "app/components/editor/PropertiesPanel.jsx",
  "app/routes/builder-proxy.$.jsx",
  "extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js"
].map((file) => path.join(process.cwd(), file));
const phase6Text = phase6Files.filter((file)=>fs.existsSync(file)).map((file)=>fs.readFileSync(file,"utf8")).join("\n");
for (const token of phase6Required) { if (!phase6Text.includes(token)) { console.error(`Missing Phase 6 capability: ${token}`); process.exitCode = 1; } }


// Phase 8 checks
const phase8RequiredFiles = [
  "scripts/e2e-smoke.mjs", "scripts/migration-safety.mjs", "scripts/cleanup.mjs", "scripts/release-readiness.mjs",
  "app/utils/observability.server.js", "app/utils/cleanup.server.js", "app/routes/internal.cleanup.jsx", "RELEASE_CHECKLIST.md",
  "prisma/migrations/20260803_phase8_operational_readiness/migration.sql"
];
for (const file of phase8RequiredFiles) if (!fs.existsSync(file)) { console.error(`Missing Phase 8 file: ${file}`); process.exitCode = 1; }
const prismaSchema = fs.readFileSync("prisma/schema.prisma", "utf8");
for (const model of ["BuilderRequestLog", "BuilderCleanupRun"]) if (!prismaSchema.includes(`model ${model}`)) { console.error(`Missing Prisma model: ${model}`); process.exitCode = 1; }


// Phase 8.1 regression checks
const pagesRouteText = fs.readFileSync("app/routes/app.pages.jsx", "utf8");
if (!/builderRole\s*=\s*["']admin["']/.test(pagesRouteText) && !/\bbuilderRole\b[\s\S]{0,160}=\s*useLoaderData/.test(pagesRouteText)) {
  console.error("PagesRoute must receive builderRole from loader data.");
  process.exitCode = 1;
}
const controlCenterText = fs.readFileSync("app/routes/app.control-center.jsx", "utf8");
const rootStyleText = fs.readFileSync("app/styles/app.css", "utf8");
if (!controlCenterText.includes('import "../styles/builder.css"') && !rootStyleText.includes('./builder.css')) {
  console.error("Release & Diagnostics styles are not available through either the route or root stylesheet pipeline.");
  process.exitCode = 1;
}
const extensionlessDbImports = sourceFiles.flatMap((file) => {
  const text = fs.readFileSync(file, "utf8");
  return /from\s+["'][^"']*db\.server["']/.test(text) ? [file] : [];
});
if (extensionlessDbImports.length) {
  console.error(`Extensionless db.server imports found: ${extensionlessDbImports.join(", ")}`);
  process.exitCode = 1;
}
for (const name of ["arrivals.svg","contact.svg","fashion.svg","interior.svg","office.svg","sale.svg","seasonal.svg","skincare.svg","watch.svg"]) {
  if (!fs.existsSync(path.join("public/vsn-stock", name))) {
    console.error(`Missing local stock asset: public/vsn-stock/${name}`);
    process.exitCode = 1;
  }
}


// Batch 4 regression checks
const pagesActionText = fs.readFileSync("app/routes/app.pages.jsx", "utf8");
for (const template of ["cart", "404", "password", "customer-account", "customer-login", "customer-register", "customer-order", "customer-addresses"]) {
  if (!pagesActionText.includes(`"${template}"`)) {
    console.error(`Missing special template support in Pages action: ${template}`);
    process.exitCode = 1;
  }
}
const builderActionText = fs.readFileSync("app/routes/app.builder.$id.jsx", "utf8");
if (!(builderActionText.includes('canBuilder(builderRole, "delete")') || builderActionText.includes('canAccessBuilderAction(db, session, "pages", "delete")')) || !builderActionText.includes('deletedAt:new Date()') || !builderActionText.includes('setShopifyPagePublished') || !builderActionText.includes('trashTemplateThemeAssets')) {
  console.error("Editor delete-page flow must enforce delete permission, soft-delete to Trash, hide linked Shopify pages and clean generated template assets.");
  process.exitCode = 1;
}
const fontRegistryText = fs.readFileSync("app/services/font-registry.server.js", "utf8");
const proxyText = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
if (/\/apps\/vsn-page-builder\/font\//.test(fontRegistryText + proxyText)) {
  console.error("Legacy custom-font app-proxy path detected; expected /apps/vsn-builder/font/.");
  process.exitCode = 1;
}
const globalLoaderText = fs.readFileSync("app/components/ui/GlobalInteractionLoader.jsx", "utf8");
if (globalLoaderText.includes('document.addEventListener("click"')) {
  console.error("Global loader must not spin for every local editor click.");
  process.exitCode = 1;
}

// Phase C widget capability coverage
{
  const registryText = fs.readFileSync("app/builder/widgetRegistry.js", "utf8");
  const typePattern = /^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\s*:\s*base\(/gm;
  const widgetTypes = [];
  let match;
  while ((match = typePattern.exec(registryText))) widgetTypes.push(match[1] || match[2] || match[3]);
  const { auditWidgetCapabilityCoverage, auditWidgetCapabilityConsistency, getWidgetCapabilities } = await import("../app/builder/widgetCapabilities.js");
  const audit = auditWidgetCapabilityCoverage(widgetTypes);
  if (audit.missing.length || audit.unexpected.length) {
    if (audit.missing.length) console.error(`Missing capability mapping: ${audit.missing.join(", ")}`);
    if (audit.unexpected.length) console.error(`Stale capability mapping: ${audit.unexpected.join(", ")}`);
    process.exitCode = 1;
  }
  const consistency = auditWidgetCapabilityConsistency(widgetTypes);
  if (!consistency.valid) {
    console.error(`Capability consistency errors: ${consistency.errors.join("; ")}`);
    process.exitCode = 1;
  }
  for (const type of widgetTypes) {
    const capabilities = getWidgetCapabilities(type);
    if (!capabilities?.family) {
      console.error(`Invalid Phase C capability record: ${type}`);
      process.exitCode = 1;
    }
  }
  console.log(`Phase C capability coverage: ${audit.covered}/${audit.total}`);
}
