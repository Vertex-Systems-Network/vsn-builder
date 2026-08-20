import { validatePluginManifest, validateWidgetDefinition } from "./validation.js";
import { VSN_SDK_API_VERSION } from "./version.js";
import { VSN_BASELINE } from "../config/baseline.js";

const pluginRegistry = new Map();
const widgetRegistry = new Map();
const editorRenderers = new Map();
const storefrontRenderers = new Map();
const dataProviders = new Map();
const categoryRegistry = new Map();
const fieldTypeRegistry = new Map();
const controlRegistry = new Map();
const templateTypeRegistry = new Map();
const inspectorPanelRegistry = new Map();
const VSN_FIELD_BASE_TYPES = new Set(["text","textarea","number","toggle","select","multi-select","radio","button-set","url","color","color-gradient","range","css-length","date","datetime","time","dimensions","border-radius","typography","media","icon"]);
const runtimeErrors = [];
let legacyWidgetRegistrar = null;

function clone(value) { try { return structuredClone(value); } catch { return value; } }
function recordError(scope, key, error) {
  runtimeErrors.unshift({ at: new Date().toISOString(), scope, key, message: error instanceof Error ? error.message : String(error) });
  runtimeErrors.splice(50);
}

function pluginOwnsWidget(pluginId, id) { return widgetRegistry.get(id)?.pluginId === pluginId; }
function pluginOwnsProvider(pluginId, id) { return dataProviders.get(id)?.pluginId === pluginId; }
function extensionId(value) { return String(value || "").trim(); }
function registerExtension(registry, input, { pluginId="vsn.core", pluginVersion="1.0.0", permissions=[] }={}, kind="extension", requiredPermission="editor:controls") {
  const id=extensionId(input?.id);
  if (!/^[a-z0-9][a-z0-9:._-]{1,100}$/.test(id)) throw new Error(`${kind} id is invalid.`);
  const existing=registry.get(id);
  if (existing && existing.pluginId!==pluginId) throw new Error(`${kind} '${id}' is already registered by ${existing.pluginId}.`);
  if (pluginId!=="vsn.core" && requiredPermission && !(permissions||[]).includes(requiredPermission)) throw new Error(`${kind} '${id}' requires ${requiredPermission} permission.`);
  const definition=Object.freeze({ ...input, id, label:String(input?.label||id).slice(0,120), pluginId, pluginVersion });
  registry.set(id,definition); return definition;
}
function listExtensions(registry) { return Array.from(registry.values()).map((row)=>clone(row)); }

export function connectLegacyWidgetRegistry(registrar) {
  legacyWidgetRegistrar = typeof registrar === "function" ? registrar : null;
  if (legacyWidgetRegistrar) {
    for (const definition of widgetRegistry.values()) legacyWidgetRegistrar(definition.id, legacyDefinition(definition));
  }
}

function legacyDefinition(definition) {
  return {
    label: definition.label,
    acceptsChildren: definition.acceptsChildren,
    props: clone(definition.defaults?.props || {}),
    styles: clone(definition.defaults?.styles || {}),
    category: definition.category || "Plugin",
    sdk: {
      pluginId: definition.pluginId,
      version: definition.version || "1.0.0",
      controls: clone(definition.controls || []),
      capabilities: clone(definition.capabilities || {}),
      styleProfile: clone(definition.styleProfile || {}),
    },
  };
}

export function registerVsnWidget(input, { pluginId = "vsn.core", pluginVersion = "1.0.0", permissions = [] } = {}) {
  const controls = (Array.isArray(input?.controls) ? input.controls : []).map((control) => {
    const customType = fieldTypeRegistry.get(String(control?.type || ""));
    return customType ? { ...control, type: customType.baseType || "text", sdkFieldType: customType.id } : control;
  });
  const checked = validateWidgetDefinition({ ...input, controls }, { pluginId });
  if (!checked.ok) throw new Error(`VSN SDK widget validation failed: ${checked.errors.join(" ")}`);
  const existing = widgetRegistry.get(checked.widget.id);
  if (existing && existing.pluginId !== pluginId) throw new Error(`Widget '${checked.widget.id}' is already registered by ${existing.pluginId}.`);

  const permissionSet = new Set(permissions || []);
  if (pluginId !== "vsn.core") {
    if ((checked.widget.controls || []).length && !permissionSet.has("editor:controls")) throw new Error(`Widget '${checked.widget.id}' requires editor:controls permission.`);
    if (typeof input.renderers?.editor === "function" && !permissionSet.has("editor:preview")) throw new Error(`Widget '${checked.widget.id}' requires editor:preview permission.`);
    if (typeof input.renderers?.storefront === "function" && !permissionSet.has("storefront:render")) throw new Error(`Widget '${checked.widget.id}' requires storefront:render permission.`);
  }

  const definition = Object.freeze({
    ...checked.widget,
    pluginId,
    version: pluginVersion,
    sdkApiVersion: VSN_SDK_API_VERSION,
    hooks: Object.freeze({ ...(input.hooks || {}) }),
  });
  widgetRegistry.set(definition.id, definition);
  if (typeof input.renderers?.editor === "function") editorRenderers.set(definition.id, input.renderers.editor);
  else editorRenderers.delete(definition.id);
  if (typeof input.renderers?.storefront === "function") storefrontRenderers.set(definition.id, input.renderers.storefront);
  else storefrontRenderers.delete(definition.id);
  if (legacyWidgetRegistrar) legacyWidgetRegistrar(definition.id, legacyDefinition(definition));
  return definition;
}


export function unregisterVsnWidget(id, { pluginId="vsn.core" }={}) {
  const key=String(id||""); const current=widgetRegistry.get(key);
  if (!current || current.pluginId!==pluginId) return false;
  widgetRegistry.delete(key); editorRenderers.delete(key); storefrontRenderers.delete(key); return true;
}
export function registerVsnCategory(input, options={}) { return registerExtension(categoryRegistry,input,options,"Category"); }
export function registerVsnFieldType(input, options={}) {
  const baseType=String(input?.baseType||"text");
  if(!VSN_FIELD_BASE_TYPES.has(baseType)) throw new Error(`Field type baseType '${baseType}' is not supported.`);
  return registerExtension(fieldTypeRegistry,{...input,baseType},options,"Field type");
}
export function registerVsnControl(input, options={}) { return registerExtension(controlRegistry,input,options,"Control"); }
export function registerVsnTemplateType(input, options={}) { return registerExtension(templateTypeRegistry,input,options,"Template type"); }
export function registerVsnInspectorPanel(input, options={}) { return registerExtension(inspectorPanelRegistry,input,options,"Inspector panel","editor:preview"); }
export function listVsnCategories(){return listExtensions(categoryRegistry);}
export function listVsnFieldTypes(){return listExtensions(fieldTypeRegistry);}
export function listVsnControls(){return listExtensions(controlRegistry);}
export function listVsnTemplateTypes(){return listExtensions(templateTypeRegistry);}
export function listVsnInspectorPanels(){return listExtensions(inspectorPanelRegistry);}
export function registerVsnDataProvider(input, { pluginId = "vsn.core", pluginVersion = "1.0.0", permissions = [], networkOrigins = [] } = {}) {
  const id = String(input?.id || "").trim();
  if (!/^[a-z0-9][a-z0-9:._-]{2,100}$/.test(id)) throw new Error("Data provider id is invalid.");
  if (pluginId !== "vsn.core") {
    const namespace = String(pluginId || "").split(".").pop();
    if (!namespace || !id.startsWith(`${namespace}:`)) throw new Error(`Third-party data provider id must be namespaced with '${namespace}:'.`);
    if (id.startsWith("shopify:") || id.startsWith("vsn:")) throw new Error(`Data provider namespace '${id.split(":")[0]}:' is reserved by VSN.`);
  }
  if (typeof input?.resolve !== "function") throw new Error(`Data provider '${id}' requires a resolve() function.`);
  const existing = dataProviders.get(id);
  if (existing && existing.pluginId !== pluginId) throw new Error(`Data provider '${id}' is already registered.`);
  const requiredPermissions = Array.from(new Set((input.requiredPermissions || []).map(String)));
  const permissionSet = new Set(permissions || []);
  if (pluginId !== "vsn.core") {
    const missing = requiredPermissions.filter((permission) => !permissionSet.has(permission));
    if (missing.length) throw new Error(`Data provider '${id}' requires permission${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
    const declaredOrigins = new Set((networkOrigins || []).map(String));
    const providerOrigins = (input.networkOrigins || []).map(String);
    const undeclared = providerOrigins.filter((origin) => !declaredOrigins.has(origin));
    if (undeclared.length) throw new Error(`Data provider '${id}' uses undeclared network origin${undeclared.length === 1 ? "" : "s"}: ${undeclared.join(", ")}.`);
  }
  const provider = Object.freeze({
    ...input,
    id,
    pluginId,
    pluginVersion,
    permissions: Object.freeze([...(permissions || [])]),
    requiredPermissions: Object.freeze(requiredPermissions),
    label: String(input.label || id),
    type: String(input.type || "custom"),
  });
  dataProviders.set(id, provider);
  return provider;
}

function snapshotPluginEntries(pluginId) {
  return {
    widgets: Array.from(widgetRegistry.entries()).filter(([, value]) => value.pluginId === pluginId).map(([id, value]) => ({ id, value, editor: editorRenderers.get(id), storefront: storefrontRenderers.get(id) })),
    providers: Array.from(dataProviders.entries()).filter(([, value]) => value.pluginId === pluginId),
    categories: Array.from(categoryRegistry.entries()).filter(([, value]) => value.pluginId === pluginId),
    fieldTypes: Array.from(fieldTypeRegistry.entries()).filter(([, value]) => value.pluginId === pluginId),
    controls: Array.from(controlRegistry.entries()).filter(([, value]) => value.pluginId === pluginId),
    templateTypes: Array.from(templateTypeRegistry.entries()).filter(([, value]) => value.pluginId === pluginId),
    inspectorPanels: Array.from(inspectorPanelRegistry.entries()).filter(([, value]) => value.pluginId === pluginId),
  };
}

function removePluginEntries(pluginId) {
  for (const [id, value] of widgetRegistry.entries()) {
    if (value.pluginId !== pluginId) continue;
    widgetRegistry.delete(id); editorRenderers.delete(id); storefrontRenderers.delete(id);
  }
  for (const [id, value] of dataProviders.entries()) if (value.pluginId === pluginId) dataProviders.delete(id);
  for (const registry of [categoryRegistry,fieldTypeRegistry,controlRegistry,templateTypeRegistry,inspectorPanelRegistry]) for (const [id,value] of registry.entries()) if(value.pluginId===pluginId) registry.delete(id);
}

function restorePluginEntries(snapshot) {
  for (const row of snapshot.widgets || []) {
    widgetRegistry.set(row.id, row.value);
    if (row.editor) editorRenderers.set(row.id, row.editor);
    if (row.storefront) storefrontRenderers.set(row.id, row.storefront);
    if (legacyWidgetRegistrar) legacyWidgetRegistrar(row.id, legacyDefinition(row.value));
  }
  for (const [id, value] of snapshot.providers || []) dataProviders.set(id, value);
  for (const [id,value] of snapshot.categories||[]) categoryRegistry.set(id,value);
  for (const [id,value] of snapshot.fieldTypes||[]) fieldTypeRegistry.set(id,value);
  for (const [id,value] of snapshot.controls||[]) controlRegistry.set(id,value);
  for (const [id,value] of snapshot.templateTypes||[]) templateTypeRegistry.set(id,value);
  for (const [id,value] of snapshot.inspectorPanels||[]) inspectorPanelRegistry.set(id,value);
}

export function registerVsnPlugin(input, { appVersion = VSN_BASELINE.version, source = "bundled" } = {}) {
  const manifestInput = input?.manifest || input;
  const checked = validatePluginManifest(manifestInput, { appVersion });
  if (!checked.ok) throw new Error(`VSN plugin manifest validation failed: ${checked.errors.join(" ")}`);
  const manifest = checked.manifest;
  const previous = pluginRegistry.get(manifest.id);
  if (previous && previous.manifest.version === manifest.version) return previous;

  const previousEntries = snapshotPluginEntries(manifest.id);
  const record = {
    manifest,
    source,
    status: "loading",
    registeredAt: new Date().toISOString(),
    widgets: [],
    dataProviders: [],
    categories: [], fieldTypes: [], controls: [], templateTypes: [], inspectorPanels: [],
    warnings: checked.warnings,
    error: null,
  };
  pluginRegistry.set(manifest.id, record);
  const api = Object.freeze({
    sdkVersion: VSN_SDK_API_VERSION,
    permissions: Object.freeze([...manifest.permissions]),
    registerWidget: (definition) => {
      const widget = registerVsnWidget(definition, { pluginId: manifest.id, pluginVersion: manifest.version, permissions: manifest.permissions });
      record.widgets.push(widget.id);
      return widget;
    },
    registerDataProvider: (definition) => {
      const provider = registerVsnDataProvider(definition, { pluginId: manifest.id, pluginVersion: manifest.version, permissions: manifest.permissions, networkOrigins: manifest.networkOrigins });
      record.dataProviders.push(provider.id);
      return provider;
    },
    registerCategory: (definition) => { const row=registerVsnCategory(definition,{pluginId:manifest.id,pluginVersion:manifest.version,permissions:manifest.permissions}); record.categories.push(row.id); return row; },
    registerFieldType: (definition) => { const row=registerVsnFieldType(definition,{pluginId:manifest.id,pluginVersion:manifest.version,permissions:manifest.permissions}); record.fieldTypes.push(row.id); return row; },
    registerControl: (definition) => { const row=registerVsnControl(definition,{pluginId:manifest.id,pluginVersion:manifest.version,permissions:manifest.permissions}); record.controls.push(row.id); return row; },
    registerTemplateType: (definition) => { const row=registerVsnTemplateType(definition,{pluginId:manifest.id,pluginVersion:manifest.version,permissions:manifest.permissions}); record.templateTypes.push(row.id); return row; },
    registerInspectorPanel: (definition) => { const row=registerVsnInspectorPanel(definition,{pluginId:manifest.id,pluginVersion:manifest.version,permissions:manifest.permissions}); record.inspectorPanels.push(row.id); return row; },
  });

  try {
    if (typeof input?.setup === "function") input.setup(api);
    else for (const widget of manifest.widgets) api.registerWidget(widget);
    // Remove widgets/providers left behind by an older plugin version.
    for (const row of previousEntries.widgets) if (!record.widgets.includes(row.id) && pluginOwnsWidget(manifest.id, row.id)) { widgetRegistry.delete(row.id); editorRenderers.delete(row.id); storefrontRenderers.delete(row.id); }
    for (const [id] of previousEntries.providers) if (!record.dataProviders.includes(id) && pluginOwnsProvider(manifest.id, id)) dataProviders.delete(id);
    for (const [key,registry,list] of [["categories",categoryRegistry,record.categories],["fieldTypes",fieldTypeRegistry,record.fieldTypes],["controls",controlRegistry,record.controls],["templateTypes",templateTypeRegistry,record.templateTypes],["inspectorPanels",inspectorPanelRegistry,record.inspectorPanels]]) for (const [id,value] of previousEntries[key]||[]) if(!list.includes(id)&&value.pluginId===manifest.id) registry.delete(id);
    record.status = "active";
  } catch (error) {
    removePluginEntries(manifest.id);
    restorePluginEntries(previousEntries);
    if (previous) pluginRegistry.set(manifest.id, previous);
    else pluginRegistry.set(manifest.id, { ...record, status: "error", error: error instanceof Error ? error.message : String(error) });
    record.status = "error";
    record.error = error instanceof Error ? error.message : String(error);
    recordError("plugin.setup", manifest.id, error);
  }
  return pluginRegistry.get(manifest.id) || record;
}

export function getVsnWidgetDefinition(id) { return widgetRegistry.get(String(id || "")) || null; }
export function getVsnWidgetControls(id) { return clone(getVsnWidgetDefinition(id)?.controls || []); }
export function getVsnEditorRenderer(id) { return editorRenderers.get(String(id || "")) || null; }
export function getVsnStorefrontRenderer(id) { return storefrontRenderers.get(String(id || "")) || null; }
export function getVsnWidgetHooks(id) { return getVsnWidgetDefinition(id)?.hooks || {}; }
export function getVsnDataProvider(id) { return dataProviders.get(String(id || "")) || null; }
export function getVsnPluginPermissions(pluginId) { return [...(pluginRegistry.get(String(pluginId || ""))?.manifest?.permissions || [])]; }
export function listVsnDataProviders() {
  return Array.from(dataProviders.values()).map((provider) => ({
    id: provider.id,
    pluginId: provider.pluginId,
    pluginVersion: provider.pluginVersion,
    label: provider.label,
    type: provider.type,
    description: provider.description || "",
    requiredPermissions: [...(provider.requiredPermissions || [])],
  }));
}
export function listVsnWidgets() {
  return Array.from(widgetRegistry.values()).map((definition) => ({
    id: definition.id,
    label: definition.label,
    category: definition.category,
    family: definition.family || "interactive",
    acceptsChildren: Boolean(definition.acceptsChildren),
    pluginId: definition.pluginId,
    version: definition.version,
    sdkApiVersion: definition.sdkApiVersion,
    controls: clone(definition.controls || []),
    capabilities: clone(definition.capabilities || {}),
    styleProfile: clone(definition.styleProfile || {}),
    renderers: { editor: editorRenderers.has(definition.id), storefront: storefrontRenderers.has(definition.id) },
    hooks: Object.keys(definition.hooks || {}),
  }));
}
export function listVsnPlugins() {
  return Array.from(pluginRegistry.values()).map((record) => ({
    manifest: clone(record.manifest),
    source: record.source,
    status: record.status,
    registeredAt: record.registeredAt,
    widgets: [...record.widgets],
    dataProviders: [...record.dataProviders],
    categories: [...(record.categories||[])], fieldTypes: [...(record.fieldTypes||[])], controls: [...(record.controls||[])], templateTypes: [...(record.templateTypes||[])], inspectorPanels: [...(record.inspectorPanels||[])],
    warnings: [...(record.warnings || [])],
    error: record.error,
  }));
}
export function listVsnSdkErrors() { return clone(runtimeErrors); }
export function reportVsnSdkError(scope, key, error) { recordError(scope, key, error); }
