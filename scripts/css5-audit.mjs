import fs from "node:fs";
import { auditBatchCss5Profiles, batchCss5Targets, getWidgetStyleProfile } from "../app/builder/widgetStyleProfiles.js";
import { buildWidgetSpecificCss } from "../app/builder/widgetSpecificStyleEngine.js";

const groups = auditBatchCss5Profiles();
for (const [name, result] of Object.entries(groups)) {
  if (result.missing.length) throw new Error(`CSS-5 ${name} missing profiles: ${result.missing.join(", ")}`);
  if (result.covered !== result.total) throw new Error(`CSS-5 ${name} coverage mismatch ${result.covered}/${result.total}`);
}

const required = {
  "search-query-title": ["textCore", "searchSummary"],
  "search-results-grid": ["gridCards", "searchResults"],
  "blog-article-grid": ["gridCards", "articleCards"],
  "article-content": ["richText", "articleBody"],
  "article-tags": ["articleMeta"],
  "article-navigation": ["navigation", "articleNav"],
  "related-articles": ["gridCards", "articleCards"],
  "customer-name": ["textCore", "customerIdentity"],
  "account-link": ["button", "customerLink"],
  "html": ["codeSurface"],
  "liquid": ["codeSurface"],
  "team-grid": ["gridCards", "contentCollection"],
  "gallery-grid": ["gridCards", "contentCollection"],
};
for (const [type, features] of Object.entries(required)) {
  const profile = getWidgetStyleProfile(type);
  for (const feature of features) if (!profile.features.includes(feature)) throw new Error(`${type} missing CSS-5 feature ${feature}`);
}

const searchCss = buildWidgetSpecificCss("search-results-grid", "css5-search", { searchResults: { titleColor: "#111111", titleClamp: 2, excerptColor: "#666666" } });
if (!searchCss.includes("vsn-search-card-title") || !searchCss.includes("-webkit-line-clamp:2") || !searchCss.includes("#111111")) throw new Error("Search result detail CSS missing");

const articleCss = buildWidgetSpecificCss("article-content", "css5-article", { articleBody: { linkColor: "#006e52", quoteBorderColor: "#95BF47" } });
if (!articleCss.includes("color:#006e52") || !articleCss.includes("border-inline-start-color:#95BF47")) throw new Error("Article body CSS missing");

const metaCss = buildWidgetSpecificCss("article-tags", "css5-tags", { articleMeta: { tagBackground: "#f3f4f6", tagGap: "8px" } });
if (!metaCss.includes("vsn-article-tag") || !metaCss.includes("background-color:#f3f4f6")) throw new Error("Article meta CSS missing");

const customerCss = buildWidgetSpecificCss("customer-name", "css5-customer", { customerIdentity: { nameColor: "#111111", nameWeight: "700" } });
if (!customerCss.includes("vsn-customer-name-value") || !customerCss.includes("font-weight:700")) throw new Error("Customer identity CSS missing");

const codeCss = buildWidgetSpecificCss("liquid", "css5-code", { codeSurface: { background: "#111111", color: "#ffffff", maxHeight: "420px" } });
if (!codeCss.includes("vsn-code-surface") || !codeCss.includes("max-height:420px")) throw new Error("Code surface CSS missing");

const contentCss = buildWidgetSpecificCss("team-grid", "css5-team", { contentCollection: { background: "#ffffff", radius: "12px", titleColor: "#111111" } });
if (!contentCss.includes("vsn-team-card") || !contentCss.includes("border-radius:12px")) throw new Error("Content collection CSS missing");

const proxy = fs.readFileSync(new URL("../app/routes/builder-proxy.$.jsx", import.meta.url), "utf8");
const preview = fs.readFileSync(new URL("../app/components/editor/PreviewRenderer.jsx", import.meta.url), "utf8");
for (const token of ["vsn-search-card-title", "vsn-article-card", "vsn-article-tag", "vsn-customer-name-value", "vsn-code-surface", "vsn-team-card"]) {
  if (!proxy.includes(token)) throw new Error(`Storefront semantic hook missing: ${token}`);
  if (!preview.includes(token) && token !== "vsn-code-surface") throw new Error(`Preview semantic hook missing: ${token}`);
}

const entries = Object.values(batchCss5Targets).flat().length;
const unique = new Set(Object.values(batchCss5Targets).flat()).size;
console.log(`CSS-5 target profile entries: ${entries}/${entries} (${unique} unique widgets)`);
console.log("Search/Blog/Article/Customer/Advanced-content renderer checks: PASS");
console.log("Batch CSS-5 audit: PASS");
