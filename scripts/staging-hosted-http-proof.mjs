// T028: public, read-only HTTP smoke evidence. This does not certify Shopify E2E.
// NEVER forward Cloudflare credentials, Shopify tokens, cookies or database URLs.
import { normalizeStagingOrigin } from "./staging-shopify-config.mjs";

const MAX_BYTES = 8192;
const allowedRedirect = (value, origin) => {
  if (!value) return false;
  try {
    const url = new URL(value, origin);
    return url.protocol === "https:" &&
      (url.origin === origin || url.hostname === "admin.shopify.com");
  } catch { return false; }
};

async function boundedJson(response) {
  if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      if (!(next.value instanceof Uint8Array)) return null;
      length += next.value.byteLength;
      if (length > MAX_BYTES) return null;
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const json = JSON.parse(new TextDecoder().decode(bytes));
    return json && typeof json === "object" && !Array.isArray(json) ? json : null;
  } catch { return null; }
  finally {
    try { void reader.cancel().catch(() => {}); } catch {}
    try { reader.releaseLock(); } catch {}
  }
}

export async function probeStagingHostedRuntime(rawOrigin, {
  fetchImpl = fetch,
  timeoutMs = 5000,
} = {}) {
  const report = {
    origin: null,
    liveness: false,
    merchantReady: false,
    merchantRoute: false,
    healthStatus: null,
    readyStatus: null,
    merchantStatus: null,
  };
  let origin;
  try { origin = normalizeStagingOrigin(rawOrigin); }
  catch { return report; }
  report.origin = origin;

  // Fetch each endpoint directly without following off-site redirects. Do not
  // send authorization, cookies, Shopify IDs or any GitHub/Cloudflare secrets.
  const get = async (path, accept) => {
    try {
      const response = await fetchImpl(new URL(path, origin), {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        headers: { accept, "cache-control": "no-store" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      return response instanceof Response ? response : null;
    } catch { return null; }
  };
  const health = await get("/healthz", "application/json");
  report.healthStatus = health?.status ?? null;
  if (health?.status === 200) {
    const json = await boundedJson(health);
    report.liveness = json?.service === "VSN Builder" && json?.tier === "staging" &&
      json?.liveness === true && health.headers.get("cache-control")?.includes("no-store") === true;
  }

  const ready = await get("/readyz", "application/json");
  report.readyStatus = ready?.status ?? null;
  if (ready?.status === 200) {
    const json = await boundedJson(ready);
    // A plain HTTP 200 or a database-only health check cannot qualify as
    // a Shopify merchant application. Full merchant E2E remains a separate gate.
    report.merchantReady = report.liveness &&
      json?.service === "VSN Builder" && json?.tier === "staging" &&
      json?.merchantAppReady === true && json?.shopifyOauthReady === true &&
      json?.persistentSessionsReady === true && json?.merchantRoutesReady === true &&
      ready.headers.get("cache-control")?.includes("no-store") === true;
  }

  const app = await get("/app", "text/html");
  report.merchantStatus = app?.status ?? null;
  if (app) {
    const status = app.status;
    const redirect = [301, 302, 303, 307, 308].includes(status);
    const type = app.headers.get("content-type") || "";
    report.merchantRoute = report.liveness &&
      (redirect ? allowedRedirect(app.headers.get("location"), origin) :
        status === 200 ? type.startsWith("text/html") : [401, 403].includes(status)) &&
      app.headers.get("cache-control")?.includes("no-store") === true;
  }
  return report;
}
