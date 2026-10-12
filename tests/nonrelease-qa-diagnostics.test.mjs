import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const y=readFileSync(".github/workflows/nonrelease-qa-diagnostics.yml","utf8");
test("non-release QA has read-only privileges, isolated test database, and no deploy",()=>{
  assert.match(y,/name: VSN Non-Release Quality Diagnostics/);
  assert.match(y,/contents: read/);
  assert.doesNotMatch(y,/contents: write|id-token: write|wrangler deploy|shopify app deploy|npm run deploy:production|environment: cloudflare-production/);
  assert.match(y,/DATABASE_URL: file:\.\/ci\.sqlite/);
  assert.match(y,/npm run typecheck/);
  assert.match(y,/npm run build/);
  assert.match(y,/npm run qa:release/);
});

test("Q4 audit requires safe blocked production deploy during three-tier transition",()=>{
  const audit=readFileSync("scripts/milestone-q4-shopify-production-integration-audit.mjs","utf8");
  assert.match(audit,/threeTierMigration \? safeBlock/);
  assert.match(audit,/release:production:check/);
  assert.match(audit,/scripts\/deployment-blocked\.mjs/);
  const pkg=JSON.parse(readFileSync("package.json","utf8"));
  assert.equal(pkg.scripts["deploy:production"],"node scripts/deployment-blocked.mjs production");
});
