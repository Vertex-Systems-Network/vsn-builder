// CI-ONLY bridge for the actual Builder route graph to load without SQLite.
// This IS NOT a usable database client, nor a Staging deployment adapter.
// All queries/mutations fail closed unless the real per-request Neon context
// is provided through the separately audited Worker request guard.
const unavailable = () => {
  const error = new Error("Worker route database needs authenticated, request-scoped Neon context");
  error.code = "VSN_WORKER_REQUEST_DATABASE_REQUIRED";
  throw error;
};
const method = new Proxy(unavailable, {
  get(_target, key) {
    if (key === "then") return undefined;
    if (key === Symbol.toStringTag) return "WorkerUnboundPrismaMethod";
    return method;
  },
});
const unboundDb = new Proxy(Object.freeze({}), {
  get(_target, key) {
    if (key === "then") return undefined;
    if (key === Symbol.toStringTag) return "WorkerUnboundPrisma";
    return method;
  },
  set() { return false; },
});

export const VSN_DATABASE_LOCATION = Object.freeze({
  provider: "neon",
  status: "not-bound",
});
export default unboundDb;

// The only supported way to access the actual Worker database uses the
// existing audited identity verification and per-request connection lifecycle.
export async function createAuthenticatedWorkerDatabase(env) {
  const { createWorkerNeonPrisma } =
    await import("../app/services/db-worker-neon.js");
  return createWorkerNeonPrisma(env);
}
