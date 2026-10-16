import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {RULES,inspectNativePlainOutputs,inspectPackagedNativePlainOutputs}
 from "../scripts/t032-native-plain-output-contract.mjs";
const base="extensions/vsn-page-builder-theme/blocks/";
const sources=()=>Object.fromEntries(Object.keys(RULES)
 .map(name=>[name,readFileSync(base+name,"utf8")]));
test("14 native block sources escape plain text, catalog titles, links and instance IDs",()=>{
 const result=inspectPackagedNativePlainOutputs();
 assert.deepEqual(result.errors,[]);
 assert.equal(result.merchantThemeVerified,false);
});
test("every plain-text setting downgrade is independently detected",()=>{
 const originals=sources();
 for(const [name,rule] of Object.entries(RULES)){
  for(const field of rule.plain){
   const old="{{ block.settings."+field+" | escape }}";
   const raw="{{ block.settings."+field+" }}";
   assert(originals[name].includes(old),name+"."+field);
   const next={...originals,[name]:originals[name].replace(old,raw)};
   assert(inspectNativePlainOutputs(next).length>0,name+"."+field);
  }
 }
});
test("Shopify richtext and inline_richtext retain merchant formatting, not escaped HTML",()=>{
 const original=sources();
 for(const [name,rule] of Object.entries(RULES)){
  for(const field of rule.rich||[]){
   const raw="{{ block.settings."+field+" }}";
   assert(original[name].includes(raw));
   assert(inspectNativePlainOutputs({...original,
    [name]:original[name].replace(raw,"{{ block.settings."+field+" | escape }}")}).length>0,
     name+"."+field);
  }
 }
});
test("escaped breadcrumb catalog metadata and title fallbacks cannot regress",()=>{
 const original=sources();
 for(const [name,oldValue,replacement] of [
  ["native-breadcrumbs.liquid","{{ routes.root_url | escape }}","{{ routes.root_url }}"],
  ["native-breadcrumbs.liquid","{{ product.title | escape }}","{{ product.title }}"],
  ["native-breadcrumbs.liquid","{{ collection.title | escape }}","{{ collection.title }}"],
  ["native-breadcrumbs.liquid","{{ page.title | escape }}","{{ page.title }}"],
  ["native-product-title.liquid","{{ product.title | default: block.settings.fallback | escape }}","{{ product.title | default: block.settings.fallback }}"],
  ["native-collection-title.liquid","{{ collection.title | default: block.settings.fallback | escape }}","{{ collection.title | default: block.settings.fallback }}"]
 ]){
  assert(original[name].includes(oldValue),name+" "+oldValue);
  assert(inspectNativePlainOutputs({...original,[name]:original[name].replace(oldValue,replacement)}).length>0);
 }
});
test("editor attrs, block IDs and schema type drift are fail-closed",()=>{
 const original=sources();
 for(const name of Object.keys(RULES)){
  const source=original[name];
  assert(source.includes("{{ block.shopify_attributes }}"),name);
  assert(inspectNativePlainOutputs({...original,
    [name]:source.replace("{{ block.shopify_attributes }}","")}).length>0,name);
  assert(inspectNativePlainOutputs({...original,
    [name]:source.replace("{{ block.id | escape }}","{{ block.id }}")}).length>0,name);
 }
 const source=original["native-icon-box.liquid"];
 const changed=source.replace('"type": "textarea"','"type": "richtext"');
 assert.notEqual(changed,source);
 assert(inspectNativePlainOutputs({...original,["native-icon-box.liquid"]:changed}).length>0);
});
