export const VSN_PLUGIN_FORBIDDEN_APIS = Object.freeze([
  "child_process", "node:child_process", "worker_threads", "node:worker_threads",
  "vm", "node:vm", "cluster", "node:cluster", "process.binding", "process.dlopen",
  "eval(", "new Function(", "Function(", "require('fs')", 'require("fs")',
  "fetch(", "XMLHttpRequest", "WebSocket(", "EventSource(",
  "process.env", "import.meta.env", "document.cookie", "localStorage", "sessionStorage",
  "registerVsnWidget(", "registerVsnDataProvider(", "registerVsnCategory(",
  "registerVsnFieldType(", "registerVsnControl(", "registerVsnTemplateType(", "registerVsnInspectorPanel(",
]);

export const VSN_PLUGIN_ALLOWED_PERMISSIONS = Object.freeze([
  "data:shopify.products", "data:shopify.collections", "data:shopify.blogs",
  "data:shopify.articles", "data:shopify.metaobjects", "data:shopify.search",
  "network:external", "editor:controls", "editor:preview", "storefront:render",
]);

export function safePluginId(value) {
  return /^[a-z0-9][a-z0-9._-]{2,63}$/.test(String(value || ""));
}

export function safeWidgetId(value) {
  return /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(value || ""));
}

export function isPublicHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (["localhost", "0.0.0.0", "::", "::1"].includes(host) || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return false;
    const private172 = host.match(/^172\.(\d+)\./); if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;
    if (/^169\.254\./.test(host)) return false;
    if (/^(?:fc|fd)[0-9a-f]{2}:/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host)) return false;
    if (/^::ffff:(?:127\.|10\.|192\.168\.|169\.254\.)/i.test(host)) return false;
    return true;
  } catch { return false; }
}

export function assertAllowedExternalUrl(value, origins = []) {
  if (!isPublicHttpsUrl(value)) throw new Error("External data providers require a public HTTPS URL.");
  const url = new URL(value);
  const allow = (origins || []).map((origin) => { try { return new URL(origin).origin; } catch { return ""; } }).filter(Boolean);
  if (allow.length && !allow.includes(url.origin)) throw new Error(`Network origin ${url.origin} is not declared by the plugin manifest.`);
  return url;
}

export function scanPluginSource(source = "") {
  const text = String(source || "");
  const findings = VSN_PLUGIN_FORBIDDEN_APIS.filter((token) => text.includes(token));
  const importPattern = /(?:import\s+(?:[^"']+?\s+from\s+)?|export\s+[^"']+?\s+from\s+|import\s*\()\s*["']([^"']+)["']/g;
  for (const match of text.matchAll(importPattern)) {
    const specifier = String(match[1] || "");
    const local = specifier.startsWith("./") && !specifier.includes("../");
    const sdk = ["@vsn/sdk", "@vsn/sdk/server"].includes(specifier) || /(?:^|\/)app\/sdk\/(?:index|server)\.js$/.test(specifier);
    if (!local && !sdk) findings.push(`import:${specifier}`);
  }
  return [...new Set(findings)];
}
