import fs from "node:fs";
import assert from "node:assert/strict";
const files = {
  pages: "app/routes/app.pages.jsx", builder: "app/routes/app.builder.$id.jsx", proxy: "app/routes/builder-proxy.$.jsx", renderer: "extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js"
};
for (const [name,file] of Object.entries(files)) assert.ok(fs.existsSync(file), `${name} route missing`);
const pages = fs.readFileSync(files.pages,"utf8");
const builder = fs.readFileSync(files.builder,"utf8");
const proxy = fs.readFileSync(files.proxy,"utf8");
const renderer = fs.readFileSync(files.renderer,"utf8");
for (const token of ["collection","product","search","blog","article","header","footer"]) assert.ok(pages.includes(token), `template support missing: ${token}`);
for (const token of ['intent: "save"','intent: "publish"',"previewMode"]) assert.ok(builder.includes(token), `builder contract missing: ${token}`);
for (const token of ["loadMoreMode","isDefault","resourceHandle","renderExtendedWidget"]) assert.ok(proxy.includes(token), `proxy contract missing: ${token}`);
for (const token of ["initializeLoadMore","vsn-cart","collection","product"]) assert.ok(renderer.includes(token), `renderer contract missing: ${token}`);
console.log("Static E2E contract PASS");
const store = process.env.VSN_E2E_STORE_URL;
if (store) {
  const checks = ["/collections/all", "/search?q=shirt"];
  for (const path of checks) {
    const response = await fetch(new URL(path, store), { redirect: "manual" });
    assert.ok(response.status < 500, `${path} returned ${response.status}`);
    console.log(`LIVE ${path}: ${response.status}`);
  }
} else console.log("Set VSN_E2E_STORE_URL to enable live storefront smoke checks.");
