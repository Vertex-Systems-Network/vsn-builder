import test from "node:test";
import assert from "node:assert/strict";
import { parseVisualTemplate, renderVisualTemplateHtml, validateVisualTemplate } from "../app/builder/visualTemplate.js";

test("Template Lab accepts a full HTML override that uses widget fields instead of {{vsn.content}}", () => {
  const html = `<div {{vsn.root}} class="x"><strong>{{heading}}</strong></div>`;
  assert.equal(validateVisualTemplate(html, ".x{color:red}", { requireContent: false }).ok, true);
  const out = renderVisualTemplateHtml(parseVisualTemplate(html), { props: { heading: "Hi <b>" }, slotHtml: "<p>native</p>", templateKey: "heading" });
  assert.match(out, /Hi &lt;b&gt;/);
  assert.doesNotMatch(out, /native/);
});

test("Template Lab still rejects scripts and missing root token", () => {
  assert.equal(validateVisualTemplate(`<div><script>x</script></div>`, "", { requireContent: false }).ok, false);
});
