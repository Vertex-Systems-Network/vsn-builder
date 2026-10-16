// A REAL read-only Shopify App Bridge page for the verified Staging Worker.
// Deliberately NOT a full React Router editor and never enabled for Live.
// The official SDK, persisted Neon session, verified paid plan and pages/view
// RBAC must all authorize the request before any merchant data is rendered.
import { acceptWorkerShopifyAdminRequest } from "./worker-shopify-admin-gate.js";

const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const PAGE=/^[a-zA-Z0-9_-]{1,64}$/;
const KEY=/^[a-f0-9]{32}$/i;
const CSP="default-src 'none'; script-src https://cdn.shopify.com; "+
  "style-src 'unsafe-inline'; connect-src 'self' https://*.shopify.com; "+
  "img-src 'self' data:; object-src 'none'; base-uri 'none'; "+
  "form-action 'none'; frame-ancestors https://admin.shopify.com https://*.myshopify.com";
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
  ".row-title{font-weight:650;overflow-wrap:anywhere}",
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
  const rows=summary.recent.map(row=>{
    if(!PAGE.test(String(row?.id||"")) ||
       typeof row?.updatedAt!=="string" ||
       !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.updatedAt) ||
       !Number.isFinite(Date.parse(row.updatedAt)))
      throw new TypeError("Invalid verified dashboard page row");
    const title=htmlText(row.title,256);
    const template=htmlText(row.template,120);
    const status=htmlText(row.status,40);
    return '<li><div><div class="row-title">'+title+
      '</div><div class="row-meta">'+template+' · '+htmlText(row.updatedAt.slice(0,10),10)+
      '</div></div><span class="status">'+status+"</span></li>";
  }).join("");
  const key=htmlText(apiKey,32);
  const host=htmlText(shop,250);
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
    host+'</p><section class="cards" aria-label="Page counts">'+
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
     env?.APP_ENV!=="staging" ||
     env?.VSN_WORKER_NAME!=="vsn-builder-staging" ||
     env?.VSN_STAGING_DASHBOARD_ENABLED!=="true")return restricted();
  const url=new URL(request.url);
  if(url.pathname!=="/app" || request.method!=="GET")return restricted();
  return acceptWorkerShopifyAdminRequest(request,env,{
    ...(createSdkContext?{createSdkContext}:{}),
    enablePageSummary:true,
    requireVerifiedPaidRead:true,
    requirePageViewPermission:true,
    onAuthenticated:async({shop,pageSummary})=>{
      const summary=await pageSummary();
      return renderVerifiedStagingMerchantDashboard({
        shop,apiKey:env.SHOPIFY_API_KEY,summary,
      });
    },
  });
}
