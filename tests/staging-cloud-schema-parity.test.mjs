import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { inspectCloudSchemaParity } from "../scripts/staging-cloud-schema-parity.mjs";
const f = (file) => readFileSync(file, "utf8");
const local = f("prisma/schema.prisma");
const cloud = f("prisma/cloud/schema.prisma");
const migrations = [
 "prisma/cloud/migrations/20261013_builder_cloud_baseline/migration.sql",
 "prisma/cloud/migrations/20261013_builder_shop_installation_fence/migration.sql",
].map(f).join("\n");
test("cloud Prisma schema preserves all local models and creates every table", () => {
  const result = inspectCloudSchemaParity(local, cloud, migrations);
  assert.equal(result.ready, true, JSON.stringify(result));
  assert.equal(result.modelCounts.local, 51);
  assert.equal(result.modelCounts.cloud, 52);
});
test("absent migration SQL must fail closed", () => {
  assert.equal(inspectCloudSchemaParity(local, cloud, "").ready, false);
});
test("accidental dropped local model must fail closed", () => {
  const broken = cloud.replace(/^model Session\s*\{[\s\S]*?^\}/m, "");
  const result = inspectCloudSchemaParity(local, broken, migrations);
  assert.equal(result.ready, false);
  assert.ok(result.missingModels.includes("Session"));
});
test("wrong cloud field type must fail closed", () => {
  const broken = cloud.replace(/(model Session \{[\s\S]*?\bshop\s+)String\b/, "$1Int");
  const result = inspectCloudSchemaParity(local, broken, migrations);
  assert.equal(result.ready, false);
  assert.ok(result.mismatch.some(x => x.includes("Session.shop")));
});
test("cloud schema must never replace local sqlite provider", () => {
  const broken = local.replace('provider = "sqlite"', 'provider = "postgresql"');
  assert.equal(inspectCloudSchemaParity(broken, cloud, migrations).ready, false);
});
