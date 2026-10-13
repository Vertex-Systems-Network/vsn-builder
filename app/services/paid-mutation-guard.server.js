// Central paid-only guard for authenticated merchant mutation routes.
// Shopify OAuth/plan selection, uninstall and support use separate protected
// paths and remain accessible without an active paid subscription.
import { getMinimumPlanDecision } from "./entitlements.server.js";

export const EXEMPT_DASHBOARD_INTENTS = Object.freeze([
  "app-uninstall",
  "billing-refresh",
  "support-create",
  "support-reply",
  "support-close",
  "support-reopen",
  "notification-read",
  "notification-read-all",
  "notification-dismiss",
]);

export async function paidMutationDenied(db,shop,{
  requiredPlan="starter",plan=null,label="VSN Builder editing",
}={}){
  // Never trust a user-supplied plan ID or a client-side pricing badge:
  // getMinimumPlanDecision resolves the server's trusted Shopify mirror.
  const decision=await getMinimumPlanDecision(db,shop,requiredPlan,{
    ...(plan?{plan}:{}),label,
  });
  if(decision.allowed)return null;
  return Response.json({
    ok:false,success:false,code:decision.code,
    error:decision.message,entitlement:decision,
  },{status:403,headers:{"cache-control":"no-store"}});
}

export function isUnpaidDashboardExempt(intent) {
 return EXEMPT_DASHBOARD_INTENTS.includes(String(intent||""));
}
