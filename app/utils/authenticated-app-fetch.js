const DEFAULT_TIMEOUT_MS = 10000;

function notifySession(status, detail = "") {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("vsn:session-status", { detail: { status, detail } }));
  } catch {}
}

export async function getFreshShopifyIdToken() {
  const api = globalThis?.shopify;
  if (!api || typeof api.idToken !== "function") return "";
  const token = await api.idToken();
  return typeof token === "string" ? token : "";
}

export async function authenticatedAppFetch(input, init = {}, options = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS));
  const controller = new AbortController();
  const sourceSignal = init.signal;
  let timeout = null;
  let removeAbort = null;

  if (sourceSignal) {
    if (sourceSignal.aborted) controller.abort(sourceSignal.reason);
    else {
      const abort = () => controller.abort(sourceSignal.reason);
      sourceSignal.addEventListener("abort", abort, { once: true });
      removeAbort = () => sourceSignal.removeEventListener("abort", abort);
    }
  }

  timeout = globalThis.setTimeout(() => controller.abort(new DOMException("VSN request timed out", "TimeoutError")), timeoutMs);
  const headers = new Headers(init.headers || {});

  try {
    try {
      const token = await getFreshShopifyIdToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    } catch (error) {
      notifySession("reauth-required", error instanceof Error ? error.message : "Shopify session token unavailable.");
      throw error;
    }

    const response = await fetch(input, { ...init, headers, signal: controller.signal });
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const looksLikeAuthRedirect = response.redirected && contentType.includes("text/html");

    if (response.status === 401 || looksLikeAuthRedirect) {
      notifySession("reauth-required", `Authentication response ${response.status || "redirect"}.`);
    } else if (response.ok) {
      notifySession("ok");
    }
    return response;
  } finally {
    if (timeout) globalThis.clearTimeout(timeout);
    removeAbort?.();
  }
}

export async function readAppJson(response, fallbackMessage = "VSN request failed.") {
  const contentType = String(response?.headers?.get?.("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    if (response?.status === 401 || response?.redirected) {
      throw new Error("Shopify session needs to be refreshed.");
    }
    throw new Error(fallbackMessage);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || fallbackMessage);
  return data;
}
