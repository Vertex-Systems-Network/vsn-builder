// Hosted Worker tiers that may serve the merchant app. Feature flags keep their
// historical VSN_STAGING_* names and must be enabled per tier in its wrangler config.
const HOSTED_WORKERS = Object.freeze({ staging: "vsn-builder-staging", production: "vsn-builder-production" });

// Production stays locked unless its own config sets the explicit release opt-in,
// so copying Staging flags onto a Production env never opens Live.
export function isHostedTier(env) {
  if (env?.APP_ENV === "staging") return true;
  return env?.APP_ENV === "production" && env?.VSN_PRODUCTION_ENABLED === "true";
}

// Stricter check: the tier and the deployed Worker name must agree.
export function isHostedWorker(env) {
  return isHostedTier(env) && env?.VSN_WORKER_NAME === HOSTED_WORKERS[env.APP_ENV];
}
