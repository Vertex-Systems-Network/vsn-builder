import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const workflow=readFileSync(".github/workflows/t013-effective-development-protection.yml","utf8");
test("untrusted PR tests have no GitHub API tokens or source credentials",()=>{
 assert.match(workflow,/pull_request:\s*\n\s*paths:/);
 assert.match(workflow,/synthetic-policy-tests:\s*\n\s*if: github\.event_name == 'pull_request'/);
 assert.match(workflow,/GITHUB_TOKEN: ""/);
 assert.match(workflow,/persist-credentials: false/);
});
test("protected development PUSH/dispatch alone invokes read-only effective rules probe",()=>{
 assert.match(workflow,/push:\s*\n\s*branches: \[development\]/);
 for(const job of ["protected-ref-prerequisite","live-read-only-attestation"]){
  const start=workflow.indexOf("  "+job+":");
  assert(start>=0);
  const next=workflow.indexOf("\n  ",start+2);
  const body=workflow.slice(start,next===-1?undefined:next);
  assert.match(body,/if: github\.event_name == 'workflow_dispatch' \|\| github\.event_name == 'push'/);
 }
 for(const guard of [
  'test "$SOURCE_REPO" = "Vertex-Systems-Network/vsn-builder"',
  'test "$SOURCE_REF" = "refs/heads/development"',
  'test "$SOURCE_PROTECTED" = "true"',
 ])assert(workflow.includes(guard));
 assert.match(workflow,/needs: protected-ref-prerequisite/);
 assert.match(workflow,/run: node scripts\/t013-effective-development-protection\.mjs/);
 assert.doesNotMatch(workflow,/pull_request_target|write-all|contents: write/);
});
