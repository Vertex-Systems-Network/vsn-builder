import assert from "node:assert/strict";
import fs from "node:fs";
import { getTemplateSettings } from "../app/storefront/templateSettings.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

const defaults = {
  headerEnabled: true,
  footerEnabled: true,
  headerId: "",
  footerId: "",
  seoTitle: "",
  seoDescription: "",
  canonical: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  schemaEnabled: true,
  sticky: false,
  transparent: false,
  mobileMenu: true,
  mobileBreakpoint: 749,
  fullWidth: true,
};

equal(getTemplateSettings(), defaults, "Missing elements keep historical template-setting defaults");
equal(getTemplateSettings(null), defaults, "Non-array elements keep historical template-setting defaults");
equal(getTemplateSettings([{ type: "heading", props: { text: "x" } }]), defaults, "Missing settings node keeps historical defaults");

const first = getTemplateSettings([
  { type: "heading", props: {} },
  {
    type: "template-settings",
    props: {
      headerEnabled: false,
      footerEnabled: false,
      headerId: 123,
      footerId: "footer-main",
      seoTitle: 456,
      seoDescription: "Description",
      canonical: "/canonical",
      ogTitle: "OG",
      ogDescription: "OG description",
      ogImage: 789,
      schemaEnabled: false,
      sticky: true,
      transparent: true,
      mobileMenu: false,
      mobileBreakpoint: "900",
      fullWidth: false,
    },
  },
  {
    type: "template-settings",
    props: {
      headerId: "second-must-not-win",
      mobileBreakpoint: 500,
    },
  },
]);

equal(first, {
  headerEnabled: false,
  footerEnabled: false,
  headerId: "123",
  footerId: "footer-main",
  seoTitle: "456",
  seoDescription: "Description",
  canonical: "/canonical",
  ogTitle: "OG",
  ogDescription: "OG description",
  ogImage: "789",
  schemaEnabled: false,
  sticky: true,
  transparent: true,
  mobileMenu: false,
  mobileBreakpoint: 900,
  fullWidth: false,
}, "First template-settings node wins and keeps string/boolean coercion");

const looseBooleans = getTemplateSettings([{
  type: "template-settings",
  props: {
    headerEnabled: 0,
    footerEnabled: null,
    schemaEnabled: "false",
    sticky: 1,
    transparent: "true",
    mobileMenu: 0,
    fullWidth: null,
  },
}]);
equal(looseBooleans.headerEnabled, true, "Header disables only on strict false");
equal(looseBooleans.footerEnabled, true, "Footer disables only on strict false");
equal(looseBooleans.schemaEnabled, true, "Schema disables only on strict false");
equal(looseBooleans.sticky, false, "Sticky enables only on strict true");
equal(looseBooleans.transparent, false, "Transparent enables only on strict true");
equal(looseBooleans.mobileMenu, true, "Mobile menu disables only on strict false");
equal(looseBooleans.fullWidth, true, "Full width disables only on strict false");

equal(getTemplateSettings([{ type: "template-settings", props: { mobileBreakpoint: 200 } }]).mobileBreakpoint, 320, "Mobile breakpoint keeps 320 lower clamp");
equal(getTemplateSettings([{ type: "template-settings", props: { mobileBreakpoint: 1500 } }]).mobileBreakpoint, 1200, "Mobile breakpoint keeps 1200 upper clamp");
equal(getTemplateSettings([{ type: "template-settings", props: { mobileBreakpoint: 0 } }]).mobileBreakpoint, 749, "Falsy zero mobile breakpoint keeps 749 fallback");
equal(getTemplateSettings([{ type: "template-settings", props: { mobileBreakpoint: "" } }]).mobileBreakpoint, 749, "Empty mobile breakpoint keeps 749 fallback");

const invalidBreakpoint = getTemplateSettings([{ type: "template-settings", props: { mobileBreakpoint: "not-a-number" } }]).mobileBreakpoint;
ok(Number.isNaN(invalidBreakpoint), "Non-numeric truthy mobile breakpoint preserves legacy NaN behavior");

const zeroStrings = getTemplateSettings([{
  type: "template-settings",
  props: {
    headerId: 0,
    footerId: 0,
    seoTitle: 0,
    seoDescription: false,
    canonical: null,
    ogTitle: undefined,
    ogDescription: 0,
    ogImage: false,
  },
}]);
equal(zeroStrings.headerId, "", "Falsy numeric header ID keeps empty-string coercion");
equal(zeroStrings.footerId, "", "Falsy numeric footer ID keeps empty-string coercion");
equal(zeroStrings.seoTitle, "", "Falsy numeric SEO title keeps empty-string coercion");
equal(zeroStrings.seoDescription, "", "Falsy SEO description keeps empty-string coercion");
equal(zeroStrings.canonical, "", "Falsy canonical keeps empty-string coercion");
equal(zeroStrings.ogTitle, "", "Falsy OG title keeps empty-string coercion");
equal(zeroStrings.ogDescription, "", "Falsy OG description keeps empty-string coercion");
equal(zeroStrings.ogImage, "", "Falsy OG image keeps empty-string coercion");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const moduleSource = fs.readFileSync("app/storefront/templateSettings.js", "utf8");
const reusableSections = fs.readFileSync("app/storefront/reusableSections.server.js", "utf8");

ok(route.includes('from "../storefront/templateSettings.js"'), "Builder proxy imports extracted template-settings boundary");
equal((route.match(/getTemplateSettings\(/g) || []).length, 2, "Builder proxy keeps its two direct template-settings call sites");
ok(reusableSections.includes('from "./templateSettings.js"'), "Reusable-section boundary imports template-settings normalization");
equal((reusableSections.match(/getTemplateSettings\(/g) || []).length, 1, "Reusable-section boundary owns the historical global-section template-settings call site");
ok(!route.includes("function getTemplateSettings("), "Builder proxy no longer owns template-settings normalization");

for (const marker of [
  "headerEnabled",
  "footerEnabled",
  "schemaEnabled",
  "mobileBreakpoint",
  "Math.max",
  "Math.min",
  "fullWidth",
]) {
  ok(moduleSource.includes(marker), `Template-settings boundary marker missing: ${marker}`);
}
for (const forbidden of [
  "db.",
  "fetch(",
  "graphql(",
  "authenticate.",
  "builderPage.",
  "Response(",
  "renderBuilder",
  "shopify.server",
]) {
  ok(!moduleSource.includes(forbidden), `Template-settings boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6e storefront template settings audit: PASS (${checks}/${checks})`);
