import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { widgetRegistry } from '../app/builder/widgetRegistry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const fail = [];
const pass = [];

function check(name, ok, detail='') {
  (ok ? pass : fail).push(`${name}${detail ? ` — ${detail}` : ''}`);
}
function has(file, ...needles) {
  const text = read(file);
  return needles.every((needle) => text.includes(needle));
}
function allSource(dir) {
  const abs = path.join(root, dir);
  let out = '';
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out += allSource(rel);
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) out += '\n' + read(rel);
  }
  return out;
}

check('Registry count', Object.keys(widgetRegistry).length === 117, `${Object.keys(widgetRegistry).length}/117`);

// W14: every registered default prop must have an editor-side control/reference.
const editorSource = allSource('app/components/editor');
const missingProps = [];
for (const [type, def] of Object.entries(widgetRegistry)) {
  // SDK widgets are controlled by their registered control schema rather than hardcoded PropertiesPanel references.
  if (def?.sdk) continue;
  for (const key of Object.keys(def?.props || {})) {
    // Internal/generated compatibility keys are not merchant controls.
    if (key.startsWith('__')) continue;
    const candidates = [`.${key}`, `?.${key}`, `["${key}"]`, `['${key}']`, `"${key}"`, `'${key}'`];
    if (!candidates.some((token) => editorSource.includes(token))) missingProps.push(`${type}.${key}`);
  }
}
check('W14 registered-prop editor coverage', missingProps.length === 0, missingProps.length ? missingProps.join(', ') : '0 missing');

// Child insertion UX / DnD / context menu.
check('Nested + Add Widget control', has('app/components/editor/Canvas.jsx', 'data-vsn-add-child="1"', 'onRequestAddChild', 'afterId'));
check('Nested insertion target workflow', has('app/components/editor/PageEditor.jsx', 'insertTarget', 'handleRequestAddChild', 'handleWidgetClickAdd'));
check('Elements click-to-add workflow', has('app/components/editor/ElementsSidebar.jsx', 'Add child:', 'onWidgetClick'));
check('Right-click targets clicked widget', has('app/components/editor/PageEditor.jsx', 'onContextMenu', 'contextMenu?.id', 'findParentId'));
check('Drag frame throttling', has('app/components/editor/Canvas.jsx', 'requestAnimationFrame', 'dragFrameRef', 'autoScrollFrameRef'));

// Checkbox + interaction crash protection.
check('Controlled checkbox field', has('app/components/editor/EditorUi.jsx', 'checked={checked === true}', 'stopPropagation'));
check('Strict checkbox change value', has('app/components/editor/EditorControls.jsx', 'event.target.checked'));
check('Sticky helpers imported', has('app/components/editor/Canvas.jsx', 'isStickyEnabledForDevice', 'calculateBoundedStickyShift'));
check('Interaction runtime guarded', has('app/components/editor/Canvas.jsx', 'stickyActive', 'try {', 'parallax'));

// Gallery state and picker behavior.
check('Gallery explicit empty preserved', has('app/builder/galleryWidget.js', 'hasGalleryItems', 'galleryItems'));
check('Gallery registry no default stock images', widgetRegistry['gallery-grid']?.props?.imagesText === '' && Array.isArray(widgetRegistry['gallery-grid']?.props?.galleryItems) && widgetRegistry['gallery-grid'].props.galleryItems.length === 0);
check('Gallery append picker', has('app/components/editor/EditorControls.jsx', 'append: true', 'GalleryControl'));

// Shopify media/SVG resolver.
check('Shopify read_files scope', /read_files/.test(read('shopify.app.toml')));
check('Persistent Shopify media cache', has('app/components/editor/EditorControls.jsx', 'vsn:shopify-media-cache:v1', 'shopifyMediaIdentityKeys'));
check('Media resolution retry', has('app/components/editor/EditorControls.jsx', 'resolveShopifyFiles', 'for (let attempt'));
check('SVG GenericFile resolver', has('app/routes/app.editor-media.jsx', 'GenericFile', 'url', 'svg-library'));

// Global lightbox.
check('Global lightbox defaults', has('app/builder/globalDesign.js', 'lightboxEnabled', 'lightboxBackdrop', 'lightboxAnimation'));
check('Global lightbox settings UI', has('app/components/editor/PropertiesPanel.jsx', 'Global Lightbox', 'lightboxCloseOnEscape'));
check('Global lightbox storefront metadata', has('app/routes/builder-proxy.$.jsx', 'lightboxEnabled', 'lightboxBackdropOpacity'));
check('Global lightbox runtime', has('extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js', 'vsnLightboxEnabled', 'vsnLightboxCloseEscape'));

// External asset compiler + dashboard rebuild.
check('Theme asset compiler exists', exists('app/services/theme-assets.server.js'));
check('Option 7 hashed per-template assets', has('app/services/theme-assets.server.js', 'VSN_THEME_MANIFEST_METAFIELD', 'vsn-tpl-', 'cssHash', 'jsHash'));
check('Option 7 manifest last switch', has('app/services/theme-assets.server.js', 'templateFiles', 'setAssetState', 'Write immutable hashed template files first'));
check('Optional per-template JavaScript', has('app/services/theme-assets.server.js', 'templateJavascript', 'jsName = javascript ?'));
check('Shopify themeFilesUpsert', has('app/services/theme-assets.server.js', 'themeFilesUpsert'));
check('Publish auto rebuild', has('app/routes/app.builder.$id.jsx', 'rebuildThemeAssets', 'rebuildPublishedAssets'));
check('Dashboard frontend asset rebuild', has('app/components/dashboard/pages/Settings.jsx', 'Frontend assets', 'Rebuild frontend assets', 'rebuild-theme-assets'));
check('Theme extension resolves Option 7 manifest URLs', has('extensions/vsn-page-builder-theme/blocks/vsn-page-renderer.liquid', 'asset_manifest.value', 'entry.css | asset_url', 'VSN_ASSET_PIPELINE_READY'));
check('Storefront loads current template assets dynamically', has('extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js', 'ensureTemplateAssets', 'prepareBuilderHtml', 'data-vsn-template-css'));

// W10–W13 representative contracts.
check('W10 forms/commerce controls', has('app/components/editor/PropertiesPanel.jsx', 'Previous button', 'Disable sold-out variants', '<Label>Minimum</Label>'));
check('W10 inventory low-stock parity', has('app/routes/app.builder.$id.jsx', 'inventoryQuantity') && has('app/routes/builder-proxy.$.jsx', 'lowStockText', 'lowThreshold', 'inventoryQuantity') && has('app/components/editor/Canvas.jsx', 'lowStockText', 'lowThreshold'));
check('W11 content controls', has('app/components/editor/PropertiesPanel.jsx', 'Date format', '<Label>Singular</Label>', 'Previous article'));
check('W12 customer/localization controls', has('app/components/editor/PropertiesPanel.jsx', 'Hide when customer is logged in', 'Country label', 'Dismissible'));
check('W13 HTML/Liquid code contract', has('app/components/editor/PropertiesPanel.jsx', 'props.code') && has('app/routes/builder-proxy.$.jsx', 'props.code||props.html', 'props.code||props.liquid'));
check('W14 breadcrumbs showHome', has('app/components/editor/PropertiesPanel.jsx', 'showHome'));
check('W14 product media thumbnail position', has('app/components/editor/PropertiesPanel.jsx', 'thumbnailPosition'));

if (fail.length) {
  console.error(`W10-W14 / Reliability audit FAILED (${fail.length})`);
  for (const item of fail) console.error(`  ✗ ${item}`);
  process.exit(1);
}
console.log(`W10-W14 / Reliability audit PASS (${pass.length} checks)`);
for (const item of pass) console.log(`  ✓ ${item}`);
