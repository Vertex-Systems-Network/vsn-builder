// Staging-only, redacted failure breadcrumbs for `wrangler tail`.
// Never logs request URLs, query strings, headers, tokens or connection data.
const REDACT=[
  /[a-z][a-z0-9+.-]*:\/\/\S+/gi,          // any URL / DSN
  /\b(shpat|shpss|shpca|napi)_[A-Za-z0-9_-]+/g, // Shopify / Neon tokens
  /\beyJ[A-Za-z0-9_-]{8,}\S*/g,             // JWT
  /\b[A-Za-z0-9+/_=-]{32,}\b/g,             // long opaque secrets
];
export function redactDiagnostic(value){
  let text=String(value??"").slice(0,300);
  for(const pattern of REDACT)text=text.replace(pattern,"[redacted]");
  return text.slice(0,200);
}
export function logStagingFailure(env,stage,error){
  if(env?.APP_ENV!=="staging")return;
  try{
    console.warn(JSON.stringify({
      vsn_diag:String(stage).slice(0,64),
      error:redactDiagnostic(error?.name||typeof error),
      code:redactDiagnostic(error?.code??""),
      message:redactDiagnostic(error?.message??""),
    }));
  }catch{/* diagnostics must never affect responses */}
}

// Fixed authorization outcomes are useful for diagnosing a blank embedded
// app, but must never include a shop, session, query value or database row.
export function logStagingDenial(env,reason){
  if(env?.APP_ENV!=="staging")return;
  const code=/^[a-z0-9-]{1,48}$/.test(String(reason||""))?
    String(reason):"other";
  try{console.warn(JSON.stringify({vsn_diag:"admin-denial",reason:code}))}
  catch{/* diagnostics must never affect responses */}
}

// React Router handles many loader/action errors internally and returns a 500
// instead of letting the outer Worker catch observe them. Log classification
// only: never include an error message, request URL, body, or stack trace.
export function logStagingRouteError(env,route,error){
  if(env?.APP_ENV!=="staging")return;
  const safeName=value=>typeof value==="string"&&/^[A-Za-z][A-Za-z0-9_$.-]{0,63}$/.test(value)?value:"";
  const safeCode=value=>typeof value==="string"&&(
    /^[A-Z][A-Z0-9_]{0,63}$/.test(value)||
    /^P\d{4}$/.test(value)||
    /^admin-identity-(?:error|http-\d{3}|gql-[A-Z0-9_-]{1,48})$/.test(value)
  )?value:"";
  const routeName=route==="app"||route==="app.pages"?route:"other";
  const queue=[error],seen=new Set(),gqlCodes=[],statusCandidates=[];
  while(queue.length&&seen.size<16){
    const current=queue.shift();
    if(!current||typeof current!=="object"||seen.has(current))continue;
    seen.add(current);
    if(Array.isArray(current)){
      queue.push(...current.slice(0,8));
      continue;
    }
    const code=safeCode(current?.extensions?.code);
    if(code&&gqlCodes.length<3)gqlCodes.push(code);
    statusCandidates.push(Number(current?.status),Number(current?.statusCode));
    for(const key of ["cause","originalError","error","response","body","errors","graphQLErrors"]){
      const child=current[key];
      if(child&&typeof child==="object")queue.push(child);
    }
  }
  const status=statusCandidates.find(value=>Number.isInteger(value)&&value>=400&&value<=599)||null;
  try{
    console.warn(JSON.stringify({
      vsn_diag:"route-error",route:routeName,
      error:safeName(error?.name)||"UnknownError",
      code:safeCode(error?.code)||"",
      status,
      ...(gqlCodes.length?{gqlCodes}:{}),
    }));
  }catch{/* diagnostics must never affect app responses */}
}

// Request breadcrumbs expose only fixed app/OAuth route paths and response
// metadata. Never log the signed Shopify query, redirect destination, headers,
// cookies, request body, or response body.
function isExactFrameOrigin(token,expectedOrigin){
  try{return new URL(token).origin===expectedOrigin}catch{return false}
}
export function logStagingRequest(env,request,response){
  if(env?.APP_ENV!=="staging" || !(request instanceof Request) ||
     !(response instanceof Response))return;
  try{
    const pathname=new URL(request.url).pathname;
    const appRoute=pathname==="/" || pathname==="/app" || pathname.startsWith("/app/") ||
      pathname==="/auth/login" || pathname==="/auth/callback";
    if(!appRoute && response.status<400)return;
    const csp=response.headers.get("content-security-policy")||"";
    const ancestors=csp.match(/(?:^|;)\s*frame-ancestors\s+([^;]*)/i)?.[1]||"";
    const frameTokens=ancestors.toLowerCase().split(/\s+/);
    const xfo=(response.headers.get("x-frame-options")||"").toLowerCase();
    console.warn(JSON.stringify({
      vsn_req:pathname.slice(0,128),method:request.method,status:response.status,
      ...(appRoute?{
        contentType:(response.headers.get("content-type")||"").slice(0,80),
        hasLocation:response.headers.has("location"),
        hasFrameAncestors:Boolean(ancestors),
        allowsShopifyAdminFrame:frameTokens.some(token=>token==="*"||isExactFrameOrigin(token,"https://admin.shopify.com")),
        xFrameOptions:["deny","sameorigin"].includes(xfo)?xfo:"none-or-other",
      }:{}),
    }));
  }catch{/* diagnostics never affect app responses */}
}
