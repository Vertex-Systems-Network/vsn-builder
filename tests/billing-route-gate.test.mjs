import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasVerifiedBuilderPlan, isPlanlessBillingLocation } from "../app/utils/billing-route-gate.js";

test("unentitled stores can open only the billing entry points", () => {
  assert.equal(isPlanlessBillingLocation(new URL("https://app.example/app?view=pricing")), true);
  assert.equal(isPlanlessBillingLocation(new URL("https://app.example/app?view=license")), true);
  assert.equal(isPlanlessBillingLocation(new URL("https://app.example/app/plans")), true);
  assert.equal(isPlanlessBillingLocation(new URL("https://app.example/app")), false);
  assert.equal(isPlanlessBillingLocation(new URL("https://app.example/app/pages")), false);
  assert.equal(isPlanlessBillingLocation(new URL("https://app.example/app?view=settings")), false);
});

test("planless access is fail-closed unless entitlement is verified or local developer mode", () => {
  assert.equal(hasVerifiedBuilderPlan({ entitlementVerified: true }), true);
  assert.equal(hasVerifiedBuilderPlan({ developerMode: true, entitlementVerified: false }), true);
  assert.equal(hasVerifiedBuilderPlan({ entitlementVerified: false, developerMode: false }), false);
  assert.equal(hasVerifiedBuilderPlan(null), false);
});

test("both plan pages use the shared responsive pricing grid", () => {
  const pricingPage = readFileSync("app/components/dashboard/pages/Pricing.jsx", "utf8");
  const dedicatedPlansPage = readFileSync("app/routes/app.plans.jsx", "utf8");
  const styles = readFileSync("app/styles/dashboard.css", "utf8");
  assert.match(pricingPage, /className="dashboard-pricing-grid"/);
  assert.match(dedicatedPlansPage, /className="dashboard-pricing-grid"/);
  assert.match(styles, /\.dashboard-pricing-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(min-width:1400px\)\{\.dashboard-pricing-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)\}\}/);
  assert.match(styles, /@media\(max-width:640px\).*\.dashboard-pricing-grid\{grid-template-columns:1fr!important\}/);
});
