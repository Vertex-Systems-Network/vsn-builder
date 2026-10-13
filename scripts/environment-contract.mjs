import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectHostedNeonUrlPair } from "../app/services/neon-target-policy.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
const mode = process.argv.find((arg) => arg.startsWith("--environment="))?.split("=")[1] || "repository";
const modes = ["repository", "local", "staging", "production"];
if (!modes.includes(mode)) {
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
  assert(content.includes('api_version = "2026-07"'), tier + " API version drifted.");
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
    return u.protocol === "https:" && !["localhost", "127.0.0.1", "example.com"].includes(host) &&
      !host.endsWith(".example.invalid") && !host.endsWith(".example.com") &&
      ![".trycloudflare.com", ".ngrok-free.app", ".ngrok.io", ".loca.lt"].some((s) => host.endsWith(s));
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
  assert(isTrue(required("SHOPIFY_BILLING_TEST_MODE")) === desiredTest, "Billing test mode does not match " + mode + ".");
  const clientId = required("SHOPIFY_API_KEY");
  required("SHOPIFY_API_SECRET");
  assert(clientId !== sourceClientId && (!exists("shopify.app.local.toml") || clientId !== parseValue(read("shopify.app.local.toml"), "client_id")), mode + " must use a dedicated non-Dev Shopify app.");
  assert(/^[a-f0-9]{32}$/i.test(clientId), mode + " Shopify client ID must be valid.");
  if (mode === "production") {
    assert(clientId === required("SHOPIFY_PRODUCTION_CLIENT_ID"), "Production Shopify identities do not match.");
    assert(!String(process.env.VSN_DEFAULT_PLAN || "").trim(), "Developer plan overrides cannot be set in Production.");
    assert(!isTrue(process.env.VSN_PRODUCTION_USE_CURRENT_CLIENT_ID), "Production may not reuse the Local app identity.");
  } else if (process.env.SHOPIFY_PRODUCTION_CLIENT_ID) {
    assert(clientId !== process.env.SHOPIFY_PRODUCTION_CLIENT_ID, "Staging must not reuse the Production Shopify app.");
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

  // Fail closed until the required PostgreSQL schema, migrations and Worker entry point really exist.
  const schema = read("prisma/schema.prisma");
  assert(/datasource\s+db\s*\{[^}]*provider\s*=\s*"postgresql"/s.test(schema) ||
    (exists("prisma/cloud/schema.prisma") && /provider\s*=\s*"postgresql"/.test(read("prisma/cloud/schema.prisma"))),
    "PostgreSQL Prisma schema is not implemented; SQLite cannot run on Neon.");
  assert(exists("prisma/cloud/migrations/migration_lock.toml"), "Hosted PostgreSQL migrations are not implemented.");
  assert(exists("workers/app.js") && exists("wrangler." + mode + ".jsonc"),
    "Cloudflare Worker entry point and configuration are not implemented.");
}

if (failures.length) {
  for (const message of failures) console.error("FAIL " + message);
  console.error("Environment " + mode + ": BLOCKED (" + failures.length + " contract violation(s)).");
  process.exitCode = 1;
} else {
  console.log("Environment " + mode + ": PASS (configuration contract only; no deployment/merchant acceptance implied).");
}
