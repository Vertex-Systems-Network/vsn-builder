import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AI_AGENT_EXECUTABLE_COMMANDS,
  AI_AGENT_MAX_CONVERSATION_TURNS,
  AI_AGENT_MAX_STEPS,
  normalizeAgentConversation,
  normalizeAgentPlan,
} from "../app/ai/agent.js";
import { AI_BEHAVIOR_DEFAULTS, resolveAiBehavior } from "../app/ai/behaviors.js";
import { runEditorAgentTurn } from "../app/services/ai-agent.server.js";

const read = (file) => fs.readFileSync(file, "utf8");
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

ok(AI_AGENT_MAX_STEPS === 6, "Editor Agent must remain bounded to six steps");
ok(AI_AGENT_MAX_CONVERSATION_TURNS === 8, "Client conversation context must remain bounded");
ok(!AI_AGENT_EXECUTABLE_COMMANDS.includes("page.publish"), "Agent executable allowlist must never include publish");
for (const command of ["element.insert", "element.move", "element.update-props", "element.update-styles", "element.rewrite", "element.remove"]) {
  ok(AI_AGENT_EXECUTABLE_COMMANDS.includes(command), `Agent allowlist missing ${command}`);
}

const behavior = resolveAiBehavior({ surface: "agent", operation: "edit", version: AI_BEHAVIOR_DEFAULTS.agent });
ok(behavior.version === "agent-v1", "Agent behavior version must be explicit");
ok(behavior.instructions.includes("Never publish") && behavior.instructions.includes("at most six commands"), "Agent behavior must retain publish and step-count guardrails");

assert.throws(
  () => normalizeAgentPlan({
    status: "ready",
    message: "unsafe",
    steps: [{ command: "page.publish", summary: "publish", elementId: "", parentId: "", beforeId: "", afterId: "", nodeType: "", label: "", text: "", propsJson: "{}", stylesJson: "{}" }],
  }),
  /Unsupported agent command/,
);
checks += 1;

const tooMany = Array.from({ length: AI_AGENT_MAX_STEPS + 1 }, (_, index) => ({
  command: "element.remove",
  summary: `step ${index}`,
  elementId: `el-${index}`,
  parentId: "",
  beforeId: "",
  afterId: "",
  nodeType: "",
  label: "",
  text: "",
  propsJson: "{}",
  stylesJson: "{}",
}));
assert.throws(() => normalizeAgentPlan({ status: "ready", message: "too many", steps: tooMany }), /step limit/);
checks += 1;

assert.throws(
  () => normalizeAgentPlan({ status: "needs_input", message: "ask", steps: [tooMany[0]] }),
  /only when status=ready/,
);
checks += 1;

const conversation = normalizeAgentConversation(Array.from({ length: 20 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", text: `turn-${index}` })));
ok(conversation.length === AI_AGENT_MAX_CONVERSATION_TURNS && conversation[0].text === "turn-12", "Conversation context must keep only the most recent bounded turns");

const pageState = {
  id: "page-1",
  shop: "agent-test.myshopify.com",
  title: "Agent page",
  template: "page",
  workflowStatus: "draft",
  version: 1,
  deletedAt: null,
  contentJson: JSON.stringify([{ id: "heading-1", type: "heading", label: "Heading", props: { text: "Old" }, styles: {}, children: [] }]),
};
const commandCalls = [];
const fakeDb = {
  builderPage: {
    findFirst: async ({ where }) => {
      if (where?.id && where.id !== pageState.id) return null;
      if (where?.shop && where.shop !== pageState.shop) return null;
      return { ...pageState };
    },
  },
  builderRevision: {
    findMany: async () => [{ id: "rev-existing", kind: "save", label: "Before agent", title: "Agent page", createdAt: new Date("2026-09-19T00:00:00Z") }],
  },
  builderAuditLog: {
    findMany: async () => [{ id: "audit-1", pageId: pageState.id, action: "command.ai.element.update-props.executed", createdAt: new Date("2026-09-19T00:01:00Z") }],
  },
  builderAiUsage: {
    update: async () => ({}),
  },
};
const ownerSession = {
  shop: pageState.shop,
  onlineAccessInfo: { associated_user: { account_owner: true, email: "owner@example.com" } },
};
const providerOutput = {
  status: "ready",
  message: "Updated the selected heading in two safe draft steps.",
  steps: [
    { command: "element.update-props", summary: "Update copy", elementId: "heading-1", parentId: "", beforeId: "", afterId: "", nodeType: "", label: "", text: "", propsJson: JSON.stringify({ text: "New" }), stylesJson: "{}" },
    { command: "element.update-styles", summary: "Improve spacing", elementId: "heading-1", parentId: "", beforeId: "", afterId: "", nodeType: "", label: "", text: "", propsJson: "{}", stylesJson: JSON.stringify({ spacing: { marginTop: "12px" } }) },
  ],
};
const turn = await runEditorAgentTurn({
  db: fakeDb,
  session: ownerSession,
  actor: "owner@example.com",
  role: "admin",
  pageId: pageState.id,
  prompt: "Improve this heading",
  selectedIds: ["heading-1", "cross-shop-id"],
  breakpoint: "mobile",
  conversation: [{ role: "user", text: "Keep it concise" }],
  env: { VSN_AI_PROVIDER: "openai", VSN_AI_AGENT_BEHAVIOR_VERSION: "agent-v1" },
  providerConfigured: () => true,
  reserveUsage: async () => ({ id: "usage-1" }),
  getUsage: async () => ({ used: 1, quota: 100, remaining: 99 }),
  generate: async ({ behavior: selectedBehavior, schema }) => {
    ok(selectedBehavior.version === "agent-v1", "Orchestrator must use the versioned agent behavior");
    ok(schema?.properties?.steps?.maxItems === AI_AGENT_MAX_STEPS, "Provider schema must enforce the step bound");
    return { output: providerOutput, usage: { input_tokens: 10, output_tokens: 20 }, provider: "openai", model: "test-model", responseId: "resp-1" };
  },
  executeCommand: async ({ name, input }) => {
    commandCalls.push({ name, input });
    ok(AI_AGENT_EXECUTABLE_COMMANDS.includes(name), "Orchestrator may execute only allowlisted agent commands");
    ok(input.pageId === pageState.id, "Agent commands must remain on the authenticated current page");
    const expectedBase = pageState.version;
    ok(input.baseVersion === expectedBase, "Agent must derive sequential baseVersion server-side");
    pageState.version += 1;
    return {
      commandId: `cmd-${commandCalls.length}`,
      result: {
        version: pageState.version,
        revisionId: `rev-applied-${commandCalls.length}`,
        elementId: input.elementId || null,
        undo: { kind: "revision.restore", revisionId: commandCalls.length === 1 ? "rev-checkpoint" : `rev-undo-${commandCalls.length}` },
      },
    };
  },
});
ok(turn.ok === true && turn.status === "ready" && commandCalls.length === 2, "Bounded agent turn must execute the planned reversible steps");
ok(turn.checkpointRevisionId === "rev-checkpoint", "First mutation undo revision must become the turn checkpoint");
ok(commandCalls[0].input.sourceGenerationId === commandCalls[1].input.sourceGenerationId, "All commands in a turn must share provider generation attribution");
ok(turn.page.version === 3, "Final agent response must expose the authoritative server page version");

const service = read("app/services/ai-agent.server.js");
for (const token of ["scanBuilderPage", "serializePageForAi", "listRecentBuilderCommands", "builderRevision.findMany", "executeAiCommand", "reserveAiUsage", "AI_AGENT_OUTPUT_SCHEMA", "checkpointRevisionId"]) {
  ok(service.includes(token), `Agent service missing context/execution contract: ${token}`);
}
for (const forbidden of ["setInterval(", "Worker(", "BullMQ", "enqueue(", "page.publish"]) {
  ok(!service.includes(forbidden), `Request-scoped Agent must not contain background/consequential marker: ${forbidden}`);
}

const route = read("app/routes/app.ai-agent.jsx");
for (const token of ["assertTrustedMutationRequest", "authenticate.admin", "canAccessBuilderEditor", "MAX_AGENT_BYTES", "runEditorAgentTurn", "restoreEditorAgentCheckpoint"]) {
  ok(route.includes(token), `Agent route missing security contract: ${token}`);
}

const panel = read("app/components/editor/AiBuilderPanel.jsx");
for (const token of ['["agent","Agent · Multi-step Edit"]', 'fetch("/app/ai-agent"', "agentConversation", "hasUnsavedChanges", "Undo last Agent turn", "onAgentResult"]) {
  ok(panel.includes(token), `Agent editor UI missing bounded workflow contract: ${token}`);
}
const pageEditor = read("app/components/editor/PageEditor.jsx");
for (const token of ["useAgentEditorSync", "handleAgentResult", "hasUnsavedChanges={!isSaved}", "onAgentResult={handleAgentResult}"]) {
  ok(pageEditor.includes(token), `PageEditor missing Agent synchronization contract: ${token}`);
}
const agentSync = read("app/components/editor/hooks/useAgentEditorSync.js");
for (const token of ["Agent changes saved", "setIsSaved(true)", "setLocalizationData", "localStorage.setItem"]) {
  ok(agentSync.includes(token), `Agent editor sync hook missing authoritative-state contract: ${token}`);
}

const schema = read("prisma/schema.prisma");
ok(!schema.includes("model BuilderAgent") && !schema.includes("model BuilderAiAgent") && !schema.includes("model BuilderJob"), "P1.1 must not introduce agent/job persistence while P0.5 remains unverified");

const topology = JSON.parse(read(".ai/PRODUCTION_DATA_TOPOLOGY.json"));
ok(topology.agentJobReadiness === "BLOCKED_ON_DEPLOYMENT_EVIDENCE", "P1.1 must preserve the P0.5 persistence gate");

const registry = read("app/services/ai-command-registry.server.js");
for (const token of ['"element.insert"', '"element.move"', '"element.rewrite"', '"revision.restore"', "AI_COMMAND_EXPLICIT_APPROVAL_REQUIRED"]) {
  ok(registry.includes(token), `Command registry missing Agent safety primitive: ${token}`);
}
ok(registry.includes("safeDraftText") && registry.includes("UNSAFE_TEXT"), "Direct rewrite/insert text must retain executable/template sanitization");
ok(registry.includes("AI_COMMAND_SYSTEM_NODE_PROTECTED"), "Agent command registry must protect builder system nodes");

const pkg = JSON.parse(read("package.json"));
ok(pkg.scripts?.["qa:p11-agent"] === "node scripts/p11-editor-agent-audit.mjs && node scripts/ai-eval-deterministic.mjs", "P1.1 QA command missing");
ok(pkg.scripts?.["qa:release"]?.includes("p11-editor-agent-audit.mjs"), "P1.1 audit must be release-blocking");

console.log(`VSN P1.1 bounded editor Agent audit: PASS (${checks}/${checks})`);
