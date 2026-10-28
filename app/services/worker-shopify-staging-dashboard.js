// A REAL read-only Shopify App Bridge page for the verified Staging Worker.
// Deliberately NOT a full React Router editor and never enabled for Live.
// The official SDK and persisted Neon session authorize the shell. Merchant
// page data still requires a verified paid plan and pages/view RBAC. An
// unpaid Staging store receives only a no-data billing notice.
import { acceptWorkerShopifyAdminRequest } from "./worker-shopify-admin-gate.js";
import { decorateVerifiedStagingEditorUi } from "./worker-shopify-staging-editor-html.js";

const PAGE=/^[a-zA-Z0-9_-]{1,64}$/;
const CSP="default-src 'none'; script-src https://cdn.shopify.com; "+
  "style-src 'unsafe-inline'; connect-src 'self' https://*.shopify.com; "+
  "img-src 'self' data:; object-src 'none'; base-uri 'none'; "+
  "form-action 'none'; frame-ancestors https://admin.shopify.com https://*.myshopify.com";
import { renderStagingBillingRequired } from "./worker-shopify-staging-billing-notice.js";
import { buildStagingPricingUrl } from "./worker-shopify-staging-plans.js";
import { isHostedWorker } from "./worker-hosted-tier.js";
export { renderStagingBillingRequired };

const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const KEY=/^[a-f0-9]{32}$/i;
const REPLACEMENTS=Object.freeze({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;",
});
function htmlText(value,max=256) {
  if(typeof value!=="string" || value.length>max)
    throw new TypeError("Invalid merchant dashboard text");
  return value.replace(/[&<>"']/g,letter=>REPLACEMENTS[letter]);
}
function restricted(status=503) {
  return new Response(null,{status,headers:{
    "cache-control":"no-store","x-content-type-options":"nosniff",
  }});
}
function validCount(count) {
  return Number.isSafeInteger(count)&&count>=0;
}
const css=[
  ":root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;color:#202223;background:#f6f6f7}",
  "*{box-sizing:border-box}body{margin:0}",
  "main{max-width:1090px;margin:0 auto;padding:36px 24px 52px}",
  "h1{font-size:28px;letter-spacing:-.03em;margin:0 0 10px}",
  "h2{font-size:17px;margin:0 0 16px}",
  "p{color:#61656a;line-height:1.55}",
  ".eyebrow{color:#316b11;font-size:12px;font-weight:750;letter-spacing:.06em;text-transform:uppercase}",
  ".muted{margin-top:0}",
  ".cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin:28px 0}",
  ".card,.panel{background:#fff;border:1px solid #dde0e3;border-radius:14px;padding:20px;box-shadow:0 1px 2px #00000009}",
  ".count{font-size:32px;font-weight:750;line-height:1.5;font-variant-numeric:tabular-nums}",
  ".label{font-size:13px;color:#61656a}",
  ".panel{margin-top:12px}",
  "ul{list-style:none;padding:0;margin:0}",
  "li{display:flex;justify-content:space-between;align-items:center;gap:18px;border-top:1px solid #ededed;padding:14px 0}",
  "li:first-child{border-top:0}",
  ".button{display:inline-flex;align-items:center;justify-content:center;margin-top:4px;padding:11px 16px;border-radius:9px;background:#202223;color:#fff;font-size:14px;font-weight:650;text-decoration:none}",
  ".button:hover{background:#3b3d3f}",
  ".row-title{font-weight:650;overflow-wrap:anywhere}",
  "a.row-title{color:#164b84;text-decoration:underline;text-underline-offset:3px}",
  ".row-meta{font-size:13px;color:#61656a;margin-top:4px;overflow-wrap:anywhere}",
  ".status{font-size:12px;background:#e9f5eb;color:#206b36;padding:6px 10px;border-radius:20px;white-space:nowrap}",
  ".notice{font-size:13px;margin-top:18px}",
  "@media(max-width:550px){main{padding:24px 16px}li{align-items:start;flex-direction:column}}",
].join("");

export function renderVerifiedStagingMerchantDashboard({shop,apiKey,summary}={}) {
  if(!SHOP.test(String(shop||""))||!KEY.test(String(apiKey||""))||
     !summary || !validCount(summary.total)||!validCount(summary.draft)||
     !validCount(summary.published)||summary.draft>summary.total||
     summary.published>summary.total||
     summary.draft+summary.published>summary.total||
     !Array.isArray(summary.recent)||summary.recent.length>5)
    throw new TypeError("Invalid verified Shopify merchant dashboard");
  const shopQuery=encodeURIComponent(shop);
  const rows=summary.recent.map(row=>{
    if(!PAGE.test(String(row?.id||"")) ||
       typeof row?.updatedAt!=="string" ||
       !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.updatedAt) ||
       !Number.isFinite(Date.parse(row.updatedAt)))
      throw new TypeError("Invalid verified dashboard page row");
    const title=htmlText(row.title,256);
    const template=htmlText(row.template,120);
    const status=htmlText(row.status,40);
    return '<li><div><a class="row-title" href="/app/__vsn/pages/'+row.id+
      '/view?shop='+shopQuery+'">'+title+
      '</a><div class="row-meta">'+template+' · '+htmlText(row.updatedAt.slice(0,10),10)+
      '</div></div><span class="status">'+status+"</span></li>";
  }).join("");
  const key=htmlText(apiKey,32);
  const host=htmlText(shop,250);
  const plansUrl='/app/plans?shop='+shopQuery;
  const pageRows=rows||'<li><div><div class="row-title">No pages yet</div>'+
    '<div class="row-meta">New pages will appear here after verified editor integration.</div></div></li>';
  const markup='<!doctype html><html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="shopify-api-key" content="'+key+'">'+
    '<title>VSN | Builder (Staging)</title>'+
    '<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>'+
    '<style>'+css+'</style></head><body>'+
    '<main><div class="eyebrow">VSN | Builder · Staging preview</div>'+
    '<h1>Builder overview</h1><p class="muted">Read-only pages from your verified store: '+
    host+'</p><p><a href="'+plansUrl+'">Plans &amp; License</a></p><section class="cards" aria-label="Page counts">'+
    '<div class="card"><div class="label">Total pages</div><div class="count">'+summary.total+'</div></div>'+
    '<div class="card"><div class="label">Drafts</div><div class="count">'+summary.draft+'</div></div>'+
    '<div class="card"><div class="label">Published</div><div class="count">'+summary.published+'</div></div>'+
    '</section><section class="panel" aria-label="Recent pages"><h2>Recent pages</h2><ul>'+
    pageRows+'</ul></section>'+
    '<p class="notice">This is a limited Staging dashboard. Editing, billing actions, storefront publication '+
    'and Live release remain disabled until the full hosted application passes acceptance.</p>'+
    '</main></body></html>';
  return new Response(markup,{status:200,headers:{
    "content-type":"text/html; charset=utf-8",
    "cache-control":"no-store","x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer",
    "content-security-policy":CSP,
  }});
}

// This handler is ONLY called by the Worker on GET /app. Dependency injection
// is a test seam; untrusted HTTP cannot supply a Shopify SDK context.
export function handleVerifiedStagingMerchantDashboard(request,env,{
  createSdkContext,
}={}) {
  if(!(request instanceof Request) ||
     !isHostedWorker(env) ||
     env?.VSN_STAGING_DASHBOARD_ENABLED!=="true")return restricted();
  const url=new URL(request.url);
  if(url.pathname!=="/app" || request.method!=="GET")return restricted();
  // Shopify's first embedded launch carries signed App Bridge parameters in
  // addition to shop. Keep them intact for authenticate.admin(); the shared
  // admin gate rejects duplicate keys and the SDK validates authentication.
  return acceptWorkerShopifyAdminRequest(request,env,{
    ...(createSdkContext?{createSdkContext}:{}),
    enablePageSummary:true,
    requireVerifiedPaidRead:true,
    requirePageViewPermission:true,
    syncVerifiedPaidRead:true,
    onUnverifiedPaidRead:({shop,billingCode})=>renderStagingBillingRequired({
      shop,apiKey:env.SHOPIFY_API_KEY,billingCode,
      pricingUrl:buildStagingPricingUrl(shop,env.SHOPIFY_APP_HANDLE),
    }),
    onAuthenticated:async({shop,pageSummary})=>{
      const summary=await pageSummary();
      const html=renderVerifiedStagingMerchantDashboard({
        shop,apiKey:env.SHOPIFY_API_KEY,summary,
      });
      return env.VSN_STAGING_DRAFT_SAVE_ENABLED==="true"?
        decorateVerifiedStagingEditorUi(html,{shop}):html;
    },
  });
}


// Read-only per-page inspection: reuses the exact metadata + bounded editor
// hydration leases. This is NOT a storefront preview or an editing surface.
export function renderVerifiedStagingPageInspection({
  shop,apiKey,metadata,content,
}={}) {
  if(!SHOP.test(String(shop||"")) || !KEY.test(String(apiKey||"")) ||
     !metadata || !content || !PAGE.test(String(metadata.id||"")) ||
     metadata.id!==content.id ||
     !Number.isSafeInteger(metadata.version) || metadata.version<1 ||
     metadata.version!==content.version ||
     !Array.isArray(content.elements) || content.elements.length>5000 ||
     typeof content.updatedAt!=="string" ||
     typeof metadata.updatedAt!=="string")
    throw new TypeError("Invalid verified page inspection records");
  const safeTime=value=>{
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
       !Number.isFinite(Date.parse(value)))
      throw new TypeError("Invalid page inspection date");
    return htmlText(value.slice(0,10),10);
  };
  const modified=safeTime(content.updatedAt);
  safeTime(metadata.updatedAt);
  const title=htmlText(metadata.title,256);
  const handle=htmlText(metadata.handle,256);
  const template=htmlText(metadata.template,120);
  const status=htmlText(metadata.status,40);
  const nodeRows=content.elements.slice(0,30).map((node,index)=>{
    if(!node || typeof node!=="object" || Array.isArray(node))
      throw new TypeError("Invalid page inspection node");
    const type=typeof node.type==="string" && node.type.length<=80?
      htmlText(node.type,80):"Component";
    const plain=typeof node.props?.text==="string"?
      htmlText(node.props.text.slice(0,280),280):"";
    return '<li><div><div class="row-title">Block '+(index+1)+
      ': '+type+'</div>'+(plain?'<div class="row-meta">'+plain+'</div>':"")+
      '</div></li>';
  }).join("");
  const blocks=nodeRows||'<li><div class="row-meta">This draft has no saved blocks.</div></li>';
  const markup='<!doctype html><html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="shopify-api-key" content="'+htmlText(apiKey,32)+'">'+
    '<title>Page details · VSN | Builder (Staging)</title>'+
    '<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>'+
    '<style>'+css+'</style></head><body><main>'+
    '<p><a href="/app?shop='+encodeURIComponent(shop)+'">← Back to overview</a></p>'+
    '<div class="eyebrow">Read-only Staging page inspector</div>'+
    '<h1>'+title+'</h1><p class="muted">Page handle: '+handle+
    ' · Template: '+template+' · Status: '+status+'</p>'+
    '<section class="cards" aria-label="Page information">'+
    '<div class="card"><div class="label">Saved version</div><div class="count">'+metadata.version+'</div></div>'+
    '<div class="card"><div class="label">Top-level blocks</div><div class="count">'+content.elements.length+'</div></div>'+
    '<div class="card"><div class="label">Last updated</div><div class="row-title">'+modified+'</div></div></section>'+
    '<section class="panel"><h2>Saved draft block outline</h2><ul>'+blocks+
    '</ul></section><p class="notice">Read-only inspection. This is not a live storefront preview. '+
    'Editing and publishing remain disabled pending hosted merchant acceptance.</p>'+
    '</main></body></html>';
  return new Response(markup,{status:200,headers:{
    "content-type":"text/html; charset=utf-8",
    "cache-control":"no-store","x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer",
    "content-security-policy":CSP,
  }});
}

// Only GET /app/__vsn/pages/:id/view from the verified Stage Worker.
// Both page capabilities automatically enforce Partner-paid and staff-view
// authority inside the official Shopify SDK merchant authentication gate.
export function handleVerifiedStagingPageInspection(request,env,{
  createSdkContext,
}={}) {
  if(!(request instanceof Request) || !isHostedWorker(env) ||
     env?.VSN_STAGING_DASHBOARD_ENABLED!=="true")
    return restricted();
  const url=new URL(request.url);
  const path=/^\/app\/__vsn\/pages\/([a-zA-Z0-9_-]{1,64})\/view$/.exec(url.pathname);
  if(!path || request.method!=="GET")return restricted();
  if([...url.searchParams.keys()].some(key=>key!=="shop") ||
     url.searchParams.getAll("shop").length>1)return restricted(404);
  const pageId=path[1];
  return acceptWorkerShopifyAdminRequest(request,env,{
    ...(createSdkContext?{createSdkContext}:{}),
    enablePageMetadata:true,enablePageContent:true,
    requireVerifiedPaidRead:true,requirePageViewPermission:true,
    onAuthenticated:async({shop,pageMetadata,pageContent})=>{
      const metadata=await pageMetadata(pageId);
      if(metadata===null)return restricted(404);
      const content=await pageContent(pageId);
      if(content===null)return restricted(404);
      const html=renderVerifiedStagingPageInspection({
        shop,apiKey:env.SHOPIFY_API_KEY,metadata,content,
      });
      return env.VSN_STAGING_DRAFT_SAVE_ENABLED==="true"?
        decorateVerifiedStagingEditorUi(html,{shop,pageId}):html;
    },
  });
}
