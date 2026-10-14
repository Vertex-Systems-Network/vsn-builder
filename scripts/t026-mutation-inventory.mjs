import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const routesDir = join(root, "app", "routes");
const files = (await readdir(routesDir)).filter((name) => name.startsWith("app.") && /\.(jsx|js|tsx|ts)$/.test(name)).sort();

// Every exception is named, documented, and checked for its enforcement marker.
// New unguarded action routes automatically enter needs-intent-review and fail CI.
const exceptions = new Map([
  ["app._index.jsx", { type: "delegated-dashboard", evidence: ["export const action = handleDashboardAction"] }],
  ["app.jsx", { type: "delegated-dashboard", evidence: ["export const action = handleDashboardAction"] }],
  ["app.client-errors.jsx", { type: "operational-telemetry", evidence: ["recordOperationalError", "assertTrustedMutationRequest(request)"] }],
  ["app.control-center.jsx", { type: "guarded-with-retention-exceptions", evidence: ["accessibleWithoutPaidPlan", "await assertPaidBuilderMutation(db, session.shop)"] }],
  ["app.editor-media.jsx", { type: "authenticated-read-only-post", evidence: ["resolveByNodes(admin, ids)", "assertTrustedMutationRequest(request)"] }],
  ["app.form-submissions.jsx", { type: "privacy-deletion-exception", evidence: ['intent !== "delete"', "await assertPaidBuilderMutation(db, session.shop)", "assertTrustedMutationRequest(request)"] }],
  ["app.onboarding.jsx", { type: "prebilling-onboarding", evidence: ['intent==="seed-demo"', "await assertPaidBuilderMutation(db, session.shop)", "assertTrustedMutationRequest(request)"] }],
  ["app.plans.jsx", { type: "billing-bootstrap-exception", evidence: ["authenticate.admin("] }],
]);
const inventory = [];
const failures = [];
for (const route of files) {
  const source = await readFile(join(routesDir, route), "utf8");
  const match = /export\s+(?:async\s+function|const)\s+action\b/.exec(source);
  if (!match) continue;
  const action = source.slice(match.index);
  const paidGuard = action.includes("assertPaidBuilderMutation(db, session.shop)");
  const trustedRequest = action.includes("assertTrustedMutationRequest(request)");
  const exception = exceptions.get(route);
  const evidenceOk = exception?.evidence.every((marker) => source.includes(marker)) ?? false;
  if (exception && !evidenceOk) failures.push(route + " exception is missing its enforcement evidence");
  const status = exception ? (evidenceOk ? exception.type : "needs-intent-review")
    : paidGuard ? "paid-guarded" : "needs-intent-review";
  inventory.push({
    route, status, paidGuard, trustedRequest,
    roleGuard: /canAccessBuilder|canBuilder\(|requireOwner\(/.test(action),
    billingCheck: /getQuotaDecision|requireEntitlement|getFeatureDecision|getMinimumPlanDecision/.test(action),
    auth: /authenticate\.admin\(/.test(action),
  });
}
const delegate = await readFile(join(root, "app", "services", "dashboard-actions.server.js"), "utf8");
if (!delegate.includes("if (!DASHBOARD_PREBILLING_INTENTS.has(intent))") ||
    !delegate.includes("await assertPaidBuilderMutation(db, session.shop)") ||
    !delegate.includes("assertTrustedMutationRequest(request)")) {
  failures.push("Dashboard delegated action handler is missing billing gate or trusted-origin validation");
}
const counts = {
  totalActionRoutes: inventory.length,
  paidGuarded: inventory.filter((r) => r.status === "paid-guarded").length,
  exceptionReviewed: inventory.filter((r) => r.status !== "paid-guarded" && r.status !== "needs-intent-review").length,
  needsIntentReview: inventory.filter((r) => r.status === "needs-intent-review").length,
  routesWithoutInlineTrustedRequestCheck: inventory.filter((r) => !r.trustedRequest).length,
};
const report = { schemaVersion: 2, counts, routes: inventory, failures };
await writeFile(join(root, "t026-mutation-inventory.json"), JSON.stringify(report, null, 2) + "\n");
console.log("T026 mutation inventory", JSON.stringify(counts));
for (const row of inventory.filter((r) => r.status !== "paid-guarded")) console.log(row.route + " => " + row.status);
if (counts.paidGuarded < 26) failures.push("Expected at least 26 fully paid-guarded merchant action handlers");
if (counts.needsIntentReview) failures.push(counts.needsIntentReview + " merchant action handlers require intent review");
if (failures.length) {
  for (const failure of failures) console.error("T026 audit failure:", failure);
  process.exitCode = 1;
}
