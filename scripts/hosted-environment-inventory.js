// Pure credential inventory validation: never echo or return supplied values.
// This script only checks syntax/identity; it makes no network or database calls.
export function hostedEnvironmentInventory(env, target) {
  const errors = [];
  const fail=(label)=>errors.push(label);
  if (!["staging","production"].includes(target)) {
    return {ok:false,errors:["Unrecognized environment target"]};
  }
  if (env.APP_ENV !== target) fail("APP_ENV must match target");
  const expectedBilling=target==="staging"?"true":"false";
  if (String(env.SHOPIFY_BILLING_TEST_MODE||"").toLowerCase()!==expectedBilling) fail("SHOPIFY_BILLING_TEST_MODE mismatches target");
  const required=["SHOPIFY_API_KEY","SHOPIFY_API_SECRET","SHOPIFY_APP_URL","DATABASE_URL","DIRECT_URL","CLOUDFLARE_ACCOUNT_ID","CLOUDFLARE_API_TOKEN"];
  if (target==="production") required.push("SHOPIFY_PRODUCTION_CLIENT_ID");
  for(const name of required)if(!String(env[name]||"").trim())fail(name+" is missing");
  const key=String(env.SHOPIFY_API_KEY||"").trim();
  if(key&&!/^[a-f0-9]{32}$/i.test(key))fail("SHOPIFY_API_KEY format invalid");
  if(key==="997eae5a9961f21d131e5f31bbbe31d3")fail("Unclassified Shopify identity cannot be used");
  const prodId=String(env.SHOPIFY_PRODUCTION_CLIENT_ID||"").trim();
  if(target==="production"&&prodId&&key!==prodId)fail("Production Shopify identity mismatch");
  if(target==="staging"&&prodId&&key===prodId)fail("Staging and Production Shopify identity must differ");
  if(String(env.CLOUDFLARE_ACCOUNT_ID||"").trim() && !/^[a-f0-9]{32}$/i.test(String(env.CLOUDFLARE_ACCOUNT_ID).trim())) fail("CLOUDFLARE_ACCOUNT_ID format invalid");
  const expectedWorker=target==="staging"?"vsn-builder-staging":"vsn-builder-production";
  if(env.CLOUDFLARE_WORKER_NAME && env.CLOUDFLARE_WORKER_NAME!==expectedWorker)fail("Wrong Cloudflare Worker target");
  const host=String(env.SHOPIFY_APP_URL||"").trim();
  if(host)try{
    const u=new URL(host);
    if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/"||u.search||u.hash||!u.hostname||u.hostname==="localhost"||u.hostname==="example.com"||u.hostname.endsWith(".example.invalid")||u.hostname.endsWith(".example.com")||/\.trycloudflare\.com$|\.ngrok\.io$/.test(u.hostname))
       fail("SHOPIFY_APP_URL must be a stable HTTPS origin");
  }catch{fail("SHOPIFY_APP_URL must be a valid URL")}
  const db=String(env.DATABASE_URL||"").trim(),direct=String(env.DIRECT_URL||"").trim();
  for(const [label,value] of [["DATABASE_URL",db],["DIRECT_URL",direct]])if(value)try{
    const parsed=new URL(value);
    if(!["postgres:","postgresql:"].includes(parsed.protocol)||!parsed.hostname||!parsed.pathname||parsed.pathname==="/")fail(label+" must be a PostgreSQL database URL");
  }catch{fail(label+" must be a valid PostgreSQL URL")}
  if(db&&direct&&db===direct)fail("DATABASE_URL and DIRECT_URL must be distinct connection endpoints");
  // Never log or include the input object, database hostname, URL, client ID or token.
  return {ok:errors.length===0,errors};
}
