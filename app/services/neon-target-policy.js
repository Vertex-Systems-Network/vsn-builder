// Pure, credential-free identity policy for hosted migration and runtime URLs.
// Never log or return connection strings, database passwords or query parameters.
import manifest from "../../config/deployment/environments.json" with { type: "json" };

function inspect(tier, connectionString, mode) {
  const issues=[];
  const target=manifest[tier];
  if(!target || !["staging","production"].includes(tier)){
    return {issues:["Unknown hosted environment"],identity:null};
  }
  const expected=String(target.neon_endpoint_host||"").toLowerCase();
  const dot=expected.indexOf(".");
  if(dot<=0 || !/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(expected)){
    return {issues:["Expected Neon compute endpoint is missing or malformed"],identity:null};
  }
  const pooled=expected.slice(0,dot)+"-pooler"+expected.slice(dot);
  let url;
  try {url=new URL(String(connectionString||""));}
  catch {return {issues:[mode+" PostgreSQL URL malformed"],identity:null};}
  if(!["postgresql:","postgres:"].includes(url.protocol))issues.push(mode+" PostgreSQL protocol invalid");
  if(url.hostname.toLowerCase()!==expected && (mode==="direct" || url.hostname.toLowerCase()!==pooled))
    issues.push(mode+" Neon endpoint does not match "+tier);
  if(url.port && url.port!=="5432")issues.push(mode+" Neon port invalid");
  if(!url.username||!url.password)issues.push(mode+" PostgreSQL credentials incomplete");
  if(!url.pathname || url.pathname==="/")issues.push(mode+" database name missing");
  if(url.searchParams.getAll("sslmode").length!==1 ||
     url.searchParams.get("sslmode")!=="require")
    issues.push(mode+" Neon TLS must be unambiguous and required");
  if(url.hash)issues.push(mode+" URL fragment forbidden");
  if(issues.length)return {issues,identity:null};
  return {issues:[],identity:{host:url.hostname.toLowerCase(),user:url.username,database:url.pathname}};
}

/**
 * Pair policy for preflight/migrations. Exact configured database and account
 * identity are compared, without exposing the URL, token or password.
 * A pooled DATABASE_URL or direct DATABASE_URL is acceptable, while DIRECT_URL
 * must always point to the exact non-pooled target compute.
 */
export function inspectHostedNeonUrlPair(tier,env={}) {
  const database=inspect(tier,env?.DATABASE_URL,"runtime");
  const direct=inspect(tier,env?.DIRECT_URL,"direct");
  const issues=[...database.issues,...direct.issues];
  if(database.identity&&direct.identity){
    if(database.identity.database!==direct.identity.database)
      issues.push("Runtime and migration database names differ");
    if(database.identity.user!==direct.identity.user)
      issues.push("Runtime and migration database roles differ");
    if(String(env.DATABASE_URL)===String(env.DIRECT_URL))
      issues.push("Runtime and direct migration connection strings must differ");
  }
  return {ready:issues.length===0,issues,tier};
}

/** Runtime-only URL is checked separately when a Worker does not bind DIRECT_URL. */
export function inspectHostedNeonRuntimeUrl(tier,url) {
  const {issues}=inspect(tier,url,"runtime");
  return {ready:issues.length===0,issues,tier};
}
