const HOOK_EVENTS = new Set([
  "catalog:afterLoad",
  "translation:beforeSave",
  "translation:afterSave",
  "nativeSync:before",
  "nativeSync:after",
]);

const registry = globalThis.__VSN_LOCALIZATION_HOOKS__ instanceof Map
  ? globalThis.__VSN_LOCALIZATION_HOOKS__
  : new Map();

globalThis.__VSN_LOCALIZATION_HOOKS__ = registry;

function normalizeHookName(name) {
  return String(name || "").trim().slice(0, 120);
}

export function registerLocalizationHook(name, event, handler) {
  const safeName = normalizeHookName(name);
  if (!safeName) throw new Error("Localization hook name is required.");
  if (!HOOK_EVENTS.has(event)) throw new Error(`Unsupported localization hook event: ${event}`);
  if (typeof handler !== "function") throw new Error("Localization hook handler must be a function.");
  registry.set(`${event}:${safeName}`, { name: safeName, event, handler });
  return () => unregisterLocalizationHook(safeName, event);
}

export function unregisterLocalizationHook(name, event) {
  const safeName = normalizeHookName(name);
  if (!safeName || !HOOK_EVENTS.has(event)) return false;
  return registry.delete(`${event}:${safeName}`);
}

export function listLocalizationHooks() {
  return Array.from(registry.values()).map(({ name, event }) => ({ name, event }));
}

export async function runLocalizationHooks(event, payload, { strict = false } = {}) {
  if (!HOOK_EVENTS.has(event)) return { payload, warnings: [] };
  let current = payload;
  const warnings = [];
  for (const hook of registry.values()) {
    if (hook.event !== event) continue;
    try {
      const next = await hook.handler(current);
      if (next && typeof next === "object") current = next;
    } catch (error) {
      const message = `${hook.name}: ${error instanceof Error ? error.message : String(error)}`;
      if (strict) throw new Error(`Localization hook failed (${message})`);
      warnings.push(message);
    }
  }
  return { payload: current, warnings };
}

export const LOCALIZATION_HOOK_EVENTS = Object.freeze(Array.from(HOOK_EVENTS));
