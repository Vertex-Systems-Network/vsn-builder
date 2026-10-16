import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const flow=readFileSync(".github/workflows/phase4-staging-cloudflare-observation.yml","utf8");
const audit=readFileSync("scripts/phase4-staging-cloudflare-readiness.mjs","utf8");
test("T019 uses Metafields-style pinned public Staging IDs and scoped secrets",()=>{
 for(const field of [
  "environment: cloudflare-staging",
  "APP_ENV: staging",
  "NEON_PROJECT_ID: shiny-violet-61219572",
  "CLOUDFLARE_WORKER_NAME: vsn-builder-staging",
  "CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
  "CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}",
 ])assert(flow.includes(field),field);
 assert(!flow.includes("vars.NEON_PROJECT_ID"));
 assert(!flow.includes("vars.CLOUDFLARE_WORKER_NAME"));
});
test("T019 real Staging observation remains manual and protected; PR gets zero scoped secrets",()=>{
 assert(flow.includes("github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/development' && github.ref_protected == true"));
 assert(flow.includes("if: github.event_name == 'pull_request'"));
 const pr=flow.split("  source-contract:")[1]?.split("  inspect-staging-worker:")[0];
 assert(pr&&pr.includes("node --test"));
 assert(!pr.includes("environment: cloudflare-staging"));
 assert(!pr.includes("secrets."));
 assert(!flow.includes("wrangler deploy"));
 assert(!flow.includes("wrangler secret put"));
 assert(!flow.includes("prisma migrate"));
});
test("T019 delegates to canonical three-secret Cloudflare metadata GET verifier",()=>{
 assert(audit.includes("verifyStagingWorkerBindings"));
 assert(audit.includes("GITHUB_EVENT_NAME!==\"workflow_dispatch\""));
 assert(audit.includes("GITHUB_REF_PROTECTED!==\"true\""));
 assert(audit.includes("if(!proof.bindingReady)throw blocked()"));
 assert(!audit.includes("fetchImpl(url,{method:\"POST\""));
 assert(!audit.includes("fetchImpl(url,{method:\"PUT\""));
 assert(audit.includes("hostedOAuthVerified:false,merchantReady:false"));
});
