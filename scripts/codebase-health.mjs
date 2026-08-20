import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const debtBudgets = new Map([
  ["app/components/editor/PropertiesPanel.jsx", 1726],
  ["app/components/editor/PreviewRenderer.jsx", 1277],
  ["app/components/editor/PageEditor.jsx", 1705],
  ["app/components/editor/Canvas.jsx", 1517],
  ["app/components/editor/EditorControls.jsx", 1654],
  ["app/builder/widgetSpecificStyleEngine.js", 682],
  ["app/routes/app.builder.$id.jsx", 1589],
  ["app/routes/app.pages.jsx", 1225],
  ["app/routes/builder-proxy.$.jsx", 5316],
]);
const newModuleBudget = 600;
const ignore = ["node_modules", "build", ".git"];

function filesUnder(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    if (ignore.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...filesUnder(full));
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) result.push(full);
  }
  return result;
}

let failures = 0;
let warnings = 0;
for (const file of filesUnder(path.join(root, "app"))) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).length;
  const grandfathered = debtBudgets.get(relative);
  if (grandfathered != null) {
    if (lines > grandfathered) {
      console.error(`FAIL  ${relative} grew from its Milestone G debt ceiling (${lines} > ${grandfathered}). Extract a cohesive module before adding more code.`);
      failures++;
    } else {
      console.log(`PASS  ${relative} remains within its legacy debt ceiling (${lines}/${grandfathered}).`);
    }
    continue;
  }
  if (lines > newModuleBudget) {
    console.warn(`WARN  ${relative} is ${lines} lines. New/modernized modules should normally stay under ${newModuleBudget}.`);
    warnings++;
  }
}

const requiredDocs = [
  "SRS.md",
  "docs/engineering/architecture.md",
  "docs/engineering/ui-standards.md",
  "docs/engineering/error-handling.md",
  "docs/engineering/testing.md",
  "docs/engineering/module-map.md",
];
for (const file of requiredDocs) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`FAIL  Missing engineering standard: ${file}`);
    failures++;
  }
}
console.log(`\nCodebase health: ${failures} failure(s), ${warnings} warning(s).`);
if (failures) process.exit(1);
