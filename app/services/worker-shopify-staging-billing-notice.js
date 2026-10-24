// Pure, dependency-free rendering for the unpaid Staging billing screen.
const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const KEY=/^[a-f0-9]{32}$/i;
const CSP="default-src 'none'; script-src https://cdn.shopify.com; "+
  "style-src 'unsafe-inline'; connect-src 'self' https://*.shopify.com; "+
  "img-src 'self' data:; object-src 'none'; base-uri 'none'; "+
  "form-action 'none'; frame-ancestors https://admin.shopify.com https://*.myshopify.com";
const css=":root{color-scheme:light;font-family:system-ui,sans-serif;color:#202223;background:#f6f6f7}body{margin:0}main{max-width:760px;margin:48px auto;padding:24px}h1{font-size:28px}p{color:#61656a;line-height:1.55}.eyebrow{color:#316b11;font-size:12px;font-weight:750;letter-spacing:.06em;text-transform:uppercase}.panel{background:#fff;border:1px solid #dde0e3;border-radius:14px;padding:20px}.button{display:inline-flex;margin-top:4px;padding:11px 16px;border-radius:9px;background:#202223;color:#fff;font-size:14px;font-weight:650;text-decoration:none}.notice{font-size:13px;margin-top:18px}";
const REPLACEMENTS=Object.freeze({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" });
function htmlText(value,max=256) {
  if(typeof value!=="string" || value.length>max) throw new TypeError("Invalid merchant dashboard text");
  return value.replace(/[&<>"']/g,letter=>REPLACEMENTS[letter]);
}
export function renderStagingBillingRequired({shop,apiKey}={}) {
  if(!SHOP.test(String(shop||"")) || !KEY.test(String(apiKey||"")))
    throw new TypeError("Invalid Staging billing notice identity");
  const key=htmlText(apiKey,32);
  const markup='<!doctype html><html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="shopify-api-key" content="'+key+'">'+
    '<title>Staging billing verification unavailable · VSN Builder</title>'+
    '<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>'+
    '<style>'+css+'</style></head><body><main><div class="eyebrow">VSN | Builder · Staging</div>'+
    '<h1>Billing verification unavailable</h1>'+
    '<p>This Staging installation uses a separate internal Shopify app identity.</p>'+
    '<section class="panel"><h2>Why page data is locked</h2>'+
    '<p>Shopify’s Partner API can verify managed subscriptions only for public apps. A plan selected for this internal Staging app cannot authorize Builder page data.</p>'+
    '<p>Use a test store installed through the public VSN Builder app to test the real subscription flow.</p>'+
    '<p class="notice">This screen does not activate a plan or make a charge. No page data or edits are available in this Staging installation until billing can be verified.</p></section>'+
    '</main></body></html>';
  return new Response(markup,{status:200,headers:{
    "content-type":"text/html; charset=utf-8","cache-control":"no-store",
    "x-content-type-options":"nosniff","referrer-policy":"no-referrer",
    "content-security-policy":CSP,
  }});
}
