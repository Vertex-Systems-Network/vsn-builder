import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 inspectNativeProductCart,inspectNativeProductCartLiquid,
} from "../scripts/t032-native-product-cart-contract.mjs";

const base="extensions/vsn-page-builder-theme/";
const liquid=readFileSync(base+"blocks/native-add-to-cart.liquid","utf8");
const css=readFileSync(base+"assets/native-blocks.css","utf8");
const evaluate=(src,styles=css)=>inspectNativeProductCartLiquid(src,styles);

test("real Shopify app block has product form, accessible variant dropdown and purchase quantity",()=>{
 const report=inspectNativeProductCart();
 assert.deepEqual(report.failures,[]);
 assert.equal(report.actualCartSubmissionTested,false);
 assert.equal(report.hostedThemeVariantTested,false);
 assert.match(liquid,/{% form 'product', product, id: vsn_cart_form_id/);
 assert.match(liquid,/<select[\s\S]*?name="id"/);
 assert.match(liquid,/name="quantity"/);
 assert.match(liquid,/variant.id == vsn_selected_variant.id/);
 assert.doesNotMatch(liquid,/<form\b|action="\/cart\/add"/);
});

test("missing selections, sold out protections, quantity limits or Shopify-generated form fail closed",()=>{
 const replacements=[
  ["{% form 'product', product","{% form 'customer', product"],
  ["{% endform %}","</form>"],
  ['name="id"','name="variant"'],
  ['name="quantity"','name="count"'],
  ['min="1"','min="0"'],
  ['step="1"','step="0.5"'],
  ['value="{{ variant.id }}"','value="{{ product.selected_or_first_available_variant.id }}"'],
  ["{% unless variant.available %}disabled{% endunless %}",""],
  ["{% unless product.available %}disabled{% endunless %}",""],
  ["{{ variant.title | escape }}","{{ variant.title }}"],
  ["{{ block.settings.label | escape }}","{{ block.settings.label }}"],
  ["{{ block.shopify_attributes }}",""],
 ];
 for(const [before,after] of replacements){
  assert(liquid.includes(before),before);
  assert(evaluate(liquid.replace(before,after)).length>0,before);
 }
});

test("250+ variant catalogue never exposes an incomplete subset as an apparently complete variant picker",()=>{
 assert.match(liquid,/product\.variants\.size >= 250 and product\.has_only_default_variant == false/);
 assert.match(liquid,/Select your options using the store's product form/);
 assert(evaluate(liquid.replace("product.variants.size >= 250","product.variants.size >= 9999")).length>0);
 assert(evaluate(liquid.replace("product.has_only_default_variant == false","product.has_only_default_variant == true")).length>0);
});

test("per-instance form/quantity/variant IDs and app billing conditional are mandatory",()=>{
 for(const after of ["'vsn-native-cart-'","'static-form-'"]){
  if(after==="'vsn-native-cart-'")continue;
  assert(evaluate(liquid.replace("'vsn-native-cart-'",after)).length>0);
 }
 assert(evaluate(liquid.replace("vsn-native-quantity-{{ block.id | escape }}","global-qty")).length>0);
 assert(evaluate(liquid.replace('"{{ app.metafields.vsn_page_builder.product_add_to_cart_enabled }}"','"true"')).length>0);
 assert(evaluate(liquid.replace('"product"','"index"')).length>0);
});

test("responsive controls and Shopify source cannot be replaced by a hand-built cart form",()=>{
 assert(evaluate(liquid,css.replace(".vsn-native-product-form{",".fake-form{")).length>0);
 assert(evaluate(liquid.replace("{% form 'product', product","<form action=\"/cart/add\" method=\"post\"")).length>0);
 assert.deepEqual(inspectNativeProductCartLiquid(undefined,null),[
  "Missing product cart Liquid and stylesheet",
 ]);
});
