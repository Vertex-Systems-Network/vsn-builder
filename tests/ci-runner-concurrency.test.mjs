import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";

const dir=new URL("../.github/workflows/",import.meta.url);
const workflows=readdirSync(dir).filter((name)=>name.endsWith(".yml")).map((name)=>({name,yaml:readFileSync(new URL(name,dir),"utf8")}));
const onPullRequest=(yaml)=>/^on:[\s\S]*?^  pull_request:/m.test(yaml.split(/^jobs:/m)[0]);

test("every pull_request workflow cancels superseded runs",()=>{
  const prWorkflows=workflows.filter(({yaml})=>onPullRequest(yaml));
  assert.ok(prWorkflows.length>=30,`expected the PR workflow set, found ${prWorkflows.length}`);
  for(const {name,yaml} of prWorkflows) assert.match(yaml,/^concurrency:\n  group: .+\n  cancel-in-progress: /m,`${name} has no workflow-level concurrency group`);
});

test("protected-branch pushes are never cancelled by the runner optimization",()=>{
  for(const {name,yaml} of workflows){
    const block=yaml.match(/^concurrency:\n  group: (.*)\n  cancel-in-progress: (.*)$/m);
    // Intentional serial groups (cancel-in-progress: false) queue runs and never cancel.
    if(!block||block[2]==="false"||!onPullRequest(yaml)||!/^  push:/m.test(yaml.split(/^jobs:/m)[0])) continue;
    assert.match(block[1],/github\.event_name/,`${name} shares one group across push and pull_request`);
    assert.equal(block[2],"${{ github.event_name == 'pull_request' }}",`${name} may cancel protected-branch push evidence`);
  }
});
