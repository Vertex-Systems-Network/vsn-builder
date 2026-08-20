import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const appCss = read("app/styles/app.css");
const scrollbars = read("app/styles/scrollbars.css");
const builder = read("app/styles/builder.css");
const root = read("app/root.jsx");

assert.match(appCss, /@import "\.\/scrollbars\.css";/, "central scrollbar stylesheet must load after builder/dashboard styles");
assert.match(scrollbars, /--vsn-scrollbar-size:\s*8px/);
assert.match(scrollbars, /scrollbar-width:\s*thin/);
assert.match(scrollbars, /scrollbar-color:\s*var\(--vsn-scrollbar-thumb\)\s+var\(--vsn-scrollbar-track\)/);
assert.match(scrollbars, /::-webkit-scrollbar\s*\{/);
assert.match(scrollbars, /width:\s*var\(--vsn-scrollbar-size\)/);
assert.match(scrollbars, /height:\s*var\(--vsn-scrollbar-size\)/);
assert.match(scrollbars, /::-webkit-scrollbar-thumb:hover/);
assert.match(scrollbars, /::-webkit-scrollbar-thumb:active/);
assert.match(scrollbars, /::-webkit-scrollbar-corner/);
assert.match(scrollbars, /scrollbar-gutter:\s*stable/);
assert.match(scrollbars, /\.dashboard-root\.dark/);
assert.match(scrollbars, /@media \(forced-colors: active\)/);
assert.match(scrollbars, /\.scrollbar-hide\s*\{/);
assert.doesNotMatch(builder, /^::-webkit-scrollbar\s*\{/m, "legacy builder-global scrollbar rules must not compete with the centralized stylesheet");
assert.match(root, /appStylesHref/, "root must continue loading app.css on every app route");

const expectedSurfaces = [
  ".vsn-editor-sidebar-scroll",
  ".vsn-properties-panel",
  ".vsn-builder-nav",
  ".vsn-workspace-page",
  ".vsn-pages-screen",
  ".vsn-pages-table-wrap",
  '[data-vsn-editor-root="true"] .overflow-auto',
  '[data-vsn-editor-root="true"] .overflow-y-auto',
];
for (const selector of expectedSurfaces) {
  assert.ok(scrollbars.includes(selector), `missing stable scrollbar coverage for ${selector}`);
}

console.log("FIX-6 full-app scrollbar styling audit PASS");
