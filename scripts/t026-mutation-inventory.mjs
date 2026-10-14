import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const routesDir = join(root, "app", "routes");
const billingException = new Set(["app.plans.jsx"]);
const names = (await readdir(routesDir)).filter((name) => name.startsWith("app.") && /\.(jsx|js|tsx|ts)$/.test(name)).sort();
const inventory = [];
for (const name of names) {
  const source = await readFile(join(routesDir, name), "utf8");
  const match = /export\s+(?:async\s+function|const)\s+action\b/.exec(source);
  if (!match) continue;
  const action = source.slice(match.index);
  const paidGuard = action.includes("assertPaidBuilderMutation(db, session.shop)");
  const roleGuard = /canAccessBuilder|canBuilder\(|requireOwner\(/.test(action);
  const billingCheck = /getQuotaDecision|requireEntitlement|getFeatureDecision|getMinimumPlanDecision/.test(action);
  const trustedRequest = /assertTrustedMutationRequest\(request\)/.test(action);
  const auth = /authenticate\.admin\(/.test(action);
  const status = paidGuard ? "guarded" : billingException.has(name) ? "billing-bootstrap-exception" : "needs-intent-review";
  inventory.push({ route: name, status, paidGuard, roleGuard, billingCheck, trustedRequest, auth });
}
const counts = {
  totalActionRoutes: inventory.length,
  guarded: inventory.filter((item) => item.status === "guarded").length,
  billingBootstrapExceptions: inventory.filter((item) => item.status === "billing-bootstrap-exception").length,
  needsIntentReview: inventory.filter((item) => item.status === "needs-intent-review").length,
  missingTrustedRequestCheck: inventory.filter((item) => !item.trustedRequest).length,
};
const report = { schemaVersion: 1, counts, routes: inventory };
await writeFile(join(root, "t026-mutation-inventory.json"), JSON.stringify(report, null, 2) + "\n");
console.log("T026 audit inventory", JSON.stringify(counts));
console.log(inventory.filter((item) => item.status === "needs-intent-review").map((item) => item.route).join("\n"));
if (counts.guarded < 22) {
  console.error("Regression: expected at least 22 guarded merchant mutation handlers");
  process.exitCode = 1;
}
