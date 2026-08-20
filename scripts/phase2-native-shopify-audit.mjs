import fs from 'node:fs';
import assert from 'node:assert/strict';
import { NATIVE_APP_BLOCKS } from '../app/services/native-shopify-bridge.server.js';
import { widgetRegistry } from '../app/builder/widgetRegistry.js';
const blockDir='extensions/vsn-page-builder-theme/blocks';
const blocks=fs.readdirSync(blockDir).filter((x)=>x.endsWith('.liquid'));
assert.ok(blocks.length <= 30, `Theme app extension has ${blocks.length} blocks; Shopify limit is 30.`);
const curated=blocks.filter((x)=>x.startsWith('native-'));
assert.equal(curated.length,24,'Expected 24 curated VSN native blocks.');
for (const file of curated) {
  const src=fs.readFileSync(`${blockDir}/${file}`,'utf8');
  assert.ok(src.includes('"target": "section"'), `${file} missing section target`);
  assert.ok(src.includes('"available_if"'), `${file} missing available_if widget gate`);
}
for (const block of NATIVE_APP_BLOCKS) {
  const file = `${block.handle}.liquid`;
  const src = fs.readFileSync(`${blockDir}/${file}`, 'utf8');
  const key = `${block.widgetId.replaceAll('-', '_')}_enabled`;
  const expected = `"available_if": "{{ app.metafields.vsn_page_builder.${key} }}"`;
  assert.ok(src.includes(expected), `${file} available_if must use Shopify-valid canonical app metafield key ${key}`);
  const match = src.match(/"available_if"\s*:\s*"{{\s*app\.metafields\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*}}"/);
  assert.ok(match, `${file} available_if must be exactly {{ app.metafields.<namespace>.<key> }} with identifier-safe namespace/key`);
}
const section=fs.readFileSync(`${blockDir}/native-vsn-section.liquid`,'utf8');
for (const token of ['section_handle','page-builder.js','page-builder.css','vsn-builder-block']) assert.ok(section.includes(token),`VSN section block missing ${token}`);
const settings=fs.readFileSync('app/services/widget-settings.server.js','utf8');
assert.ok(settings.includes('type: "boolean"') || settings.includes("type: 'boolean'"),'Widget settings must write boolean app metafields for available_if.');
const props=fs.readFileSync('app/components/editor/PropertiesPanel.jsx','utf8');
for (const token of ['Shopify Theme Section Bridge','themeSectionId','Render Mode']) assert.ok(props.includes(token),`Theme Section Bridge editor missing ${token}`);
const proxy=fs.readFileSync('app/routes/builder-proxy.$.jsx','utf8');
assert.ok(proxy.includes('data-vsn-theme-section-id'),'Storefront bridge marker missing.');
const runtime=fs.readFileSync('extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js','utf8');
for(const token of ['initializeThemeSectionBridges','getElementById(`shopify-section-${sectionId}`)','searchParams.set("sections"','shopify:section:load','vsn:theme-section:loaded']) assert.ok(runtime.includes(token),`Theme section runtime missing ${token}`);
const service=fs.readFileSync('app/services/native-shopify-bridge.server.js','utf8');
for(const token of ['NATIVE_APP_BLOCKS','newAppsSection','addAppBlockId']) assert.ok(service.includes(token),`Native bridge service missing ${token}`);
console.log(`Phase 2 Native Shopify Bridge audit PASS (${blocks.length}/30 extension blocks, ${curated.length} curated)`);
