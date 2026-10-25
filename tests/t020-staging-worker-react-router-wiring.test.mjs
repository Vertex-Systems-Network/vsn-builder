import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(path,"utf8");

test("Staging Vite build uses the real route graph with request-scoped Worker modules",()=>{
  const config=read("vite.staging-cloudflare.config.js");
  assert.match(config,/cloudflare\(\{configPath:"\.\/wrangler\.staging\.jsonc"/);
  assert.match(config,/reactRouter\(\)/);
  assert.match(config,/workerDb/);
  assert.match(config,/workerShopify/);
  assert.match(config,/workerHealth/);
  assert.match(config,/workerEntry/);
  assert.match(config,/workerPrisma/);
  assert.match(config,/\/app\/db\.server\.js/);
  assert.match(config,/\/app\/shopify\.server\.js/);
  assert.match(config,/\/app\/services\/database-health\.server\.js/);
  assert.match(config,/\/app\/entry\.server\.jsx/);
});

test("Staging entry uses Cloudflare Fetch, official SDK auth and request-scoped Neon",()=>{
  const entry=read("workers/staging-full-app.js");
  const runtime=read("app/services/worker-full-app-router-runtime.js");
  const context=read("app/services/worker-request-context.server.js");
  assert.match(entry,/virtual:react-router\/server-build/);
  assert.match(entry,/createWorkerShopifySdkContext/);
  assert.match(runtime,/VSN_STAGING_REACT_ROUTER_ENABLED!=="true"/);
  assert.match(runtime,/runWithWorkerRequestContext\(context/);
  assert.match(runtime,/context\.close/);
  assert.match(runtime,/env\.ASSETS\.fetch\(request\)/);
  assert.match(context,/AsyncLocalStorage/);
  assert.match(read("app/entry.worker.js"),/addDocumentResponseHeaders/);
  assert.match(read("app/services/worker-database-health.server.js"),/sourceChecksumAttested:false/);
});

test("Production remains on its separate existing Node Worker manifest",()=>{
  const production=JSON.parse(read("wrangler.production.jsonc").replace(/^\s*\/\/.*$/gm,""));
  assert.equal(production.main,"./workers/app.js");
  assert.equal(production.vars.VSN_STAGING_REACT_ROUTER_ENABLED,undefined);
});
