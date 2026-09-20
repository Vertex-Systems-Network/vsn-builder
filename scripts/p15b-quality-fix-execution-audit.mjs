import assert from "node:assert/strict";
import fs from "node:fs";
import { applyAiQualityFix } from "../app/services/ai-quality-fix-execution.server.js";

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

const unsafeContent = [{ id: "root", type: "section", props: {}, styles: {}, children: [
  { id: "unsafe", type: "button", props: { text: "Buy", url: "javascript:alert(1)" }, styles: {}, children: [] },
] }];
const safeContent = [{ id: "root", type: "section", props: {}, styles: {}, children: [
  { id: "unsafe", type: "button", props: { text: "Buy", url: "https://example.com" }, styles: {}, children: [] },
] }];

let applied = false;
const db = { builderPage: { async findFirst(query) {
  ok(query?.where?.shop === "safe-shop.myshopify.com", "Quality fix execution must tenant-scope page reads");
  ok(query?.where?.id === "page-1", "Quality fix execution must keep the requested page scope");
  return { id: "page-1", template: "page", contentJson: JSON.stringify(applied ? safeContent : unsafeContent), version: applied ? 5 : 4, workflowStatus: "draft" };
} } };

let executeCalls = 0;
const executeCommand = async ({ session, name, input }) => {
  executeCalls += 1;
  ok(session.shop === "safe-shop.myshopify.com", "Execution must use the authenticated shop session");
  ok(name === "element.update-props", "Execution must use the approved reversible command");
  ok(input.pageId === "page-1" && input.baseVersion === 4, "Page/version authority must be rebuilt server-side");
  ok(input.elementId === "unsafe", "Element target must be forced to the deterministic finding target");
  ok(input.patch?.url === "https://example.com", "Approved command payload must reach the typed command boundary");
  applied = true;
  return { commandId: "cmd-1", result: { version: 5, revisionId: "rev-applied", undo: { revisionId: "rev-before" } } };
};

let approvalRejected = false;
try {
  await applyAiQualityFix({
    db, session: { shop: "safe-shop.myshopify.com" }, pageId: "page-1",
    findingId: "finding-1", findingCode: "unsafe-link-protocol", expectedElementId: "unsafe",
    commandIntent: "element.update-props", commandInput: { patch: { url: "https://example.com" } }, executeCommand,
  });
} catch (error) { approvalRejected = error?.code === "AI_QUALITY_FIX_EXPLICIT_APPROVAL_REQUIRED"; }
ok(approvalRejected, "Quality fix execution must require explicit merchant confirmation");
ok(executeCalls === 0, "Missing approval must not execute a command");

const result = await applyAiQualityFix({
  db, session: { shop: "safe-shop.myshopify.com" }, actor: "merchant", role: "owner", pageId: "page-1",
  findingId: "finding-1", findingCode: "unsafe-link-protocol", expectedElementId: "unsafe",
  commandIntent: "element.update-props", commandInput: { patch: { url: "https://example.com" } },
  sourceGenerationId: "quality-generation-1", confirmed: true, executeCommand,
});
ok(executeCalls === 1, "Approved quality fix must execute exactly one command");
ok(result.ok === true && result.status === "applied_resolved", "Resolved quality fix must report applied_resolved");
ok(result.resolved === true && result.revalidated === true, "Result must come from deterministic post-command revalidation");
ok(result.validatorsAuthoritative === true, "Deterministic validators must remain authoritative");
ok(result.before.pass === false && result.after.pass === true, "Before/after summaries must reflect the deterministic rerun");
ok(result.command.undoRevisionId === "rev-before", "Existing command-registry undo checkpoint must be returned");

let staleRejected = false;
try {
  applied = false;
  await applyAiQualityFix({
    db, session: { shop: "safe-shop.myshopify.com" }, pageId: "page-1",
    findingId: "finding-1", findingCode: "different-code", expectedElementId: "unsafe",
    commandIntent: "element.update-props", commandInput: { patch: { url: "https://example.com" } },
    confirmed: true, executeCommand,
  });
} catch (error) { staleRejected = error?.code === "AI_QUALITY_FIX_STALE_FINDING"; }
ok(staleRejected, "Changed finding identity must fail closed before execution");
ok(executeCalls === 1, "Stale finding rejection must not execute another command");

let authorityRejected = false;
try {
  await applyAiQualityFix({
    db, session: { shop: "safe-shop.myshopify.com" }, pageId: "page-1",
    findingId: "finding-1", findingCode: "unsafe-link-protocol", expectedElementId: "unsafe",
    commandIntent: "element.update-props",
    commandInput: { pageId: "other-page", patch: { url: "https://example.com" } },
    confirmed: true, executeCommand,
  });
} catch (error) { authorityRejected = error?.code === "AI_QUALITY_FIX_INVALID_INPUT"; }
ok(authorityRejected, "commandInput must reject client-supplied authority fields");

const service = fs.readFileSync("app/services/ai-quality-fix-execution.server.js", "utf8");
for (const marker of ["buildQualityReport","buildQualityFixPlanInput","QUALITY_FIX_PLAN_COMMAND_INTENTS","executeAiCommand","AI_QUALITY_FIX_EXPLICIT_APPROVAL_REQUIRED","findMatchingFinding",'status: remaining ? "applied_unresolved" : "applied_resolved"']) {
  ok(service.includes(marker), `Quality fix execution marker missing: ${marker}`);
}
for (const forbidden of ["generateStructuredAi","OPENAI_API_KEY","builderPage.update","builderPage.create","admin.graphql","fetch(","runBuilderCommand","page.publish"]) {
  ok(!service.includes(forbidden), `Quality fix execution must not gain provider/direct persistence/publish authority: ${forbidden}`);
}
const route = fs.readFileSync("app/routes/app.ai-agent.jsx", "utf8");
for (const marker of ['intent === "quality-apply"',"qualityFixExecutionV1","qualityFixPlanningV1","applyAiQualityFix","body.confirm === true"]) {
  ok(route.includes(marker), `Guarded quality-apply route marker missing: ${marker}`);
}
const flags = fs.readFileSync("app/config/featureFlags.js", "utf8");
ok(flags.includes('qualityFixExecutionV1: Object.freeze({ env: "VSN_FEATURE_AI_QUALITY_FIX_EXECUTION", defaultValue: false'), "Quality fix execution feature flag must remain default-OFF");
console.log(`VSN P1.5b-c quality fix execution audit: PASS (${checks}/${checks})`);
