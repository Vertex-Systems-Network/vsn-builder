export const AI_AGENT_PLAN_VERSION = 1;
export const AI_AGENT_MAX_STEPS = 6;
export const AI_AGENT_MAX_CONVERSATION_TURNS = 8;

export const AI_AGENT_EXECUTABLE_COMMANDS = Object.freeze([
  "element.insert",
  "element.move",
  "element.update-props",
  "element.update-styles",
  "element.rewrite",
  "element.remove",
]);

const COMMAND_SET = new Set(AI_AGENT_EXECUTABLE_COMMANDS);

export const AI_AGENT_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "steps"],
  properties: {
    status: { type: "string", enum: ["ready", "needs_input", "no_change"] },
    message: { type: "string" },
    steps: {
      type: "array",
      maxItems: AI_AGENT_MAX_STEPS,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "command", "summary", "elementId", "parentId", "beforeId", "afterId",
          "nodeType", "label", "text", "propsJson", "stylesJson",
        ],
        properties: {
          command: { type: "string", enum: AI_AGENT_EXECUTABLE_COMMANDS },
          summary: { type: "string" },
          elementId: { type: "string" },
          parentId: { type: "string" },
          beforeId: { type: "string" },
          afterId: { type: "string" },
          nodeType: { type: "string" },
          label: { type: "string" },
          text: { type: "string" },
          propsJson: { type: "string", description: "JSON object string for props patch, or {} when unused." },
          stylesJson: { type: "string", description: "JSON object string for style patch, or {} when unused." },
        },
      },
    },
  },
});

function cleanText(value, max = 4000) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function optionalId(value) {
  return cleanText(value, 200);
}

function parseObjectJson(value, field) {
  const raw = cleanText(value || "{}", 12000) || "{}";
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(`Agent step ${field} must be valid JSON.`); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`Agent step ${field} must be a JSON object.`);
  }
  return parsed;
}

export function normalizeAgentConversation(value = []) {
  if (!Array.isArray(value)) return [];
  return value.slice(-AI_AGENT_MAX_CONVERSATION_TURNS).map((turn) => ({
    role: turn?.role === "assistant" ? "assistant" : "user",
    text: cleanText(turn?.text, 2400),
  })).filter((turn) => turn.text);
}

export function normalizeAgentSelectedIds(value = []) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(optionalId).filter(Boolean))].slice(0, 12);
}

export function normalizeAgentPlan(plan = {}) {
  const status = ["ready", "needs_input", "no_change"].includes(plan?.status) ? plan.status : "needs_input";
  const message = cleanText(plan?.message, 3000);
  const rawSteps = Array.isArray(plan?.steps) ? plan.steps : [];
  if (rawSteps.length > AI_AGENT_MAX_STEPS) throw new Error(`Agent plan exceeds the ${AI_AGENT_MAX_STEPS}-step limit.`);
  const steps = rawSteps.map((step, index) => {
    const command = cleanText(step?.command, 80);
    if (!COMMAND_SET.has(command)) throw new Error(`Unsupported agent command at step ${index + 1}: ${command || "missing"}.`);
    const beforeId = optionalId(step?.beforeId);
    const afterId = optionalId(step?.afterId);
    if (beforeId && afterId) throw new Error(`Agent step ${index + 1} cannot set both beforeId and afterId.`);
    return Object.freeze({
      command,
      summary: cleanText(step?.summary || command, 500),
      elementId: optionalId(step?.elementId),
      parentId: optionalId(step?.parentId),
      beforeId,
      afterId,
      nodeType: cleanText(step?.nodeType, 80),
      label: cleanText(step?.label, 160),
      text: cleanText(step?.text, 6000),
      props: parseObjectJson(step?.propsJson, "propsJson"),
      styles: parseObjectJson(step?.stylesJson, "stylesJson"),
    });
  });
  if (status !== "ready" && steps.length) throw new Error("Agent plans may contain executable steps only when status=ready.");
  return Object.freeze({ version: AI_AGENT_PLAN_VERSION, status, message, steps });
}

export function agentStepToCommandInput(step, { pageId, baseVersion, sourceGenerationId } = {}) {
  const common = {
    pageId: cleanText(pageId, 200),
    baseVersion: Number(baseVersion),
    sourceGenerationId: cleanText(sourceGenerationId, 100) || null,
  };
  if (!common.pageId || !Number.isInteger(common.baseVersion) || common.baseVersion < 1) {
    throw new Error("Agent command context requires pageId and a positive baseVersion.");
  }
  switch (step.command) {
    case "element.insert":
      return {
        ...common,
        parentId: step.parentId || null,
        beforeId: step.beforeId || null,
        afterId: step.afterId || null,
        nodeType: step.nodeType,
        label: step.label,
        props: step.props,
        styles: step.styles,
      };
    case "element.move":
      return {
        ...common,
        elementId: step.elementId,
        parentId: step.parentId || null,
        beforeId: step.beforeId || null,
        afterId: step.afterId || null,
      };
    case "element.update-props":
      return { ...common, elementId: step.elementId, patch: step.props };
    case "element.update-styles":
      return { ...common, elementId: step.elementId, patch: step.styles };
    case "element.rewrite":
      return { ...common, elementId: step.elementId, text: step.text };
    case "element.remove":
      return { ...common, elementId: step.elementId };
    default:
      throw new Error(`Unsupported executable agent command: ${step.command}.`);
  }
}
