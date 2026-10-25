import test from "node:test";
import assert from "node:assert/strict";
import {renderStagingBillingRequired} from "../app/services/worker-shopify-staging-billing-notice.js";

test("Staging unverified app shell explains private test-plan requirements",async()=>{
  const response=renderStagingBillingRequired({
    shop:"staging-oath3rth.myshopify.com",
    apiKey:"a".repeat(32),
  });
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/shopify-test/);
  assert.match(html,/works only for stores allowed in the Partner Dashboard/);
  assert.doesNotMatch(html,/pricing_plans|Choose a Shopify test plan|target="_top"/);
  assert.match(html,/does not activate a plan or make a charge/);
});

test("billing notice rejects untrusted shop or app identities",()=>{
  assert.throws(()=>renderStagingBillingRequired({shop:"foreign.example",apiKey:"a".repeat(32)}));
  assert.throws(()=>renderStagingBillingRequired({shop:"store.myshopify.com",apiKey:"short"}));
});
