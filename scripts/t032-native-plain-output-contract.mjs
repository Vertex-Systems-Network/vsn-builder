// T032: offline Liquid markup contract only; not theme storefront execution.
// Inline_richtext/richtext are intentionally NOT blanket-escaped: Shopify
// renders their formatted markup; text/textarea/url and catalog titles are
// always escaped at their final HTML/text/URL output boundary.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
export const RULES=Object.freeze({
 "native-accordion.liquid":{plain:["heading"],rich:["text"]},
 "native-image-box.liquid":{plain:["heading"],rich:["text"]},
 "native-icon-box.liquid":{plain:["icon","heading","text"]},
 "native-trust-badges.liquid":{plain:["one","two","three"]},
 "native-banner.liquid":{plain:["button","url"],rich:["heading","text"]},
 "native-breadcrumbs.liquid":{plain:["home"]},
 "native-product-title.liquid":{plain:[]},
 "native-collection-title.liquid":{plain:[]},
 "native-product-price.liquid":{plain:["fallback"]},
 "native-announcement.liquid":{plain:[],rich:["text"]},
 "native-heading.liquid":{plain:[],rich:["text"]},
 "native-text.liquid":{plain:[],rich:["text"]},
 "native-vsn-section.liquid":{plain:[]},
 "native-collection-image.liquid":{plain:[]},
});
const PLAIN_TYPES=new Set(["text","textarea","url"]);
const RICH_TYPES=new Set(["richtext","inline_richtext"]);
const ROOT="extensions/vsn-page-builder-theme/blocks/";
const exact=(value)=>"{{ "+value+" }}";
const escaped=(value)=>"{{ "+value+" | escape }}";
export function inspectNativePlainOutputs(sources){
 const errors=[];
 for(const [name,rule] of Object.entries(RULES)){
  const source=sources?.[name];
  if(typeof source!=="string"){errors.push(name+": missing source");continue}
  const tag=source.match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/);
  let schema;
  try{schema=JSON.parse(tag?.[1]);}catch{errors.push(name+": invalid schema");continue}
  if(schema?.target!=="section" || !Array.isArray(schema.settings))
   errors.push(name+": invalid theme-block target/settings");
  const fields=new Map((schema.settings||[]).map(x=>[x.id,x.type]));
  for(const field of rule.plain){
   if(!PLAIN_TYPES.has(fields.get(field)))
    errors.push(name+": plain setting type drift "+field);
   const v="block.settings."+field;
   if(!source.includes(escaped(v))||source.includes(exact(v)))
    errors.push(name+": raw plain output "+field);
  }
  for(const field of rule.rich||[]){
   if(!RICH_TYPES.has(fields.get(field)))
    errors.push(name+": rich setting type drift "+field);
   // Preserving rich text semantics is deliberate; do not replace with
   // escaped HTML text that would display <p> tags to the shopper.
   if(!source.includes(exact("block.settings."+field)))
    errors.push(name+": rendered richtext missing "+field);
  }
  if(!source.includes(escaped("block.id")))errors.push(name+": unescaped instance ID");
  if(!source.includes(exact("block.shopify_attributes")))
    errors.push(name+": missing editor block attributes");
 }
 const special={
  "native-banner.liquid":[escaped("block.settings.url"),escaped("block.settings.button")],
  "native-breadcrumbs.liquid":[escaped("routes.root_url"),escaped("product.title"),escaped("collection.title"),escaped("page.title")],
  "native-product-title.liquid":[exact("product.title | default: block.settings.fallback | escape")],
  "native-collection-title.liquid":[exact("collection.title | default: block.settings.fallback | escape")],
 };
 for(const [name,outputs] of Object.entries(special)){
  for(const s of outputs)if(!sources?.[name]?.includes(s))
    errors.push(name+": missing protected output "+s);
 }
 return errors;
}
export function inspectPackagedNativePlainOutputs(root="."){
 const sources={};
 for(const name of Object.keys(RULES))
  sources[name]=readFileSync(resolve(root,ROOT+name),"utf8");
 return {errors:inspectNativePlainOutputs(sources),merchantThemeVerified:false};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const proof=inspectPackagedNativePlainOutputs();
 if(proof.errors.length){for(const e of proof.errors)console.error("::error::T032 "+e);process.exitCode=1;}
 else console.log("T032 static plain-output protection PASS; hosted Shopify theme E2E NOT VERIFIED.");
}
