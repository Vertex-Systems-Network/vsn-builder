import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("shopify.app.toml");
const outputPath = path.resolve(process.env.VSN_PRODUCTION_CONFIG_FILE || "shopify.app.production.toml");
const source = fs.readFileSync(sourcePath, "utf8");

function fail(message) {
  console.error(`VSN production config: ${message}`);
  process.exit(1);
}
function cleanUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  let url;
  try { url = new URL(raw); } catch { fail("SHOPIFY_PRODUCTION_APP_URL must be a valid absolute HTTPS URL."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:") fail("SHOPIFY_PRODUCTION_APP_URL must use HTTPS.");
  const ephemeral = [".trycloudflare.com", ".ngrok-free.app", ".ngrok.io", ".loca.lt"].some((suffix) => host.endsWith(suffix));
  if (ephemeral || ["localhost", "127.0.0.1", "::1", "example.com"].includes(host) || host.endsWith(".example.com")) fail("SHOPIFY_PRODUCTION_APP_URL must be a stable production host, not a development tunnel/localhost/example.com.");
  return raw;
}

const appUrl = cleanUrl(process.env.SHOPIFY_PRODUCTION_APP_URL);
const explicitClientId = String(process.env.SHOPIFY_PRODUCTION_CLIENT_ID || "").trim();
const sourceClientId = source.match(/^client_id\s*=\s*"([^"]+)"/m)?.[1] || "";
const allowCurrentClientId = String(process.env.VSN_PRODUCTION_USE_CURRENT_CLIENT_ID || "") === "1";
const clientId = explicitClientId || (allowCurrentClientId ? sourceClientId : "");
if (!clientId) fail("Set SHOPIFY_PRODUCTION_CLIENT_ID, or explicitly set VSN_PRODUCTION_USE_CURRENT_CLIENT_ID=1 when production uses the same Shopify app.");
if (!/^[A-Za-z0-9_-]{16,}$/.test(clientId)) fail("SHOPIFY_PRODUCTION_CLIENT_ID does not look valid.");

const appName = String(process.env.SHOPIFY_PRODUCTION_APP_NAME || "VSN Builder").trim() || "VSN Builder";
const appHandle = String(process.env.SHOPIFY_PRODUCTION_APP_HANDLE || process.env.SHOPIFY_APP_HANDLE || "").trim().toLowerCase();
if (appHandle && !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(appHandle)) fail("SHOPIFY_PRODUCTION_APP_HANDLE must contain only letters, numbers, hyphens or underscores.");
let output = source;
output = output.replace(/^client_id\s*=.*$/m, `client_id = "${clientId}"`);
output = output.replace(/^name\s*=.*$/m, `name = ${JSON.stringify(appName)}`);
if (appHandle) {
  if (/^handle\s*=/m.test(output)) output = output.replace(/^handle\s*=.*$/m, `handle = ${JSON.stringify(appHandle)}`);
  else output = output.replace(/^name\s*=.*$/m, (line) => `${line}\nhandle = ${JSON.stringify(appHandle)}`);
}
output = output.replace(/^application_url\s*=.*$/m, `application_url = "${appUrl}"`);
output = output.replace(/(^\[webhooks\][\s\S]*?^api_version\s*=\s*)"[^"]+"/m, `$1"2026-07"`);
output = output.replace(/(^\[auth\][\s\S]*?^redirect_urls\s*=\s*)\[[^\]]*\]/m, `$1[ "${appUrl}/auth/callback" ]`);
output = output.replace(/(^\[build\][\s\S]*?^automatically_update_urls_on_dev\s*=\s*)(true|false)/m, "$1false");

if (output.includes('application_url = "https://example.com"')) fail("Failed to replace the development application_url.");
if (!output.includes('api_version = "2026-07"')) fail("Production webhook API version must be 2026-07.");
if (!output.includes(`redirect_urls = [ "${appUrl}/auth/callback" ]`)) fail("Production OAuth callback could not be generated.");
if (!output.includes('automatically_update_urls_on_dev = false')) fail("Production config must disable automatically_update_urls_on_dev.");

fs.writeFileSync(outputPath, `${output.trim()}\n`);
console.log(`VSN production Shopify config written: ${path.relative(process.cwd(), outputPath)}`);
console.log(`Application URL: ${appUrl}`);
console.log(`OAuth callback: ${appUrl}/auth/callback`);
if (appHandle) console.log(`App handle: ${appHandle}`);
console.log("Next: npm run release:production:check, then npm run deploy:production");
