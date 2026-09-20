import assert from "node:assert/strict";
import fs from "node:fs";
import { runAiQualityFixPlan } from "../app/services/ai-quality-fix-plan.server.js";

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

const pageContent = [{
  id: "root",
  type: "section",
  props: {},
  styles: {},
  children: [
    { id: "unsafe", type: "button", props: { text: "PRIVATE_PAGE_COPY_SHOULD_NOT_REACH_PROVIDER", url: "javascript:alert(1)" }, styles: {}, children: [] },
    { id: "image", type: "image", props: { src: "/hero.jpg", alt: "" }, styles: {}, children: [] },
  ],
}];

const usageUpdates = [];
let reserved = 0;
let capturedInput = "";
let selectedFindingId = "";
const db = {
  builderPage: {
    async findFirst(query) {
      ok(query?.where?.shop === "safe-shop.myshopify.com", "Quality planning must tenant-scope the page read");
      ok(query?.where?.id === "page-1", "Quality planning must use the requested authenticated page");
      return { id: "page-1", template: "page", contentJson: JSON.stringify(pageContent) };
    },
  },
  builderAiUsage: {
    async update({ data }) { usageUpdates.push(data); return {}; },
  },
};

const result = await runAiQualityFixPlan({
  db,
  shop: "safe-shop.myshopify.com",
  pageId: "page-1",
  goal: "Explain the blocker and propose a safe fix.",
  reserveUsage: async ({ operation }) => {
    reserved += 1;
    ok(operation === "quality-fix-plan", "Quality plan must use a dedicated metered operation");
    return { id: "usage-1" };
  },
  getUsage: async () => ({ remaining: 9 }),
  providerConfigured: () => true,
  env: {
    VSN_AI_PROVIDER: "openai",
    VSN_AI_MODEL: "test-model",
    VSN_AI_QUALITY_BEHAVIOR_VERSION: "quality-fix-v1",
  },
  generate: async ({ behavior, input, schema, schemaName }) => {
    ok(behavior?.version === "quality-fix-v1", "Quality planning must use the versioned quality behavior");
    ok(schemaName === "vsn_quality_fix_plan", "Quality planning must use the sealed fix-plan schema");
    ok(schema?.additionalProperties === false, "Provider output schema must remain strict");
    capturedInput = input?.[0]?.content?.[0]?.text || "";
    const jsonStart = capturedInput.indexOf("{");
    const projected = JSON.parse(capturedInput.slice(jsonStart));
    const linkFinding = projected.findings.find((item) => item.code === "unsafe-link-protocol");
    ok(Boolean(linkFinding), "Provider projection must contain the deterministic unsafe-link finding");
    selectedFindingId = linkFinding.id;
    return {
      output: {
        status: "ready",
        summary: "One blocking link issue should be addressed first.",
        items: [{
          findingId: linkFinding.id,
          commandIntent: "element.update-props",
          explanation: "The deterministic validator rejected the link protocol.",
          proposedChange: "Replace the unsafe destination with a merchant-approved safe URL.",
          elementId: linkFinding.elementId,
          blockId: "",
          requiresMerchantInput: true,
        }],
      },
      usage: { input_tokens: 21, output_tokens: 12 },
      provider: "openai",
      model: "test-model",
      responseId: "resp-test",
    };
  },
});

ok(reserved === 1, "Quality planning must reserve usage exactly once");
ok(result.ok === true, "Quality planning must return a successful result");
ok(result.quality.validatorsAuthoritative === true, "Deterministic validators must remain authoritative");
ok(result.quality.pass === false, "Deterministic blocker must remain visible in the quality summary");
ok(result.plan.proposalOnly === true && result.plan.executable === false, "Provider output must normalize to proposal-only non-executable plan");
ok(result.plan.requiresRevalidation === true, "Provider plan must require deterministic revalidation");
ok(result.plan.items[0].findingId === selectedFindingId, "Provider proposal must stay bound to the deterministic finding");
ok(capturedInput.includes("unsafe-link-protocol"), "Provider must receive the compact deterministic finding projection");
ok(!capturedInput.includes("PRIVATE_PAGE_COPY_SHOULD_NOT_REACH_PROVIDER"), "Provider must not receive raw Builder page copy");
ok(!capturedInput.includes('"children"'), "Provider must not receive the raw Builder node tree");
ok(usageUpdates.some((row) => row.status === "completed" && row.inputTokens === 21 && row.outputTokens === 12), "Quality usage telemetry must be recorded");

let emptyGenerateCalled = false;
let emptyReserveCalled = false;
const cleanDb = {
  builderPage: {
    async findFirst() {
      return { id: "clean-page", template: "page", contentJson: JSON.stringify([{ id: "root", type: "section", props: {}, styles: {}, children: [] }]) };
    },
  },
  builderAiUsage: { async update() { return {}; } },
};
const clean = await runAiQualityFixPlan({
  db: cleanDb,
  shop: "safe-shop.myshopify.com",
  pageId: "clean-page",
  reserveUsage: async () => { emptyReserveCalled = true; return { id: "unexpected" }; },
  getUsage: async () => ({ remaining: 10 }),
  providerConfigured: () => true,
  generate: async () => { emptyGenerateCalled = true; return {}; },
});
ok(clean.plan.status === "no_safe_fixes", "Clean deterministic reports must short-circuit without invented fixes");
ok(emptyGenerateCalled === false && emptyReserveCalled === false, "Clean reports must not spend provider quota");

const service = fs.readFileSync("app/services/ai-quality-fix-plan.server.js", "utf8");
for (const marker of [
  "buildQualityReport",
  "buildQualityFixPlanInput",
  "normalizeQualityFixPlan",
  "quality-fix-plan",
  "QUALITY_FIX_PLAN_OUTPUT_SCHEMA",
  "pageTemplate",
]) {
  ok(service.includes(marker), `Quality planning integration marker missing: ${marker}`);
}
for (const forbidden of [
  "executeAiCommand",
  "runBuilderCommand",
  "builderPage.update",
  "builderPage.create",
  "admin.graphql",
  "fetch(",
]) {
  ok(!service.includes(forbidden), `Quality planning service must not gain execution/publish/network mutation authority: ${forbidden}`);
}

const route = fs.readFileSync("app/routes/app.ai-agent.jsx", "utf8");
for (const marker of [
  'intent === "quality-plan"',
  "qualityFixPlanningV1",
  "runAiQualityFixPlan",
  "canAccessBuilderEditor",
]) {
  ok(route.includes(marker), `Guarded quality-plan route integration missing: ${marker}`);
}

const flags = fs.readFileSync("app/config/featureFlags.js", "utf8");
ok(flags.includes('qualityFixPlanningV1: Object.freeze({ env: "VSN_FEATURE_AI_QUALITY_FIX_PLAN", defaultValue: false'), "Quality planning feature flag must remain default-OFF");

const behaviors = fs.readFileSync("app/ai/behaviors.js", "utf8");
ok(behaviors.includes('quality: "quality-fix-v1"') && behaviors.includes('"quality-fix-v1"'), "Quality planning must be behavior-versioned");
ok(behaviors.includes("Deterministic validators remain authoritative"), "Quality behavior must preserve deterministic authority");

const provider = fs.readFileSync("app/services/ai-provider.server.js", "utf8");
ok(provider.includes("VSN_AI_QUALITY_BEHAVIOR_VERSION") && provider.includes("AI_BEHAVIOR_DEFAULTS.quality"), "Provider policy must expose the quality behavior version");

console.log(`VSN P1.5b-b quality plan integration audit: PASS (${checks}/${checks})`);
