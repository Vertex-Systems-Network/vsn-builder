import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const cli = process.platform === "win32" ? "npm.cmd" : "npm";
function fail(message) { throw new Error("[VSN Local/Dev] " + message); }
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", cwd: root, env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
function configField(text, name) {
  return text.match(new RegExp("^" + name + '\\s*=\\s*"([^"]*)"', "m"))?.[1] || "";
}
function main() {
  const file = path.join(root, ".env.local");
  if (!fs.existsSync(file)) fail("Create .env.local from .env.local.example, using the dedicated Shopify Dev credentials.");
  process.loadEnvFile(file);
  const branch = execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim();
  if (branch !== "development" && !/^(feat|fix|chore|test)\//.test(branch))
    fail("Local CLI must run on development or a feature branch, never main/production.");
  if (process.env.APP_ENV !== "development") fail("APP_ENV must be development.");
  if (!/^(true|1|yes)$/i.test(process.env.SHOPIFY_BILLING_TEST_MODE || "")) fail("Local billing must be test mode.");
  const db = (process.env.DATABASE_URL || "").trim();
  if (db && !db.startsWith("file:")) fail("Local DATABASE_URL must be a SQLite file URL.");
  for (const name of ["DIRECT_URL", "NEON_API_KEY", "NEON_PROJECT_ID", "CLOUDFLARE_API_TOKEN"])
    if (String(process.env[name] || "").trim()) fail(name + " must not be present in Local/Dev.");
  const key = String(process.env.SHOPIFY_API_KEY || "").trim();
  const secret = String(process.env.SHOPIFY_API_SECRET || "").trim();
  if (!/^[a-f0-9]{32}$/i.test(key)) fail("Set the 32-character dedicated Dev SHOPIFY_API_KEY.");
  if (!secret || secret === "replace-with-dev-app-secret") fail("Set a real dedicated Dev SHOPIFY_API_SECRET.");
  const expectedDevId = "f6156da0bd799053f2f0bd0f9e10983c"; // Existing Shopify Partner Development app: public Client ID
  if (key.toLowerCase() !== expectedDevId)
    fail('Local SHOPIFY_API_KEY must match the existing "VSN | Builder (Development)" app.');
  const defaultId = configField(read("shopify.app.toml"), "client_id");
  if (key === defaultId) fail("Do not reuse the existing default/unclassified Shopify Client ID for Dev.");
  const template = read("shopify.app.local.template.toml");
  if (configField(template, "client_id") !== "__SHOPIFY_LOCAL_CLIENT_ID__") fail("Local template placeholder is missing.");
  if (configField(template, "name") !== "VSN | Builder (Development)") fail("Unexpected Local Shopify app name.");
  if (!template.includes("automatically_update_urls_on_dev = true")) fail("Local URL updates must be enabled.");
  const scopes = configField(template, "scopes");
  if (process.env.SCOPES !== scopes) fail("Local SCOPES must match the dedicated app config exactly.");
  const output = template.replace(/^client_id\s*=.*$/m, "client_id = " + JSON.stringify(key));
  const generated = path.join(root, "shopify.app.local.toml");
  fs.writeFileSync(generated, output, { mode: 0o600 });
  console.log("[VSN Local/Dev] prepared isolated Shopify config for " + branch + "; SQLite + test billing.");
  const mode = process.argv[2] || "prepare";
  if (mode === "prepare") run(cli, ["run", "db:prepare"]);
  else if (mode === "dev") {
    run(process.execPath, ["scripts/clean-dev-cache.mjs"]);
    run(cli, ["exec", "--", "shopify", "app", "dev", "--config", "local"]);
  } else fail("Unknown mode: " + mode);
}
try { main(); } catch (err) { console.error(err.message || String(err)); process.exitCode = 1; }
