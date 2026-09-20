import { authenticate } from "../shopify.server.js";
import db from "../db.server.js";
import { builderActor, getBuilderRole } from "../utils/builder-permissions.js";
import { canAccessBuilderEditor } from "../utils/builder-permissions.server.js";
import { assertTrustedMutationRequest, safeClientErrorMessage } from "../utils/request-security.server.js";
import { getServerFeatureFlags } from "../services/feature-flags.server.js";
import { restoreEditorAgentCheckpoint, runEditorAgentTurn } from "../services/ai-agent.server.js";
import { runAiQualityFixPlan } from "../services/ai-quality-fix-plan.server.js";
import { applyAiQualityFix } from "../services/ai-quality-fix-execution.server.js";

const MAX_AGENT_BYTES = 128 * 1024;

function aiEnabled() {
  return getServerFeatureFlags().aiBuilderV1 === true;
}

async function boundedJson(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_AGENT_BYTES) {
    throw new Response("AI Agent request is too large.", { status: 413 });
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_AGENT_BYTES) throw new Response("AI Agent request is too large.", { status: 413 });
  try {
    const parsed = JSON.parse(text || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    return parsed;
  } catch {
    throw new Response("AI Agent request must be valid JSON.", { status: 400 });
  }
}

function stringValue(value, max = 8000) {
  return String(value || "").trim().slice(0, max);
}

export async function action({ request }) {
  assertTrustedMutationRequest(request);
  if (!aiEnabled()) return Response.json({ ok: false, code: "AI_DISABLED", error: "AI Builder is disabled." }, { status: 404 });

  const { session, admin } = await authenticate.admin(request);
  if (!(await canAccessBuilderEditor(db, session))) {
    return Response.json({ ok: false, code: "AI_AGENT_FORBIDDEN", error: "Your role cannot use the editor Agent." }, { status: 403 });
  }

  try {
    const body = await boundedJson(request);
    const pageId = stringValue(body.pageId, 200);
    if (!pageId) return Response.json({ ok: false, code: "AI_AGENT_INVALID_INPUT", error: "pageId is required." }, { status: 400 });
    const intent = stringValue(body.intent, 40);
    const flags = getServerFeatureFlags();
    const common = { db, session, actor: builderActor(session), role: getBuilderRole(session), pageId };

    if (intent === "quality-plan") {
      if (flags.qualityFixPlanningV1 !== true) {
        return Response.json({ ok: false, code: "AI_QUALITY_FIX_PLAN_DISABLED", error: "AI Quality planning is disabled." }, { status: 404 });
      }
      const result = await runAiQualityFixPlan({
        db,
        shop: session.shop,
        pageId,
        goal: stringValue(body.prompt, 2000),
      });
      return Response.json(result);
    }

    if (intent === "quality-apply") {
      if (flags.qualityFixPlanningV1 !== true || flags.qualityFixExecutionV1 !== true) {
        return Response.json({ ok: false, code: "AI_QUALITY_FIX_EXECUTION_DISABLED", error: "AI Quality fix execution is disabled." }, { status: 404 });
      }
      const result = await applyAiQualityFix({ ...common, findingId: stringValue(body.findingId, 80), findingCode: stringValue(body.findingCode, 120), expectedElementId: stringValue(body.elementId, 160), commandIntent: stringValue(body.commandIntent, 80), commandInput: body.commandInput, sourceGenerationId: stringValue(body.sourceGenerationId, 100), confirmed: body.confirm === true });
      return Response.json(result);
    }

    if (intent === "revert") {
      const revisionId = stringValue(body.revisionId, 200);
      if (!revisionId) return Response.json({ ok: false, code: "AI_AGENT_INVALID_INPUT", error: "revisionId is required." }, { status: 400 });
      const result = await restoreEditorAgentCheckpoint({ ...common, revisionId });
      return Response.json(result);
    }

    const result = await runEditorAgentTurn({
      ...common,
      admin,
      contextToolsEnabled: flags.agentContextToolsV1 === true,
      prompt: stringValue(body.prompt, 8000),
      breakpoint: stringValue(body.breakpoint, 40) || "desktop",
      selectedIds: Array.isArray(body.selectedIds) ? body.selectedIds : [],
      conversation: Array.isArray(body.conversation) ? body.conversation : [],
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Response) return error;
    const status = Number(error?.status || 500);
    const code = String(error?.code || "AI_AGENT_FAILED");
    const message = error instanceof Error ? error.message : "AI Agent failed.";
    if (process.env.NODE_ENV === "production") console.error("VSN AI Agent error:", code, message);
    else console.warn("VSN AI Agent failed:", code, message);
    return Response.json(
      {
        ok: false,
        code,
        error: process.env.NODE_ENV === "production" && status >= 500
          ? "AI Agent request failed."
          : safeClientErrorMessage(error, "AI Agent request failed."),
      },
      { status: status >= 400 && status <= 599 ? status : 500 },
    );
  }
}
