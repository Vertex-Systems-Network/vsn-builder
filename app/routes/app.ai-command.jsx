import { authenticate } from "../shopify.server.js";
import db from "../db.server.js";
import { builderActor, getBuilderRole } from "../utils/builder-permissions.js";
import { canAccessBuilderEditor } from "../utils/builder-permissions.server.js";
import { assertTrustedMutationRequest, safeClientErrorMessage } from "../utils/request-security.server.js";
import { getServerFeatureFlags } from "../services/feature-flags.server.js";
import { AiCommandError, executeAiCommand, listAiCommandDefinitions, AI_COMMAND_REGISTRY_VERSION } from "../services/ai-command-registry.server.js";

const MAX_COMMAND_BYTES = 64 * 1024;

function aiEnabled() {
  return getServerFeatureFlags().aiBuilderV1 === true;
}

async function boundedJson(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_COMMAND_BYTES) {
    throw new Response("AI command request is too large.", { status: 413 });
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_COMMAND_BYTES) throw new Response("AI command request is too large.", { status: 413 });
  try {
    const parsed = JSON.parse(text || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    return parsed;
  } catch {
    throw new Response("AI command request must be valid JSON.", { status: 400 });
  }
}

export async function loader({ request }) {
  if (!aiEnabled()) throw new Response("AI Builder is disabled.", { status: 404 });
  const { session } = await authenticate.admin(request);
  if (!(await canAccessBuilderEditor(db, session))) throw new Response("Forbidden", { status: 403 });
  return Response.json({
    ok: true,
    registryVersion: AI_COMMAND_REGISTRY_VERSION,
    commands: listAiCommandDefinitions(),
  });
}

export async function action({ request }) {
  assertTrustedMutationRequest(request);
  if (!aiEnabled()) return Response.json({ ok: false, code: "AI_DISABLED", error: "AI Builder is disabled." }, { status: 404 });

  const { session } = await authenticate.admin(request);
  try {
    const body = await boundedJson(request);
    const result = await executeAiCommand({
      db,
      session,
      actor: builderActor(session),
      role: getBuilderRole(session),
      name: String(body.command || ""),
      input: body.input && typeof body.input === "object" && !Array.isArray(body.input) ? body.input : {},
    });
    return Response.json({ ok: true, registryVersion: AI_COMMAND_REGISTRY_VERSION, ...result });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof AiCommandError) {
      return Response.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "AI command failed.";
    if (process.env.NODE_ENV === "production") console.error("VSN AI command error:", message);
    else console.warn("VSN AI command failed:", message);
    return Response.json(
      { ok: false, code: "AI_COMMAND_FAILED", error: process.env.NODE_ENV === "production" ? "AI command failed." : safeClientErrorMessage(error, "AI command failed.") },
      { status: 500 },
    );
  }
}
