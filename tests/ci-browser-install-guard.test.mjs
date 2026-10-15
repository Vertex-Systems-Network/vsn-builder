import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const workflow=readFileSync(new URL("../.github/workflows/ci.yml",import.meta.url),"utf8");
function stepBefore(command) {
  const lines=workflow.split("\n");
  const index=lines.findIndex(line=>line.trim()===command);
  assert.notEqual(index,-1, `Missing CI command: ${command}`);
  for(let i=index-1;i>=0;i--){
    if(lines[i].trim().startsWith("- if:"))return lines[i].trim();
  }
  throw new Error(`No adjacent event guard for ${command}`);
}
test("PR does not download unused browser binaries; trusted E2E still can",()=>{
  const install=stepBefore("run: npx playwright install --with-deps chromium firefox webkit");
  assert.match(install,/github\.event_name != 'pull_request'/);
  assert.match(install,/post_playwright_audit\.outcome == 'success'/);
  const e2e=stepBefore("run: npm run e2e:playwright");
  assert.match(e2e,/github\.event_name != 'pull_request'/);
  assert.match(e2e,/post_playwright_audit\.outcome == 'success'/);
});
test("security checks run before browser gating and still enforce full post-install audit",()=>{
  assert.match(workflow,/id: post_playwright_audit[\s\S]*?run: npm audit --include=dev --audit-level=high/);
  assert.match(workflow,/POST_PLAYWRIGHT_AUDIT: \$\{\{ steps\.post_playwright_audit\.outcome \}\}/);
  assert.match(workflow,/if: always\(\)[\s\S]*?POST_PLAYWRIGHT_AUDIT/);
  assert.match(workflow,/if: steps\.production_audit\.outcome == 'success' && steps\.development_audit\.outcome == 'success'\n\s*continue-on-error: true\n\s*run: npm audit --include=dev --audit-level=high/);
});
