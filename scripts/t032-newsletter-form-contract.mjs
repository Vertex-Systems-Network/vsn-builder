// T032: source-only newsletter block contract — DOES NOT perform Shopify
// submission, theme-editor rendering, or email-consent acceptance on a store.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";

const BASE="extensions/vsn-page-builder-theme/";
const rules=[
 ["Shopify-generated customer form",/{%\s*form\s+['"]customer['"]\s*,\s*id:\s*vsn_newsletter_form_id/],
 ["Unique per-block form identifier",/{%\s*assign\s+vsn_newsletter_form_id\s*=\s*['"]vsn-native-newsletter-['"]\s*\|\s*append:\s*block\.id/],
 ["Form closes with Shopify Liquid tag",/{%\s*endform\s*%}/],
 ["Email signup field",/<input\b[^>]*type="email"[^>]*name="contact\[email\]"/s],
 ["Shopify newsletter tag",/name="contact\[tags\]"\s+value="newsletter"/],
 ["Native Shopify success signal",/{%\s*if\s+form\.posted_successfully\?\s*%}/],
 ["Shopify-managed errors",/{{\s*form\.errors\s*\|\s*default_errors\s*}}/],
 ["Semantic success message",/role="status"/],
 ["Semantic error feedback",/role="alert"/],
 ["Per-block accessible email label",/<label\b[^>]*for="vsn-native-newsletter-email-{{\s*block\.id\s*\|\s*escape\s*}}"/s],
 ["Per-block email input id",/id="vsn-native-newsletter-email-{{\s*block\.id\s*\|\s*escape\s*}}"/],
 ["Linked form error description",/aria-describedby="vsn-native-newsletter-error-{{\s*block\.id\s*\|\s*escape\s*}}"/],
 ["Customer email redisplayed with Liquid escaping",/value="{{\s*form\.email\s*\|\s*escape\s*}}"/],
 ["Escaped placeholder setting",/placeholder="{{\s*block\.settings\.placeholder\s*\|\s*escape\s*}}"/],
 ["Escaped button setting",/{{\s*block\.settings\.button\s*\|\s*escape\s*}}/],
 ["Email field autocomplete",/autocomplete="email"/],
 ["Required email submission",/<input\b[\s\S]*?\bname="contact\[email\]"[\s\S]*?\brequired\b/],
];
export function inspectNativeNewsletterLiquid(liquid,css) {
 const failures=[];
 if(typeof liquid!=="string"||typeof css!=="string")
   return ["Missing newsletter theme source and stylesheet"];
 for(const [description,pattern] of rules)
   if(!pattern.test(liquid))failures.push("Missing "+description);
 if((liquid.match(/{%\s*form\s+/g)||[]).length!==1 ||
    (liquid.match(/{%\s*endform\s*%}/g)||[]).length!==1)
   failures.push("Expected exactly one Shopify customer form");
 // Never build unlocalized /contact endpoints or bypass the customer form
 // with a plain <form> and hand-authored form_type.
 if(/<form\b|action=["'][^"']*\/contact|name=["']form_type["']/.test(liquid))
   failures.push("Untrusted manual newsletter endpoint/form");
 if(!/\.vsn-native-sr-only\s*\{/.test(css) ||
    !/\.vsn-native-form\s+\.vsn-native-form-feedback/.test(css))
   failures.push("Native accessible newsletter styles missing");
 const schema=liquid.match(/{%\s*schema\s*%}([\s\S]+?){%\s*endschema\s*%}/);
 try{
   const parsed=JSON.parse(schema?.[1]??"invalid");
   if(parsed.target!=="section"||parsed.name!=="Newsletter"||
      parsed.stylesheet!=="native-blocks.css")
     failures.push("Unexpected Newsletter Shopify extension schema");
 }catch{failures.push("Invalid Newsletter Shopify extension schema")}
 return failures;
}
export function inspectNativeNewsletter({root="."}={}){
 const liquid=readFileSync(resolve(root,BASE+"blocks/native-newsletter.liquid"),"utf8");
 const css=readFileSync(resolve(root,BASE+"assets/native-blocks.css"),"utf8");
 return {failures:inspectNativeNewsletterLiquid(liquid,css),
   hostedShopifyConsentTested:false,hostedThemeTested:false};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const result=inspectNativeNewsletter();
 if(result.failures.length){
  for(const item of result.failures)console.error("::error::T032 "+item);
  process.exitCode=1;
 } else console.log("T032 Shopify customer newsletter Liquid contract PASS; real-store testing NOT certified.");
}
