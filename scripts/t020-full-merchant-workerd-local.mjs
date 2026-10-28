// CI-only actual Cloudflare Workerd module-evaluation test.
// This loads the full Builder React Router ServerBuild but never executes
// merchant routes or reaches Shopify, Neon, Cloudflare APIs or Live.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
assert.equal(process.env.CI, "true", "isolated GitHub CI only");
for (const key of ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET",
  "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "DIRECT_URL"]) {
  assert(!process.env[key], "real service identity must not be available: " + key);
}
assert(!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:"),
  "No remote database connection is permitted in this probe");
const port = 8791;
const origin = "http://127.0.0.1:" + port;
const forbidden = ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET", "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID", "DATABASE_URL", "DIRECT_URL"];
const isolatedEnv = { ...process.env, CI:"true", BROWSER:"none",
  WRANGLER_SEND_METRICS:"false" };
for (const key of forbidden) isolatedEnv[key] = "";
let log = "";
const child = spawn("npm", ["exec", "--yes", "--package=wrangler@4.149.0",
  "--", "wrangler", "dev", "--config", "wrangler.full-merchant-graph-ci.jsonc",
  "--local", "--ip", "127.0.0.1", "--port", String(port)], {
  cwd:root, env:isolatedEnv, detached:true, stdio:["ignore","pipe","pipe"],
});
for (const stream of [child.stdout,child.stderr]) stream.on("data", chunk => {
  log = (log + chunk.toString()).slice(-5000);
});
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
const scrub = value => String(value||"")
  .replace(/(?:secret|token|password|DATABASE_URL)\s*[:=]\s*\S+/gi,"[redacted]")
  .slice(-1800);
const get = async path => fetch(origin + path, {
  redirect:"manual",signal:AbortSignal.timeout(4000),
});
const stop = async () => {
  const signal = type => { try { process.kill(-child.pid,type); }
    catch { try { child.kill(type); } catch {} } };
  signal("SIGTERM");
  if(child.exitCode===null && child.signalCode===null)
    await Promise.race([new Promise(done=>child.once("exit",done)),sleep(2500)]);
  signal("SIGKILL");
};
try {
  let reachable = false;
  for(let attempt=0;attempt<110;attempt++) {
    if(child.exitCode!==null) throw Error("Worker process exited; " + scrub(log));
    try { const r = await get("/app");
      if(r.status===503){ reachable=true; break; }
    } catch {}
    await sleep(300);
  }
  assert(reachable,"Full merchant local Workerd never started: "+scrub(log));
  const result=await get("/__vsn/full-merchant-module-proof");
  if(result.status!==200) {
    let reason="WORKER_REQUEST_NOT_READY";
    let diagnostic="";
    let ciFrames="";
    try {
      const response = await result.json();
      if(response?.ciOnly===true && typeof response.ciCause==="string")
        diagnostic = response.ciCause.slice(0, 180);
      if(response?.ciOnly===true && Array.isArray(response.ciFrames))
        ciFrames = response.ciFrames.filter(x=>typeof x==="string")
          .slice(0,4).map(x=>x.slice(0,140)).join(" | ");
      const categories = new Set([
        "SHOPIFY_APP_BOOTSTRAP_CONFIGURATION",
        "DATABASE_CLIENT_RUNTIME_INITIALIZATION",
        "NODE_MODULE_RUNTIME_COMPATIBILITY",
        "MERCHANT_SERVER_MODULE_EVALUATION",
        "REACT_ROUTER_SERVER_BUILD_EXPORTS",
      ]);
      if(response?.ciOnly===true && categories.has(response.blocked))
        reason=response.blocked;
    } catch {}
    throw Error("Full merchant ServerBuild runtime import blocked: "+reason+
      ", HTTP "+result.status+(diagnostic ? ", sanitized cause: "+diagnostic : "")+
      (ciFrames ? ", frames: "+ciFrames : ""));
  }
  const proof=await result.json();
  assert.deepEqual(proof,{ciOnly:true,fullMerchantModuleEvaluated:true,
    routeManifestPresent:true});
  assert.equal(result.headers.get("cache-control"),"no-store");
  for(const route of ["/app","/app/pages","/auth/callback","/readyz",
    "/__vsn/full-merchant-module-proof?shop=evil"]) {
    assert.equal((await get(route)).status,503,route+" cannot be exposed");
  }
  assert.equal((await fetch(origin+"/__vsn/full-merchant-module-proof",
    {method:"POST",signal:AbortSignal.timeout(4000)})).status,503);
  console.log("PASS: full production merchant ServerBuild evaluated by LOCAL Workerd only");
  console.log("PASS: all Shopify/auth/billing/merchant routes remain HTTP 503");
} catch (error) {
  console.error("T020 actual merchant Workerd evaluation FAILED: "+
    scrub(error?.message||error));
  process.exitCode = 1;
} finally { await stop(); }
