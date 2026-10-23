import assert from "node:assert/strict";
import fs from "node:fs";
import { allowedUnit, allowedValue, cssSize, escapeAttribute, escapeHtml, individualSpacingCss, responsiveValue, safeColor, safeNumber, safeUrl, spacingCss } from "../app/storefront/safeCss.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

equal(escapeHtml(`<a href="x" onclick='y'>&</a>`), "&lt;a href=&quot;x&quot; onclick=&#039;y&#039;&gt;&amp;&lt;/a&gt;", "escapeHtml encodes all HTML metacharacters");
equal(escapeHtml(null), "", "escapeHtml tolerates nullish values");
equal(escapeAttribute(`" onmouseover="x`), "&quot; onmouseover=&quot;x", "escapeAttribute blocks attribute breakout");

for (const blocked of ["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,<script>", "vbscript:x", ""]) {
  equal(safeUrl(blocked), "#", `safeUrl blocks ${JSON.stringify(blocked)}`);
}
for (const allowed of ["/products/a", "#top", "mailto:a@b.c", "tel:+1", "https://shop.example/x", "http://shop.example"]) {
  equal(safeUrl(allowed), allowed, `safeUrl keeps ${allowed}`);
}
equal(safeUrl(42), "#", "safeUrl rejects non-strings");
// Protocol-relative URLs are kept, matching the existing allowance for absolute http(s) links.
equal(safeUrl("//cdn.example/x"), "//cdn.example/x", "safeUrl keeps protocol-relative links like other http(s) links");

for (const color of ["#fff", "#11223344", "rgb(1, 2, 3)", "rgba(1,2,3,.5)", "hsl(10, 20%, 30%)", "transparent"]) {
  equal(safeColor(color, "F"), color, `safeColor keeps ${color}`);
}
for (const bad of ["red;background:url(x)", "expression(alert(1))", "#ggg", "url(javascript:x)", 5]) {
  equal(safeColor(bad, "F"), "F", `safeColor rejects ${String(bad)}`);
}

equal(safeNumber("4.5", 0), 4.5, "safeNumber parses numeric strings");
equal(safeNumber("abc", 7), 7, "safeNumber falls back on NaN");
equal(safeNumber(Infinity, 7), 7, "safeNumber falls back on Infinity");
equal(allowedUnit("rem"), "rem", "allowedUnit keeps whitelisted units");
equal(allowedUnit("px;color:red"), null, "allowedUnit rejects injected units");
equal(allowedValue("left", ["left", "right"], "center"), "left", "allowedValue keeps listed values");
equal(allowedValue("evil", ["left"], "center"), "center", "allowedValue falls back for unlisted values");

equal(cssSize(10, "0px"), "10px", "cssSize numbers get px");
equal(cssSize("12", "0px"), "12px", "cssSize bare numeric strings get px");
equal(cssSize("50%", "0px"), "50%", "cssSize keeps unit strings");
equal(cssSize("auto", "0px"), "auto", "cssSize keeps keywords");
equal(cssSize("calc(100% - 4px)", "0px"), "calc(100% - 4px)", "cssSize keeps math functions");
equal(cssSize("calc(1px);}body{color:red", "0px"), "0px", "cssSize rejects declaration breakout");
equal(cssSize({ desktop: 3, unit: "em" }, "0px"), "3em", "cssSize reads responsive objects");
equal(cssSize({ desktop: 3, unit: "bogus" }, "0px"), "3px", "cssSize falls back to px for bad units");

equal(responsiveValue({ desktop: 8, unit: "rem" }, 1), "8rem", "responsiveValue reads desktop and unit");
equal(responsiveValue({ desktop: "x" }, 2), "2px", "responsiveValue falls back on bad numbers");
equal(responsiveValue(5, 0), "5px", "responsiveValue numbers get px");
equal(responsiveValue("1.5em", 0), "1.5em", "responsiveValue keeps unit strings");
equal(responsiveValue("1px;color:red", 4), "4px", "responsiveValue rejects injected strings");

equal(spacingCss({ desktop: { top: 1, right: 2, bottom: 3, left: 4 } }, 0), "1px 2px 3px 4px", "spacingCss reads desktop sides");
equal(spacingCss(null, 5), "5px 5px 5px 5px", "spacingCss applies scalar fallback");
equal(spacingCss({ top: "x", unit: "em" }, { top: 9, right: 0, bottom: 0, left: 0 }), "9em 0em 0em 0em", "spacingCss falls back per side and honors unit");
equal(individualSpacingCss({ marginTop: 4, paddingLeft: "2rem" }), { margin: "4px 0px 0px 0px", padding: "0px 0px 0px 2rem" }, "individualSpacingCss composes margin and padding");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const source = fs.readFileSync("app/storefront/safeCss.js", "utf8");
ok(route.includes('from "../storefront/safeCss.js"'), "Builder proxy imports safe-CSS boundary");
for (const name of ["responsiveValue", "cssSize", "individualSpacingCss", "spacingCss", "safeNumber", "allowedUnit", "allowedValue", "safeColor", "safeUrl", "escapeHtml", "escapeAttribute"]) {
  ok(!route.includes(`function ${name}(`), `Builder proxy no longer owns ${name}`);
}
for (const forbidden of ["import ", "db.", "fetch(", "graphql(", "authenticate.", "session.", "Response(", "renderNode", "process.env"]) {
  ok(!source.includes(forbidden), `Safe-CSS boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6q storefront safe CSS/escape audit: PASS (${checks}/${checks})`);
