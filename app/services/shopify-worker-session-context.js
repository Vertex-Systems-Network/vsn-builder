// Worker Shopify session lifecycle backed by the real Shopify Prisma adapter.
// It does not perform OAuth, authenticate Shopify requests, or authorize users.
// A validated Worker environment and migrated Neon DB are required per request.
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { createWorkerNeonPrisma, inspectWorkerNeonEnvironment } from "./db-worker-neon.js";
import { inspectWorkerShopifyConfiguration } from "./shopify-worker-configuration.js";
import { createWorkerGenerationSessionStorage } from "./worker-shopify-install-session-storage.js";

export async function createWorkerShopifySessionContext(request, env, {
  createDatabase = createWorkerNeonPrisma,
  SessionStorage = PrismaSessionStorage,
} = {}) {
  const shopify = inspectWorkerShopifyConfiguration(request, env);
  const neon = inspectWorkerNeonEnvironment(env);
  if (!shopify.ready || !neon.ready) {
    const err = new Error("Worker Shopify session configuration not ready");
    err.code = "VSN_WORKER_SESSION_BLOCKED";
    throw err;
  }

  let db;
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    if (db && typeof db.$disconnect === "function") await db.$disconnect();
  };

  try {
    db = await createDatabase(env);
    // Probe before constructing Shopify storage. That package retries and
    // logs raw Prisma errors on missing tables; do not expose DB URLs/tokens.
    if (!db || typeof db.session?.count !== "function" ||
        typeof db.builderShopInstallation?.count !== "function" ||
        typeof db.$disconnect !== "function") {
      throw new Error("Prisma session/installation models are unavailable");
    }
    // Explicitly query both real models BEFORE SDK initialization. An
    // unmigrated/partially migrated Neon database must fail closed, rather
    // than allowing Shopify to issue a token which cannot be durably saved.
    await db.session.count();
    await db.builderShopInstallation.count();
    const storage = new SessionStorage(db, {
      connectionRetries: 1,
      connectionRetryIntervalMs: 0,
    });
    if (typeof storage.storeSession !== "function" ||
        typeof storage.loadSession !== "function" ||
        typeof storage.deleteSession !== "function" ||
        typeof storage.findSessionsByShop !== "function" ||
        typeof storage.isReady !== "function" ||
        await storage.isReady() !== true) {
      throw new Error("Shopify persistent session storage is not ready");
    }
    // Installation-generation transactions guard official SDK writes.
    // Worker reads also fence the official SDK's asynchronous loaders with
    // before/after persisted token and active generation checks. Deletes
    // remain delegated; independent signed-uninstall attestation is separate.
    const fenced = createWorkerGenerationSessionStorage(db,storage,{
      SessionStorage,
    });
    return { database: db, sessionStorage: fenced, close };
  } catch {
    try { await close(); } catch { /* do not disclose driver error */ }
    const err = new Error("Worker Shopify session store unavailable");
    err.code = "VSN_WORKER_SESSION_UNAVAILABLE";
    throw err;
  }
}
