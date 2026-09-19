import assert from "node:assert/strict";
import fs from "node:fs";
import { AI_COMMAND_REGISTRY_VERSION, AiCommandError, executeAiCommand, listAiCommandDefinitions, resolveAiCommandDefinition } from "../app/services/ai-command-registry.server.js";

const read = (file) => fs.readFileSync(file, "utf8");
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

ok(AI_COMMAND_REGISTRY_VERSION === 1, "Command registry version must be explicit");
const definitions = listAiCommandDefinitions();
for (const name of ["page.read", "element.update-props", "element.update-styles", "element.remove", "page.publish"]) {
  ok(definitions.some((row) => row.name === name), `Command registry missing ${name}`);
}
const publish = resolveAiCommandDefinition("page.publish");
ok(publish.kind === "consequential" && publish.directExecution === false && publish.approval === "explicit-route", "Publish must stay outside direct AI execution");

const service = read("app/services/ai-command-registry.server.js");
for (const token of [
  "runBuilderCommand",
  "canAccessBuilderAction",
  "getBuilderRuntimeEntitlements",
  "getCollaborationRole",
  "getBlockingPageLock",
  "canCollaborate",
  "AI_COMMAND_PAGE_LOCKED",
  "baseVersion",
  "AI_COMMAND_STALE_VERSION",
  "builderRevision.create",
  'kind: "ai-command-undo"',
  'kind: "ai-command"',
  "updateMany",
  "sourceGenerationId",
]) ok(service.includes(token), `AI command registry missing contract: ${token}`);
ok(!service.includes("admin.graphql"), "AI command registry must not call Shopify Admin GraphQL directly");
ok(!service.includes("publishedJson"), "AI draft command registry must not directly mutate published content");

const route = read("app/routes/app.ai-command.jsx");
for (const token of ["assertTrustedMutationRequest", "authenticate.admin", "MAX_COMMAND_BYTES", "executeAiCommand", "builderActor", "getBuilderRole"]) {
  ok(route.includes(token), `AI command route missing security contract: ${token}`);
}

const commandBus = read("app/services/command-bus.server.js");
ok(commandBus.includes("db.$transaction") && commandBus.includes("builderAuditLog.create"), "AI mutations must inherit transactional audit logging from command bus");

const fakeDeniedDb = {};
await assert.rejects(
  () => executeAiCommand({ db: fakeDeniedDb, session: {}, name: "page.read", input: { pageId: "x" } }),
  (error) => error instanceof AiCommandError && error.code === "AI_COMMAND_UNAUTHENTICATED",
);
checks += 1;

const pageState = {
  id: "page-1",
  shop: "test.myshopify.com",
  title: "Test page",
  template: "page",
  status: "draft",
  workflowStatus: "draft",
  version: 1,
  deletedAt: null,
  contentJson: JSON.stringify([{ id: "heading-1", type: "heading", label: "Heading", props: { text: "Old" }, styles: {}, children: [] }]),
};
const revisions = [];
const auditRows = [];
const fakeDb = {
  builderSubscription: { findUnique: async () => null },
  builderPage: {
    findFirst: async ({ where }) => {
      if (where?.id && where.id !== pageState.id) return null;
      if (where?.shop && where.shop !== pageState.shop) return null;
      if (where?.deletedAt === null && pageState.deletedAt !== null) return null;
      return { ...pageState };
    },
    updateMany: async ({ where, data }) => {
      if (where.id !== pageState.id || where.shop !== pageState.shop || where.version !== pageState.version) return { count: 0 };
      pageState.contentJson = data.contentJson;
      pageState.version += Number(data.version?.increment || 0);
      pageState.workflowStatus = data.workflowStatus;
      return { count: 1 };
    },
  },
  builderRevision: {
    findFirst: async () => revisions.at(-1) || null,
    create: async ({ data }) => {
      const row = { id: `rev-${revisions.length + 1}`, ...data };
      revisions.push(row);
      return row;
    },
  },
  builderAuditLog: {
    create: async ({ data }) => {
      const row = { id: `audit-${auditRows.length + 1}`, ...data };
      auditRows.push(row);
      return row;
    },
  },
  $transaction: async (callback) => callback(fakeDb),
};
const ownerSession = {
  shop: pageState.shop,
  onlineAccessInfo: { associated_user: { account_owner: true, email: "owner@example.com" } },
};
const mutation = await executeAiCommand({
  db: fakeDb,
  session: ownerSession,
  actor: "owner@example.com",
  role: "admin",
  name: "element.update-props",
  input: { pageId: pageState.id, baseVersion: 1, elementId: "heading-1", patch: { text: "New heading" }, sourceGenerationId: "generation-1" },
});
ok(pageState.version === 2, "Executable draft command must increment the page version");
const persistedHeading = JSON.parse(pageState.contentJson).find((node) => node?.id === "heading-1");
ok(persistedHeading?.props?.text === "New heading", "Executable draft command must apply a bounded element patch");
ok(revisions.length === 2 && revisions[0].kind === "ai-command-undo" && revisions[1].kind === "ai-command", "Draft command must create undo and applied revisions");
ok(Boolean(mutation.result?.undo?.revisionId) && mutation.result?.sourceGenerationId === "generation-1", "Draft command must return attributable undo metadata");
ok(auditRows.some((row) => row.action === "command.ai.element.update-props.executed"), "Draft command must inherit command-bus audit logging");

await assert.rejects(
  () => executeAiCommand({
    db: fakeDb,
    session: ownerSession,
    actor: "owner@example.com",
    role: "admin",
    name: "element.update-styles",
    input: { pageId: pageState.id, baseVersion: 1, elementId: "heading-1", patch: { typography: { fontSize: "20px" } } },
  }),
  (error) => error instanceof AiCommandError && error.code === "AI_COMMAND_STALE_VERSION",
);
checks += 1;

await assert.rejects(
  () => executeAiCommand({
    db: fakeDb,
    session: ownerSession,
    actor: "owner@example.com",
    role: "admin",
    name: "page.publish",
    input: { pageId: pageState.id, baseVersion: 2 },
  }),
  (error) => error instanceof AiCommandError && error.code === "AI_COMMAND_EXPLICIT_APPROVAL_REQUIRED",
);
checks += 1;

assert.throws(
  () => resolveAiCommandDefinition("unknown.command"),
  (error) => error instanceof AiCommandError && error.code === "AI_COMMAND_UNSUPPORTED",
);
checks += 1;

const pkg = JSON.parse(read("package.json"));
ok(pkg.scripts?.["qa:p03"] === "node scripts/p03-ai-command-registry-audit.mjs", "P0.3 QA command missing");
ok(pkg.scripts?.["qa:release"]?.includes("p03-ai-command-registry-audit.mjs"), "P0.3 audit must be release-blocking");

console.log(`VSN P0.3 AI command registry audit: PASS (${checks}/${checks})`);
