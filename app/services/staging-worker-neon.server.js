import manifest from "../../config/deployment/environments.json" with { type: "json" };
import { inspectHostedNeonRuntimeUrl } from "./neon-target-policy.js";

const staging = manifest.staging;
const SANITIZED_FAILURE = "VSN Staging Neon Worker runtime not certified";

export function inspectStagingWorkerNeon(env = {}) {
  const issues = [];
  if (env.APP_ENV !== "staging") issues.push("Staging tier required");
  if (env.VSN_WORKER_NAME !== staging.cloudflare_worker) issues.push("Worker target mismatch");
  if (env.NEON_PROJECT_ID !== staging.neon_project_id) issues.push("Neon project isolation mismatch");
  if (env.SHOPIFY_BILLING_TEST_MODE !== "true") issues.push("Shopify test billing required");
  if (env.DIRECT_URL) issues.push("Direct migration credentials are forbidden inside Worker");
  if (env.SHOPIFY_PRODUCTION_CLIENT_ID && env.SHOPIFY_API_KEY === env.SHOPIFY_PRODUCTION_CLIENT_ID)
    issues.push("Production Shopify identity is forbidden in staging Worker");
  if (!inspectHostedNeonRuntimeUrl("staging", env.DATABASE_URL).ready)
    issues.push("Staging pooled Neon runtime URL or TLS invalid");
  return { ready: issues.length === 0, issues };
}

/**
 * Construct a real staging-only edge Prisma adapter when its audited,
 * generated dependencies are included in the eventual Cloudflare bundle.
 *
 * Tests inject adapter/client constructors without contacting Neon.
 * Missing runtime dependencies intentionally fail closed. This factory is
 * NOT evidence that the full React Router Shopify merchant UI is deployed.
 */
export async function createStagingWorkerNeonClient(env, { Adapter, Client } = {}) {
  const report = inspectStagingWorkerNeon(env);
  if (!report.ready) {
    const error = new Error(SANITIZED_FAILURE + ": " + report.issues.join("; "));
    error.code = "VSN_STAGING_WORKER_NEON_NOT_READY";
    throw error;
  }
  let adapterConstructor = Adapter;
  let clientConstructor = Client;
  if (!adapterConstructor || !clientConstructor) {
    try {
      if (!adapterConstructor) {
        ({ PrismaNeon: adapterConstructor } = await import("@prisma/adapter-neon"));
      }
      if (!clientConstructor) {
        ({ PrismaClient: clientConstructor } = await import("../../generated/prisma-edge/client.ts"));
      }
    } catch {
      const error = new Error(SANITIZED_FAILURE + ": audited Workerd Prisma adapter/build unavailable");
      error.code = "VSN_STAGING_WORKER_NEON_NOT_READY";
      throw error;
    }
  }
  if (typeof adapterConstructor !== "function" || typeof clientConstructor !== "function") {
    throw new TypeError(SANITIZED_FAILURE + ": invalid adapter/client exports");
  }
  try {
    return new clientConstructor({
      adapter: new adapterConstructor({ connectionString: env.DATABASE_URL }),
    });
  } catch {
    const error = new Error(SANITIZED_FAILURE + ": adapter construction failed");
    error.code = "VSN_STAGING_WORKER_NEON_NOT_READY";
    throw error;
  }
}
