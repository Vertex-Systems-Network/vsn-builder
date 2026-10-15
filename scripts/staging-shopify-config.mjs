import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const APP_NAME = "VSN | Builder (Staging)";
export function normalizeStagingOrigin(raw) {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("Stage-only HTTPS URL required");
  let url;
  try { url = new URL(raw); } catch { throw new Error("Invalid Staging app origin"); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      url.pathname !== "/" || url.search || url.hash ||
      !hostname.includes(".") || /^localhost$|^127\.0\.0\.1$|^example\./.test(hostname) ||
      /\.(invalid|test|localhost)$/.test(hostname) ||
      [".trycloudflare.com", ".ngrok-free.app", ".ngrok.io", ".loca.lt"].some(x => hostname.endsWith(x)))
    throw new Error("Staging requires a stable public HTTPS origin without credentials, port, path, or placeholders");
  return url.origin;
}

function replaceOnce(source, pattern, replacement, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"))];
  if (matches.length !== 1) throw new Error("Expected exactly one Shopify config field: " + label);
  return source.replace(pattern, replacement);
}

function replaceHeaderField(source, pattern, replacement, label) {
  // Header fields must be changed ONLY before the first TOML section:
  // metaobject definitions legitimately contain many other "name" fields.
  const end = source.search(/^\[/m);
  if (end < 0) throw new Error("Shopify TOML section boundary missing");
  const header = source.slice(0, end);
  const tail = source.slice(end);
  return replaceOnce(header, pattern, replacement, label) + tail;
}

export function createStagingShopifyConfig(baseToml, env = {}) {
  if (env.VSN_TARGET_ENV !== "staging") throw new Error("Only staging target is permitted");
  if (typeof baseToml !== "string" || !baseToml.includes("[webhooks]") ||
      !baseToml.includes("[app_proxy]") || !baseToml.includes("[access_scopes]"))
    throw new Error("Full canonical Shopify app TOML required");
  const baseMatch = baseToml.match(/^client_id\s*=\s*"([0-9a-f]{32})"\s*$/m);
  if (!baseMatch) throw new Error("Current Shopify app identity is missing/ambiguous");
  const stageId = String(env.SHOPIFY_API_KEY || "").trim();
  if (!/^[0-9a-f]{32}$/i.test(stageId)) throw new Error("Protected Staging Shopify client ID invalid");
  if (stageId.toLowerCase() === baseMatch[1].toLowerCase())
    throw new Error("Staging cannot modify or reuse canonical Live Shopify app identity");
  const origin = normalizeStagingOrigin(env.SHOPIFY_APP_URL);
  if (env.SHOPIFY_PRODUCTION_CLIENT_ID && stageId.toLowerCase() === String(env.SHOPIFY_PRODUCTION_CLIENT_ID).toLowerCase())
    throw new Error("Staging Shopify Client ID matches explicit Production ID");
  let next = baseToml;
  next = replaceHeaderField(next, /^client_id\s*=\s*"[^"]*"\s*$/m, "client_id = " + JSON.stringify(stageId), "client_id");
  next = replaceHeaderField(next, /^name\s*=\s*"[^"]*"\s*$/m, "name = " + JSON.stringify(APP_NAME), "name");
  next = replaceHeaderField(next, /^application_url\s*=\s*"[^"]*"\s*$/m, "application_url = " + JSON.stringify(origin), "application_url");
  next = replaceOnce(next, /^redirect_urls\s*=\s*\[[^\n]*\]\s*$/m,
    "redirect_urls = [ " + JSON.stringify(origin + "/auth/callback") + " ]", "OAuth callback");
  next = replaceOnce(next, /^automatically_update_urls_on_dev\s*=\s*(true|false)\s*$/m,
    "automatically_update_urls_on_dev = false", "Shopify URL mutation");
  if (!next.includes('name = "' + APP_NAME + '"') ||
      !next.includes(origin + "/auth/callback") ||
      /https:\/\/example\.com/i.test(next))
    throw new Error("Stage config materialization failed integrity checks");
  // No Shopify app registration, deployment, installation or secret writes.
  return next;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const canonical = readFileSync("shopify.app.toml", "utf8");
    const generated = createStagingShopifyConfig(canonical, process.env);
    if (!process.argv.includes("--write"))
      throw new Error("Refusing to materialize Staging config without explicit --write");
    writeFileSync("shopify.app.staging.toml", generated, { mode: 0o600, flag: "w" });
    console.log("PASS Staging Shopify TOML generated locally, with dedicated identity and HTTPS callback; no app deployed");
  } catch (error) {
    console.error("BLOCKED Staging Shopify config: " + (error instanceof Error ? error.message : "unknown error"));
    process.exitCode = 1;
  }
}
