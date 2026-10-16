// Shared, pre-SDK parser policy for Stage-only Shopify OAuth entrypoints.
// Shopify SDK still owns HMAC, state, cookies, token verification and redirects.
// Canonicalize only query SHAPE here; no custom authentication is performed.
const LOGIN_KEYS=new Set(["shop","host","embedded"]);
const CALLBACK_KEYS=new Set([
  "shop","host","hmac","timestamp","state","code","id_token","session","embedded",
]);
// Shopify callback JWTs and OAuth query strings are bounded before database
// acquisition; 8 KiB permits normal signed Shopify callback/session parameters.
const MAX_SEARCH_LENGTH=8192;
export function hasCanonicalStagingOAuthQuery(url,mode){
  const permitted=mode==="login"?LOGIN_KEYS:
    mode==="callback"?CALLBACK_KEYS:null;
  if(!permitted || !(url instanceof URL) || url.search.length>MAX_SEARCH_LENGTH)
    return false;
  // Reject duplicates across ALL parameters, not just shop: WebCrypto,
  // URLSearchParams and SDK internals may choose different occurrences.
  const seen=new Set();
  for(const [key,value] of url.searchParams){
    if(!permitted.has(key)||seen.has(key)||value.length>4096)return false;
    seen.add(key);
  }
  const shop=url.searchParams.get("shop");
  if(shop!==null && shop.length>253)return false;
  return true;
}
