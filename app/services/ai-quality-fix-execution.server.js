import { buildQualityReport } from "../ai/qualityAgent.js";
import {
  QUALITY_FIX_PLAN_COMMAND_INTENTS,
  buildQualityFixPlanInput,
} from "../ai/qualityFixPlan.js";
import { migrateBuilderContent } from "../builder/schemaMigrations.js";
import { executeAiCommand } from "./ai-command-registry.server.js";

const MAX_PAGE_ID_CHARS = 200;
const SYSTEM_NODE_TYPES = new Set(["template-settings", "global-styles"]);
const COMMAND_SET = new Set(QUALITY_FIX_PLAN_COMMAND_INTENTS);

function qualityExecutionError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}
function cleanText(value, max) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}
function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw qualityExecutionError("AI_QUALITY_FIX_INVALID_INPUT", `${label} must be an object.`);
  }
  return value;
}
function assertAllowedKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw qualityExecutionError("AI_QUALITY_FIX_INVALID_INPUT", `${label} contains unsupported field: ${key}.`);
  }
}
function parsePageContent(value) {
  let parsed;
  try { parsed = JSON.parse(String(value || "[]")); }
  catch { throw qualityExecutionError("AI_QUALITY_PAGE_CORRUPT", "Builder page content is not valid JSON.", 500); }
  if (!Array.isArray(parsed)) throw qualityExecutionError("AI_QUALITY_PAGE_CORRUPT", "Builder page content must be an array.", 500);
  return migrateBuilderContent(parsed);
}
function merchantQualityNodes(nodes = []) {
  return (Array.isArray(nodes) ? nodes : []).filter((node) => !SYSTEM_NODE_TYPES.has(node?.type)).map((node) => ({
    ...node,
    children: merchantQualityNodes(node?.children),
  }));
}
async function loadPage(db, shop, pageId) {
  const id = cleanText(pageId, MAX_PAGE_ID_CHARS);
  if (!id) throw qualityExecutionError("AI_QUALITY_FIX_INVALID_INPUT", "pageId is required.");
  const page = await db.builderPage.findFirst({
    where: { id, shop, deletedAt: null },
    select: { id: true, template: true, contentJson: true, version: true, workflowStatus: true },
  });
  if (!page) throw qualityExecutionError("AI_QUALITY_PAGE_NOT_FOUND", "Builder page not found.", 404);
  return page;
}
function qualityState(page) {
  const content = parsePageContent(page.contentJson);
  const report = buildQualityReport(merchantQualityNodes(content), { pageTemplate: page.template });
  const input = buildQualityFixPlanInput(report);
  return { report, input };
}
function publicQualitySummary(report, input) {
  return Object.freeze({
    version: report.version,
    pass: report.pass,
    score: report.score,
    counts: report.counts,
    bounds: report.bounds,
    validatorsAuthoritative: true,
    projectedFindings: input.findings.length,
    inputFindingsTruncated: input.inputFindingsTruncated === true,
  });
}
function optionalText(value, max = 200) {
  const result = cleanText(value, max);
  return result || null;
}
function commandInputForQualityFix(commandIntent, rawInput, { page, finding, sourceGenerationId }) {
  const commandData = plainObject(rawInput ?? {}, "commandInput");
  const common = {
    pageId: page.id,
    baseVersion: Number(page.version || 1),
    sourceGenerationId: cleanText(sourceGenerationId, 100) || null,
  };
  switch (commandIntent) {
    case "element.insert":
      assertAllowedKeys(commandData, new Set(["beforeId", "afterId", "nodeType", "label", "props", "styles"]), "commandInput");
      return { ...common, parentId: finding.elementId, beforeId: optionalText(commandData.beforeId), afterId: optionalText(commandData.afterId), nodeType: cleanText(commandData.nodeType, 80), label: optionalText(commandData.label, 160), props: commandData.props, styles: commandData.styles };
    case "element.move":
      assertAllowedKeys(commandData, new Set(["parentId", "beforeId", "afterId"]), "commandInput");
      return { ...common, elementId: finding.elementId, parentId: optionalText(commandData.parentId), beforeId: optionalText(commandData.beforeId), afterId: optionalText(commandData.afterId) };
    case "element.update-props":
    case "element.update-styles":
      assertAllowedKeys(commandData, new Set(["patch"]), "commandInput");
      return { ...common, elementId: finding.elementId, patch: commandData.patch };
    case "element.rewrite":
      assertAllowedKeys(commandData, new Set(["text"]), "commandInput");
      return { ...common, elementId: finding.elementId, text: cleanText(commandData.text, 6000) };
    case "element.remove":
      assertAllowedKeys(commandData, new Set(), "commandInput");
      return { ...common, elementId: finding.elementId };
    default:
      throw qualityExecutionError("AI_QUALITY_FIX_COMMAND_UNSUPPORTED", "The requested quality fix command is not executable.");
  }
}
function findMatchingFinding(report, original) {
  return (report.findings || []).find((item) => item.code === original.code && item.elementId === original.elementId && item.blockId === original.blockId) || null;
}

export async function applyAiQualityFix({
  db, session, actor = "system", role = "system", pageId, findingId, findingCode,
  expectedElementId, commandIntent, commandInput = {}, sourceGenerationId = "",
  confirmed = false, executeCommand = executeAiCommand,
} = {}) {
  if (!db) throw qualityExecutionError("AI_QUALITY_FIX_SERVER_ERROR", "Quality fix database is unavailable.", 500);
  if (!session?.shop) throw qualityExecutionError("AI_QUALITY_UNAUTHENTICATED", "Authenticated shop session is required.", 401);
  if (confirmed !== true) throw qualityExecutionError("AI_QUALITY_FIX_EXPLICIT_APPROVAL_REQUIRED", "Explicit merchant confirmation is required before applying a quality fix.", 409);

  const safeFindingId = cleanText(findingId, 80);
  const safeFindingCode = cleanText(findingCode, 120);
  const safeExpectedElementId = cleanText(expectedElementId, 160);
  const safeCommandIntent = cleanText(commandIntent, 80);
  if (!safeFindingId || !safeFindingCode || !safeExpectedElementId || !safeCommandIntent) {
    throw qualityExecutionError("AI_QUALITY_FIX_INVALID_INPUT", "findingId, findingCode, elementId and commandIntent are required.");
  }
  if (!COMMAND_SET.has(safeCommandIntent)) throw qualityExecutionError("AI_QUALITY_FIX_COMMAND_UNSUPPORTED", "Only reversible Builder draft commands can be applied.");

  const page = await loadPage(db, session.shop, pageId);
  const beforeState = qualityState(page);
  const finding = (beforeState.input.findings || []).find((item) => item.id === safeFindingId);
  if (!finding || finding.code !== safeFindingCode || finding.elementId !== safeExpectedElementId) {
    throw qualityExecutionError("AI_QUALITY_FIX_STALE_FINDING", "The selected quality finding changed. Regenerate the plan before applying it.", 409);
  }
  if (!finding.elementId || finding.blockId) throw qualityExecutionError("AI_QUALITY_FIX_MANUAL_REVIEW_REQUIRED", "This finding is not safely executable as a Builder draft command.", 409);

  const input = commandInputForQualityFix(safeCommandIntent, commandInput, { page, finding, sourceGenerationId });
  const commandResult = await executeCommand({ db, session, actor, role, name: safeCommandIntent, input });
  const afterPage = await loadPage(db, session.shop, page.id);
  const afterState = qualityState(afterPage);
  const remaining = findMatchingFinding(afterState.report, finding);
  const revalidationComplete = afterState.report?.bounds?.findingsTruncated !== true;
  const resolved = revalidationComplete && !remaining;
  const result = commandResult?.result || {};

  return Object.freeze({
    ok: true,
    status: resolved ? "applied_resolved" : remaining ? "applied_unresolved" : "applied_revalidation_truncated",
    resolved,
    revalidated: true,
    revalidationComplete,
    validatorsAuthoritative: true,
    finding: Object.freeze({ id: finding.id, category: finding.category, code: finding.code, severity: finding.severity, elementId: finding.elementId, blockId: finding.blockId }),
    command: Object.freeze({ intent: safeCommandIntent, commandId: commandResult?.commandId || null, revisionId: result.revisionId || null, undoRevisionId: result.undo?.revisionId || null, pageVersion: Number(result.version || afterPage.version || page.version || 1), sourceGenerationId: cleanText(sourceGenerationId, 100) || null }),
    before: publicQualitySummary(beforeState.report, beforeState.input),
    after: publicQualitySummary(afterState.report, afterState.input),
  });
}
