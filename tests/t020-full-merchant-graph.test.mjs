import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import worker from "../workers/full-merchant-graph-ci-probe.js";

const origin = "https://vsn-builder-ci.test";
const allowed = {
  APP_ENV: "test",
  VSN_BUILD_INTENT: "full-merchant-graph-compat",
};

test("full actual merchant React Router build was generated first", () => {
  const file = "build/server/index.js";
  assert.equal(existsSync(file), true, "npm run build must produce actual merchant ServerBuild");
  const list = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = dir + "/" + entry.name;
    return entry.isDirectory() ? list(path) : entry.name.endsWith(".js") ? [path] : [];
  });
  const chunks = list("build/server");
  const graphBytes = chunks.reduce((bytes, path) => bytes + statSync(path).size, 0);
  assert.ok(chunks.includes(file) && graphBytes > 1000,
    "expected nonempty generated merchant server graph, including Vite chunks");
});

test("CI Workerd runtime denies every request including synthetic health and auth", async () => {
  for (const path of ["/", "/healthz", "/readyz", "/app", "/app/pages",
    "/app/__vsn-auth-smoke", "/auth/callback", "/webhooks/app/uninstalled",
    "/billing"]) {
    for (const method of ["GET", "POST"]) {
      const r = await worker.fetch(new Request(origin + path, { method }), allowed);
      assert.equal(r.status, 503, method + " " + path);
      assert.equal(await r.text(), "");
      assert.equal(r.headers.get("cache-control"), "no-store");
      assert.match(r.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    }
  }
});

test("CI-only graph probe rejects live and secret-bearing environment", async () => {
  for (const env of [
    {},
    { ...allowed, APP_ENV: "staging" },
    { ...allowed, APP_ENV: "production" },
    { ...allowed, SHOPIFY_API_SECRET: "nope" },
    { ...allowed, DATABASE_URL: "nope" },
  ]) {
    const r = await worker.fetch(new Request(origin + "/app"), env);
    assert.equal(r.status, 503);
  }
});

test("full graph dry-run target cannot be mistaken for hosted Worker", () => {
  const config = readFileSync("wrangler.full-merchant-graph-ci.jsonc", "utf8")
    .replace(/^\s*\/\/.*$/gm, "");
  const parsed = JSON.parse(config);
  assert.equal(parsed.main, "./workers/full-merchant-graph-ci-probe.js");
  assert.equal(parsed.vars.APP_ENV, "test");
  assert.equal(parsed.workers_dev, false);
  assert.equal(parsed.preview_urls, false);
  assert.notEqual(parsed.name, "vsn-builder-staging");
  assert.notEqual(parsed.name, "vsn-builder-production");
  assert.doesNotMatch(JSON.stringify(parsed), /DATABASE_URL|SHOPIFY_API_KEY|SHOPIFY_API_SECRET/);
});

test("full graph actually imports merchant ServerBuild, official SDK and Neon", () => {
  const code = readFileSync("workers/full-merchant-graph-ci-probe.js", "utf8");
  assert.match(code, /import\("\.\.\/build\/server\/index\.js"\)/);
  assert.match(code, /shopify-worker-sdk-context\.js/);
  assert.match(code, /db-worker-neon\.js/);
  assert.match(code, /createRequestHandler/);
  const merchant = readFileSync("app/shopify.server.js", "utf8");
  assert.match(merchant, /@shopify\/shopify-app-react-router\/adapters\/node/);
  const entry = readFileSync("app/entry.server.jsx", "utf8");
  assert.match(entry, /PassThrough/);
});
