// Developer-only commercial simulation. A hosting tier must NEVER infer
// permission to grant a default paid plan merely from NODE_ENV="test" or
// "development"; Cloudflare/hosted builds can have those values during QA.
// Treat any recognized hosting tier identity as authoritative over NODE_ENV.
// This does NOT replace official Shopify Partner subscription verification.
const LOCAL_TIERS=new Set(["local","dev","development"]);
const HOSTED_TIERS=new Set(["staging","stage","production","prod","live"]);
export function isLocalBillingSimulation(env=process.env){
 const node=String(env.NODE_ENV||"").trim().toLowerCase();
 if(node==="production")return false;
 const declared=String(env.APP_ENV||"").trim().toLowerCase();
 if(declared && !LOCAL_TIERS.has(declared))return false;
 const tier=String(env.VSN_DEPLOYMENT_TIER||env.VSN_RUNTIME_TIER||"").trim().toLowerCase();
 if(tier && (!LOCAL_TIERS.has(tier)||HOSTED_TIERS.has(tier)))return false;
 const worker=String(env.VSN_WORKER_NAME||"").trim().toLowerCase();
 if(worker && /(?:^|[-_])(staging|stage|production|prod|live)(?:$|[-_])/.test(worker))
  return false;
 // Explicit Local/Dev opt-in is mandatory. If APP_ENV is missing from
 // process.env (as can happen under a Worker build), never infer a local
 // merchant entitlement from NODE_ENV=test/development alone.
 return LOCAL_TIERS.has(declared);
}
