// T032 Shopify theme product-form source contract.
// This is deliberately OFFLINE validation. Actual Shopify Liquid rendering,
// variant >250 catalogue behavior, cart writes and real theme QA remain open.
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const BASE="extensions/vsn-page-builder-theme";
const RULES=[
 ["Shopify product form",/{%\s*form 'product', product, id: vsn_cart_form_id,/],
 ["Unique per-block form ID",/{%\s*assign vsn_cart_form_id = 'vsn-native-cart-' \| append: block\.id\s*%}/],
 ["Shopify-generated product form close",/{%\s*endform\s*%}/],
 ["Verified product availability branch",/{%\s*if product == blank\s*%}/],
 ["Liquid 250+ variant safety fallback",/{%\s*elsif product\.variants\.size >= 250 and product\.has_only_default_variant == false\s*%}/],
 ["Default variant for one-choice product",/{%\s*assign vsn_selected_variant = product\.selected_or_first_available_variant\s*%}/],
 ["One-choice hidden variant id",/<input type="hidden" name="id" value="{{ vsn_selected_variant\.id }}">/],
 ["Variant picker condition",/{%\s*if product\.has_only_default_variant\s*%}/],
 ["Variant selector named id",/<select[\s\S]*?name="id"[\s\S]*?>/],
 ["Accessible variant label",/<label for="vsn-native-variant-{{ block\.id \| escape }}">/],
 ["Variant options enumerated",/{%\s*for variant in product\.variants\s*%}/],
 ["Explicit variant id submit",/value="{{ variant\.id }}"/],
 ["Chosen variant retained",/{%\s*if variant\.id == vsn_selected_variant\.id\s*%}selected/],
 ["Unsellable variant disabled",/{%\s*unless variant\.available\s*%}disabled/],
 ["Variant name HTML escaped",/{{ variant\.title \| escape }}/],
 ["Unique accessible quantity label",/<label for="vsn-native-quantity-{{ block\.id \| escape }}">/],
 ["Quantity submitted",/name="quantity"/],
 ["Minimum positive quantity",/min="1"/],
 ["Whole unit quantity",/step="1"/],
 ["Default quantity one",/value="1"/],
 ["Out-of-stock purchase denied",/{%\s*unless product\.available\s*%}disabled/],
 ["Merchant-configured label escaped",/{{ block\.settings\.label \| escape }}/],
 ["Theme editor attributes preserved",/{{ block\.shopify_attributes }}/],
];
export function inspectNativeProductCartLiquid(liquid,css){
 const failures=[];
 if(typeof liquid!=="string"||typeof css!=="string")return ["Missing product cart Liquid and stylesheet"];
 for(const [description,pattern] of RULES)
   if(!pattern.test(liquid))failures.push("Missing "+description);
 if((liquid.match(/{%\s*form 'product'/g)||[]).length!==1 ||
    (liquid.match(/{%\s*endform\s*%}/g)||[]).length!==1)
   failures.push("Expected one native Shopify product form");
 if(/<form\b|action=["'][^"']*cart\/add|fetch\s*\(|XMLHttpRequest/.test(liquid))
   failures.push("Manual cart request bypasses Shopify product form");
 if(!/\.vsn-native-product-form\s*\{/.test(css) ||
    !/\.vsn-native-product-form\s+select,/.test(css) ||
    !/\.vsn-native-product-form \[disabled\]/.test(css))
   failures.push("Accessible variant form styles missing");
 const schema=liquid.match(/{%\s*schema\s*%}([\s\S]+?){%\s*endschema\s*%}/);
 try{
   const parsed=JSON.parse(schema?.[1]??"undefined");
   if(parsed.name!=="Add to cart"||parsed.target!=="section" ||
      parsed.stylesheet!=="native-blocks.css" ||
      parsed.available_if!=="{{ app.metafields.vsn_page_builder.product_add_to_cart_enabled }}" ||
      !parsed.enabled_on?.templates?.includes("product"))
     failures.push("Product cart Shopify theme schema altered");
 }catch{failures.push("Invalid Shopify product cart schema")}
 return failures;
}
export function inspectNativeProductCart({root="."}={}){
 const liquid=readFileSync(resolve(root,BASE+"/blocks/native-add-to-cart.liquid"),"utf8");
 const css=readFileSync(resolve(root,BASE+"/assets/native-blocks.css"),"utf8");
 return {failures:inspectNativeProductCartLiquid(liquid,css),
   actualCartSubmissionTested:false,hostedThemeVariantTested:false};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const x=inspectNativeProductCart();
 if(x.failures.length){for(const e of x.failures)console.error("::error::T032 "+e);process.exitCode=1}
 else console.log("T032 native Shopify product variant form contract PASS. Real cart/theme acceptance NOT certified.");
}
