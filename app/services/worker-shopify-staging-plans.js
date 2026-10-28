// Staging-only, authenticated plan comparison page. Plan selection stays on
// Shopify's hosted App Pricing page; this route never activates entitlement.
import { COMMERCIAL_PLANS, PLAN_FEATURE_ROWS, PLAN_ORDER, quotaLabel } from "../config/commercialPlans.js";
import { acceptWorkerShopifyAdminRequest } from "./worker-shopify-admin-gate.js";
import { isHostedWorker } from "./worker-hosted-tier.js";

const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const KEY=/^[a-f0-9]{32}$/i;
const HANDLE=/^[a-z0-9][a-z0-9_-]{0,79}$/;
const CSP="default-src 'none'; script-src https://cdn.shopify.com; "+
  "style-src 'unsafe-inline'; connect-src 'self' https://*.shopify.com; "+
  "img-src 'self' data:; object-src 'none'; base-uri 'none'; "+
  "form-action 'none'; frame-ancestors https://admin.shopify.com https://*.myshopify.com";
const esc=value=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export function buildStagingPricingUrl(shop,appHandle) {
  if(!SHOP.test(String(shop||"")) || !HANDLE.test(String(appHandle||"")))return null;
  const store=shop.slice(0,-".myshopify.com".length);
  return `https://admin.shopify.com/store/${encodeURIComponent(store)}/charges/${encodeURIComponent(appHandle)}/pricing_plans`;
}

export function renderStagingPlanPage({shop,apiKey,appHandle}={}) {
  const pricingUrl=buildStagingPricingUrl(shop,appHandle);
  if(!pricingUrl || !KEY.test(String(apiKey||"")))
    throw new TypeError("Invalid Staging plan page identity");
  const cards=PLAN_ORDER.map(key=>{
    const plan=COMMERCIAL_PLANS[key];
    const limits=[
      `${quotaLabel(plan.maxPages)} Builder pages`,
      `${quotaLabel(plan.templateQuota)} Marketplace installs`,
      `${quotaLabel(plan.aiMonthly)} AI generations/month`,
      `${quotaLabel(plan.croExperiments)} active CRO experiments`,
      `${quotaLabel(plan.teamMembers)} team seats`,
    ];
    return '<article class="plan"><h2>'+esc(plan.name)+'</h2><p class="price">$'+
      plan.monthlyUsd+'/month'+(plan.annualUsd?' · $'+plan.annualUsd+'/year':'')+
      '</p><p class="desc">'+esc(plan.description)+'</p><p class="trial">'+
      plan.trialDays+'-day trial · Shopify confirms billing</p><ul>'+limits.map(x=>'<li>'+esc(x)+'</li>').join('')+
      '</ul><a class="button" target="_top" rel="noopener noreferrer" href="'+
      esc(pricingUrl)+'">Review in Shopify</a></article>';
  }).join('');
  const comparisonHead='<tr><th scope="col">Plan features</th>'+PLAN_ORDER.map(key=>{
    const plan=COMMERCIAL_PLANS[key];
    return '<th scope="col"><strong>'+esc(plan.name)+'</strong><br>$'+plan.monthlyUsd+'/mo'+
      (plan.annualUsd?'<br>$'+plan.annualUsd+'/yr':'')+'</th>';
  }).join('')+'</tr>';
  const comparisonRows=PLAN_FEATURE_ROWS.map(row=>'<tr><th scope="row">'+esc(row.label)+'</th>'+PLAN_ORDER.map(key=>
    '<td>'+esc(row.format(COMMERCIAL_PLANS[key][row.key]))+'</td>').join('')+'</tr>').join('');
  const comparison='<section class="comparison"><h2>Compare all 8 plans</h2><div class="matrix-scroll" role="region" aria-label="Plan comparison" tabindex="0"><table><thead>'+comparisonHead+'</thead><tbody>'+comparisonRows+'</tbody></table></div></section>';
  const back='/app?shop='+encodeURIComponent(shop);
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="shopify-api-key" content="'+esc(apiKey)+'">'+
    '<title>Plans &amp; License · VSN Builder</title>'+
    '<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>'+ 
    '<style>:root{font-family:system-ui,sans-serif;color:#202223;background:#f6f6f7}*{box-sizing:border-box}body{margin:0}main{max-width:1120px;margin:36px auto;padding:24px}.eyebrow{color:#35633b;font-size:12px;font-weight:750;letter-spacing:.07em;text-transform:uppercase}h1{font-size:32px;margin:10px 0}p{line-height:1.55;color:#61656a}.intro{max-width:760px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:26px}.plan{display:flex;flex-direction:column;background:#fff;border:1px solid #dfe3e6;border-radius:14px;padding:20px}.plan h2{margin:0}.price{font-size:21px;font-weight:700;color:#202223;margin:10px 0}.desc{min-height:68px}.trial{font-size:13px}.plan ul{padding-left:20px;line-height:1.9;flex:1}.button{display:inline-block;text-align:center;padding:12px 14px;border-radius:9px;background:#202223;color:#fff;font-weight:650;text-decoration:none}.button:hover{background:#3b3d3f}.back{display:inline-block;margin-bottom:20px;color:#164b84}.notice{font-size:13px;margin-top:24px}.comparison{margin-top:32px}.matrix-scroll{overflow:auto;border:1px solid #dfe3e6;border-radius:10px;background:#fff}.matrix-scroll table{width:100%;min-width:1450px;border-collapse:collapse;font-size:13px}.matrix-scroll th,.matrix-scroll td{padding:12px;border-bottom:1px solid #e1e3e5;border-right:1px solid #e1e3e5;text-align:center}.matrix-scroll thead th{position:sticky;top:0;background:#f6f6f7}.matrix-scroll th:first-child{position:sticky;left:0;z-index:1;min-width:220px;text-align:left;background:#f6f6f7}.matrix-scroll tbody th:first-child{background:#fff}.matrix-scroll tr>*:last-child{border-right:0}.matrix-scroll tbody tr:last-child>*{border-bottom:0}</style></head><body><main><a class="back" href="'+back+'">← Back to Builder</a><div class="eyebrow">VSN | Builder · Staging</div><h1>Plans &amp; License</h1><p class="intro">Choose one of 8 paid plans. Every plan includes the complete widget library and a 10-day Shopify-managed trial; capacities and team systems differ by plan. Shopify handles plan approval and billing.</p><section class="grid" aria-label="Available plans">'+cards+'</section>'+comparison+'<p class="notice">Plan access turns on only after Shopify verifies the subscription. Staging plan selection uses Shopify test billing.</p></main></body></html>';
  return new Response(html,{status:200,headers:{
    "content-type":"text/html; charset=utf-8","cache-control":"no-store",
    "x-content-type-options":"nosniff","referrer-policy":"no-referrer",
    "content-security-policy":CSP,
  }});
}

export function handleVerifiedStagingPlanPage(request,env,{createSdkContext}={}) {
  if(!(request instanceof Request) || !isHostedWorker(env) ||
     env?.VSN_STAGING_DASHBOARD_ENABLED!=="true")
    return new Response(null,{status:503,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
  const url=new URL(request.url);
  if(url.pathname!=="/app/plans" || request.method!=="GET" || url.hash)
    return new Response(null,{status:404,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
  return acceptWorkerShopifyAdminRequest(request,env,{
    ...(createSdkContext?{createSdkContext}:{}),
    onAuthenticated:async({shop})=>renderStagingPlanPage({
      shop,apiKey:env.SHOPIFY_API_KEY,appHandle:env.SHOPIFY_APP_HANDLE,
    }),
  });
}
