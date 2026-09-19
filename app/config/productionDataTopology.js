export const PRODUCTION_DATA_TOPOLOGY_VERSION = 1;

export const PRODUCTION_DATA_TOPOLOGY = Object.freeze({
  databaseEngine: "sqlite",
  prismaProvider: "sqlite",
  externalDatabaseSupport: false,
  multiInstanceSqliteSupport: false,
  requiresExplicitDatabaseUrl: true,
  requiresSingleInstance: true,
  requiresDurableVolume: true,
  requiresInfrastructureSnapshot: true,
  requiresRestoreDrill: true,
});

function clean(value) {
  return String(value || "").trim();
}

function isoTimestamp(value) {
  const raw = clean(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function resolveProductionDataTopologyEvidence(env = process.env) {
  const databaseUrl = clean(env.DATABASE_URL);
  const databaseIsSqlite = /^file:/i.test(databaseUrl);
  const hostingProvider = clean(env.VSN_PRODUCTION_HOSTING_PROVIDER);
  const volumeMount = clean(env.VSN_SQLITE_VOLUME_MOUNT);
  const instanceMode = clean(env.VSN_SQLITE_INSTANCE_MODE).toLowerCase();
  const durability = clean(env.VSN_SQLITE_DURABILITY).toLowerCase();
  const backupMode = clean(env.VSN_SQLITE_BACKUP_MODE).toLowerCase();
  const restoreTestedAt = isoTimestamp(env.VSN_SQLITE_RESTORE_TESTED_AT);

  const checks = Object.freeze({
    explicitDatabaseUrl: Boolean(databaseUrl),
    sqliteDatabaseUrl: databaseIsSqlite,
    hostingProvider: Boolean(hostingProvider),
    volumeMount: Boolean(volumeMount),
    singleInstance: instanceMode === "single-instance",
    durableVolume: durability === "durable-volume",
    infrastructureSnapshot: backupMode === "infrastructure-snapshot",
    restoreDrill: Boolean(restoreTestedAt),
  });

  const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
  return Object.freeze({
    version: PRODUCTION_DATA_TOPOLOGY_VERSION,
    status: missing.length ? "NOT_VERIFIED" : "ATTESTED",
    databaseEngine: "sqlite",
    databaseIsSqlite,
    hostingProvider: hostingProvider || null,
    volumeMount: volumeMount || null,
    instanceMode: instanceMode || null,
    durability: durability || null,
    backupMode: backupMode || null,
    restoreTestedAt,
    checks,
    missing,
  });
}

export function assertProductionDataTopologyEvidence(env = process.env) {
  const evidence = resolveProductionDataTopologyEvidence(env);
  if (evidence.status !== "ATTESTED") {
    const error = new Error(`Production data topology evidence is incomplete: ${evidence.missing.join(", ") || "unknown"}.`);
    error.code = "VSN_PRODUCTION_DATA_TOPOLOGY_NOT_VERIFIED";
    error.evidence = evidence;
    throw error;
  }
  return evidence;
}
