function fail(message) { console.error(`VSN production runtime: ${message}`); process.exitCode = 1; }
function productionUrl(value) { try { const u=new URL(String(value||"").trim()); const h=u.hostname.toLowerCase(); const ephemeral=[".trycloudflare.com",".ngrok-free.app",".ngrok.io",".loca.lt"].some((suffix)=>h.endsWith(suffix)); return u.protocol==="https:" && !ephemeral && !["localhost","127.0.0.1","::1","example.com"].includes(h) && !h.endsWith(".example.com"); } catch { return false; } }

if (process.env.NODE_ENV !== "production") {
  console.log("VSN production runtime validation skipped (NODE_ENV is not production).");
  process.exit(0);
}

if (!productionUrl(process.env.SHOPIFY_APP_URL)) fail("SHOPIFY_APP_URL must be a real HTTPS production origin.");
if (!String(process.env.SHOPIFY_API_KEY || "").trim()) fail("SHOPIFY_API_KEY is required.");
if (!String(process.env.SHOPIFY_API_SECRET || "").trim()) fail("SHOPIFY_API_SECRET is required.");
if (String(process.env.VSN_DEFAULT_PLAN || "").trim()) fail("VSN_DEFAULT_PLAN is a developer-only entitlement override and must be blank in production.");
const commercializationEnabled = /^(1|true|yes|on)$/i.test(String(process.env.VSN_FEATURE_COMMERCIALIZATION || ""));
const appPricingUrl = String(process.env.SHOPIFY_APP_PRICING_URL || "").trim();
const appHandle = String(process.env.SHOPIFY_APP_HANDLE || "").trim();
if (commercializationEnabled && !appPricingUrl && !appHandle) fail("Commercialization is enabled but Shopify App Pricing is not configured. Set SHOPIFY_APP_HANDLE or SHOPIFY_APP_PRICING_URL.");
if (commercializationEnabled && !String(process.env.SHOPIFY_PARTNER_ORGANIZATION_ID || "").trim()) fail("Commercialization is enabled but SHOPIFY_PARTNER_ORGANIZATION_ID is missing.");
if (commercializationEnabled && !String(process.env.SHOPIFY_PARTNER_API_TOKEN || "").trim()) fail("Commercialization is enabled but SHOPIFY_PARTNER_API_TOKEN is missing; verified subscription sync cannot run.");
if (String(process.env.SHOPIFY_MANAGED_PRICING_URL || "").trim()) console.warn("VSN production runtime: SHOPIFY_MANAGED_PRICING_URL is a legacy fallback. Migrate to Shopify App Pricing configuration.");
if (String(process.env.VSN_PRODUCTION_USE_CURRENT_CLIENT_ID || "") === "1") console.warn("VSN production runtime: VSN_PRODUCTION_USE_CURRENT_CLIENT_ID is set. Confirm this deployment intentionally shares the development Shopify app.");

if (!process.exitCode) console.log("VSN production runtime validation PASS.");
