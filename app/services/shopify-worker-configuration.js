// Cloudflare Shopify bootstrap *configuration contract* only.
// This does NOT enable OAuth, validate Shopify sessions, or install an SDK.
import manifest from "../../config/deployment/environments.json" with { type: "json" };
import {
  SHOPIFY_API_VERSION_HANDLE,
  SHOPIFY_EXPECTED_SCOPES,
  normalizeShopifyScopes,
  isProductionHttpsUrl,
} from "../config/shopifyIntegration.js";

const equal=(a,b)=>a.length===b.length && a.every((x,i)=>x===b[i]);
const EXPECTED=normalizeShopifyScopes(SHOPIFY_EXPECTED_SCOPES);
// Read-only Shopify Admin appByKey verification: exactly ONE intended public
// Builder app, with separate internal Development/Staging app registrations.
const PUBLIC_BUILDER_CLIENT_ID="997eae5a9961f21d131e5f31bbbe31d3";
function getOrigin(value) {
  try {
    const uri=new URL(String(value||""));
    if(!isProductionHttpsUrl(uri.toString()) || uri.username || uri.password ||
       (uri.pathname!=="/" && uri.pathname!=="") || uri.search || uri.hash) return null;
    return uri.origin;
  }catch{return null}
}
export function inspectWorkerShopifyConfiguration(request, env={}) {
  const issues=[];
  const tier=String(env.APP_ENV||"");
  if(!["staging","production"].includes(tier))
    return {ready:false,tier:null,issues:["Unknown Shopify Worker tier"]};
  const target=manifest[tier];
  if(!(request instanceof Request))issues.push("Request must use Web Fetch API");
  if(env.VSN_WORKER_NAME!==target.cloudflare_worker)issues.push("Shopify Worker target mismatch");
  if(env.NEON_PROJECT_ID!==target.neon_project_id)issues.push("Shopify Worker Neon project mismatch");
  if(env.SHOPIFY_BILLING_TEST_MODE!==(tier==="staging"?"true":"false"))issues.push("Shopify billing tier mismatch");
  // Do not validate a trimmed client ID and then pass an untrimmed value to
  // Shopify's official SDK; this must be the literal reviewed 32-hex key.
  const key=String(env.SHOPIFY_API_KEY||"");
  if(!/^[0-9a-f]{32}$/i.test(key))issues.push("Shopify Client ID invalid");
  if(tier==="production" && key.toLowerCase()!==PUBLIC_BUILDER_CLIENT_ID)
    issues.push("Production must use canonical public Builder app");
  if(tier==="staging" && key.toLowerCase()===PUBLIC_BUILDER_CLIENT_ID)
    issues.push("Staging cannot use canonical public Builder app");
  if(!String(env.SHOPIFY_API_SECRET||"").trim())issues.push("Shopify secret missing");
  const publicOrigin=getOrigin(env.SHOPIFY_APP_URL);
  if(!publicOrigin)issues.push("Shopify app URL must be stable HTTPS origin");
  else if(request instanceof Request){
    try{
      const incoming=new URL(request.url);
      if(incoming.origin!==publicOrigin)
        issues.push("Incoming request origin differs from Shopify app URL");
      // An origin match alone ignores URL userinfo and fragments. Neither
      // is part of a valid Shopify OAuth, signed webhook or app request.
      // Validate BEFORE SDK and Neon request-scoped sessions are acquired.
      if(incoming.username || incoming.password || incoming.hash)
        issues.push("Incoming Shopify request has URL credentials or fragment");
    }catch{issues.push("Incoming request URL invalid")}
  }
  if(tier==="production"){
    const id=String(env.SHOPIFY_PRODUCTION_CLIENT_ID||"").trim();
    if(!id||id.toLowerCase()!==key.toLowerCase())issues.push("Production Shopify Client ID mismatch");
  }else{
    const id=String(env.SHOPIFY_PRODUCTION_CLIENT_ID||"").trim();
    if(id&&id.toLowerCase()===key.toLowerCase())issues.push("Staging cannot reuse Production Shopify Client ID");
  }
  if(!equal(normalizeShopifyScopes(env.SCOPES),EXPECTED))issues.push("Shopify scopes do not match canonical approved permissions");
  return {ready:issues.length===0,tier,issues};
}

export function createShopifyWorkerSdk(request, env, {
  createSdk,
  sessionStorage,
  distribution,
}={}) {
  const contract=inspectWorkerShopifyConfiguration(request,env);
  if(!contract.ready) {
    const error=new Error("Shopify Worker configuration blocked: "+contract.issues.join("; "));
    error.code="VSN_WORKER_SHOPIFY_NOT_READY";
    throw error;
  }
  // Session storage must come from the Worker-specific PostgreSQL Prisma Client.
  if(typeof createSdk!=="function" || !sessionStorage ||
     typeof sessionStorage.storeSession!=="function" ||
     typeof sessionStorage.loadSession!=="function") {
    throw new Error("Shopify Worker SDK or persistent session storage has not been integrated");
  }
  if(!distribution)throw new Error("Shopify Worker distribution mapping not integrated");
  const options={
    apiKey:env.SHOPIFY_API_KEY,
    apiSecretKey:env.SHOPIFY_API_SECRET,
    appUrl:new URL(env.SHOPIFY_APP_URL).origin,
    scopes:EXPECTED.slice(),
    authPathPrefix:"/auth",
    sessionStorage,
    distribution,
    apiVersion:SHOPIFY_API_VERSION_HANDLE,
    useOnlineTokens:true,
    future:{expiringOfflineAccessTokens:true},
  };
  try{return createSdk(options)}
  catch{throw new Error("Shopify Worker SDK initialization failed")}
}
