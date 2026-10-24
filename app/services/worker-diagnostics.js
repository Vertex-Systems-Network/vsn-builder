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
