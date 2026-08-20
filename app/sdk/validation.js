import { safePluginId, safeWidgetId, VSN_PLUGIN_ALLOWED_PERMISSIONS } from "./security.js";
import { VSN_SDK_SCHEMA_VERSION, parseVersion, versionSatisfies } from "./version.js";
import { VSN_BASELINE } from "../config/baseline.js";

const CONTROL_TYPES = new Set(["text", "textarea", "number", "toggle", "select", "multi-select", "radio", "button-set", "url", "color", "color-gradient", "range", "css-length", "date", "datetime", "time", "dimensions", "border-radius", "typography", "media", "icon"]);

function string(value, max = 200) { return String(value ?? "").trim().slice(0, max); }
function plainObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }

export function validateControlSchema(controls = []) {
  const errors = []; const normalized = [];
  for (const [index, raw] of (Array.isArray(controls) ? controls : []).entries()) {
    const control = plainObject(raw); const key = string(control.key, 80); const type = string(control.type, 30);
    if (!/^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/.test(key)) errors.push(`controls[${index}].key is invalid.`);
    if (!CONTROL_TYPES.has(type)) errors.push(`controls[${index}].type must be one of ${Array.from(CONTROL_TYPES).join(", ")}.`);
    const hasOptions = ["select", "multi-select", "radio", "button-set"].includes(type);
    const options = hasOptions ? (Array.isArray(control.options) ? control.options.slice(0, 100).map((option) => typeof option === "string" ? ({ value: string(option, 120), label: string(option, 120) }) : ({ value: string(option?.value, 120), label: string(option?.label ?? option?.value, 120) })) : []) : undefined;
    if (hasOptions && !options.length) errors.push(`controls[${index}] select requires at least one option.`);
    normalized.push({ key, type, sdkFieldType: string(control.sdkFieldType, 100) || undefined, label: string(control.label || key, 120), help: string(control.help, 240), default: control.default, min: Number.isFinite(Number(control.min)) ? Number(control.min) : undefined, max: Number.isFinite(Number(control.max)) ? Number(control.max) : undefined, step: Number.isFinite(Number(control.step)) ? Number(control.step) : undefined, options, unit: string(control.unit || "px", 16), keywords: Array.isArray(control.keywords) ? control.keywords.slice(0, 30).map((item) => string(item, 40)) : [], accept: string(control.accept || "image/*", 100), mediaTypes: Array.isArray(control.mediaTypes) ? control.mediaTypes.slice(0, 20).map((item) => string(item, 80)) : undefined });
  }
  return { ok: errors.length === 0, errors, controls: normalized };
}

export function validateWidgetDefinition(input = {}, { pluginId = "" } = {}) {
  const value = plainObject(input); const errors = [];
  const id = string(value.id, 64); const label = string(value.label, 120);
  if (!safeWidgetId(id)) errors.push("Widget id must use lowercase letters, numbers and hyphens.");
  if (!label) errors.push("Widget label is required.");
  if (pluginId && !id.startsWith(`${pluginId.split(".").pop()}-`) && pluginId !== "vsn.core") errors.push(`Third-party widget id must be namespaced with '${pluginId.split(".").pop()}-'.`);
  const controls = validateControlSchema(value.controls || []); errors.push(...controls.errors);
  return { ok: errors.length === 0, errors, widget: { ...value, id, label, category: string(value.category || "Plugin", 80), acceptsChildren: Boolean(value.acceptsChildren), defaults: { props: structuredClone(plainObject(value.defaults?.props)), styles: structuredClone(plainObject(value.defaults?.styles)) }, controls: controls.controls, capabilities: structuredClone(plainObject(value.capabilities)), styleProfile: structuredClone(plainObject(value.styleProfile)) } };
}

export function validatePluginManifest(input = {}, { appVersion = VSN_BASELINE.version } = {}) {
  const value = plainObject(input); const errors = []; const warnings = [];
  const id = string(value.id, 64); const name = string(value.name, 120); const version = string(value.version, 40);
  if (!safePluginId(id)) errors.push("Plugin id is invalid. Use lowercase letters, numbers, dots, underscores or hyphens.");
  if (!name) errors.push("Plugin name is required.");
  if (!/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(version)) errors.push("Plugin version must be semantic versioning (for example 1.0.0).");
  const schemaVersion = Number(value.schemaVersion || VSN_SDK_SCHEMA_VERSION); if (schemaVersion !== VSN_SDK_SCHEMA_VERSION) errors.push(`Unsupported plugin manifest schemaVersion ${schemaVersion}.`);
  const compatibility = plainObject(value.compatibility); const normalizedCompatibility = { min: string(compatibility.min || "2.5.50", 40), max: compatibility.max ? string(compatibility.max, 40) : undefined, maxExclusive: compatibility.maxExclusive ? string(compatibility.maxExclusive, 40) : undefined };
  if (!parseVersion(normalizedCompatibility.min)) errors.push("compatibility.min must be a semantic version.");
  if (normalizedCompatibility.max && !parseVersion(normalizedCompatibility.max)) errors.push("compatibility.max must be a semantic version.");
  if (normalizedCompatibility.maxExclusive && !parseVersion(normalizedCompatibility.maxExclusive)) errors.push("compatibility.maxExclusive must be a semantic version.");
  if (parseVersion(normalizedCompatibility.min) && normalizedCompatibility.max && parseVersion(normalizedCompatibility.max) && !versionSatisfies(normalizedCompatibility.min, { max: normalizedCompatibility.max })) errors.push("compatibility.max must be greater than or equal to compatibility.min.");
  if (parseVersion(normalizedCompatibility.min) && normalizedCompatibility.maxExclusive && parseVersion(normalizedCompatibility.maxExclusive) && !versionSatisfies(normalizedCompatibility.min, { maxExclusive: normalizedCompatibility.maxExclusive })) errors.push("compatibility.maxExclusive must be greater than compatibility.min.");
  if (!versionSatisfies(appVersion, normalizedCompatibility)) errors.push(`Plugin compatibility does not include VSN ${appVersion}.`);
  const permissions = Array.from(new Set((Array.isArray(value.permissions) ? value.permissions : []).map((item) => string(item, 80)).filter(Boolean)));
  const unknownPermissions = permissions.filter((permission) => !VSN_PLUGIN_ALLOWED_PERMISSIONS.includes(permission));
  if (unknownPermissions.length) errors.push(`Unsupported permissions: ${unknownPermissions.join(", ")}.`);
  const networkOrigins = Array.from(new Set((Array.isArray(value.networkOrigins) ? value.networkOrigins : []).map((item) => string(item, 240)).filter(Boolean)));
  for (const origin of networkOrigins) { try { const url = new URL(origin); if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) errors.push(`networkOrigins must contain HTTPS origins only: ${origin}`); } catch { errors.push(`Invalid network origin: ${origin}`); } }
  if (networkOrigins.length && !permissions.includes("network:external")) errors.push("networkOrigins requires the network:external permission.");
  const widgets = []; const seen = new Set();
  for (const rawWidget of (Array.isArray(value.widgets) ? value.widgets : [])) {
    const checked = validateWidgetDefinition(rawWidget, { pluginId: id }); errors.push(...checked.errors.map((error) => `Widget ${rawWidget?.id || "?"}: ${error}`));
    if (seen.has(checked.widget.id)) errors.push(`Duplicate widget id: ${checked.widget.id}`); seen.add(checked.widget.id); widgets.push(checked.widget);
  }
  if (!widgets.length && !(Array.isArray(value.dataProviders) && value.dataProviders.length)) warnings.push("Plugin does not declare widgets or data providers.");
  const manifest = { schemaVersion, id, name, version, description: string(value.description, 280), author: string(value.author, 120), compatibility: normalizedCompatibility, permissions, networkOrigins, widgets, dataProviders: Array.isArray(value.dataProviders) ? value.dataProviders.slice(0, 50) : [] };
  return { ok: errors.length === 0, errors, warnings, manifest };
}
