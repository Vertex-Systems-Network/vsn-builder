import { chooseWeightedVariant, EXPERIMENT_EVENT_TYPES, normalizeExperimentConfig, stableExperimentHash } from "../builder/experimentSystem.js";

function safeJson(value, fallback = null) { try { return JSON.parse(String(value || "")); } catch { return fallback; } }
function clone(value) { try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); } }

function walkReplace(nodes, targetId, replacement) {
  let replaced = false;
  const next = (Array.isArray(nodes) ? nodes : []).map((node) => {
    if (!node || typeof node !== "object") return node;
    if (String(node.id || "") === String(targetId || "")) { replaced = true; return replacement; }
    const children = walkReplace(node.children || [], targetId, replacement);
    if (children.replaced) { replaced = true; return { ...node, children: children.nodes }; }
    return node;
  });
  return { nodes: next, replaced };
}

function remapSnapshot(snapshot, targetId, variantKey = "variant") {
  const root = clone(snapshot);
  if (!root || typeof root !== "object") return null;
  const map = new Map(); let index = 0;
  const collect = (node, rootNode = false) => {
    if (!node || typeof node !== "object") return;
    const old = String(node.id || `node-${index}`);
    map.set(old, rootNode ? String(targetId) : `${String(targetId)}--exp-${String(variantKey).replace(/[^a-z0-9_-]/gi, "_")}-${++index}`);
    for (const child of node.children || []) collect(child, false);
  };
  collect(root, true);
  const apply = (node) => {
    if (!node || typeof node !== "object") return node;
    const old = String(node.id || "");
    const next = { ...node, id: map.get(old) || old };
    if (next.props?.targetId && map.has(String(next.props.targetId))) next.props = { ...next.props, targetId: map.get(String(next.props.targetId)) };
    next.children = (node.children || []).map(apply);
    return next;
  };
  return apply(root);
}

export async function activeExperimentForPage(db, shop, pageId, now = new Date()) {
  if (!pageId) return null;
  const rows = await db.builderExperiment.findMany({
    where: { shop, pageId: String(pageId), status: "running" },
    orderBy: [{ startedAt: "asc" }, { updatedAt: "desc" }], take: 10,
  });
  return rows.find((row) => (!row.startedAt || row.startedAt <= now) && (!row.endedAt || row.endedAt > now)) || null;
}

export async function assignExperimentVisitor({ db, shop, experiment, visitorId, sessionId = "" }) {
  const config = normalizeExperimentConfig(experiment);
  const visitor = String(visitorId || "").trim().slice(0, 120);
  if (!visitor || !experiment?.id) return null;
  const variants = await db.builderExperimentVariant.findMany({ where: { experimentId: experiment.id }, orderBy: [{ isControl: "desc" }, { createdAt: "asc" }] });
  if (variants.length < 2) return null;
  const existing = await db.builderExperimentAssignment.findUnique({ where: { experimentId_visitorId: { experimentId: experiment.id, visitorId: visitor } } });
  if (existing) {
    const variant = variants.find((item) => item.id === existing.variantId);
    if (variant) {
      await db.builderExperimentAssignment.update({ where: { id: existing.id }, data: { lastSeenAt: new Date(), sessionId: String(sessionId || "").slice(0, 120) || existing.sessionId } }).catch(() => null);
      return { experiment, variant, assignment: existing, variants };
    }
  }
  const trafficBucket = stableExperimentHash(`${shop}:${experiment.id}:${visitor}:traffic`) * 100;
  if (trafficBucket >= config.trafficPercent) return null;
  const variant = chooseWeightedVariant(variants, `${shop}:${experiment.id}:${visitor}:variant`);
  if (!variant) return null;
  try {
    const assignment = await db.builderExperimentAssignment.create({ data: { shop, experimentId: experiment.id, variantId: variant.id, visitorId: visitor, sessionId: String(sessionId || "").slice(0, 120) || null } });
    return { experiment, variant, assignment, variants };
  } catch {
    const assignment = await db.builderExperimentAssignment.findUnique({ where: { experimentId_visitorId: { experimentId: experiment.id, visitorId: visitor } } });
    const racedVariant = variants.find((item) => item.id === assignment?.variantId);
    return assignment && racedVariant ? { experiment, variant: racedVariant, assignment, variants } : null;
  }
}

export function applyExperimentVariant(elements, experiment, variant) {
  const config = normalizeExperimentConfig(experiment);
  if (!variant || variant.isControl || !variant.snapshotJson) return { elements, changed: false };
  const snapshot = safeJson(variant.snapshotJson, null);
  if (config.targetType === "page") {
    return { elements: Array.isArray(snapshot) ? clone(snapshot) : elements, changed: Array.isArray(snapshot) };
  }
  const node = Array.isArray(snapshot) ? snapshot[0] : snapshot;
  if (!node || !config.targetNodeId) return { elements, changed: false };
  const replacement = remapSnapshot(node, config.targetNodeId, variant.key || variant.id);
  const result = walkReplace(elements, config.targetNodeId, replacement);
  return { elements: result.nodes, changed: result.replaced };
}

export async function resolveExperimentRender({ db, shop, page, elements, visitorId, sessionId, forcedExperimentId = "", forcedVariantKey = "" }) {
  if (forcedExperimentId && forcedVariantKey) {
    const experiment = await db.builderExperiment.findFirst({ where: { id:String(forcedExperimentId), shop, pageId:String(page?.id || "") } });
    if (experiment) {
      const variant = await db.builderExperimentVariant.findFirst({ where: { experimentId:experiment.id, key:String(forcedVariantKey) } });
      if (variant) { const applied=applyExperimentVariant(elements,experiment,variant); return { page,elements:applied.elements,experiment,variant,assignment:null,changed:applied.changed,preview:true }; }
    }
  }
  const experiment = await activeExperimentForPage(db, shop, page?.id);
  if (!experiment) return { page, elements, experiment: null, variant: null, assignment: null, changed: false, preview:false };
  const assigned = await assignExperimentVisitor({ db, shop, experiment, visitorId, sessionId });
  if (!assigned) return { page, elements, experiment: null, variant: null, assignment: null, changed: false, preview:false };
  const applied = applyExperimentVariant(elements, experiment, assigned.variant);
  return { page, elements: applied.elements, experiment, variant: assigned.variant, assignment: assigned.assignment, changed: applied.changed, preview:false };
}

export async function recordExperimentEvent({ db, shop, experimentId, variantId, visitorId, sessionId = "", eventType, eventName = "", value = null, currency = "", metadata = null, dedupeKey = null }) {
  const type = EXPERIMENT_EVENT_TYPES.includes(eventType) ? eventType : "";
  const visitor = String(visitorId || "").trim().slice(0, 120);
  if (!type || !visitor || !experimentId || !variantId) return { success: false, error: "Invalid experiment event." };
  const assignment = await db.builderExperimentAssignment.findFirst({ where: { shop, experimentId: String(experimentId), variantId: String(variantId), visitorId: visitor } });
  if (!assignment) return { success: false, error: "Experiment assignment was not found." };
  const safeValue = type === "purchase" ? Math.max(0, Number(value || 0)) : (Number.isFinite(Number(value)) ? Number(value) : null);
  const data = {
    shop, experimentId: String(experimentId), variantId: String(variantId), visitorId: visitor,
    sessionId: String(sessionId || "").slice(0, 120) || null, eventType: type, eventName: String(eventName || "").slice(0, 160) || null,
    value: safeValue, currency: String(currency || "").slice(0, 12) || null, metadataJson: metadata ? JSON.stringify(metadata).slice(0, 12000) : null,
    dedupeKey: dedupeKey ? String(dedupeKey).slice(0, 220) : null,
  };
  try { const event = await db.builderExperimentEvent.create({ data }); return { success: true, event }; }
  catch (error) {
    if (data.dedupeKey) {
      const existing = await db.builderExperimentEvent.findFirst({ where: { shop, dedupeKey: data.dedupeKey } });
      if (existing) return { success: true, event: existing, duplicate: true };
    }
    throw error;
  }
}

export function parseExperimentCartAttribute(value) {
  const parsed = safeJson(value, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, 12).map((item) => ({ experimentId: String(item?.e || item?.experimentId || ""), variantId: String(item?.v || item?.variantId || ""), visitorId: String(item?.u || item?.visitorId || "") })).filter((item) => item.experimentId && item.variantId && item.visitorId);
}

export async function recordPaidOrderAttribution({ db, shop, order }) {
  const attrs = Array.isArray(order?.note_attributes) ? order.note_attributes : Array.isArray(order?.custom_attributes) ? order.custom_attributes : [];
  const row = attrs.find((item) => String(item?.name || item?.key || "") === "vsn_experiments");
  const assignments = parseExperimentCartAttribute(row?.value || "");
  if (!assignments.length) return { attributed: 0 };
  const orderId = String(order?.admin_graphql_api_id || order?.id || "").slice(0, 160);
  const value = Math.max(0, Number(order?.current_total_price ?? order?.total_price ?? order?.subtotal_price ?? 0));
  const currency = String(order?.currency || order?.presentment_currency || "").slice(0, 12);
  let attributed = 0;
  for (const item of assignments) {
    const experiment = await db.builderExperiment.findFirst({ where: { id: item.experimentId, shop } });
    const variant = await db.builderExperimentVariant.findFirst({ where: { id: item.variantId, experimentId: item.experimentId } });
    if (!experiment || !variant) continue;
    await db.builderExperimentAssignment.upsert({
      where: { experimentId_visitorId: { experimentId: experiment.id, visitorId: item.visitorId } },
      create: { shop, experimentId: experiment.id, variantId: variant.id, visitorId: item.visitorId },
      update: { variantId: variant.id, lastSeenAt: new Date() },
    });
    const result = await recordExperimentEvent({ db, shop, experimentId: experiment.id, variantId: variant.id, visitorId: item.visitorId, eventType: "purchase", value, currency, dedupeKey: `paid:${orderId}:${experiment.id}`, metadata: { orderId } });
    if (result.success && !result.duplicate) attributed += 1;
  }
  return { attributed };
}
