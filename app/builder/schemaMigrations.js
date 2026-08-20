import { VSN_BASELINE } from "../config/baseline.js";
import { normalizeElementInteractions } from "./interactionSchema.js";
import { normalizeResponsiveBreakpoints } from "./responsiveEngine.js";

export const CURRENT_SCHEMA = VSN_BASELINE.schema;
const SETTINGS_ID = "__vsn_template_settings__";

function objectOr(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function migrateNodeV0ToV1(node) {
  if (!node || typeof node !== "object") return node;
  const next = {
    ...node,
    props: objectOr(node.props),
    styles: objectOr(node.styles),
    meta: objectOr(node.meta),
    children: Array.isArray(node.children) ? node.children.map(migrateNodeV0ToV1) : [],
  };
  if (next.props?.interactions || next.interactions) {
    const interactions = normalizeElementInteractions(next.props?.interactions || next.interactions || {});
    if (next.props?.interactions) next.props = { ...next.props, interactions };
    else next.interactions = interactions;
  }
  return next;
}

function migrateNodeV1ToV2(node) {
  if (!node || typeof node !== "object") return node;
  const next = { ...node, children: Array.isArray(node.children) ? node.children.map(migrateNodeV1ToV2) : [] };
  if (next.type === "global-styles") {
    const props = objectOr(next.props);
    next.props = { ...props, responsiveBreakpoints: normalizeResponsiveBreakpoints(props) };
  }
  if (next.type === "component-instance") {
    next.props = { componentId: "", variantId: "default", propValues: {}, overrides: {}, activeSlot: "content", masterVersion: 0, ...objectOr(next.props) };
  }
  return next;
}


function migrateNodeV2ToV3(node) {
  if (!node || typeof node !== "object") return node;
  const next = { ...node, children: Array.isArray(node.children) ? node.children.map(migrateNodeV2ToV3) : [] };
  next.interactions = normalizeElementInteractions(next.interactions || next.props?.interactions || {});
  if (next.props?.interactions) {
    const props = { ...next.props };
    delete props.interactions;
    next.props = props;
  }
  return next;
}

const DOCUMENT_MIGRATIONS = Object.freeze({
  1: (nodes) => (Array.isArray(nodes) ? nodes.map(migrateNodeV0ToV1) : []),
  2: (nodes) => (Array.isArray(nodes) ? nodes.map(migrateNodeV1ToV2) : []),
  3: (nodes) => (Array.isArray(nodes) ? nodes.map(migrateNodeV2ToV3) : []),
});

function schemaMeta() {
  return {
    documentSchemaVersion: CURRENT_SCHEMA.document,
    widgetSchemaVersion: CURRENT_SCHEMA.widgets,
    styleSchemaVersion: CURRENT_SCHEMA.styles,
    interactionSchemaVersion: CURRENT_SCHEMA.interactions,
    querySchemaVersion: CURRENT_SCHEMA.queries,
    componentSchemaVersion: CURRENT_SCHEMA.components,
    responsiveSchemaVersion: CURRENT_SCHEMA.responsive,
    localizationSchemaVersion: CURRENT_SCHEMA.localization,
    baselineVersion: VSN_BASELINE.version,
  };
}

export function readDocumentSchemaVersion(nodes = []) {
  const settings = (Array.isArray(nodes) ? nodes : []).find((item) => item?.type === "template-settings");
  return Math.max(0, Number(settings?.props?.__vsn?.documentSchemaVersion || 0));
}

export function stampBuilderSchema(nodes = []) {
  const content = Array.isArray(nodes) ? nodes : [];
  const index = content.findIndex((item) => item?.type === "template-settings");
  const existing = index >= 0 ? content[index] : null;
  const settings = {
    id: existing?.id || SETTINGS_ID,
    type: "template-settings",
    label: existing?.label || "Template Settings",
    props: {
      ...objectOr(existing?.props),
      __vsn: { ...objectOr(existing?.props?.__vsn), ...schemaMeta() },
    },
    styles: objectOr(existing?.styles),
    children: [],
  };
  if (index < 0) return [settings, ...content];
  const next = [...content];
  next[index] = settings;
  return next;
}

export function migrateBuilderContent(input = []) {
  let nodes = Array.isArray(input) ? structuredClone(input) : [];
  let version = readDocumentSchemaVersion(nodes);
  if (version > CURRENT_SCHEMA.document) {
    const error = new Error(`This template uses document schema v${version}, but this release supports v${CURRENT_SCHEMA.document}.`);
    error.code = "VSN_SCHEMA_TOO_NEW";
    throw error;
  }
  while (version < CURRENT_SCHEMA.document) {
    const target = version + 1;
    const migration = DOCUMENT_MIGRATIONS[target];
    if (typeof migration !== "function") throw new Error(`Missing VSN document migration ${version} -> ${target}.`);
    nodes = migration(nodes);
    version = target;
  }
  return stampBuilderSchema(nodes);
}

export function getMigrationRegistrySummary() {
  return Object.freeze({
    current: CURRENT_SCHEMA,
    documentMigrations: Object.keys(DOCUMENT_MIGRATIONS).map(Number).sort((a, b) => a - b),
  });
}
