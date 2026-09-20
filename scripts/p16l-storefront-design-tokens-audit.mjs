import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getGlobalStyles,
  mergeShopDesignTokens,
  toCssSize,
} from "../app/storefront/designTokens.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

equal(toCssSize(null, "7px"), "7px", "Null CSS size uses fallback");
equal(toCssSize(undefined, "7px"), "7px", "Undefined CSS size uses fallback");
equal(toCssSize("", "7px"), "7px", "Empty CSS size uses fallback");
equal(toCssSize(12), "12px", "Finite numeric CSS size gets px");
equal(toCssSize(-2.5), "-2.5px", "Negative finite numeric CSS size gets px");
equal(toCssSize(Number.NaN, "3rem"), "3rem", "NaN CSS size uses fallback");
equal(toCssSize(Number.POSITIVE_INFINITY, "3rem"), "3rem", "Infinite CSS size uses fallback");
equal(toCssSize(" 12 "), "12px", "Numeric string CSS size is trimmed and gets px");
equal(toCssSize("-1.5"), "-1.5px", "Negative decimal string CSS size gets px");
equal(toCssSize("2rem"), "2rem", "Unit-bearing CSS string is preserved");
equal(toCssSize(" calc(100% - 2rem) "), "calc(100% - 2rem)", "CSS expression string is trimmed and preserved");
equal(toCssSize({ desktop: 14, unit: "rem" }), "14rem", "Responsive desktop numeric value uses supplied unit");
equal(toCssSize({ value: 8, unit: "em" }), "8em", "Object value numeric CSS size uses supplied unit");
equal(toCssSize({ tablet: 6 }), "6px", "Tablet numeric fallback uses px");
equal(toCssSize({ mobile: "3rem", unit: "px" }), "3rem", "String responsive candidate preserves its own unit semantics");
equal(toCssSize({ desktop: "", value: 4 }), "0px", "Empty desktop candidate keeps historical fallback behavior");
equal(toCssSize({}, "11px"), "11px", "Object without candidate uses fallback");

const defaults = getGlobalStyles([]);
equal(defaults, {
  primaryColor: "#008060",
  secondaryColor: "#6d7175",
  accentColor: "#008060",
  textColor: "#1a1a1a",
  backgroundColor: "#ffffff",
  surfaceColor: "#ffffff",
  mutedSurfaceColor: "#f6f6f7",
  borderColor: "#e3e3e3",
  fontFamily: "Inter, system-ui, sans-serif",
  headingFontFamily: "inherit",
  headingScale: 1.25,
  buttonBackground: "#1a1a1a",
  buttonTextColor: "#ffffff",
  buttonRadius: "8px",
  formBackground: "#ffffff",
  formTextColor: "#202223",
  formBorderColor: "#c9cccf",
  formRadius: "8px",
  radiusSm: "6px",
  radiusMd: "12px",
  radiusLg: "20px",
  spacingBase: 4,
  shadowSm: "0 1px 2px rgba(0,0,0,.08)",
  shadowMd: "0 8px 24px rgba(0,0,0,.12)",
  shadowLg: "0 20px 50px rgba(0,0,0,.16)",
  containerMaxWidth: "1200px",
  mobileBreakpoint: 749,
  tabletBreakpoint: 989,
}, "Global styles preserve historical defaults");

const custom = getGlobalStyles([
  { id: "other", type: "text", props: { primaryColor: "#bad" } },
  {
    id: "globals-1",
    type: "global-styles",
    props: {
      primaryColor: "#112233",
      secondaryColor: "#223344",
      textColor: "#334455",
      backgroundColor: "#445566",
      surfaceColor: "#556677",
      mutedSurfaceColor: "#667788",
      borderColor: "#778899",
      fontFamily: "Example Sans",
      headingFontFamily: "Example Display",
      headingScale: 3,
      buttonBackground: "#111111",
      buttonTextColor: "#eeeeee",
      buttonRadius: { desktop: 10, unit: "px" },
      formBackground: "#fafafa",
      formTextColor: "#121212",
      formBorderColor: "#999999",
      formRadius: "0.5rem",
      radiusSm: 2,
      radiusMd: "10",
      radiusLg: "1.5rem",
      spacingBase: 0,
      shadowSm: "none",
      shadowMd: "0 2px 8px #0003",
      shadowLg: "0 10px 30px #0004",
      containerMaxWidth: 1440,
      mobileBreakpoint: 200,
      tabletBreakpoint: 400,
    },
  },
  { id: "globals-2", type: "global-styles", props: { primaryColor: "#ffffff" } },
]);
equal(custom.primaryColor, "#112233", "First global-styles node remains authoritative");
equal(custom.accentColor, "#112233", "Accent falls back to custom primary color");
equal(custom.headingScale, 2, "Heading scale remains clamped to 2");
equal(custom.buttonRadius, "10px", "Button radius uses shared CSS-size normalization");
equal(custom.formRadius, "0.5rem", "Form radius preserves explicit units");
equal(custom.radiusSm, "2px", "Small radius numeric value gets px");
equal(custom.radiusMd, "10px", "Medium radius numeric string gets px");
equal(custom.radiusLg, "1.5rem", "Large radius explicit units are preserved");
equal(custom.spacingBase, 4, "Zero spacing base keeps historical default via truthy fallback");
equal(custom.containerMaxWidth, "1440px", "Container numeric width gets px");
equal(custom.mobileBreakpoint, 320, "Mobile breakpoint keeps historical minimum");
equal(custom.tabletBreakpoint, 500, "Tablet breakpoint keeps historical minimum");

const explicitAccent = getGlobalStyles([{
  type: "global-styles",
  props: { primaryColor: "#111111", accentColor: "#abcdef", headingScale: 0.5 },
}]);
equal(explicitAccent.accentColor, "#abcdef", "Explicit accent remains authoritative");
equal(explicitAccent.headingScale, 1, "Heading scale keeps historical minimum");

const globals = getGlobalStyles([]);
const merged = mergeShopDesignTokens(globals, {
  primaryColor: "#010203",
  secondaryColor: "  ",
  buttonRadius: "18px",
  formRadius: 0,
  radiusMd: "1rem",
  containerMaxWidth: "1400px",
  containerMd: "1500px",
  spacingBase: 8,
  headingScale: 1.75,
});
equal(merged.primaryColor, "#010203", "Non-empty design token overrides global primary");
equal(merged.secondaryColor, globals.secondaryColor, "Whitespace-only token is ignored");
equal(merged.buttonRadius, "18px", "Token radius is preserved without extra normalization");
equal(merged.formRadius, 0, "Numeric zero token remains a valid direct-key override");
equal(merged.radiusMd, "1rem", "Radius design token override is preserved");
equal(merged.containerMaxWidth, "1500px", "containerMd keeps historical precedence over containerMaxWidth");
equal(merged.spacingBase, 8, "Spacing base token overrides and normalizes numerically");
equal(merged.headingScale, 1.75, "Heading scale token overrides within range");
equal(globals.primaryColor, "#008060", "Token merge does not mutate input globals");

const clamps = mergeShopDesignTokens(globals, {
  spacingBase: -4,
  headingScale: 9,
});
equal(clamps.spacingBase, 1, "Merged spacing base keeps minimum of 1");
equal(clamps.headingScale, 2, "Merged heading scale keeps maximum of 2");

const ignoredFalsySpecials = mergeShopDesignTokens({ ...globals, spacingBase: 7, headingScale: 1.4 }, {
  spacingBase: 0,
  headingScale: 0,
  containerMd: "",
});
equal(ignoredFalsySpecials.spacingBase, 7, "Falsy special spacing token preserves existing value");
equal(ignoredFalsySpecials.headingScale, 1.4, "Falsy special heading token preserves existing value");
equal(ignoredFalsySpecials.containerMaxWidth, globals.containerMaxWidth, "Falsy containerMd preserves existing max width");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const source = fs.readFileSync("app/storefront/designTokens.js", "utf8");

ok(route.includes('from "../storefront/designTokens.js"'), "Builder proxy imports extracted design-token boundary");
ok((route.match(/\btoCssSize\b/g) || []).length >= 50, "Builder proxy keeps broad historical CSS-size usage through imported helper");
equal((route.match(/mergeShopDesignTokens\(getGlobalStyles\(elements\), designTokens\)/g) || []).length, 2, "Fragment and document renderers keep both historical design-token merge calls");
for (const duplicate of [
  "function toCssSize(",
  "function getGlobalStyles(",
  "function mergeShopDesignTokens(",
]) {
  ok(!route.includes(duplicate), `Builder proxy no longer owns design-token helper: ${duplicate}`);
}
for (const marker of [
  'return `${value}px`',
  'value.desktop ??',
  'primaryColor: node?.props?.primaryColor || "#008060"',
  'accentColor: node?.props?.accentColor || node?.props?.primaryColor || "#008060"',
  'headingScale: Math.max(1, Math.min(2',
  'mobileBreakpoint: Math.max(320',
  'tabletBreakpoint: Math.max(500',
  'if (tokens.containerMd) out.containerMaxWidth = tokens.containerMd',
  'if (tokens.spacingBase) out.spacingBase = Math.max(1',
  'if (tokens.headingScale) out.headingScale = Math.max(1, Math.min(2',
]) {
  ok(source.includes(marker), `Design-token boundary marker missing: ${marker}`);
}
for (const forbidden of [
  "db.",
  "fetch(",
  "graphql(",
  "authenticate.",
  "session.",
  "Response(",
  "renderNode",
  "shopify.server",
  "process.env",
  "document.",
  "window.",
]) {
  ok(!source.includes(forbidden), `Design-token boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6l storefront design token audit: PASS (${checks}/${checks})`);
