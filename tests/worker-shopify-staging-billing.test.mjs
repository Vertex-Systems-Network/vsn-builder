import test from "node:test";
import assert from "node:assert/strict";
import {renderStagingBillingRequired} from "../app/services/worker-shopify-staging-dashboard.js";

test("Staging unpaid app shell links to the authenticated shop's Shopify pricing page",async()=>{
  const response=renderStagingBillingRequired({
    shop:"staging-oath3rth.myshopify.com",
    apiKey:"a".repeat(32),
  });
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/href="https:\/\/admin\.shopify\.com\/store\/staging-oath3rth\/charges\/vsn-builder-staging\/pricing_plans"/);
  assert.match(html,/target="_top"/);
  assert.match(html,/Choose a Shopify test plan/);
  assert.match(html,/does not activate a plan or make a charge/);
});

test("billing notice rejects untrusted shop or app identities",()=>{
  assert.throws(()=>renderStagingBillingRequired({shop:"foreign.example",apiKey:"a".repeat(32)}));
  assert.throws(()=>renderStagingBillingRequired({shop:"store.myshopify.com",apiKey:"short"}));
});
