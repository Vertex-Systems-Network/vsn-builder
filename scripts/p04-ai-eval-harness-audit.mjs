import assert from "node:assert/strict";
import fs from "node:fs";
import { assertSafeEvalArtifact, buildEvalArtifact, compareEvalArtifacts } from "../app/ai/evalHarness.js";

const read = (file) => fs.readFileSync(file, "utf8");
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

const config = JSON.parse(read(".ai/evals/v1/config.json"));
const deterministic = JSON.parse(read(".ai/evals/v1/deterministic.json"));
const provider = JSON.parse(read(".ai/evals/v1/provider.json"));

ok(config.evalVersion === "1.0.0" && config.dataset === "vsn-ai-eval-v1", "Eval version/dataset must be explicit");
ok(config.deterministic.requiredPassRate === 1 && config.deterministic.maxCriticalSafetyFailures === 0, "Deterministic release threshold must fail closed");
for (const key of ["storeRawPrompts", "storeRawOutputs", "storeMerchantContext", "storeCredentials"]) {
  ok(config.artifactPolicy[key] === false, `Safe artifact policy must disable ${key}`);
}
ok(deterministic.cases.length >= 13, "Deterministic suite must cover initial contract/adversarial cases");
for (const id of [
  "page-executable-url",
  "behavior-prompt-injection-boundary",
  "email-executable-output",
  "command-undeclared-rejected",
  "command-consequential-denied",
  "command-cross-shop-rejected",
  "command-stale-version-rejected",
  "command-unsafe-patch-rejected",
]) ok(deterministic.cases.some((row) => row.id === id), `Deterministic safety suite missing ${id}`);

ok(provider.cases.length === 15, "Provider golden suite must cover all 15 initial QUALITY_GATES tasks");
for (let index = 1; index <= 15; index += 1) {
  const prefix = `golden-${String(index).padStart(2, "0")}-`;
  ok(provider.cases.some((row) => row.id.startsWith(prefix)), `Provider golden task ${index} missing`);
}

assert.throws(() => assertSafeEvalArtifact({ prompt: "must never persist" }), /Unsafe eval artifact field/);
checks += 1;
assert.throws(() => assertSafeEvalArtifact({ nested: { apiKey: "secret" } }), /Unsafe eval artifact field/);
checks += 1;

const baselineCases = [
  { id: "a", category: "golden", severity: "medium", surface: "page", status: "PASS", taskPass: true, safetyPass: true, schemaPass: true, latencyMs: 100, inputTokens: 10, outputTokens: 20 },
];
const candidateCases = [
  { id: "a", category: "golden", severity: "medium", surface: "page", status: "FAIL", taskPass: false, safetyPass: false, schemaPass: true, latencyMs: 120, inputTokens: 12, outputTokens: 25 },
];
const baseline = buildEvalArtifact({ evalVersion: "1.0.0", dataset: "vsn-ai-eval-v1", runLabel: "baseline", mode: "provider", status: "VERIFIED", cases: baselineCases });
const candidate = buildEvalArtifact({ evalVersion: "1.0.0", dataset: "vsn-ai-eval-v1", runLabel: "candidate", mode: "provider", status: "VERIFIED", cases: candidateCases });
const comparison = compareEvalArtifacts(baseline, candidate);
ok(comparison.decision === "block", "New safety/schema failures must mechanically block rollout");
ok(comparison.regressions.includes("a"), "Comparison must identify per-case regressions");

const deterministicRunner = read("scripts/ai-eval-deterministic.mjs");
for (const token of ["buildEvalArtifact", "criticalFailures", "artifacts/ai-evals", "process.exit(1)"]) ok(deterministicRunner.includes(token), `Deterministic runner missing ${token}`);

const providerRunner = read("scripts/ai-eval-provider.mjs");
for (const token of ["VSN_AI_EVALS", "NOT VERIFIED", "OPENAI_API_KEY", "runAiBuilder", "runEmailAi", "inputHash", "VSN_AI_EVAL_INPUT_USD_PER_M", "VSN_AI_EVAL_OUTPUT_USD_PER_M"]) {
  ok(providerRunner.includes(token), `Provider eval runner missing ${token}`);
}
ok(!providerRunner.includes("outputText:"), "Provider eval artifact must not persist raw model output");
ok(!providerRunner.includes("prompt: testCase.prompt"), "Provider eval artifact must not persist raw prompts");

const compareRunner = read("scripts/ai-eval-compare.mjs");
ok(compareRunner.includes("compareEvalArtifacts") && compareRunner.includes("process.exit(2)"), "Comparison runner must distinguish NOT VERIFIED");

const emailAi = read("app/services/email-ai.server.js");
for (const token of ["normalizeEmailAiResult", "(?:javascript|vbscript)", "data\\s*:\\s*text\\/html"]) ok(emailAi.includes(token), `Email AI adversarial sanitizer missing ${token}`);

const pkg = JSON.parse(read("package.json"));
ok(pkg.scripts?.["qa:p04"] === "node scripts/p04-ai-eval-harness-audit.mjs && node scripts/ai-eval-deterministic.mjs", "P0.4 QA command missing");
ok(pkg.scripts?.["qa:release"]?.includes("p04-ai-eval-harness-audit.mjs") && pkg.scripts?.["qa:release"]?.includes("ai-eval-deterministic.mjs"), "P0.4 deterministic evals must be release-blocking");
ok(pkg.scripts?.["qa:ai-evals:provider"] === "node scripts/ai-eval-provider.mjs", "Provider eval command missing");
ok(pkg.scripts?.["qa:ai-evals:compare"] === "node scripts/ai-eval-compare.mjs", "Eval comparison command missing");

console.log(`VSN P0.4 AI eval harness audit: PASS (${checks}/${checks})`);
