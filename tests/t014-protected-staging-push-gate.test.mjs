import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(".github/workflows/t014-cloudflare-staging-binding-audit.yml","utf8");
test("T014 source PR never receives Cloudflare tokens",()=>{
 assert.match(source,/pull_request:\s*\n\s*paths:/);
 assert.match(source,/synthetic-inventory:\s*\n\s*if: github\.event_name == 'pull_request'/);
 assert.doesNotMatch(source,/pull_request_target|write-all|contents: write/);
});
test("only protected development pushes or manual protected runs can read Staging metadata",()=>{
 assert.match(source,/push:\s*\n\s*branches: \[development\]/);
 for(const name of ["protected-reference","live-metadata-readonly"]){
  const start=source.indexOf("  "+name+":");
  assert(start>=0);
  const remainder=source.slice(start+2);
  const next=remainder.search(/\n  [A-Za-z0-9_-]+:/);
  const section=source.slice(start,next===-1?undefined:start+2+next);
  assert.match(section,/if: github\.event_name == 'workflow_dispatch' \|\| github\.event_name == 'push'/);
 }
 for(const guard of [
  'test "$SOURCE_REPO" = "Vertex-Systems-Network/vsn-builder"',
  'test "$SOURCE_REF" = "refs/heads/development"',
  'test "$SOURCE_PROTECTED" = "true"',
 ])assert(source.includes(guard));
 assert.match(source,/needs: protected-reference/);
 assert.match(source,/environment: cloudflare-staging/);
 assert.doesNotMatch(source,/environment: cloudflare-production/);
 assert.match(source,/node scripts\/t014-staging-worker-bindings\.mjs/);
});
