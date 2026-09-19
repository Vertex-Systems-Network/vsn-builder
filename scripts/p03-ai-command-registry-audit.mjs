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

assert.throws(
  () => resolveAiCommandDefinition("unknown.command"),
  (error) => error instanceof AiCommandError && error.code === "AI_COMMAND_UNSUPPORTED",
);
checks += 1;

const pkg = JSON.parse(read("package.json"));
ok(pkg.scripts?.["qa:p03"] === "node scripts/p03-ai-command-registry-audit.mjs", "P0.3 QA command missing");
ok(pkg.scripts?.["qa:release"]?.includes("p03-ai-command-registry-audit.mjs"), "P0.3 audit must be release-blocking");

console.log(`VSN P0.3 AI command registry audit: PASS (${checks}/${checks})`);
