import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("dashboard delegates protect paid features but allow billing, support, and uninstall", async () => {
  const handler = await source("app/services/dashboard-actions.server.js");
  assert.match(handler, /DASHBOARD_PREBILLING_INTENTS/);
  for (const intent of ["app-uninstall", "billing-refresh", "support-create", "support-reply", "support-status", "notification-read"]) {
    assert.ok(handler.includes('"' + intent + '"'), intent);
  }
  assert.match(handler, /if \(!DASHBOARD_PREBILLING_INTENTS\.has\(intent\)\)/);
  assert.match(handler, /await assertPaidBuilderMutation\(db, session\.shop\)/);
  for (const route of ["app.jsx", "app._index.jsx"]) {
    assert.match(await source("app/routes/" + route), /export const action = handleDashboardAction/);
  }
});
test("onboarding retains prebilling workflow but paid-gates demo assets", async () => {
  const route = await source("app/routes/app.onboarding.jsx");
  assert.match(route, /assertTrustedMutationRequest\(request\)/);
  const seed = route.indexOf('if(intent==="seed-demo")');
  const paid = route.indexOf("await assertPaidBuilderMutation(db, session.shop)");
  assert.ok(seed >= 0 && paid > seed, "seed demo must require paid subscription");
  assert.ok(route.indexOf('if(intent==="select-track")') < seed);
});
test("submission management permits post-cancellation deletion but gates status changes", async () => {
  const route = await source("app/routes/app.form-submissions.jsx");
  assert.match(route, /assertTrustedMutationRequest\(request\)/);
  assert.match(route, /if \(intent !== "delete"\) await assertPaidBuilderMutation\(db, session\.shop\)/);
});
test("read-only media resolver keeps Shopify file lookup working without paid subscription", async () => {
  const route = await source("app/routes/app.editor-media.jsx");
  assert.match(route, /assertTrustedMutationRequest\(request\)/);
  assert.doesNotMatch(route, /assertPaidBuilderMutation/);
  assert.match(route, /resolveByNodes\(admin, ids\)/);
});
test("SVG imports require trusted Shopify host boundaries and do not follow redirects", async () => {
  const route = await source("app/routes/app.svg-assets.jsx");
  assert.match(route, /host\.endsWith\("\.shopify\.com"\)/);
  assert.match(route, /host\.endsWith\("\.shopifycdn\.net"\)/);
  assert.match(route, /redirect:"error"/);
  assert.doesNotMatch(route, /host\.endsWith\("shopify\.com"\)/);
});

test("merchant PII, media and setup access require the correct VSN role", async () => {
  const resources = [
    ["app.form-submissions.jsx", "submissions", true],
    ["app.form-uploads.$id.jsx", "submissions", false],
    ["app.fonts.jsx", "fonts", true],
    ["app.svg-assets.jsx", "svgAssets", true],
    ["app.onboarding.jsx", "onboarding", true],
    ["app.editor-media.jsx", "pages", true],
  ];
  for (const [file, permission, hasAction] of resources) {
    const route = await source("app/routes/" + file);
    const expected = 'canAccessBuilderSystem(db, session, "' + permission + '")';
    const loaderStart = route.indexOf("export async function loader");
    const actionStart = route.indexOf("export async function action");
    assert.ok(loaderStart >= 0, file + " must authenticate protected reads");
    assert.ok(route.slice(loaderStart, actionStart >= 0 ? actionStart : undefined).includes(expected), file + " loader role check");
    if (hasAction) {
      assert.ok(actionStart >= 0, file + " action present");
      assert.ok(route.slice(actionStart).includes(expected), file + " action role check");
    }
  }
});
