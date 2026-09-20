import assert from "node:assert/strict";
import fs from "node:fs";
import { buildQualityReport } from "../app/ai/qualityAgent.js";
import {
  QUALITY_FIX_PLAN_COMMAND_INTENTS,
  QUALITY_FIX_PLAN_MAX_INPUT_FINDINGS,
  QUALITY_FIX_PLAN_MAX_ITEMS,
  QUALITY_FIX_PLAN_OUTPUT_SCHEMA,
  QUALITY_FIX_PLAN_VERSION,
  buildQualityFixPlanInput,
  normalizeQualityFixPlan,
} from "../app/ai/qualityFixPlan.js";

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };
const rejects = (fn, pattern, message) => {
  assert.throws(fn, pattern, message);
  checks += 1;
};

const nodes = [{
  id: "root",
  type: "section",
  props: {},
  styles: {},
  children: [
    { id: "bad-link", type: "button", props: { text: "Unsafe", url: "javascript:alert(1)" }, styles: {}, children: [] },
    { id: "bad-image", type: "image", props: { src: "/hero.jpg", alt: "" }, styles: {}, children: [] },
    { id: "bad-binding", type: "text", props: { text: "Bound" }, styles: {}, bindings: { "props.text": { enabled: true, source: "secret.token", type: "text" } }, children: [] },
  ],
}];

const report = buildQualityReport(nodes);
const input = buildQualityFixPlanInput(report);
ok(QUALITY_FIX_PLAN_VERSION === 1, "Quality fix plan contract version must be explicit");
ok(QUALITY_FIX_PLAN_MAX_ITEMS === 12, "Quality fix plan must stay bounded to 12 proposals");
ok(QUALITY_FIX_PLAN_MAX_INPUT_FINDINGS === 40, "Quality fix-plan provider projection must stay bounded");
ok(input.validatorsAuthoritative === true && input.proposalOnly === true && input.executable === false, "Deterministic authority and proposal-only state must be explicit");
ok(input.requiresRevalidation === true, "Every plan must require deterministic revalidation");
ok(input.findings.length > 0, "Quality report findings must project into bounded fix-plan input");
ok(QUALITY_FIX_PLAN_OUTPUT_SCHEMA.additionalProperties === false, "Strict output schema must reject hidden top-level payloads");
ok(QUALITY_FIX_PLAN_OUTPUT_SCHEMA.properties.items.maxItems === QUALITY_FIX_PLAN_MAX_ITEMS, "Strict schema must enforce item bound");
assert.deepEqual(QUALITY_FIX_PLAN_COMMAND_INTENTS, [
  "element.insert",
  "element.move",
  "element.update-props",
  "element.update-styles",
  "element.rewrite",
  "element.remove",
], "Fix-plan command intents must exactly match the existing reversible Editor Agent command set");
checks += 1;
ok(QUALITY_FIX_PLAN_OUTPUT_SCHEMA.properties.items.items.properties.commandIntent.enum.includes("manual-review"), "Manual review must be available for findings without a safe Builder command mapping");

const linkFinding = input.findings.find((item) => item.code === "unsafe-link-protocol");
ok(Boolean(linkFinding?.elementId), "Unsafe-link test finding must retain deterministic element target");

const normalized = normalizeQualityFixPlan({
  status: "ready",
  summary: "Propose the smallest reversible draft remediation for the blocking link issue.",
  items: [{
    findingId: linkFinding.id,
    commandIntent: "element.update-props",
    explanation: "The deterministic link validator blocked this element.",
    proposedChange: "Replace the unsafe URL with a merchant-approved safe destination.",
    elementId: linkFinding.elementId,
    blockId: "",
    requiresMerchantInput: true,
  }],
}, input);

ok(normalized.items.length === 1, "Valid proposal must normalize");
ok(normalized.items[0].executable === false, "Normalized items must never become executable");
ok(normalized.items[0].verification === "rerun-deterministic-quality-report", "Every proposal must require deterministic revalidation");
ok(normalized.coverage.uncoveredFindingIds.length === input.findings.length - 1, "Coverage must expose findings the plan did not address");
ok(Object.isFrozen(normalized) && Object.isFrozen(normalized.items), "Normalized plan must be immutable");

rejects(() => normalizeQualityFixPlan({
  status: "ready",
  summary: "orphan",
  items: [{
    findingId: "finding-999",
    commandIntent: "element.update-props",
    explanation: "x",
    proposedChange: "x",
    elementId: linkFinding.elementId,
    blockId: "",
    requiresMerchantInput: false,
  }],
}, input), /unknown findingId/, "Orphan proposals must be rejected");

rejects(() => normalizeQualityFixPlan({
  status: "ready",
  summary: "cross-target",
  items: [{
    findingId: linkFinding.id,
    commandIntent: "element.update-props",
    explanation: "x",
    proposedChange: "x",
    elementId: "some-other-element",
    blockId: "",
    requiresMerchantInput: false,
  }],
}, input), /outside its deterministic finding/, "Cross-element targeting must be rejected");

rejects(() => normalizeQualityFixPlan({
  status: "ready",
  summary: "hidden payload",
  items: [{
    findingId: linkFinding.id,
    commandIntent: "element.update-props",
    explanation: "x",
    proposedChange: "x",
    elementId: linkFinding.elementId,
    blockId: "",
    requiresMerchantInput: false,
    props: { url: "https://example.test" },
  }],
}, input), /unsupported field: props/, "Executable payload fields must not be smuggled into proposal items");

const source = fs.readFileSync("app/ai/qualityFixPlan.js", "utf8");
for (const forbidden of [
  "generateStructuredAi",
  "executeAiCommand",
  "builderPage.update",
  "builderPage.create",
  "admin.graphql",
  "OPENAI_API_KEY",
  "fetch(",
  "prisma",
]) {
  ok(!source.includes(forbidden), `P1.5b-a contract must remain provider/mutation free: ${forbidden}`);
}
for (const marker of [
  "proposalOnly",
  "executable: false",
  "requiresRevalidation",
  "validatorsAuthoritative",
  "rerun-deterministic-quality-report",
]) {
  ok(source.includes(marker), `Quality fix-plan safety marker missing: ${marker}`);
}

console.log(`VSN P1.5b-a quality fix-plan audit: PASS (${checks}/${checks})`);
