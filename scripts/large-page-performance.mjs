import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { buildStyleBundleCss } from '../app/builder/stylePipeline.js';

function node(i, depth = 0) {
  return { id: `perf-${depth}-${i}`, type: i % 7 === 0 ? 'image' : i % 5 === 0 ? 'button' : 'text', props: {}, styles: { typography: { fontSize: `${14 + (i % 8)}px`, color: '#222222' }, spacing: { paddingTop: `${i % 12}px`, paddingBottom: `${i % 12}px` } }, children: [] };
}
function tree(count) {
  const roots = [];
  for (let i = 0; i < count; i++) roots.push(node(i));
  return roots;
}
const budgetMs = Number(process.env.VSN_PERF_STYLE_BUDGET_MS || 750);
for (const count of [25, 50, 100, 200]) {
  const items = tree(count);
  const start = performance.now();
  const css = buildStyleBundleCss(items, {}, { includeBase: true, includeResponsive: true });
  const elapsed = performance.now() - start;
  assert.equal(typeof css, 'string');
  assert.ok(elapsed < budgetMs, `${count}-widget style compile ${elapsed.toFixed(1)}ms exceeds ${budgetMs}ms budget`);
  console.log(`PASS ${count} widgets: ${elapsed.toFixed(1)}ms, ${(Buffer.byteLength(css)/1024).toFixed(1)} KB CSS`);
}
