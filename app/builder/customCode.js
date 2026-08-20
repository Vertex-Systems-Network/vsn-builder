export const MAX_CUSTOM_JS_PER_ELEMENT = 50_000;
export const MAX_CUSTOM_JS_ENTRIES = 150;

/**
 * Collect scoped Custom JavaScript entries from a builder tree.
 * Duplicate node ids/code pairs are ignored so reusable/global groups do not
 * accidentally execute identical merchant scripts twice on the same page.
 */
export function collectCustomJsEntries(nodes = [], out = [], seen = new Set()) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node || typeof node !== "object") continue;
    const id = String(node.id || "").trim();
    const code = String(node.styles?.advanced?.customJs || "").trim().slice(0, MAX_CUSTOM_JS_PER_ELEMENT);
    if (id && code) {
      const signature = `${id}\u001f${code}`;
      if (!seen.has(signature)) {
        seen.add(signature);
        out.push({ id, code });
      }
    }
    collectCustomJsEntries(node.children || [], out, seen);
  }
  return out;
}

export function collectCustomJsGroups(groups = []) {
  const out = [];
  const seen = new Set();
  for (const group of Array.isArray(groups) ? groups : []) {
    collectCustomJsEntries(group || [], out, seen);
    if (out.length >= MAX_CUSTOM_JS_ENTRIES) break;
  }
  return out.slice(0, MAX_CUSTOM_JS_ENTRIES);
}

export function customJsSignature(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map((item) => `${item.id}:${item.code}`)
    .join("\u001f");
}

export function validateCustomJs(code = "") {
  const source = String(code || "").slice(0, MAX_CUSTOM_JS_PER_ELEMENT);
  try {
    // Compile only. The caller decides where/when the merchant-authored code runs.
    // eslint-disable-next-line no-new-func
    new Function("element", "document", "window", `"use strict";\n${source}`);
    return { valid: true, error: "" };
  } catch (error) {
    return { valid: false, error: String(error?.message || "Invalid JavaScript").slice(0, 240) };
  }
}
