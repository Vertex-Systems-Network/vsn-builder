/**
 * VSN global style schema.
 *
 * This module intentionally does not inject visual defaults. It only normalizes
 * the persisted shape so legacy pages and partial responsive/state payloads can
 * safely pass through the same style engine.
 */

export const STYLE_SCHEMA_VERSION = 1;

export const GLOBAL_STYLE_SECTIONS = Object.freeze([
  "typography",
  "background",
  "border",
  "spacing",
  "size",
  "effects",
  "layout",
  "transform",
  "transition",
  "interaction",
  "scroll",
  "advanced",
  "states",
  "widget",
]);

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * Normalize section objects without deleting unknown/legacy top-level keys.
 * Unknown keys are preserved for backward compatibility and custom renderers.
 */
export function normalizeStyleShape(styles = {}) {
  const source = objectOrEmpty(styles);
  const normalized = { ...source };

  for (const section of GLOBAL_STYLE_SECTIONS) {
    if (section === "transition") {
      // Transition supports a string, one structured object, or multiple rows.
      if (source.transition === undefined || source.transition === null) continue;
      normalized.transition = source.transition;
      continue;
    }
    normalized[section] = objectOrEmpty(source[section]);
  }

  // Canonicalize a few old flat values while retaining their source keys.
  if (source.overflowHidden === true && normalized.advanced.overflowHidden === undefined) {
    normalized.advanced = { ...normalized.advanced, overflowHidden: true };
  }
  if (source.customCss && !normalized.advanced.customCss) {
    normalized.advanced = { ...normalized.advanced, customCss: source.customCss };
  }
  if (source.customJs && !normalized.advanced.customJs) {
    normalized.advanced = { ...normalized.advanced, customJs: source.customJs };
  }

  return normalized;
}

export function auditStyleShape(styles = {}) {
  const errors = [];
  const source = styles && typeof styles === "object" ? styles : {};
  for (const section of GLOBAL_STYLE_SECTIONS) {
    const value = source[section];
    if (value === undefined || value === null || section === "transition") continue;
    if (typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${section} must be an object`);
    }
  }
  return { valid: errors.length === 0, errors };
}
