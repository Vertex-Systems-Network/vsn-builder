import test from "node:test";
import assert from "node:assert/strict";
import { buildLiquidBody, hasLiquidPlaceholders, liquidPlaceholder } from "../app/storefront/liquidOutput.js";
import { renderPhase10Widget } from "../app/storefront/phase10Widgets.js";

test("liquid widget renders a placeholder, never raw code",()=>{
  const html=renderPhase10Widget({id:"l1",type:"liquid",props:{code:"{{ product.title }}"}},{code:"{{ product.title }}"},{},{},()=>"");
  assert.ok(hasLiquidPlaceholders(html));
  assert.ok(!html.includes("{{ product.title }}"));
});

test("only widget code is left outside raw blocks",()=>{
  const {liquid,body}=buildLiquidBody(`<p>{{ shop.name }} {% endraw %}</p>${liquidPlaceholder("{{ product.title | upcase }} ü")}<i>x</i>`);
  assert.equal(liquid,true);
  assert.ok(body.startsWith("{% layout none %}{% raw %}<p>{{ shop.name }} {% endraw %}{{ '{' }}{% raw %}% endraw %}</p>{% endraw %}"));
  assert.ok(body.includes("{% endraw %}{{ product.title | upcase }} ü{% raw %}<i>x</i>{% endraw %}"));
});

test("safe mode strips Liquid widget code and stays HTML",()=>{
  const {liquid,body}=buildLiquidBody(`<p>a</p>${liquidPlaceholder("{{ customer.email }}")}`,{enabled:false});
  assert.equal(liquid,false);
  assert.equal(body,"<p>a</p>");
});
