import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const yaml=readFileSync(new URL("../.github/workflows/ci.yml",import.meta.url),"utf8");
const step=(name)=>{
  const start=yaml.indexOf("      - name: "+name+"\n");
  assert.notEqual(start,-1,"Required CI step missing: "+name);
  const end=yaml.indexOf("\n      - ",start+1);
  return yaml.slice(start,end<0?undefined:end);
};
test("required verify job retains both original npm audit commands",()=>{
  assert.match(yaml,/  verify:\n/);
  const prod=step("Production dependency audit");
  const dev=step("Development dependency audit");
  assert.match(prod,/id: production_audit/);
  assert.match(prod,/run: npm audit --omit=dev --audit-level=high/);
  assert.match(dev,/id: development_audit/);
  assert.match(dev,/run: npm audit --include=dev --audit-level=high/);
});
test("audit results must fail the same required verify job at the end",()=>{
  const enforced=step("Enforce all mandatory dependency audits");
  assert.match(enforced,/if: always\(\)/);
  assert.match(enforced,/steps\.production_audit\.outcome/);
  assert.match(enforced,/steps\.development_audit\.outcome/);
  assert.match(enforced,/steps\.post_playwright_audit\.outcome/);
  assert.match(enforced,/if \[\[ "\$PROD_AUDIT" != "success" \]\]/);
  assert.match(enforced,/if \[\[ "\$DEV_AUDIT" != "success" \]\]/);
  assert.match(enforced,/if \[\[ "\$POST_PLAYWRIGHT_AUDIT" != "success" \]\]/);
  assert.match(enforced,/exit 1/);
});
test("external Shopify QA, browser installs and E2E cannot run with red audits",()=>{
  assert.match(step("Run external phase-1 QA with protected credentials"),/steps\.development_audit\.outcome == 'success'/);
  assert.match(step("Run external Playwright E2E with protected credentials"),/steps\.post_playwright_audit\.outcome == 'success'/);
  const play=step("Audit post-Playwright dependency state");
  assert.match(play,/id: post_playwright_audit/);
  assert.match(play,/run: npm audit --include=dev --audit-level=high/);
  assert.match(yaml,/if: steps\.production_audit\.outcome == 'success' && steps\.development_audit\.outcome == 'success'\n\s+run: npm install --no-save/);
  const lines=yaml.split("\n");
  const browserIndex=lines.findIndex(line=>line.includes("run: npx playwright install --with-deps"));
  assert.notEqual(browserIndex,-1);
  const guard=lines[browserIndex-1];
  for(const requirement of [
    "github.event_name != 'pull_request'",
    "github.ref_protected == true",
    "github.ref == 'refs/heads/development'",
    "github.ref == 'refs/heads/main'",
    "steps.production_audit.outcome == 'success'",
    "steps.development_audit.outcome == 'success'",
    "steps.post_playwright_audit.outcome == 'success'",
  ]) assert.ok(guard.includes(requirement),"Missing browser release requirement: "+requirement);
});
