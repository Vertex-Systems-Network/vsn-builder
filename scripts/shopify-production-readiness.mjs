import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve(process.env.VSN_PRODUCTION_CONFIG_FILE || "shopify.app.production.toml");
const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok, detail });
const text = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
const match = (pattern) => text.match(pattern)?.[1] || "";
const appUrl = match(/^application_url\s*=\s*"([^"]+)"/m);
const redirect = match(/^redirect_urls\s*=\s*\[\s*"([^"]+)"/m);
const scopes = new Set((match(/^scopes\s*=\s*"([^"]+)"/m) || "").split(",").map((v)=>v.trim()).filter(Boolean));
const expectedScopes = ["read_files","write_files","read_locales","read_markets","read_metaobject_definitions","read_metaobjects","read_online_store_pages","read_orders","read_products","read_themes","read_translations","write_app_proxy","write_metaobject_definitions","write_metaobjects","write_online_store_pages","write_products","write_themes","write_translations"];
function productionUrl(value) { try { const u=new URL(value); const h=u.hostname.toLowerCase(); const ephemeral=[".trycloudflare.com",".ngrok-free.app",".ngrok.io",".loca.lt"].some((suffix)=>h.endsWith(suffix)); return u.protocol==="https:" && !ephemeral && !["localhost","127.0.0.1","::1","example.com"].includes(h) && !h.endsWith(".example.com"); } catch { return false; } }

check("Production Shopify config exists", Boolean(text), path.relative(process.cwd(), configPath));
check("Production application URL", productionUrl(appUrl), appUrl || "missing");
check("OAuth callback matches app URL", Boolean(appUrl) && redirect === `${appUrl.replace(/\/+$/,"")}/auth/callback`, redirect || "missing");
check("Embedded app enabled", /^embedded\s*=\s*true$/m.test(text));
check("Dev URL mutation disabled", /^automatically_update_urls_on_dev\s*=\s*false$/m.test(text));
check("Webhook API version 2026-07", /^api_version\s*=\s*"2026-07"$/m.test(text));
for (const topic of ["app/uninstalled","app/scopes_update","orders/paid"]) check(`Webhook ${topic}`, text.includes(`"${topic}"`));
for (const topic of ["customers/data_request","customers/redact","shop/redact"]) check(`Compliance webhook ${topic}`, new RegExp(`compliance_topics\\s*=\\s*\\[[^\\]]*"${topic.replace("/","\\/")}"`).test(text));
check("App proxy route", /\[app_proxy\][\s\S]*?url\s*=\s*"\/builder-proxy"[\s\S]*?prefix\s*=\s*"apps"[\s\S]*?subpath\s*=\s*"vsn-builder"/m.test(text));
check("write_app_proxy scope", scopes.has("write_app_proxy"));
check("Expected production scopes declared", expectedScopes.every((scope)=>scopes.has(scope)), expectedScopes.filter((scope)=>!scopes.has(scope)).join(", ") || "complete");
const unexpectedScopes=[...scopes].filter((scope)=>!expectedScopes.includes(scope));
check("No unexpected production scopes", unexpectedScopes.length===0, unexpectedScopes.join(", ") || "least-privilege contract exact");
check("Theme extension config present", fs.existsSync("extensions/vsn-page-builder-theme/shopify.extension.toml"));
check("Uninstall handler present", fs.existsSync("app/routes/webhooks.app.uninstalled.jsx"));
check("Shop redact handler present", fs.existsSync("app/routes/webhooks.shop.redact.jsx"));
check("Runtime SHOPIFY_APP_URL matches production URL", !process.env.SHOPIFY_APP_URL || process.env.SHOPIFY_APP_URL.replace(/\/+$/,"") === appUrl.replace(/\/+$/, ""), process.env.SHOPIFY_APP_URL ? `${process.env.SHOPIFY_APP_URL} vs ${appUrl}` : "SHOPIFY_APP_URL not set in this shell");

let failed = false;
for (const row of checks) { console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}${row.detail ? ` — ${row.detail}` : ""}`); if (!row.ok) failed = true; }
if (failed) process.exit(1);
console.log(`VSN Shopify production readiness PASS (${checks.length}/${checks.length}).`);
