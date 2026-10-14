import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePaidMutationAccess } from "../app/utils/paid-mutation-access.js";

const resolve = (handle) => ({ starter: "starter", sliver: "sliver", gold: "gold", platinum: "platinum" })[handle] || null;
const active = (changes = {}) => ({
  key: "starter", subscriptionMirrorTrusted: true, entitlementVerified: true,
  subscription: { status: "active", planHandle: "starter" }, ...changes,
});
test("trusted paid contracts allow merchant writes", () => {
  for (const status of ["active", "trialing", "canceling"]) {
    assert.equal(evaluatePaidMutationAccess(active({ subscription: { status, planHandle: "starter" } }), resolve).allowed, true);
  }
});
test("missing, stale, unverified, retired Free and mismatched contracts are denied", () => {
  const cases = [
    null, {}, active({ subscriptionMirrorTrusted: false }), active({ entitlementVerified: false }),
    active({ subscription: null }), active({ subscription: { status: "frozen", planHandle: "starter" } }),
    active({ subscription: { status: "canceled", planHandle: "starter" } }),
    active({ subscription: { status: "active", planHandle: "free" } }),
    active({ subscription: { status: "active", planHandle: "unknown" } }),
    active({ subscription: { status: "active", planHandle: "gold" } }),
    active({ key: "inactive" }),
    active({ key: "core", subscription: { status: "active", planHandle: "free" } }),
  ];
  for (const plan of cases) {
    const decision = evaluatePaidMutationAccess(plan, resolve);
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, "VSN_PAID_SUBSCRIPTION_REQUIRED");
  }
});

test("paid gate stays in action, never read-only loader for twenty-two merchant routes", async () => {
  const { readFile } = await import("node:fs/promises");
  const protectedRoutes = [
    "app.pages.jsx", "app.builder.$id.jsx", "app.ai.jsx",
    "app.ai-command.jsx", "app.form-settings.jsx",
    "app.widget-studio.jsx", "app.builder-panel.$panel.jsx",
    "app.role-manager.jsx", "app.developer-studio.jsx",
    "app.email-builder.jsx", "app.floating-elements.jsx", "app.plugins.jsx",
    "app.campaigns.jsx", "app.stock-images.jsx", "app.stock-videos.jsx",
    "app.experiments.jsx", "app.backups.jsx", "app.library.jsx",
    "app.stock-audio.jsx", "app.brand-kits.jsx",
    "app.motion-library.jsx", "app.platform-intelligence.jsx",
  ];
  for (const path of protectedRoutes) {
    const source = await readFile(new URL("../app/routes/" + path, import.meta.url), "utf8");
    const loaderStart = source.indexOf("export async function loader(");
    const actionStart = source.search(/export\s+(?:async\s+function|const)\s+action\b/);
    assert.ok(actionStart >= 0, path + " requires an action");
    if (loaderStart >= 0 && loaderStart < actionStart) {
      assert.equal(source.slice(loaderStart, actionStart).includes("assertPaidBuilderMutation(db, session.shop)"), false, path + " loader must remain read-only");
    }
    assert.equal(source.slice(actionStart).includes("assertPaidBuilderMutation(db, session.shop)"), true, path + " must gate mutations");
    assert.equal(source.includes("paid-mutation-guard.server.js"), true, path + " must import guard");
    const actionSource = source.slice(actionStart);
    assert.ok(actionSource.indexOf("await authenticate.admin(") < actionSource.indexOf("assertPaidBuilderMutation(db, session.shop)"), path + " authenticates first");
  }
});
test("server helper explicitly fails closed in production", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app/utils/paid-mutation-guard.server.js", import.meta.url), "utf8");
  assert.match(source, /process\.env\.NODE_ENV !== "production"/);
  assert.match(source, /evaluatePaidMutationAccess\(plan, resolveInternalPlanKeyFromHandle\)/);
  assert.match(source, /status: 403/);
});
