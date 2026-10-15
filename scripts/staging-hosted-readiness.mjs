import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { inspectHostedNeonRuntimeUrl } from "../app/services/neon-target-policy.js";
import { probeStagingHostedRuntime } from "./staging-hosted-http-proof.mjs";

export function assessStaging({ vars = {}, appConfig = "", worker = null, hasWranglerConfig = false, hasD1Adapter = false, hasNeonAdapter = false, hasWorkerMerchantRuntime = false, httpProof = null } = {}) {
  const checks = [];
  const check = (name, ok, reason) => checks.push({ name, ok: Boolean(ok), ...(ok ? {} : { reason }) });
  const get = (key) => String(vars[key] || "").trim();
  const apiUrl = get("SHOPIFY_APP_URL");
  const targetOrigin = (() => { try { return new URL(apiUrl).origin; } catch { return null; } })();
  const stage = get("VSN_TARGET_ENV");
  const isHttps = (value) => {
    try {
      const u = new URL(value);
      return u.protocol === "https:" && !/^(localhost|127\.0\.0\.1|example\.com)$/.test(u.hostname) &&
        !u.hostname.endsWith(".trycloudflare.com") && !u.hostname.endsWith(".ngrok-free.app");
    } catch { return false; }
  };
  check("Explicit staging target", stage === "staging", "Set VSN_TARGET_ENV=staging; never target production");
  check("HTTPS permanent staging application URL", isHttps(apiUrl), "Provide non-ephemeral HTTPS SHOPIFY_APP_URL");
  check("Shopify API key present", Boolean(get("SHOPIFY_API_KEY")), "Configure protected staging Shopify API key");
  check("Shopify API secret present", Boolean(get("SHOPIFY_API_SECRET")), "Configure protected staging Shopify API secret");
  check("Dedicated staging Shopify config", appConfig.includes("VSN | Builder (Staging)") &&
    appConfig.includes(apiUrl) && appConfig.includes("redirect_urls") &&
    appConfig.includes("/auth/callback"), "Supply Shopify staging TOML with matching OAuth callback");
  const platform = get("VSN_STAGING_PLATFORM") || "cloudflare-worker";
  check("Supported staging hosting target", ["cloudflare-worker", "node"].includes(platform), "Unknown hosting platform");
  if (platform === "cloudflare-worker") {
    check("Cloudflare staging Worker exists", worker?.exists === true, "Worker discovery unavailable or missing");
    check("Worker deployed", (worker?.deployments || 0) > 0, "No deployment evidence");
    const names = new Set(worker?.secretNames || []);
    for (const name of ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET"]) {
      check("Worker secret " + name, names.has(name), "Protected secret binding missing");
    }
    const dbProvider = get("VSN_STAGING_DATABASE_PROVIDER") || "neon-postgresql";
    check("Staging database provider explicit", ["neon-postgresql", "d1"].includes(dbProvider),
      "Only Neon PostgreSQL or D1 supported for Cloudflare Worker staging");
    if (dbProvider === "neon-postgresql") {
      check("Staging Neon project identity", get("NEON_PROJECT_ID") === "shiny-violet-61219572",
        "Use the existing isolated vsn-builder-staging Neon project");
      check("Worker Neon DATABASE_URL secret", names.has("DATABASE_URL"),
        "Bind Staging Neon PostgreSQL connection string as a protected Worker secret");
      check("Staging database URL matches isolated Neon host",
        inspectHostedNeonRuntimeUrl("staging", get("DATABASE_URL")).ready,
        "Protected staging DATABASE_URL absent or targets a different Neon host / lacks TLS");
      check("Worker Neon Prisma adapter", hasNeonAdapter,
        "Worker edge Prisma/Neon adapter and PostgreSQL client bundle not integrated");
      check("Neon default branch schema attested", get("VSN_STAGING_NEON_SCHEMA_VERIFIED") === "1",
        "Default branch has no verified migrated application schema");
      check("Neon migration ledger attested", get("VSN_STAGING_NEON_MIGRATIONS_VERIFIED") === "1",
        "Verified Prisma migration history on staging default branch required");
    } else if (dbProvider === "d1") {
      const d1 = (worker?.bindings || []).some((b) => b.type === "d1" || b.type === "d1_database");
      check("Persistent D1 database binding", d1, "No D1 relational database binding");
      check("D1-compatible Prisma client", hasD1Adapter, "D1 Prisma adapter missing");
    }
    check("Worker merchant SSR/OAuth integration", hasWorkerMerchantRuntime,
      "Existing Worker placeholder is not a Shopify React Router merchant application");
    check("Worker app build/config", hasWranglerConfig, "No Wrangler Worker application deployment config");
    check("Verified external HTTPS route", httpProof?.origin === targetOrigin &&
      httpProof?.liveness === true,
      "Public Staging /healthz must be read successfully over matching HTTPS origin");
    check("Hosted merchant readiness response", httpProof?.merchantReady === true,
      "Public Staging /readyz must attest real Shopify OAuth, merchant routes and persistent sessions");
    check("Hosted merchant /app route", httpProof?.merchantRoute === true,
      "Public Staging /app is missing, locked or lacks safe auth response");
  } else if (platform === "node") {
    check("Persistent database configured", Boolean(get("DATABASE_URL")), "Node staging DATABASE_URL missing");
    check("Persistent SQLite volume attested", get("VSN_STAGING_PERSISTENT_STORAGE_VERIFIED") === "1",
      "File-backed SQLite on a disposable host risks losing sessions and customer data");
    check("Staging host reachable", httpProof?.origin === targetOrigin && httpProof?.liveness === true,
      "App-level health endpoint must be checked from outside, not claimed by an env flag");
    check("Node merchant runtime reachable", httpProof?.merchantReady === true &&
      httpProof?.merchantRoute === true,
      "Node staging needs real /readyz and /app route evidence");
  }
  return { target: "staging", platform, checks, ready: checks.every((row) => row.ok) };
}

async function fetchWorkerEvidence() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) return null;
  const base = "https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(account) +
    "/workers/scripts/vsn-builder-staging";
  const get = async (suffix) => {
    const response = await fetch(base + suffix, {
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const value = await response.json();
    return value.success ? value.result : null;
  };
  const [settings, deployments, secrets] = await Promise.all([
    get("/settings"), get("/deployments"), get("/secrets"),
  ]);
  return {
    exists: Boolean(settings || deployments),
    deployments: deployments?.deployments?.length || 0,
    bindings: (settings?.bindings || []).map((item) => ({ type: item.type, name: item.name })),
    secretNames: (Array.isArray(secrets) ? secrets : []).map((item) => item.name),
  };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  const configPath = "shopify.app.staging.toml";
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const hasWranglerConfig = ["wrangler.staging.jsonc", "wrangler.toml", "wrangler.json", "wrangler.jsonc"].some(existsSync);
  const clientSources = ["app/db.server.js", "app/db.server.ts"].filter(existsSync).map((file) => readFileSync(file, "utf8")).join("\n");
  let worker = null;
  try { worker = await fetchWorkerEvidence(); }
  catch (error) { console.error("Cloudflare staging metadata lookup failed:", error.message); }
  const httpProof = await probeStagingHostedRuntime(process.env.SHOPIFY_APP_URL);
  const report = assessStaging({
    httpProof,
    vars: { ...process.env, VSN_TARGET_ENV: process.env.VSN_TARGET_ENV || "staging" },
    appConfig: existsSync(configPath) ? readFileSync(configPath, "utf8") : "",
    worker,
    hasWranglerConfig,
    hasD1Adapter: Boolean(pkg.dependencies?.["@prisma/adapter-d1"] || pkg.devDependencies?.["@prisma/adapter-d1"]) &&
      clientSources.includes("PrismaD1"),
    hasNeonAdapter: Boolean(pkg.dependencies?.["@prisma/adapter-neon"]) &&
      existsSync("app/services/db-worker-neon.js") && existsSync("generated/prisma-edge/client.ts"),
    hasWorkerMerchantRuntime: existsSync("workers/app.js") &&
      !readFileSync("workers/app.js", "utf8").includes("No storefront, OAuth, merchant mutations, billing, or editor routes"),
  });
  writeFileSync("staging-hosted-readiness.json", JSON.stringify({ ...report, httpProof }, null, 2) + "\n");
  for (const row of report.checks) console.log((row.ok ? "PASS" : "BLOCKED") + " " + row.name +
    (row.ok ? "" : ": " + row.reason));
  console.log("Staging hosted readiness:", report.ready ? "PASS" : "BLOCKED");
  if (process.argv.includes("--require-ready") && !report.ready) process.exitCode = 1;
}
