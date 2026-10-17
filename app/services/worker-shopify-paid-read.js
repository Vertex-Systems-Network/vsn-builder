// T020: protect authenticated Worker page reads with the same paid-only
// commercial contract as merchant mutation routes. No "developer mode"
// bypass is allowed on an externally hosted Staging/Production Worker.
const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const PLAN_HANDLES=new Set(["starter","sliver","gold","platinum"]);
const ALLOWED_STATES=new Set(["active","trialing","canceling"]);
const MAX_MIRROR_AGE_MS=24*60*60*1000;
const FUTURE_CLOCK_SKEW_MS=5*60*1000;
const SELECT=Object.freeze({
  shop:true,provider:true,planKey:true,planHandle:true,status:true,
  verifiedAt:true,trialEndsAt:true,cancelEffectiveOn:true,
});

// This check only consumes the persisted Partner-verified subscription mirror.
// A URL plan parameter, Shopify ID token, self-reported status, or environment
// variable must NEVER be accepted as evidence that a paid plan is active.
// Real Partner pricing/sync and hosted acceptance remain separate tasks.
export async function getVerifiedWorkerPaidPlan(database,verifiedShop,now=new Date()) {
  if(!SHOP.test(String(verifiedShop||"")) ||
     typeof database?.builderSubscription?.findUnique!=="function" ||
     !(now instanceof Date) || !Number.isFinite(now.getTime()))
    throw new TypeError("Verified paid read authority unavailable");
  const row=await database.builderSubscription.findUnique({
    where:{shop:verifiedShop},select:SELECT,
  });
  if(!row || row.shop!==verifiedShop ||
     row.provider!=="shopify-app-pricing" ||
     !ALLOWED_STATES.has(row.status) ||
     !PLAN_HANDLES.has(row.planKey) ||
     row.planHandle!==row.planKey ||
     !(row.verifiedAt instanceof Date) ||
     !Number.isFinite(row.verifiedAt.getTime()))return null;
  const age=now.getTime()-row.verifiedAt.getTime();
  if(age < -FUTURE_CLOCK_SKEW_MS || age>MAX_MIRROR_AGE_MS)return null;
  if(row.status==="trialing" &&
     (!(row.trialEndsAt instanceof Date) ||
      !Number.isFinite(row.trialEndsAt.getTime()) ||
      row.trialEndsAt.getTime()<=now.getTime()))return null;
  if(row.status==="canceling" && row.cancelEffectiveOn!=null &&
     (!(row.cancelEffectiveOn instanceof Date) ||
      !Number.isFinite(row.cancelEffectiveOn.getTime()) ||
      row.cancelEffectiveOn.getTime()<=now.getTime()))return null;
  return row.planKey;
}

// The boolean access guard remains identical for existing authenticated GET
// routes; the verified canonical handle is also needed for per-plan write
// quotas inside the serialized merchant transaction.
export async function hasVerifiedWorkerPaidReadAccess(database,verifiedShop,now=new Date()) {
  return (await getVerifiedWorkerPaidPlan(database,verifiedShop,now))!==null;
}
