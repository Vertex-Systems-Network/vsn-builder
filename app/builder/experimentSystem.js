export const EXPERIMENT_SCHEMA_VERSION = 1;
export const EXPERIMENT_TARGET_TYPES = Object.freeze(["page", "section", "component"]);
export const EXPERIMENT_GOAL_TYPES = Object.freeze(["purchase", "revenue", "aov", "add_to_cart", "checkout", "form_submit", "click", "custom"]);
export const EXPERIMENT_STATUSES = Object.freeze(["draft", "running", "paused", "completed", "archived"]);
export const EXPERIMENT_EVENT_TYPES = Object.freeze(["impression", "add_to_cart", "checkout", "form_submit", "click", "custom", "purchase"]);

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

export function normalizeExperimentConfig(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    schemaVersion: EXPERIMENT_SCHEMA_VERSION,
    name: String(source.name || "Untitled experiment").trim() || "Untitled experiment",
    status: EXPERIMENT_STATUSES.includes(source.status) ? source.status : "draft",
    targetType: EXPERIMENT_TARGET_TYPES.includes(source.targetType) ? source.targetType : "page",
    pageId: String(source.pageId || "").trim(),
    targetNodeId: String(source.targetNodeId || "").trim(),
    goalType: EXPERIMENT_GOAL_TYPES.includes(source.goalType) ? source.goalType : "purchase",
    goalValue: String(source.goalValue || "").trim(),
    trafficPercent: Math.round(clamp(source.trafficPercent, 1, 100, 100)),
    minimumSessions: Math.round(clamp(source.minimumSessions, 20, 10000000, 200)),
    confidenceThreshold: clamp(source.confidenceThreshold, 0.8, 0.999, 0.95),
  };
}

export function stableExperimentHash(value = "") {
  let hash = 2166136261;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function chooseWeightedVariant(variants = [], seed = "") {
  const items = (Array.isArray(variants) ? variants : []).filter((item) => item && Number(item.weight || 0) > 0);
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + Math.max(1, Number(item.weight || 0)), 0);
  let point = stableExperimentHash(seed) * total;
  for (const item of items) {
    point -= Math.max(1, Number(item.weight || 0));
    if (point < 0) return item;
  }
  return items[items.length - 1];
}

function erf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCdf(value) { return 0.5 * (1 + erf(Number(value || 0) / Math.SQRT2)); }

export function twoProportionConfidence({ controlSessions = 0, controlConversions = 0, variantSessions = 0, variantConversions = 0 } = {}) {
  const n1 = Math.max(0, Number(controlSessions || 0));
  const n2 = Math.max(0, Number(variantSessions || 0));
  if (n1 < 2 || n2 < 2) return 0;
  const x1 = Math.max(0, Math.min(n1, Number(controlConversions || 0)));
  const x2 = Math.max(0, Math.min(n2, Number(variantConversions || 0)));
  const p1 = x1 / n1, p2 = x2 / n2;
  const pooled = (x1 + x2) / (n1 + n2);
  const variance = pooled * (1 - pooled) * ((1 / n1) + (1 / n2));
  if (!(variance > 0)) return p1 === p2 ? 0 : 0.999;
  const z = Math.abs((p2 - p1) / Math.sqrt(variance));
  return Math.max(0, Math.min(0.999, (normalCdf(z) - 0.5) * 2));
}

export function goalEventType(goalType = "purchase") {
  if (["purchase", "revenue", "aov"].includes(goalType)) return "purchase";
  return EXPERIMENT_EVENT_TYPES.includes(goalType) ? goalType : "purchase";
}

export function experimentVariantStats({ experiment = {}, variants = [], assignments = [], events = [] } = {}) {
  const config = normalizeExperimentConfig(experiment);
  const goalEvent = goalEventType(config.goalType);
  const byVariant = new Map((variants || []).map((variant) => [String(variant.id), {
    id: String(variant.id), key: variant.key, name: variant.name, isControl: Boolean(variant.isControl), weight: Number(variant.weight || 0),
    sessions: 0, conversions: 0, purchases: 0, revenue: 0, conversionRate: 0, aov: 0, uplift: null, confidence: 0,
  }]));
  for (const assignment of assignments || []) {
    const row = byVariant.get(String(assignment.variantId)); if (row) row.sessions += 1;
  }
  const converters = new Map(Array.from(byVariant.keys()).map((id)=>[id,new Set()]));
  for (const event of events || []) {
    const row = byVariant.get(String(event.variantId)); if (!row) continue;
    const goalNameMatches = config.goalType !== "custom" || !config.goalValue || String(event.eventName || "") === config.goalValue;
    if (event.eventType === goalEvent && goalNameMatches) converters.get(String(event.variantId))?.add(String(event.visitorId || event.id));
    if (event.eventType === "purchase") { row.purchases += 1; row.revenue += Math.max(0, Number(event.value || 0)); }
  }
  for (const row of byVariant.values()) {
    row.conversions = converters.get(String(row.id))?.size || 0;
    row.conversionRate = row.sessions > 0 ? row.conversions / row.sessions : 0;
    row.aov = row.purchases > 0 ? row.revenue / row.purchases : 0;
  }
  const rows = Array.from(byVariant.values());
  const control = rows.find((row) => row.isControl) || rows[0] || null;
  for (const row of rows) {
    if (!control || row.id === control.id) continue;
    row.uplift = control.conversionRate > 0 ? (row.conversionRate - control.conversionRate) / control.conversionRate : (row.conversionRate > 0 ? 1 : 0);
    row.confidence = twoProportionConfidence({ controlSessions: control.sessions, controlConversions: control.conversions, variantSessions: row.sessions, variantConversions: row.conversions });
  }
  const totalSessions = rows.reduce((sum, row) => sum + row.sessions, 0);
  const eligible = rows.filter((row) => !row.isControl && row.sessions >= 10 && row.conversionRate > (control?.conversionRate || 0) && row.confidence >= config.confidenceThreshold);
  eligible.sort((a, b) => b.conversionRate - a.conversionRate || b.revenue - a.revenue);
  const sampleReady = totalSessions >= config.minimumSessions && rows.every((row) => row.sessions >= Math.max(10, Math.floor(config.minimumSessions / Math.max(2, rows.length) / 3)));
  const winnerCandidate = sampleReady ? (eligible[0] || null) : null;
  return { config, rows, totalSessions, control, sampleReady, winnerCandidate, status: !sampleReady ? "collecting" : winnerCandidate ? "winner-ready" : "no-winner" };
}
