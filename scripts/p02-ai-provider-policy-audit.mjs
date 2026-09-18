import assert from "node:assert/strict";
import fs from "node:fs";
import { AI_BEHAVIOR_DEFAULTS, resolveAiBehavior } from "../app/ai/behaviors.js";
import { createAiExecution, getAiRuntimePolicy } from "../app/services/ai-provider.server.js";

const read = (file) => fs.readFileSync(file, "utf8");
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

const page = resolveAiBehavior({ surface: "page", operation: "url", version: AI_BEHAVIOR_DEFAULTS.page });
ok(page.version === "page-v1", "Page behavior v1 must remain selectable");
ok(page.instructions.includes("untrusted data") && page.instructions.includes("do not reproduce source code"), "Page behavior must retain prompt-injection/source-copy guardrails");

const email = resolveAiBehavior({ surface: "email", operation: "subjects", version: AI_BEHAVIOR_DEFAULTS.email });
ok(email.version === "email-v1", "Email behavior v1 must remain selectable");
ok(email.instructions.includes("Never invent merge-token paths") && email.instructions.includes("untrusted data"), "Email behavior must retain token and prompt-injection guardrails");

const policy = getAiRuntimePolicy({ env: {} });
ok(policy.provider === "openai" && policy.model === "gpt-5-mini", "OpenAI/gpt-5-mini must remain the default provider/model");
ok(policy.timeoutMs === 45000 && policy.maxRetries === 0 && policy.fallbackProvider === null, "AI timeout/retry/fallback defaults must be explicit and conservative");
ok(policy.behaviorVersions.page === "page-v1" && policy.behaviorVersions.email === "email-v1", "Default behavior versions must be explicit");

const bounded = getAiRuntimePolicy({ env: { VSN_AI_TIMEOUT_MS: "999999", VSN_AI_MAX_RETRIES: "99" } });
ok(bounded.timeoutMs === 120000 && bounded.maxRetries === 2, "AI timeout/retries must be bounded");

assert.throws(() => createAiExecution({ behavior: page, env: { VSN_AI_PROVIDER: "unsupported" } }), /Unsupported AI provider/);
checks += 1;

const pageService = read("app/services/ai-builder.server.js");
const emailService = read("app/services/email-ai.server.js");
const providerService = read("app/services/ai-provider.server.js");
const vendorTransportMarkers = ["OPENAI_API_KEY", "/v1/responses", "Authorization:"];
for (const [label, source] of [["Page AI", pageService], ["Email AI", emailService]]) {
  ok(vendorTransportMarkers.every((marker) => !source.includes(marker)), `${label} must not own provider credentials or transport`);
}
ok(pageService.includes("generateStructuredAi") && emailService.includes("generateStructuredAi"), "Page and Email AI must use the shared provider contract");
ok(
  providerService.includes("/v1/responses") &&
    providerService.includes("OPENAI_API_KEY") &&
    providerService.includes("Authorization:"),
  "OpenAI transport must live only behind the provider adapter",
);
ok(providerService.includes("RETRYABLE_STATUS") && providerService.includes("fallbackProvider: null"), "Provider adapter must declare retry/fallback policy");

const schema = read("prisma/schema.prisma");
for (const field of ["provider", "behaviorVersion", "generationId"]) ok(schema.includes(field), `BuilderAiUsage telemetry missing ${field}`);
ok(fs.existsSync("prisma/migrations/20260919042500_p02_ai_provider_policy/migration.sql"), "P0.2 telemetry migration missing");

const envExample = read(".env.example");
for (const key of ["VSN_AI_PROVIDER", "VSN_AI_TIMEOUT_MS", "VSN_AI_MAX_RETRIES", "VSN_AI_PAGE_BEHAVIOR_VERSION", "VSN_AI_EMAIL_BEHAVIOR_VERSION"]) ok(envExample.includes(key), `Environment contract missing ${key}`);

const pkg = JSON.parse(read("package.json"));
ok(pkg.scripts?.["qa:p02"] === "node scripts/p02-ai-provider-policy-audit.mjs", "P0.2 QA command missing");
ok(pkg.scripts?.["qa:release"]?.includes("p02-ai-provider-policy-audit.mjs"), "P0.2 audit must be release-blocking");

console.log(`VSN P0.2 AI provider policy audit: PASS (${checks}/${checks})`);
