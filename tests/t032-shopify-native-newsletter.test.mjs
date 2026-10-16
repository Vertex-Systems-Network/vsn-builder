import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 inspectNativeNewsletter,inspectNativeNewsletterLiquid,
} from "../scripts/t032-newsletter-form-contract.mjs";

const liquid=readFileSync(
 "extensions/vsn-page-builder-theme/blocks/native-newsletter.liquid","utf8");
const css=readFileSync(
 "extensions/vsn-page-builder-theme/assets/native-blocks.css","utf8");
const failures=(text,styles=css)=>inspectNativeNewsletterLiquid(text,styles);

test("real newsletter block uses official Shopify 'customer' form and is statically auditable",()=>{
 const result=inspectNativeNewsletter();
 assert.deepEqual(result.failures,[]);
 assert.equal(result.hostedShopifyConsentTested,false);
 assert.equal(result.hostedThemeTested,false);
 const audit=failures(liquid);
 assert.deepEqual(audit,[]);
 assert(!/<form\b/.test(liquid));
 assert(!/action=["']\/contact/.test(liquid));
 assert.match(liquid,/{%\s*form 'customer'/);
 assert.match(liquid,/name="contact\[email\]"/);
 assert.match(liquid,/name="contact\[tags\]" value="newsletter"/);
});
test("custom hardcoded endpoints, incorrect customer form and missing consent fields fail",()=>{
 for(const source of [
   liquid.replace("{% form 'customer'",'{% form \'contact\''),
   liquid.replace('name="contact[email]"','name="contact[body]"'),
   liquid.replace('value="newsletter"','value="unknown"'),
   liquid.replace('{% endform %}','</form>'),
   liquid.replace("{% form 'customer'",'<form action="/contact" method="post">'),
 ]){
   assert(failures(source).length>0,"Invalid newsletter form must fail");
 }
});
test("Shopify success, errors, labels and escaped merchant settings are mandatory",()=>{
 for(const source of [
   liquid.replace("form.posted_successfully?","form.posted_successfully"),
   liquid.replace("form.errors | default_errors","form.errors"),
   liquid.replace('role="status"','class="status"'),
   liquid.replace('role="alert"','class="error"'),
   liquid.replace("block.settings.placeholder | escape","block.settings.placeholder"),
   liquid.replace("block.settings.button | escape","block.settings.button"),
   liquid.replace("form.email | escape","form.email"),
   liquid.replace("vsn-native-newsletter-email-{{ block.id | escape }}","email"),
 ]){
   assert(failures(source).length>0,"Missing accessible or safely escaped field must fail");
 }
});
test("block-scoped styles, schema and exactly one form are mandatory",()=>{
 assert(failures(liquid,css.replace(".vsn-native-sr-only{",".hidden-label{")).length>0);
 assert(failures(liquid+"\n"+liquid.slice(0,liquid.indexOf("{% schema %}"))).length>0);
 assert(failures(liquid.replace('"target": "section"','"target": "body"')).length>0);
 assert(failures(liquid.replace("{% endschema %}","")).length>0);
 assert.deepEqual(inspectNativeNewsletterLiquid(null,null),[
  "Missing newsletter theme source and stylesheet",
 ]);
});
