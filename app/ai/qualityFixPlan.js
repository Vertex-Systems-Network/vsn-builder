import { QUALITY_REPORT_VERSION } from "./qualityAgent.js";

export const QUALITY_FIX_PLAN_VERSION = 1;
export const QUALITY_FIX_PLAN_MAX_INPUT_FINDINGS = 40;
export const QUALITY_FIX_PLAN_MAX_ITEMS = 12;

export const QUALITY_FIX_PLAN_COMMAND_INTENTS = Object.freeze([
  "element.insert",
  "element.move",
  "element.update-props",
  "element.update-styles",
  "element.rewrite",
  "element.remove",
]);

export const QUALITY_FIX_PLAN_INTENTS = Object.freeze([
  ...QUALITY_FIX_PLAN_COMMAND_INTENTS,
  "manual-review",
]);

const INTENT_SET = new Set(QUALITY_FIX_PLAN_INTENTS);
const TARGETED_INTENTS = new Set([
  "element.move",
  "element.update-props",
  "element.update-styles",
  "element.rewrite",
  "element.remove",
]);
const PLAN_KEYS = new Set(["status", "summary", "items"]);
const ITEM_KEYS = new Set([
  "findingId",
  "commandIntent",
  "explanation",
  "proposedChange",
  "elementId",
  "blockId",
  "requiresMerchantInput",
]);

export const QUALITY_FIX_PLAN_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["status", "summary", "items"],
  properties: {
    status: { type: "string", enum: ["ready", "needs_review", "no_safe_fixes"] },
    summary: { type: "string" },
    items: {
      type: "array",
      maxItems: QUALITY_FIX_PLAN_MAX_ITEMS,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "findingId",
          "commandIntent",
          "explanation",
          "proposedChange",
          "elementId",
          "blockId",
          "requiresMerchantInput",
        ],
        properties: {
          findingId: { type: "string" },
          commandIntent: { type: "string", enum: QUALITY_FIX_PLAN_INTENTS },
          explanation: { type: "string" },
          proposedChange: { type: "string" },
          elementId: { type: "string" },
          blockId: { type: "string" },
          requiresMerchantInput: { type: "boolean" },
        },
      },
    },
  },
});

function cleanText(value, max = 1200) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertOnlyKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unsupported field: ${key}.`);
  }
}

function compactFinding(item, index) {
  return Object.freeze({
    id: `finding-${index + 1}`,
    category: cleanText(item?.category, 60),
    code: cleanText(item?.code, 120),
    severity: cleanText(item?.severity, 30),
    title: cleanText(item?.title, 240),
    message: cleanText(item?.message, 900),
    elementId: cleanText(item?.elementId, 160),
    blockId: cleanText(item?.blockId, 160),
  });
}

export function buildQualityFixPlanInput(report = {}) {
  if (
    report?.version !== QUALITY_REPORT_VERSION
    || report?.deterministic !== true
    || report?.validatorsAuthoritative !== true
  ) {
    throw new Error("Quality fix planning requires an authoritative deterministic Quality Report.");
  }

  const sourceFindings = Array.isArray(report.findings) ? report.findings : [];
  const findings = sourceFindings
    .slice(0, QUALITY_FIX_PLAN_MAX_INPUT_FINDINGS)
    .map(compactFinding);

  return Object.freeze({
    version: QUALITY_FIX_PLAN_VERSION,
    qualityReportVersion: QUALITY_REPORT_VERSION,
    reportPass: report.pass === true,
    reportScore: Number.isFinite(Number(report.score)) ? Number(report.score) : null,
    validatorsAuthoritative: true,
    proposalOnly: true,
    executable: false,
    requiresRevalidation: true,
    inputFindingsTruncated: sourceFindings.length > findings.length || report?.bounds?.findingsTruncated === true,
    findings: Object.freeze(findings),
  });
}

function normalizeItem(item, findingMap, index) {
  assertPlainObject(item, `Quality fix item ${index + 1}`);
  assertOnlyKeys(item, ITEM_KEYS, `Quality fix item ${index + 1}`);

  const findingId = cleanText(item.findingId, 80);
  const finding = findingMap.get(findingId);
  if (!finding) throw new Error(`Quality fix item ${index + 1} references an unknown findingId.`);

  const commandIntent = cleanText(item.commandIntent, 80);
  if (!INTENT_SET.has(commandIntent)) {
    throw new Error(`Quality fix item ${index + 1} uses an unsupported commandIntent.`);
  }

  const elementId = cleanText(item.elementId, 160);
  const blockId = cleanText(item.blockId, 160);
  if (elementId && elementId !== finding.elementId) {
    throw new Error(`Quality fix item ${index + 1} targets an element outside its deterministic finding.`);
  }
  if (blockId && blockId !== finding.blockId) {
    throw new Error(`Quality fix item ${index + 1} targets an email block outside its deterministic finding.`);
  }
  if (TARGETED_INTENTS.has(commandIntent) && !finding.elementId) {
    throw new Error(`Quality fix item ${index + 1} cannot use ${commandIntent} without a deterministic element target.`);
  }
  if (commandIntent !== "manual-review" && finding.blockId && !finding.elementId) {
    throw new Error(`Quality fix item ${index + 1} cannot map an email-only finding to a Builder command intent.`);
  }

  return Object.freeze({
    findingId,
    category: finding.category,
    code: finding.code,
    severity: finding.severity,
    commandIntent,
    executable: false,
    explanation: cleanText(item.explanation, 1200),
    proposedChange: cleanText(item.proposedChange, 1600),
    elementId: elementId || finding.elementId,
    blockId: blockId || finding.blockId,
    requiresMerchantInput: item.requiresMerchantInput === true,
    verification: "rerun-deterministic-quality-report",
  });
}

export function normalizeQualityFixPlan(plan = {}, qualityInput = {}) {
  assertPlainObject(plan, "Quality fix plan");
  assertOnlyKeys(plan, PLAN_KEYS, "Quality fix plan");

  if (
    qualityInput?.version !== QUALITY_FIX_PLAN_VERSION
    || qualityInput?.qualityReportVersion !== QUALITY_REPORT_VERSION
    || qualityInput?.validatorsAuthoritative !== true
    || qualityInput?.proposalOnly !== true
    || qualityInput?.executable !== false
  ) {
    throw new Error("Quality fix plan input is not a valid proposal-only deterministic projection.");
  }

  const status = cleanText(plan.status, 40);
  if (!["ready", "needs_review", "no_safe_fixes"].includes(status)) {
    throw new Error("Quality fix plan status is invalid.");
  }

  const rawItems = Array.isArray(plan.items) ? plan.items : [];
  if (rawItems.length > QUALITY_FIX_PLAN_MAX_ITEMS) {
    throw new Error(`Quality fix plan exceeds the ${QUALITY_FIX_PLAN_MAX_ITEMS}-item limit.`);
  }
  if (status === "no_safe_fixes" && rawItems.length) {
    throw new Error("no_safe_fixes plans cannot contain proposed items.");
  }
  if (status === "ready" && !rawItems.length) {
    throw new Error("ready quality fix plans require at least one proposed item.");
  }

  const findingMap = new Map((qualityInput.findings || []).map((item) => [item.id, item]));
  const seen = new Set();
  const items = rawItems.map((item, index) => {
    const normalized = normalizeItem(item, findingMap, index);
    if (seen.has(normalized.findingId)) {
      throw new Error(`Quality fix plan duplicates findingId: ${normalized.findingId}.`);
    }
    seen.add(normalized.findingId);
    return normalized;
  });

  const uncoveredFindingIds = (qualityInput.findings || [])
    .map((item) => item.id)
    .filter((id) => !seen.has(id));

  return Object.freeze({
    version: QUALITY_FIX_PLAN_VERSION,
    status,
    summary: cleanText(plan.summary, 2000),
    validatorsAuthoritative: true,
    proposalOnly: true,
    executable: false,
    requiresRevalidation: true,
    items: Object.freeze(items),
    coverage: Object.freeze({
      inputFindings: (qualityInput.findings || []).length,
      proposedItems: items.length,
      uncoveredFindingIds: Object.freeze(uncoveredFindingIds),
      inputFindingsTruncated: qualityInput.inputFindingsTruncated === true,
    }),
  });
}
