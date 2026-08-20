import { COMMERCIAL_PLANS, PLAN_ORDER, normalizePlanKey } from "../config/commercialPlans.js";

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const MYSHOPIFY_SUFFIX = ".myshopify.com";

function clean(value) {
  return String(value || "").trim();
}

export function normalizeShopDomain(value) {
  const raw = clean(value).toLowerCase();
  if (!raw) return "";
  try {
    const parsed = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return raw.split("/")[0].split(":")[0].toLowerCase();
  }
}

export function storeHandleFromShop(value) {
  const shop = normalizeShopDomain(value);
  if (!shop.endsWith(MYSHOPIFY_SUFFIX)) return "";
  const handle = shop.slice(0, -MYSHOPIFY_SUFFIX.length);
  return HANDLE_RE.test(handle) ? handle : "";
}

export function normalizePricingHandle(value) {
  const handle = clean(value).toLowerCase();
  return HANDLE_RE.test(handle) ? handle : "";
}

export function getShopifyAppHandle() {
  return normalizePricingHandle(process.env.SHOPIFY_APP_HANDLE || process.env.VSN_SHOPIFY_APP_HANDLE || "");
}

export function getShopifyPlanHandleMap() {
  return Object.freeze(Object.fromEntries(PLAN_ORDER.map((key) => {
    const plan = COMMERCIAL_PLANS[key];
    const publicEnvName = `SHOPIFY_APP_PRICING_PLAN_${String(plan.publicKey || key).toUpperCase()}_HANDLE`;
    const legacyEnvName = `SHOPIFY_APP_PRICING_PLAN_${key.toUpperCase()}_HANDLE`;
    const configured = normalizePricingHandle(process.env[publicEnvName]) || normalizePricingHandle(process.env[legacyEnvName]);
    return [key, configured || normalizePricingHandle(plan.shopifyHandle) || key];
  })));
}

export function resolveInternalPlanKeyFromHandle(value, handleMap = getShopifyPlanHandleMap()) {
  const handle = normalizePricingHandle(value);
  if (!handle) return null;
  const match = Object.entries(handleMap).find(([, configured]) => configured === handle);
  return match ? normalizePlanKey(match[0]) : null;
}

function safePricingOverride(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function buildShopifyAppPricingUrl({ shop, appHandle = getShopifyAppHandle() } = {}) {
  const explicit = safePricingOverride(process.env.SHOPIFY_APP_PRICING_URL);
  if (explicit) return explicit;

  const storeHandle = storeHandleFromShop(shop);
  const cleanAppHandle = normalizePricingHandle(appHandle);
  if (storeHandle && cleanAppHandle) {
    return `https://admin.shopify.com/store/${encodeURIComponent(storeHandle)}/charges/${encodeURIComponent(cleanAppHandle)}/pricing_plans`;
  }

  // Transitional compatibility only. Q5 moves the product away from the old
  // Managed Pricing env name without breaking existing developer setups.
  return safePricingOverride(process.env.SHOPIFY_MANAGED_PRICING_URL);
}

export function getShopifyAppPricingConfig(shop) {
  const storeHandle = storeHandleFromShop(shop);
  const appHandle = getShopifyAppHandle();
  const pricingUrl = buildShopifyAppPricingUrl({ shop, appHandle });
  const explicit = safePricingOverride(process.env.SHOPIFY_APP_PRICING_URL);
  const legacy = !explicit ? safePricingOverride(process.env.SHOPIFY_MANAGED_PRICING_URL) : "";
  const mode = explicit ? "explicit" : storeHandle && appHandle ? "generated" : legacy ? "legacy" : "unconfigured";
  const issues = [];
  if (!storeHandle) issues.push("Authenticated shop must be a valid *.myshopify.com domain before a Shopify App Pricing URL can be generated.");
  if (!appHandle && !explicit && !legacy) issues.push("SHOPIFY_APP_HANDLE is required to generate the Shopify-hosted pricing URL.");
  if (process.env.SHOPIFY_APP_PRICING_URL && !explicit) issues.push("SHOPIFY_APP_PRICING_URL must be an absolute HTTPS URL.");
  if (process.env.SHOPIFY_MANAGED_PRICING_URL && !legacy && !explicit) issues.push("Legacy SHOPIFY_MANAGED_PRICING_URL is invalid and was ignored.");
  return {
    provider: "shopify-app-pricing",
    configured: Boolean(pricingUrl),
    mode,
    pricingUrl,
    storeHandle,
    appHandle,
    planHandles: getShopifyPlanHandleMap(),
    issues,
    requiresPartnerVerification: true,
  };
}

export function readShopifyAppPricingReturn(request, expectedShop) {
  let url;
  try { url = new URL(request.url); } catch { return null; }
  const rawPlanHandle = url.searchParams.get("plan_handle");
  if (!rawPlanHandle) return null;

  const planHandle = normalizePricingHandle(rawPlanHandle);
  const expectedDomain = normalizeShopDomain(expectedShop);
  const returnedDomain = normalizeShopDomain(url.searchParams.get("shop"));
  const shopMatches = !returnedDomain || returnedDomain === expectedDomain;
  const planKey = resolveInternalPlanKeyFromHandle(planHandle);

  return {
    provider: "shopify-app-pricing",
    planHandle,
    planKey,
    recognized: Boolean(planKey),
    shopMatches,
    returnedShop: returnedDomain || null,
    expectedShop: expectedDomain || null,
    pendingVerification: Boolean(planHandle && shopMatches),
    trustedForEntitlements: false,
  };
}
