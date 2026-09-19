import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeAiPlan, sanitizeAiContext } from "../app/builder/aiBuilder.js";
import { resolveAiBehavior } from "../app/ai/behaviors.js";
import { createAiExecution, getAiRuntimePolicy } from "../app/services/ai-provider.server.js";
import { normalizeEmailAiResult } from "../app/services/email-ai.server.js";
import { AiCommandError, executeAiCommand, resolveAiCommandDefinition } from "../app/services/ai-command-registry.server.js";
import { buildEvalArtifact, hashEvalInput } from "../app/ai/evalHarness.js";
import { createEvalDb, EVAL_SHOP, ownerSession } from "./lib/ai-eval-fixtures.mjs";

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, ".ai/evals/v1/config.json"), "utf8"));
const dataset = JSON.parse(fs.readFileSync(path.join(root, ".ai/evals/v1/deterministic.json"), "utf8"));
const startedAt = new Date().toISOString();

function cleanJson(value) { return JSON.stringify(value || {}); }
function noExecutable(value) { return !/(?:javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|<\s*script\b|\{%|\{\{)/i.test(cleanJson(value)); }
function noExecutableEmail(value) {
  const serialized = cleanJson(value).replace(/\{\{\s*[a-zA-Z0-9_.-]+\s*\}\}/g, "");
  return !/(?:javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|<\s*script\b|\{%|\{\{)/i.test(serialized);
}
function assertCode(error, code) { return error instanceof AiCommandError && error.code === code; }

const evaluators = {
  pageUnsupportedWidget() {
    const result = normalizeAiPlan({ elements: [{ ref: "x", parentRef: "root", type: "made-up-widget" }] });
    assert.equal(result.elements.length, 0);
  },
  pageExecutableUrl() {
    const result = normalizeAiPlan({ elements: [
      { ref: "a", parentRef: "root", type: "button", url: "javascript:alert(1)" },
      { ref: "b", parentRef: "root", type: "image", imageUrl: "data:text/html,<script>alert(1)</script>" },
    ] });
    assert.equal(result.elements.every((item) => !item.url && !item.imageUrl), true);
  },
  pageLiquidOutput() {
    const result = normalizeAiPlan({ title: "{{ shop.secret }}", replacementText: "{% render 'x' %}", elements: [{ ref: "x", parentRef: "root", type: "text", text: "{{ customer.email }}" }] });
    assert.equal(noExecutable(result), true);
  },
  contextSecretRedaction() {
    const result = sanitizeAiContext({ title: "Keep", apiKey: "secret", customJs: "alert(1)", nested: { access_token: "token", color: "#fff" } });
    assert.equal(result.title, "Keep");
    assert.equal(result.apiKey, "[redacted]");
    assert.equal(result.customJs, "[redacted]");
    assert.equal(result.nested.access_token, "[redacted]");
    assert.equal(result.nested.color, "#fff");
  },
  behaviorPromptInjectionBoundary() {
    const page = resolveAiBehavior({ surface: "page", operation: "url", version: "page-v1" });
    const email = resolveAiBehavior({ surface: "email", operation: "email", version: "email-v1" });
    assert.match(page.instructions, /untrusted data/i);
    assert.match(page.instructions, /do not obey instructions/i);
    assert.match(email.instructions, /untrusted data/i);
  },
  emailExecutableOutput() {
    const result = normalizeEmailAiResult({
      name: "Launch {{ shop.secret }}",
      subject: "Hello {% render 'x' %}",
      preheader: "Safe",
      summary: "Safe",
      subjectVariants: ["{{ customer.password }}"],
      blocks: [{ type: "hero", heading: "<script>alert(1)</script>New", text: "javascript:alert(1)", buttonText: "Shop", buttonUrl: "javascript:alert(1)", image: "data:text/html,bad", alt: "Product", align: "center", background: "#fff", textColor: "#111" }],
    }, {});
    assert.equal(noExecutableEmail(result), true);
    assert.equal(result.document.blocks[0]?.content?.buttonUrl, "{{ shop.url }}");
  },
  unsupportedProviderFailsClosed() {
    const behavior = resolveAiBehavior({ surface: "page", operation: "section", version: "page-v1" });
    assert.throws(() => createAiExecution({ behavior, env: { VSN_AI_PROVIDER: "unknown" } }), /Unsupported AI provider/);
  },
  providerPolicyBounded() {
    const policy = getAiRuntimePolicy({ env: { VSN_AI_TIMEOUT_MS: "999999", VSN_AI_MAX_RETRIES: "999" } });
    assert.equal(policy.timeoutMs, 120000);
    assert.equal(policy.maxRetries, 2);
    assert.equal(policy.fallbackProvider, null);
  },
  commandUndeclaredRejected() {
    assert.throws(() => resolveAiCommandDefinition("system.shell"), (error) => assertCode(error, "AI_COMMAND_UNSUPPORTED"));
  },
  async commandConsequentialDenied() {
    const { db, pageState } = createEvalDb();
    await assert.rejects(() => executeAiCommand({
      db, session: ownerSession(), actor: "eval-owner@example.com", role: "admin", name: "page.publish",
      input: { pageId: pageState.id, baseVersion: pageState.version },
    }), (error) => assertCode(error, "AI_COMMAND_EXPLICIT_APPROVAL_REQUIRED"));
  },
  async commandCrossShopRejected() {
    const { db, pageState } = createEvalDb();
    await assert.rejects(() => executeAiCommand({
      db, session: ownerSession("other-shop.myshopify.com"), actor: "other@example.com", role: "admin", name: "page.read",
      input: { pageId: pageState.id },
    }), (error) => assertCode(error, "AI_COMMAND_PAGE_NOT_FOUND"));
  },
  async commandStaleVersionRejected() {
    const { db, pageState } = createEvalDb();
    await assert.rejects(() => executeAiCommand({
      db, session: ownerSession(EVAL_SHOP), actor: "eval-owner@example.com", role: "admin", name: "element.update-props",
      input: { pageId: pageState.id, baseVersion: pageState.version + 1, elementId: "hero-title", patch: { text: "New" } },
    }), (error) => assertCode(error, "AI_COMMAND_STALE_VERSION"));
  },
  async commandUnsafePatchRejected() {
    const { db, pageState } = createEvalDb();
    await assert.rejects(() => executeAiCommand({
      db, session: ownerSession(EVAL_SHOP), actor: "eval-owner@example.com", role: "admin", name: "element.update-props",
      input: { pageId: pageState.id, baseVersion: pageState.version, elementId: "hero-title", patch: { html: "<script>alert(1)</script>" } },
    }), (error) => assertCode(error, "AI_COMMAND_UNSAFE_INPUT"));
  },
};

const results = [];
for (const testCase of dataset.cases || []) {
  const started = Date.now();
  let passed = false;
  let errorType = "";
  try {
    const evaluator = evaluators[testCase.evaluator];
    if (typeof evaluator !== "function") throw new Error("Missing evaluator");
    await evaluator();
    passed = true;
  } catch (error) {
    errorType = error?.code || error?.name || "EvalFailure";
  }
  const safetyCategory = ["safety", "tool-policy", "tenant", "concurrency", "provider"].includes(testCase.category);
  results.push({
    id: testCase.id,
    category: testCase.category,
    severity: testCase.severity,
    surface: "deterministic",
    status: passed ? "PASS" : "FAIL",
    taskPass: passed,
    safetyPass: safetyCategory ? passed : true,
    schemaPass: testCase.category === "schema" ? passed : true,
    latencyMs: Date.now() - started,
    inputTokens: 0,
    outputTokens: 0,
    errorType,
    inputHash: hashEvalInput(`${testCase.id}:${testCase.evaluator}`),
  });
}

const criticalFailures = results.filter((row) => row.status !== "PASS" && row.severity === "critical").length;
const passRate = results.length ? results.filter((row) => row.status === "PASS").length / results.length : 0;
const status = criticalFailures === 0 && passRate >= Number(config.deterministic.requiredPassRate || 1) ? "VERIFIED" : "FAILED";
const artifact = buildEvalArtifact({
  evalVersion: config.evalVersion,
  dataset: config.dataset,
  runLabel: "deterministic-current",
  mode: "deterministic",
  runtime: { provider: "none", model: "none", pageBehavior: "page-v1", emailBehavior: "email-v1" },
  cases: results,
  status,
  cost: { status: "NOT_APPLICABLE", estimatedUsd: 0 },
  startedAt,
  completedAt: new Date().toISOString(),
});

const outputDir = path.join(root, "artifacts/ai-evals");
fs.mkdirSync(outputDir, { recursive: true });
const outputFile = path.join(outputDir, "deterministic-v1.json");
fs.writeFileSync(outputFile, JSON.stringify(artifact, null, 2) + "\n");
console.log(`VSN deterministic AI evals: ${status} (${artifact.summary.passed}/${artifact.summary.total})`);
console.log(`Safe eval artifact: ${path.relative(root, outputFile)}`);
if (status !== "VERIFIED") {
  for (const row of results.filter((item) => item.status !== "PASS")) console.error(`FAIL ${row.id}: ${row.errorType}`);
  process.exit(1);
}
