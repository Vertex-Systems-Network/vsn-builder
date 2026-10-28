import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectHostedNeonUrlPair } from "../app/services/neon-target-policy.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
const mode = process.argv.find((arg) => arg.startsWith("--environment="))?.split("=")[1] || "repository";
const modes = ["repository", "local", "staging", "production"];
// Phase 1 identity-only checks must not depend on Phase 3 PostgreSQL
// migrations or Phase 4 hosted Worker entry/deployment. The default
// Staging/Production preflight stays strict and deployment-blocking.
const identityOnly = process.argv.includes("--identity-only");
if (!modes.includes(mode) || (identityOnly && mode === "repository")) {
  console.error("Usage: node scripts/environment-contract.mjs --environment=repository|local|staging|production");
  process.exit(2);
}

const failures = [];
const assert = (ok, message) => { if (!ok) failures.push(message); };
const parseValue = (content, key) => content.match(new RegExp("^" + key + '\\s*=\\s*"([^"]*)"', "m"))?.[1] || "";
const parseBool = (content, key) => content.match(new RegExp("^" + key + '\\s*=\\s*(true|false)', "m"))?.[1] || "";
const rootConfig = read("shopify.app.toml");
const configs = {
  local: read("shopify.app.local.template.toml"),
  staging: read("shopify.app.staging.toml"),
  production: read("shopify.app.production.template.toml"),
};
const manifest = JSON.parse(read("config/deployment/environments.json"));
const clientIds = Object.fromEntries(Object.entries(configs).map(([name, value]) => [name, parseValue(value, "client_id")]));
const sourceClientId = parseValue(rootConfig, "client_id");

assert(manifest.promotion_order?.join(",") === "local,staging,production", "Promotion order must be local -> staging -> production.");
assert(manifest.local?.source_branch === "development" && manifest.staging?.source_branch === "development" && manifest.production?.source_branch === "main", "Branch-to-environment mapping is invalid.");
assert(manifest.staging?.github_environment === "cloudflare-staging" && manifest.production?.github_environment === "cloudflare-production", "Environment scopes must be isolated.");
assert(clientIds.local === "__SHOPIFY_LOCAL_CLIENT_ID__", "Tracked Local template must keep a non-deployable identity placeholder.");
assert(clientIds.staging === "__SHOPIFY_STAGING_CLIENT_ID__", "Staging tracked config must keep a non-deployable client ID placeholder.");
assert(clientIds.production === "__SHOPIFY_PRODUCTION_CLIENT_ID__", "Production template must keep a non-deployable client ID placeholder.");
for (const [tier, content] of Object.entries(configs)) {
  assert(parseValue(content, "scopes") === parseValue(rootConfig, "scopes"), tier + " Shopify access scopes drifted from the canonical app config.");
  const metaobjects = (value) => value.slice(value.indexOf("[metaobjects.app."));
  const metaPart = (value) => metaobjects(value).split("[webhooks]")[0];
  assert(metaPart(content) === metaPart(rootConfig), tier + " metaobject definitions drifted.");
  assert(content.includes('[app_proxy]') && content.includes('subpath = "vsn-builder"'), tier + " app proxy contract missing.");
  assert(content.includes('api_version = "2026-10"'), tier + " API version drifted.");
  assert(parseBool(content, "automatically_update_urls_on_dev") === (tier === "local" ? "true" : "false"), tier + " dev URL automation policy is invalid.");
}
assert(exists("shopify.app.production.template.toml"), "Production template missing.");


function required(name) {
  const value = String(process.env[name] || "").trim();
  assert(Boolean(value), name + " must be set for " + mode + ".");
  return value;
}
function isTrue(v) { return /^(1|true|yes|on)$/i.test(String(v || "")); }
function stableHttps(value) {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    const forbidden = [".example.com", ".example.org", ".example.net",
      ".example.invalid", ".invalid", ".test", ".localhost", ".local",
      ".trycloudflare.com", ".ngrok-free.app", ".ngrok.io", ".loca.lt"];
    // Identity-only preflight is the source of truth for a stable, hosted
    // Shopify callback origin; credentials, path, query and custom ports must
    // never be silently accepted as part of that origin.
    return u.protocol === "https:" && u.username === "" && u.password === "" &&
      u.port === "" && u.pathname === "/" && u.search === "" && u.hash === "" &&
      /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) &&
      !["localhost", "example.com", "example.org", "example.net"].includes(host) &&
      !forbidden.some((suffix) => host.endsWith(suffix)) &&
      !/^\d+(?:\.\d+){3}$/.test(host);
  } catch { return false; }
}

if (mode === "local") {
  assert(["", "development"].includes(String(process.env.APP_ENV || "")), "Local APP_ENV must be development.");
  assert(isTrue(required("SHOPIFY_BILLING_TEST_MODE")), "Local billing must be in test mode.");
  const url = String(process.env.DATABASE_URL || "");
  assert(!url || url.startsWith("file:"), "Local database must use SQLite; do not connect hosted databases.");
  const runtimeConfig = exists("shopify.app.local.toml") ? read("shopify.app.local.toml") : "";
  const runtimeClientId = parseValue(runtimeConfig, "client_id");
  const configuredClientId = required("SHOPIFY_API_KEY");
  assert(/^[a-f0-9]{32}$/i.test(runtimeClientId) && runtimeClientId !== sourceClientId,
    "Generated Local Shopify app config must contain a distinct Dev Client ID.");
  assert(configuredClientId === runtimeClientId, "Local SHOPIFY_API_KEY must match generated local Shopify app config.");
  required("SHOPIFY_API_SECRET");
}

if (mode === "staging" || mode === "production") {
  assert(String(process.env.APP_ENV || "") === mode, "APP_ENV must match the target environment.");
  const desiredTest = mode === "staging";
  // Reject unknown values instead of treating every non-true string as false.
  // Production must explicitly opt out of test billing; Staging must opt in.
  required("SHOPIFY_BILLING_TEST_MODE");
  assert(String(process.env.SHOPIFY_BILLING_TEST_MODE ?? "") === (desiredTest ? "true" : "false"),
    "Billing test mode must be exactly " + (desiredTest ? "true" : "false") + " for " + mode + ".");
  const clientId = required("SHOPIFY_API_KEY");
  required("SHOPIFY_API_SECRET");

  // Both identity-only and FULL hosted checks must validate the same exact
  // destination identities. A full preflight must never be weaker than the
  // Phase 1 check merely because later Worker/DB requirements are present.
  assert(required("NEON_PROJECT_ID") === manifest[mode].neon_project_id,
    mode + " Neon project identity must match exact configured tier.");
  assert(required("CLOUDFLARE_WORKER_NAME") === manifest[mode].cloudflare_worker,
    mode + " Worker identity must match exact configured tier.");

  // Match the protected GitHub workflow's three-way app isolation policy.
  // Client IDs are hex, so case must not allow aliases of the root or a
  // second environment's Shopify app. Never print any client IDs.
  const ids = {
    development: required("SHOPIFY_DEVELOPMENT_CLIENT_ID"),
    staging: required("SHOPIFY_STAGING_CLIENT_ID"),
    production: required("SHOPIFY_PRODUCTION_CLIENT_ID"),
  };
  const canonicalIds = Object.fromEntries(
    Object.entries(ids).map(([tier, id]) => [tier, id.toLowerCase()]),
  );
  for (const [tier, id] of Object.entries(ids)) {
    assert(/^[a-f0-9]{32}$/i.test(id), tier + " Shopify Client ID format is invalid.");
    assert(tier === "production" ? canonicalIds[tier] === sourceClientId.toLowerCase() : canonicalIds[tier] !== sourceClientId.toLowerCase(),
      tier === "production" ? "Production Shopify Client ID must match canonical public VSN Builder app." : tier + " Shopify Client ID reuses canonical public Live app.");
  }
  assert(new Set(Object.values(canonicalIds)).size === 3,
    "Development, Staging and Production Shopify Client IDs must be distinct.");
  assert(/^[a-f0-9]{32}$/i.test(clientId), mode + " Shopify client ID must be valid.");
  assert(clientId.toLowerCase() === canonicalIds[mode],
    mode + " SHOPIFY_API_KEY does not match scoped Shopify Client ID.");
  const localClientId = exists("shopify.app.local.toml") ?
    parseValue(read("shopify.app.local.toml"), "client_id") : "";
  assert((mode === "production" ? clientId.toLowerCase() === sourceClientId.toLowerCase() : clientId.toLowerCase() !== sourceClientId.toLowerCase()) &&
    (!localClientId || clientId.toLowerCase() !== localClientId.toLowerCase()),
    mode + " Shopify app must match its distinct verified tier identity.");

  if (mode === "production") {
    assert(!String(process.env.VSN_DEFAULT_PLAN || "").trim(),
      "Developer plan overrides cannot be set in Production.");
    assert(!isTrue(process.env.VSN_PRODUCTION_USE_CURRENT_CLIENT_ID),
      "Production may not reuse the Local app identity.");
  }
  assert(stableHttps(required("SHOPIFY_APP_URL")), "Hosted Shopify origin must be a stable HTTPS URL.");
  // Credential presence is necessary but cannot certify database identity.
  // A Staging DIRECT_URL pointed at Production is a potential destructive
  // migration, even when APP_ENV and NEON_PROJECT_ID look correct.
  const database = required("DATABASE_URL");
  const direct = required("DIRECT_URL");
  const connectionIdentity = inspectHostedNeonUrlPair(mode,{
    DATABASE_URL:database,DIRECT_URL:direct,
  });
  for(const issue of connectionIdentity.issues)
    assert(false, mode + " Neon migration target blocked: " + issue);

  // Phase 3 schema/migration and Phase 4 hosted app readiness are NOT
  // prerequisites for verifying Phase 1 credentials and tier identity.
  // Crucially, normal env:staging:check/env:production:check keep all gates.
  if (!identityOnly) {
    const schema = read("prisma/schema.prisma");
    assert(/datasource\s+db\s*\{[^}]*provider\s*=\s*"postgresql"/s.test(schema) ||
      (exists("prisma/cloud/schema.prisma") && /provider\s*=\s*"postgresql"/.test(read("prisma/cloud/schema.prisma"))),
      "PostgreSQL Prisma schema is not implemented; SQLite cannot run on Neon.");
    assert(exists("prisma/cloud/migrations/migration_lock.toml"), "Hosted PostgreSQL migrations are not implemented.");
    assert(exists("workers/app.js") && exists("wrangler." + mode + ".jsonc"),
      "Cloudflare Worker entry point and configuration are not implemented.");
  }
}

if (failures.length) {
  for (const message of failures) console.error("FAIL " + message);
  console.error("Environment " + mode + ": BLOCKED (" + failures.length + " contract violation(s)).");
  process.exitCode = 1;
} else {
  console.log("Environment " + mode + ": PASS (" +
    (identityOnly ? "Phase 1 identity/config" : "full configuration contract") +
    " only; no external identity ownership, database connectivity, Shopify authentication or deployment verified).");
}
