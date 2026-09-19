import fs from "node:fs";
import path from "node:path";
import { assertSafeEvalArtifact, compareEvalArtifacts } from "../app/ai/evalHarness.js";

const [, , baselinePath, candidatePath, outputArg] = process.argv;
if (!baselinePath || !candidatePath) {
  console.error("Usage: node scripts/ai-eval-compare.mjs <baseline.json> <candidate.json> [output.json]");
  process.exit(2);
}
const baseline = JSON.parse(fs.readFileSync(path.resolve(baselinePath), "utf8"));
const candidate = JSON.parse(fs.readFileSync(path.resolve(candidatePath), "utf8"));
assertSafeEvalArtifact(baseline);
assertSafeEvalArtifact(candidate);
const comparison = compareEvalArtifacts(baseline, candidate);
assertSafeEvalArtifact(comparison);

const outputFile = path.resolve(outputArg || "artifacts/ai-evals/comparison.json");
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(comparison, null, 2) + "\n");
console.log(`VSN AI eval comparison: ${comparison.decision}`);
console.log(`Regressions: ${comparison.regressions.length}; improvements: ${comparison.improvements.length}`);
console.log(`Safe comparison artifact: ${path.relative(process.cwd(), outputFile)}`);
if (comparison.decision === "block") process.exit(1);
if (comparison.decision === "not-verified") process.exit(2);
