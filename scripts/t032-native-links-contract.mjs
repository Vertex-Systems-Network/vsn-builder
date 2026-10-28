// T032 offline-only source contract. Not Shopify theme/browser acceptance.
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const BASE="extensions/vsn-page-builder-theme/blocks/";
const buttonRules=[
 ["Button URL escaped",/href="{{\s*block\.settings\.url\s*\|\s*escape\s*}}"/],
 ["Button label escaped",/{{\s*block\.settings\.text\s*\|\s*escape\s*}}/],
 ["Missing URL suppresses storefront CTA",/{%\s*if block\.settings\.url != blank\s*%}/],
 ["Empty URL hint limited to editor",/{%\s*elsif request\.design_mode\s*%}/],
 ["New-tab noopener noreferrer",/target="_blank" rel="noopener noreferrer"/],
 ["Button instance ID escaped",/data-vsn-native-instance="{{\s*block\.id\s*\|\s*escape\s*}}"/],
 ["Button Shopify editor attributes",/{{\s*block\.shopify_attributes\s*}}/],
];
export function inspectNativeLinks(button,social){
 const errors=[];
 if(typeof button!=="string"||typeof social!=="string")return ["Missing native link source"];
 for(const [description,rx] of buttonRules)
   if(!rx.test(button))errors.push(description);
 if(!/{%\s*if block\.settings\.instagram != blank or block\.settings\.facebook != blank or block\.settings\.tiktok != blank\s*%}/.test(social))
   errors.push("Empty social navigation must not render on storefront");
 for(const name of ["instagram","facebook","tiktok"]){
   const guard=new RegExp("{%\\s*if block\\.settings\\."+name+" != blank\\s*%}");
   const escaped=new RegExp("href=\"{{\\s*block\\.settings\\."+name+"\\s*\\|\\s*escape\\s*}}\"");
   if(!guard.test(social))errors.push(name+" missing individual blank check");
   if(!escaped.test(social))errors.push(name+" URL not escaped");
 }
 for(const [description,rx] of [
  ["Accessible social nav",/<nav class="vsn-native-social" aria-label="Social media">/],
  ["Closing social nav",/<\/nav>/],
  ["Social instance ID escaped",/data-vsn-native-instance="{{\s*block\.id\s*\|\s*escape\s*}}"/],
  ["Social Shopify editor attributes",/{{\s*block\.shopify_attributes\s*}}/],
  ["Social empty editor hint",/{%\s*elsif request\.design_mode\s*%}/],
 ])if(!rx.test(social))errors.push(description);
 for(const [name,source] of [["button",button],["social",social]]){
   const matches=[...source.matchAll(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/g)];
   try{
     if(matches.length!==1)throw Error("Missing schema");
     const schema=JSON.parse(matches[0][1]);
     if(schema.target!=="section"||!Array.isArray(schema.settings)||
       typeof schema.available_if!=="string"||
       !schema.available_if.startsWith("{{ app.metafields.vsn_page_builder."))
       throw Error("Invalid app-block schema");
   }catch{errors.push(name+" Shopify schema invalid or removed");}
 }
 if(/href="{{\s*block\.settings\.(?:url|instagram|facebook|tiktok)\s*}}"/.test(button+"\n"+social))
   errors.push("Unsafe raw URL interpolation");
 if(/{{\s*block\.settings\.text\s*}}/.test(button))errors.push("Unsafe raw label interpolation");
 return errors;
}
export function inspectPackagedNativeLinks({root="."}={}){
 const button=readFileSync(resolve(root,BASE+"native-button.liquid"),"utf8");
 const social=readFileSync(resolve(root,BASE+"native-social-icons.liquid"),"utf8");
 return {errors:inspectNativeLinks(button,social),hostedStorefrontVerified:false};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const report=inspectPackagedNativeLinks();
 if(report.errors.length){for(const x of report.errors)console.error("::error::T032 "+x);process.exitCode=1;}
 else console.log("T032 native link source contract PASS; hosted storefront NOT verified.");
}
