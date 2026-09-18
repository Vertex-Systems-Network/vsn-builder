const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TRUSTED_SHOPIFY_ADMIN_HOSTS = new Set(["admin.shopify.com"]);

function normalizeHttpsOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function configuredAppOrigin() {
  return normalizeHttpsOrigin(process.env.SHOPIFY_APP_URL || process.env.HOST || "");
}

function effectiveAppOrigins(request) {
  const origins = new Set();
  try {
    const requestOrigin = new URL(request.url).origin;
    if (requestOrigin) origins.add(requestOrigin);
  } catch {}
  // Never trust Forwarded/X-Forwarded-Host for an authorization decision. Those
  // headers are safe only when a deployment guarantees they are stripped and
  // rewritten by a trusted proxy, which application code cannot prove. A public
  // reverse-proxy/tunnel origin must be configured through SHOPIFY_APP_URL/HOST.
  const configured = configuredAppOrigin();
  if (configured) origins.add(configured);
  return origins;
}

export function isTrustedShopifyAdminOrigin(origin) {
  let parsed;
  try { parsed = new URL(String(origin || "")); } catch { return false; }
  if (parsed.protocol !== "https:") return false;
  const hostname = parsed.hostname.toLowerCase();
  if (TRUSTED_SHOPIFY_ADMIN_HOSTS.has(hostname)) return true;
  // Older/admin surfaces can still originate from the merchant's Shopify domain.
  return hostname.endsWith(".myshopify.com") && hostname.length > ".myshopify.com".length;
}

export function mutationRequestTrust(request) {
  if (!request || SAFE_METHODS.has(String(request.method || "GET").toUpperCase())) {
    return { ok: true, reason: "safe-method" };
  }

  const origin = String(request.headers.get("origin") || "").trim();
  const fetchSite = String(request.headers.get("sec-fetch-site") || "").trim().toLowerCase();

  if (!origin) {
    // Server/internal requests commonly omit Origin. A browser explicitly declaring
    // cross-site without an Origin is not trusted.
    if (fetchSite === "cross-site") return { ok: false, reason: "cross-site-without-origin" };
    return { ok: true, reason: "origin-omitted" };
  }

  let parsed;
  try { parsed = new URL(origin); }
  catch { return { ok: false, reason: "invalid-origin" }; }

  const appOrigins = effectiveAppOrigins(request);
  if (appOrigins.has(parsed.origin)) return { ok: true, reason: "app-origin", origin: parsed.origin };

  // Shopify embedded apps run inside Shopify Admin. Browser Fetch Metadata can report
  // this as cross-site even though authenticate.admin() subsequently validates the
  // Shopify session token/session. Allow only Shopify-controlled HTTPS admin origins.
  if (isTrustedShopifyAdminOrigin(parsed.origin)) {
    return { ok: true, reason: "shopify-admin-origin", origin: parsed.origin };
  }

  if (fetchSite === "cross-site") return { ok: false, reason: "untrusted-cross-site", origin: parsed.origin };
  return { ok: false, reason: "origin-mismatch", origin: parsed.origin };
}

export function assertTrustedMutationRequest(request) {
  const trust = mutationRequestTrust(request);
  if (trust.ok) return true;
  if (trust.reason === "invalid-origin") throw new Response("Invalid request origin.", { status: 403 });
  if (trust.reason === "cross-site-without-origin" || trust.reason === "untrusted-cross-site") {
    throw new Response("Cross-site mutation request rejected.", { status: 403 });
  }
  throw new Response("Mutation request origin is not trusted for this app.", { status: 403 });
}

export function applyVsnSecurityHeaders(input) {
  const headers = input instanceof Headers ? new Headers(input) : new Headers(input || {});
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  return headers;
}

export function safeClientErrorMessage(error, fallback = "The request could not be completed.") {
  const source = error instanceof Error ? error.message : String(error || "");
  if (!source) return fallback;
  if (/PrismaClient|\$queryRaw|SELECT |INSERT |UPDATE |DELETE |node_modules|[A-Z]:\\/i.test(source)) return fallback;
  return source.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 500) || fallback;
}
