import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

test("hosted Shopify staging cannot access protected secrets from PR or unprotected ref", () => {
  const yaml=readFileSync(".github/workflows/staging-hosted-readiness.yml","utf8");
  const host=yaml.slice(yaml.indexOf("\n  hosted-readiness:"));
  assert.match(host,/if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/development' && github\.ref_protected == true/);
  assert.match(host,/environment: cloudflare-staging/);
  assert.ok(host.includes("scripts/staging-hosted-readiness.mjs --require-ready"));
  assert.doesNotMatch(host,/continue-on-error:\s*true/);
});

test("staging Cloudflare metadata reads actual Worker settings and secret-name inventory",()=>{
  const code=readFileSync("scripts/staging-hosted-readiness.mjs","utf8");
  assert.match(code,/get\("\/settings"\)/);
  assert.match(code,/get\("\/secrets"\)/);
  assert.match(code,/get\("\/deployments"\)/);
  assert.doesNotMatch(code,/get\("\/script-settings"\)/);
});

test("Worker Neon adapter detection uses existing project runtime module, not stale path",()=>{
  const code=readFileSync("scripts/staging-hosted-readiness.mjs","utf8");
  assert.equal(existsSync("app/services/db-worker-neon.js"),true);
  assert.match(code,/existsSync\("app\/services\/db-worker-neon\.js"\)/);
  assert.doesNotMatch(code,/staging-worker-neon\.server\.js/);
});

test("public readiness never trusts configured URL or synthetic flags alone",()=>{
  const code=readFileSync("scripts/staging-hosted-readiness.mjs","utf8");
  assert.match(code,/await probeStagingHostedRuntime\(process\.env\.SHOPIFY_APP_URL\)/);
  assert.match(code,/httpProof\?\.merchantReady === true/);
  assert.match(code,/httpProof\?\.merchantRoute === true/);
});
