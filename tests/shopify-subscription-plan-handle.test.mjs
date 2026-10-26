import test from "node:test";
import assert from "node:assert/strict";
import { planFromItems } from "../app/services/shopify-subscription.server.js";
import { serializePlan } from "../app/utils/plan.server.js";
import { UNSUBSCRIBED_PLAN } from "../app/config/commercialPlans.js";

test("recognized Shopify plan handles map to their configured Builder plan",()=>{
  assert.deepEqual(planFromItems([{handle:"starter"}]),{
    key:"starter",handle:"starter",ambiguous:false,
  });
});

test("one safe but unmapped Shopify handle stays out of the active-plan identity",()=>{
  assert.deepEqual(planFromItems([{handle:"vsn_starter_legacy"}]),{
    key:null,handle:null,diagnosticHandle:"vsn_starter_legacy",ambiguous:false,
  });
});

test("multiple unmapped Shopify item handles are not guessed",()=>{
  assert.deepEqual(planFromItems([{handle:"legacy_starter"},{handle:"legacy_addon"}]),{
    key:null,handle:null,ambiguous:true,
  });
});

test("safe unknown handle is surfaced from diagnostics without becoming the entitlement handle",()=>{
  const plan=serializePlan({
    ...UNSUBSCRIBED_PLAN,
    entitlementSource:"production-unrecognized-paid-contract",
    subscription:{planKey:"inactive",planHandle:null,snapshotJson:JSON.stringify({diagnostics:{activePlanHandle:"vsn_starter_legacy",activePlanAmbiguous:false}})},
  });
  assert.equal(plan.unrecognizedPlanHandle,"vsn_starter_legacy");
  assert.equal(plan.subscription.planHandle,null);
});

test("ambiguous or malformed diagnostic handles are not exposed",()=>{
  for (const diagnostics of [
    {activePlanHandle:"vsn_starter_legacy",activePlanAmbiguous:true},
    {activePlanHandle:"not safe!",activePlanAmbiguous:false},
  ]) {
    const plan=serializePlan({
      ...UNSUBSCRIBED_PLAN,
      entitlementSource:"production-unrecognized-paid-contract",
      subscription:{planKey:"inactive",planHandle:null,snapshotJson:JSON.stringify({diagnostics})},
    });
    assert.equal(plan.unrecognizedPlanHandle,null);
  }
});
