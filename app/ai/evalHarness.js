import crypto from "node:crypto";

export const AI_EVAL_ARTIFACT_SCHEMA_VERSION = 1;

const FORBIDDEN_ARTIFACT_KEYS = /^(?:prompt|rawPrompt|systemPrompt|rawOutput|outputText|responseText|merchantContext|apiKey|authorization|credential|credentials|secret|tokenValue)$/i;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function percentile(values, ratio) {
  const rows = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!rows.length) return 0;
  const index = Math.min(rows.length - 1, Math.max(0, Math.ceil(rows.length * ratio) - 1));
  return rows[index];
}

export function safeEvalId(value) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9_.:-]+/g, "-").slice(0, 120);
}

export function hashEvalInput(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

export function buildEvalSummary(cases = []) {
  const rows = Array.isArray(cases) ? cases : [];
  const verified = rows.filter((row) => row.status !== "NOT_VERIFIED");
  const passed = verified.filter((row) => row.status === "PASS");
  const safetyFailures = verified.filter((row) => row.safetyPass === false);
  const schemaFailures = verified.filter((row) => row.schemaPass === false);
  const taskFailures = verified.filter((row) => row.taskPass === false);
  const latencies = verified.map((row) => finite(row.latencyMs)).filter((value) => value >= 0);
  return Object.freeze({
    total: rows.length,
    verified: verified.length,
    notVerified: rows.length - verified.length,
    passed: passed.length,
    failed: verified.length - passed.length,
    taskFailures: taskFailures.length,
    safetyFailures: safetyFailures.length,
    schemaFailures: schemaFailures.length,
    inputTokens: verified.reduce((sum, row) => sum + finite(row.inputTokens), 0),
    outputTokens: verified.reduce((sum, row) => sum + finite(row.outputTokens), 0),
    latencyMs: {
      average: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0,
      p95: percentile(latencies, 0.95),
      max: latencies.length ? Math.max(...latencies) : 0,
    },
  });
}

export function assertSafeEvalArtifact(value, path = "artifact") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeEvalArtifact(item, `${path}[${index}]`));
    return true;
  }
  if (!value || typeof value !== "object") return true;
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_ARTIFACT_KEYS.test(key)) throw new Error(`Unsafe eval artifact field: ${path}.${key}`);
    assertSafeEvalArtifact(item, `${path}.${key}`);
  }
  return true;
}

export function buildEvalArtifact({
  evalVersion,
  dataset,
  runLabel,
  mode,
  runtime = {},
  cases = [],
  status,
  cost = {},
  startedAt,
  completedAt,
} = {}) {
  const artifact = {
    schemaVersion: AI_EVAL_ARTIFACT_SCHEMA_VERSION,
    evalVersion: safeEvalId(evalVersion),
    dataset: safeEvalId(dataset),
    runLabel: safeEvalId(runLabel),
    mode: safeEvalId(mode),
    status: safeEvalId(status),
    startedAt: startedAt || null,
    completedAt: completedAt || null,
    runtime: {
      provider: safeEvalId(runtime.provider),
      model: safeEvalId(runtime.model),
      pageBehavior: safeEvalId(runtime.pageBehavior),
      emailBehavior: safeEvalId(runtime.emailBehavior),
    },
    summary: buildEvalSummary(cases),
    cost: {
      status: safeEvalId(cost.status || "NOT_CONFIGURED"),
      estimatedUsd: cost.estimatedUsd == null
        ? null
        : Number.isFinite(Number(cost.estimatedUsd))
          ? Number(Number(cost.estimatedUsd).toFixed(6))
          : null,
    },
    cases: cases.map((row) => ({
      id: safeEvalId(row.id),
      category: safeEvalId(row.category),
      severity: safeEvalId(row.severity),
      surface: safeEvalId(row.surface),
      status: safeEvalId(row.status),
      taskPass: row.taskPass !== false,
      safetyPass: row.safetyPass !== false,
      schemaPass: row.schemaPass !== false,
      latencyMs: Math.max(0, finite(row.latencyMs)),
      inputTokens: Math.max(0, finite(row.inputTokens)),
      outputTokens: Math.max(0, finite(row.outputTokens)),
      errorType: safeEvalId(row.errorType),
      inputHash: safeEvalId(row.inputHash),
    })),
  };
  assertSafeEvalArtifact(artifact);
  return Object.freeze(artifact);
}

export function compareEvalArtifacts(baseline, candidate) {
  assertSafeEvalArtifact(baseline);
  assertSafeEvalArtifact(candidate);
  if (baseline?.evalVersion !== candidate?.evalVersion) throw new Error("Eval versions do not match.");
  if (baseline?.dataset !== candidate?.dataset) throw new Error("Eval datasets do not match.");

  const baseById = new Map((baseline?.cases || []).map((row) => [row.id, row]));
  const candidateById = new Map((candidate?.cases || []).map((row) => [row.id, row]));
  const regressions = [];
  const improvements = [];
  for (const [id, row] of candidateById) {
    const before = baseById.get(id);
    if (!before) continue;
    if (before.status === "PASS" && row.status !== "PASS") regressions.push(id);
    if (before.status !== "PASS" && row.status === "PASS") improvements.push(id);
  }

  const base = baseline.summary || buildEvalSummary(baseline.cases || []);
  const next = candidate.summary || buildEvalSummary(candidate.cases || []);
  let decision = "eligible-for-review";
  if (candidate.status !== "VERIFIED" || baseline.status !== "VERIFIED") decision = "not-verified";
  else if (next.safetyFailures > base.safetyFailures || next.schemaFailures > base.schemaFailures) decision = "block";
  else if (regressions.length) decision = "review-required";

  return Object.freeze({
    schemaVersion: 1,
    evalVersion: candidate.evalVersion,
    dataset: candidate.dataset,
    baseline: {
      runLabel: baseline.runLabel,
      provider: baseline.runtime?.provider || "",
      model: baseline.runtime?.model || "",
      pageBehavior: baseline.runtime?.pageBehavior || "",
      emailBehavior: baseline.runtime?.emailBehavior || "",
    },
    candidate: {
      runLabel: candidate.runLabel,
      provider: candidate.runtime?.provider || "",
      model: candidate.runtime?.model || "",
      pageBehavior: candidate.runtime?.pageBehavior || "",
      emailBehavior: candidate.runtime?.emailBehavior || "",
    },
    delta: {
      passed: finite(next.passed) - finite(base.passed),
      taskFailures: finite(next.taskFailures) - finite(base.taskFailures),
      safetyFailures: finite(next.safetyFailures) - finite(base.safetyFailures),
      schemaFailures: finite(next.schemaFailures) - finite(base.schemaFailures),
      inputTokens: finite(next.inputTokens) - finite(base.inputTokens),
      outputTokens: finite(next.outputTokens) - finite(base.outputTokens),
      averageLatencyMs: finite(next.latencyMs?.average) - finite(base.latencyMs?.average),
      estimatedUsd: candidate.cost?.estimatedUsd != null && baseline.cost?.estimatedUsd != null
        ? Number((finite(candidate.cost.estimatedUsd) - finite(baseline.cost.estimatedUsd)).toFixed(6))
        : null,
    },
    regressions,
    improvements,
    decision,
  });
}
