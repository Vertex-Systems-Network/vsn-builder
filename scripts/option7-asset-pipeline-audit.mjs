import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileThemeAssets, collectRuntimeDependencies } from '../app/services/theme-assets.server.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const failures = [];
const passes = [];
const check = (name, ok, detail = '') => (ok ? passes : failures).push(`${name}${detail ? ` — ${detail}` : ''}`);

const header = {
  id: 'header_unique_0001', title: 'Main Header', handle: 'main-header', template: 'header', isDefault: true,
  status: 'published', publishedVersion: 2, version: 2, publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  publishedJson: JSON.stringify([{ id: 'nav-a', type: 'navigation-menu', props: {} }]),
};
const staticPage = {
  id: 'page_unique_static_0002', title: 'Static Landing Page', handle: 'static-landing', template: 'page', isDefault: false,
  status: 'published', publishedVersion: 7, version: 8, publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  publishedJson: JSON.stringify([
    { id: 'settings', type: 'template-settings', props: { headerEnabled: true } },
    { id: 'global', type: 'global-styles', props: { primaryColor: '#123456', fontFamily: 'Inter, sans-serif' } },
    { id: 'heading-a', type: 'heading', props: { text: 'Static' }, styles: { typography: { fontSize: '48px' } } },
  ]),
};
const interactivePage = {
  id: 'page_unique_interactive_0003', title: 'Interactive Product', handle: 'interactive-product', template: 'product', isDefault: true,
  status: 'published', publishedVersion: 4, version: 4, publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  publishedJson: JSON.stringify([
    { id: 'settings-b', type: 'template-settings', props: { headerEnabled: false, footerEnabled: false } },
    { id: 'slider-a', type: 'slider', props: {}, children: [{ id: 'child-a', type: 'heading', props: { text: 'Slide' }, styles: { advanced: { customJs: 'element.dataset.customReady="1";' } } }] },
  ]),
};

const compiled = compileThemeAssets([header, staticPage, interactivePage]);
const entry = (id) => compiled.manifest.entries.find((item) => item.id === id);
const staticEntry = entry(staticPage.id);
const interactiveEntry = entry(interactivePage.id);

check('Architecture marker', compiled.architecture === 'option-7-shared-core-template-delta');
check('One CSS per published template', compiled.cssFileCount === 3, `${compiled.cssFileCount}/3`);
check('JS only for templates with Custom JS', compiled.jsFileCount === 1, `${compiled.jsFileCount}/1`);
check('Static template has no JS asset', staticEntry?.js === null);
check('Interactive template has JS asset', /\.js$/.test(interactiveEntry?.js || ''));
check('Hashed CSS filename', /vsn-tpl-static-landing-page-[a-z0-9]+\.[a-f0-9]{12}\.css$/.test(staticEntry?.css || ''), staticEntry?.css || 'missing');
check('Stable unique id participates in file identity', (staticEntry?.css || '').includes('static0002'));
check('Header composition compiled into page bundle', staticEntry?.composition?.some((item) => item.kind === 'header' && item.id === header.id));
check('Runtime dependency metadata', interactiveEntry?.dependencies?.includes('slider'));
check('Runtime dependency helper', collectRuntimeDependencies([[{ type: 'video' }, { type: 'form-builder' }]]).join(',') === 'forms,media');
check('No global generated CSS/JS asset', !compiled.files.some((file) => /vsn-page-builder\.(css|js)$/.test(file.filename)));
check('Manifest stored separately from theme assets', !compiled.files.some((file) => /manifest/.test(file.filename)));

const service = read('app/services/theme-assets.server.js');
const liquid = read('extensions/vsn-page-builder-theme/blocks/vsn-page-renderer.liquid');
const renderer = read('extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js');
const proxy = read('app/routes/builder-proxy.$.jsx');
const settings = read('app/components/dashboard/pages/Settings.jsx');

check('Manifest uses app-owned JSON metafield', service.includes('VSN_THEME_MANIFEST_METAFIELD = "asset_manifest"') && service.includes('type: "json"'));
check('Immutable files written before manifest switch', service.includes('Write immutable hashed template files first') && service.indexOf('upsertThemeFiles(admin, theme.id, batch)') < service.indexOf('setAssetState(admin, { ready: true, manifest: compiled.manifest })'));
check('Shopify 50-file limit respected with headroom', service.includes('MAX_FILES_PER_UPSERT = 45'));
check('Liquid resolves CSS via asset_url', liquid.includes('entry.css | asset_url'));
check('Liquid resolves optional JS via asset_url', liquid.includes('entry.js | asset_url'));
check('Liquid exposes only manifest URLs, not global builder assets', !liquid.includes("'vsn-page-builder.css' | asset_url") && !liquid.includes("'vsn-page-builder.js' | asset_url"));
check('Renderer loads current entry on demand', renderer.includes('manifestTemplate(pageId)') && renderer.includes('ensureTemplateAssets(pageId)'));
check('Renderer waits for CSS before removing fallback', renderer.includes('if (!state.cssReady) return source') && renderer.includes('style[data-vsn-inline-bundle="1"]'));
check('Renderer supports template JS registry', renderer.includes('__VSN_TEMPLATE_CUSTOM_JS__') && renderer.includes('runRegisteredTemplateJavascript'));
check('Proxy marks inline fallback bundle', proxy.includes('data-vsn-inline-bundle="1"'));
check('Dashboard exposes frontend asset rebuild without internal architecture jargon', settings.includes('Frontend assets') && settings.includes('Rebuild frontend assets') && !settings.includes('Option 7 asset architecture'));

if (failures.length) {
  console.error(`Option 7 asset pipeline audit FAILED (${failures.length})`);
  failures.forEach((item) => console.error(`  ✗ ${item}`));
  process.exit(1);
}
console.log(`Option 7 asset pipeline audit PASS (${passes.length} checks)`);
passes.forEach((item) => console.log(`  ✓ ${item}`));
