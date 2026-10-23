import assert from "node:assert/strict";
import fs from "node:fs";
import { parseFormFields, renderContentIconSvg, renderFormBuilder, renderFormWidget, renderIconWidget, renderNavigationMenu } from "../app/storefront/formWidgets.js";

let checks = 0;
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const node = (type) => ({ id: `n-${type}`, type });

const fields = parseFormFields("email|e mail<x>|Email||required\nselect|size|Size|||S, M ,L|2\n\n");
equal(fields[0].name, "e_mail_x_", "Form field names are sanitized");
equal(fields[0].required, true, "required flag is parsed");
equal(fields[1].options, ["S", "M", "L"], "Select options are trimmed");
equal(fields[1].step, 2, "Field steps are parsed");

const form = renderFormBuilder(node("form-builder"), { fieldsText: "email|email|Email||required\ntext|full_name|Name", formKey: "lead" }, {}, { customer: { email: 'a"b@x.io', name: "Ann" } });
ok(form.includes('data-vsn-form-type="lead"') && form.includes('name="formType" value="lead"'), "Form builder carries the form key");
ok(form.includes('name="website"') && form.includes('tabindex="-1"'), "Form builder keeps the honeypot field");
ok(form.includes('value="a&quot;b@x.io"') && form.includes('value="Ann"'), "Customer prefill is escaped");
ok(!renderFormBuilder(node("f"), { fieldsText: "email|email|Email", prefillCustomer: false }, {}, { customer: { email: "x@y.z" } }).includes("x@y.z"), "Prefill can be disabled");
ok(renderFormBuilder(node("f"), { fieldsText: "evil|f|F" }, {}, {}).includes('type="text"'), "Unknown field types fall back to text");

const v3 = renderFormBuilder(node("f"), { fieldsText: "text|a|A", captchaMode: "recaptcha-v3", recaptchaV3Action: "sub mit<x>" }, {}, { googleCaptcha: { v3: { siteKeyConfigured: true, siteKey: "KEY", threshold: 9 } } });
ok(v3.includes('class="vsn-g-recaptcha-v3" data-sitekey="KEY"'), "reCAPTCHA v3 renders configured site key");
ok(v3.includes('data-action="submitx"'), "reCAPTCHA v3 action is sanitized");
ok(renderFormBuilder(node("f"), { fieldsText: "text|a|A", captchaMode: "recaptcha-v2" }, {}, {}).includes("Google reCAPTCHA v2 is not configured."), "Missing reCAPTCHA v2 key renders an explicit error");
ok(renderFormBuilder(node("f"), { fieldsText: "text|a|A", captchaMode: "turnstile", turnstileSiteKey: "T" }, {}, {}).includes('class="cf-turnstile" data-sitekey="T"'), "Turnstile renders configured site key");

const multi = renderFormBuilder(node("f"), { fieldsText: "text|a|A|||| 1\ntext|b|B||||2", multiStep: true }, {}, {});
ok(multi.includes("vsn-form-next") && multi.includes('data-vsn-form-step="2" style="display:none;'), "Multi-step forms hide later steps");

const contact = renderFormWidget(node("contact-form"), { heading: "<h>" }, {}, "contact-form", { product: { handle: 'p"1' } });
ok(contact.includes('data-vsn-form-type="contact"') && contact.includes("&lt;h&gt;") && contact.includes('value="p&quot;1"'), "Contact form escapes heading and product handle");
const news = renderFormWidget(node("newsletter-form"), {}, {}, "newsletter-form", {});
ok(news.includes('data-vsn-form-type="newsletter"') && !news.includes('name="message"'), "Newsletter form omits message field");
ok(news.includes('name="website"'), "Newsletter form keeps the honeypot field");

const nav = renderNavigationMenu(node("navigation-menu"), { itemsText: "Home|/\nShop|/collections/all", alignment: "center" }, {});
ok(nav.includes("justify-content:center") && nav.includes('data-vsn-mobile="1"'), "Navigation honours alignment and mobile toggle");

ok(renderContentIconSvg("heart").includes("20.8 4.8") && renderContentIconSvg("nope").includes("12 2.8"), "Icon SVG falls back to star");
ok(renderIconWidget(node("icon"), { label: '"x"' }).includes('aria-label="&quot;x&quot;"'), "Icon widget escapes accessible label");
ok(renderIconWidget(node("icon"), {}).includes('aria-hidden="true"'), "Unlabelled icon is decorative");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const source = fs.readFileSync("app/storefront/formWidgets.js", "utf8");
ok(route.includes('from "../storefront/formWidgets.js"'), "Builder proxy imports form-widget boundary");
for (const name of ["parseFormFields", "renderFormBuilder", "renderFormWidget", "renderNavigationMenu", "renderContentIconSvg", "renderIconWidget"]) {
  ok(!route.includes(`function ${name}(`), `Builder proxy no longer owns ${name}`);
}
for (const forbidden of ["db.", "fetch(", "graphql(", "authenticate.", "session.", "Response(", "renderNode", "shopify.server", "process.env"]) {
  ok(!source.includes(forbidden), `Form-widget boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6u storefront form widgets audit: PASS (${checks}/${checks})`);
