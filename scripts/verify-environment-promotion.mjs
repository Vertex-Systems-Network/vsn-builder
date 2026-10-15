import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gate = JSON.parse(fs.readFileSync(path.join(root, "config/release/environment-gates.json"), "utf8"));
const target = process.argv.find((x) => x.startsWith("--target="))?.slice(9);
const source = process.argv.find((x) => x.startsWith("--source="))?.slice(9);
const errors = [];
const requireCheck = (condition, error) => { if (!condition) errors.push(error); };
requireCheck(["staging","production"].includes(target), "target must be staging or production");
requireCheck(/^[0-9a-f]{40}$/.test(source || ""), "source must be exact 40-character lowercase SHA");
requireCheck(gate.schema_version === 1, "unknown release-gate schema");

function evidenceValid(record, requiredEnvironment) {
  return record && typeof record === "object" &&
    /^[0-9a-f]{40}$/.test(record.source_ref || "") &&
    record.source_ref === source &&
    record.environment === requiredEnvironment &&
    Number.isSafeInteger(record.workflow_run_id) && record.workflow_run_id > 0 &&
    !Number.isNaN(Date.parse(record.accepted_at || "")) &&
    typeof record.verification === "object" &&
    record.verification?.status === "passed";
}

if (target === "staging") {
  const local = gate.local_dev || {};
  requireCheck(local.status === "accepted", "Local/Dev not accepted");
  requireCheck(local.accepted_source_ref === source, "Local/Dev accepted source differs from requested staging source");
  requireCheck(evidenceValid(local.evidence, "development"), "Local/Dev exact-source certification evidence missing");
  requireCheck(local.evidence?.verification?.sqlite === "passed", "Local SQLite persistence not certified");
  requireCheck(local.evidence?.verification?.shopify_dev_auth === "passed", "Local Shopify Dev auth not certified");
  requireCheck(local.evidence?.verification?.billing_test_mode === true, "Local billing test mode not certified");
}
if (target === "production") {
  const staging = gate.staging || {};
  requireCheck(staging.status === "accepted", "Staging not accepted");
  requireCheck(staging.accepted_main_ref === source, "Main source not matched to accepted Staging promotion");
  requireCheck(staging.evidence?.source_ref === staging.accepted_source_ref, "Staging runtime evidence source mismatch");
  requireCheck(staging.evidence?.environment === "staging", "Signed Staging runtime evidence missing environment");
  requireCheck(staging.evidence?.verification?.status === "passed", "Staging runtime verification not passed");
  requireCheck(staging.evidence?.verification?.postgresql === "passed", "Staging PostgreSQL not certified");
  requireCheck(staging.evidence?.verification?.signed_shopify_session === "passed", "Staging signed session not certified");
  requireCheck(staging.evidence?.verification?.billing_test_mode === true, "Staging billing test mode not certified");
  requireCheck(Number.isSafeInteger(staging.evidence?.workflow_run_id) && staging.evidence.workflow_run_id > 0, "Staging acceptance run ID missing");
}
if (errors.length) {
  for (const error of errors) console.error("FAIL " + error);
  console.error("Promotion " + (target || "unknown") + " BLOCKED (unverified exact source/evidence).");
  process.exitCode = 1;
} else console.log("Promotion "+target+" declaration checks passed; externally verify GitHub workflow provenance and real merchant acceptance before deployment.");
