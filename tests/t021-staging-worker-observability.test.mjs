import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const staging = readFileSync(new URL("../wrangler.staging.jsonc", import.meta.url), "utf8");
const production = readFileSync(new URL("../wrangler.production.jsonc", import.meta.url), "utf8");

test("Staging observability is explicitly persisted and survives every config deploy", () => {
  assert.match(staging, /"observability"\s*:\s*\{/);
  assert.match(staging, /"enabled"\s*:\s*true/);
  assert.match(staging, /"logs"\s*:\s*\{[\s\S]*?"enabled"\s*:\s*true[\s\S]*?"persist"\s*:\s*true/);
  assert.match(staging, /"traces"\s*:\s*\{[\s\S]*?"enabled"\s*:\s*true[\s\S]*?"persist"\s*:\s*true/);
  assert.match(staging, /"issues"\s*:\s*\{\s*"enabled"\s*:\s*true\s*\}/);
});

test("Stored Staging telemetry redacts Shopify query credentials", () => {
  assert.match(staging, /"logs"\s*:\s*\{[\s\S]*?"redact_query_string"\s*:\s*true/);
  assert.match(staging, /"traces"\s*:\s*\{[\s\S]*?"redact_query_string"\s*:\s*true/);
});

test("Staging observability settings are not copied into Production", () => {
  assert.doesNotMatch(production, /"observability"\s*:/);
});
