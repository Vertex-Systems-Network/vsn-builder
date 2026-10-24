import test from "node:test";
import assert from "node:assert/strict";
import {renderStagingBillingRequired} from "../app/services/worker-shopify-staging-billing-notice.js";

test("Staging unpaid app shell explains internal-app billing verification limits",async()=>{
  const response=renderStagingBillingRequired({
    shop:"staging-oath3rth.myshopify.com",
    apiKey:"a".repeat(32),
  });
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/separate internal Shopify app identity/);
  assert.match(html,/Partner API can verify managed subscriptions only for public apps/);
  assert.doesNotMatch(html,/pricing_plans|Choose a Shopify test plan|target="_top"/);
  assert.match(html,/does not activate a plan or make a charge/);
});

test("billing notice rejects untrusted shop or app identities",()=>{
  assert.throws(()=>renderStagingBillingRequired({shop:"foreign.example",apiKey:"a".repeat(32)}));
  assert.throws(()=>renderStagingBillingRequired({shop:"store.myshopify.com",apiKey:"short"}));
});
