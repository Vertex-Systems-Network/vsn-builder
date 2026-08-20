import { FEATURE_FLAGS, normalizeFeatureFlags } from "../config/featureFlags.js";

function envBoolean(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

export function getServerFeatureFlags() {
  const raw = {};
  for (const [key, definition] of Object.entries(FEATURE_FLAGS)) {
    raw[key] = envBoolean(process.env[definition.env], definition.defaultValue);
  }
  return normalizeFeatureFlags(raw);
}
