// Non-deploying Worker-side Prisma/Neon constructor.
// Only the future certified Cloudflare runtime should import this module.
// The app's existing Local SQLite Prisma client remains untouched.
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../../generated/prisma-edge/client.ts";
import manifests from "../../config/deployment/environments.json" with { type: "json" };
import { inspectHostedNeonUrlPair } from "./neon-target-policy.js";

export function inspectWorkerNeonEnvironment(env) {
  const issues=[];
  const tier=String(env?.APP_ENV||"");
  if(!["staging","production"].includes(tier))
    return {ready:false,issues:["APP_ENV must be staging or production"],tier:null};
  const cfg=manifests[tier]||{};
  if(env?.NEON_PROJECT_ID!==cfg.neon_project_id)issues.push("Neon project identity mismatch");
  if(env?.VSN_WORKER_NAME!==cfg.cloudflare_worker)issues.push("Cloudflare Worker identity mismatch");
  if(env?.SHOPIFY_BILLING_TEST_MODE!==(tier==="staging"?"true":"false"))issues.push("Billing environment mode mismatch");
  const url=String(env?.DATABASE_URL||"");
  if(!url)issues.push("DATABASE_URL binding missing");
  else try {
    const parsed=new URL(url);
    if(!["postgres:","postgresql:"].includes(parsed.protocol))issues.push("Neon URL scheme invalid");
    if(!parsed.hostname.endsWith(".neon.tech")||parsed.hostname==="neon.tech")issues.push("Neon host invalid");
    // NEON_PROJECT_ID is a caller-supplied string; it cannot prove that the
    // DATABASE_URL actually targets this tier's project. Bind the URL to the
    // exact compute hostname recorded in the reviewed deployment manifest.
    const directHost=String(cfg.neon_endpoint_host||"").toLowerCase();
    const dot=directHost.indexOf(".");
    const pooledHost=dot>0?directHost.slice(0,dot)+"-pooler"+directHost.slice(dot):"";
    if(!directHost.startsWith("ep-")||!directHost.endsWith(".neon.tech")||dot<=0 ||
      ![directHost,pooledHost].includes(parsed.hostname.toLowerCase())) {
      issues.push("Neon endpoint identity mismatch");
    }
    // Both real Neon projects have exactly one database: "neondb".
    // Endpoint/project metadata does not pin the PostgreSQL database name:
    // another database on the SAME trusted compute could otherwise be used.
    // Never let a Worker read/write an unrelated database (e.g. Brovexa).
    // Check the literal pathname so percent-encoded aliases fail closed too.
    if(parsed.pathname!=="/neondb")
      issues.push("Builder Worker must use the canonical neondb database");
    if(parsed.port && parsed.port!=="5432")issues.push("Neon PostgreSQL port invalid");
    if(!parsed.username||!parsed.password||!parsed.pathname||parsed.pathname==="/")issues.push("Neon database credentials incomplete");
    if(parsed.searchParams.getAll("sslmode").length!==1 ||
       parsed.searchParams.get("sslmode")!=="require")
      issues.push("Neon TLS policy missing or ambiguous");
    if(parsed.hash)issues.push("Neon URL fragment forbidden");
  }catch{issues.push("Neon URL malformed")}
  // DIRECT_URL normally belongs to the migration runner, not the Worker.
  // If mistakenly bound to a Worker, fail closed rather than silently accept
  // a Production migration target in a Staging environment.
  if (env?.DIRECT_URL) {
    const identity=inspectHostedNeonUrlPair(tier,env);
    issues.push(...identity.issues);
  }
  return {ready:issues.length===0,issues,tier};
}
export function createWorkerNeonPrisma(env,{Adapter=PrismaNeon,Client=PrismaClient}={}) {
  const validation=inspectWorkerNeonEnvironment(env);
  if(!validation.ready) {
    const error=new Error("VSN Worker PostgreSQL runtime blocked: "+validation.issues.join("; "));
    error.code="VSN_WORKER_DATABASE_NOT_READY";
    throw error;
  }
  // No URLs or tokens are included in errors/logs; never cache credentials globally.
  const adapter=new Adapter({connectionString:env.DATABASE_URL});
  const db=new Client({adapter});
  return db;
}
