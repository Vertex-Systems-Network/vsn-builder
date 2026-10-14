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
  ];
  for (const plan of cases) {
    const decision = evaluatePaidMutationAccess(plan, resolve);
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, "VSN_PAID_SUBSCRIPTION_REQUIRED");
  }
});

test("paid gate stays in action, never read-only loader", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app/routes/app.pages.jsx", import.meta.url), "utf8");
  const loaderStart = source.indexOf("export async function loader(");
  const actionStart = source.indexOf("export async function action(");
  assert.ok(loaderStart >= 0 && actionStart > loaderStart);
  assert.equal(source.slice(loaderStart, actionStart).includes("evaluatePaidMutationAccess("), false);
  assert.equal(source.slice(actionStart).includes("evaluatePaidMutationAccess("), true);
});
