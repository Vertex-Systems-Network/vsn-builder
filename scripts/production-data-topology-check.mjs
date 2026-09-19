import fs from "node:fs";
import path from "node:path";
import { resolveProductionDataTopologyEvidence } from "../app/config/productionDataTopology.js";

const requireEvidence = process.argv.includes("--require-production-evidence");
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const schema = read("prisma/schema.prisma");
const migrationLock = read("prisma/migrations/migration_lock.toml");
const runtimeLocation = read("app/utils/database-location.server.js");
const runtimeHealth = read("app/services/database-health.server.js");
const dockerfile = read("Dockerfile");
const backups = read("app/routes/app.backups.jsx");
const manifest = JSON.parse(read(".ai/PRODUCTION_DATA_TOPOLOGY.json"));

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
}

check("Prisma provider is SQLite", /datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"sqlite"/m.test(schema));
check("Migration lock is SQLite", /provider\s*=\s*"sqlite"/.test(migrationLock));
check("Runtime uses filesystem SQLite location semantics", runtimeLocation.includes("normalizeSqliteFilePath") && runtimeLocation.includes("file:"));
check("Runtime health uses SQLite-specific inspection", runtimeHealth.includes("sqlite_master") && runtimeHealth.includes("PRAGMA database_list"));
check("External database support is not falsely claimed", manifest.implementedTopology?.externalDatabaseSupport === "NOT_IMPLEMENTED");
check("Multi-instance SQLite is explicitly unsupported", manifest.implementedTopology?.multiInstanceSqliteSupport === "UNSUPPORTED");
check("Docker image does not falsely imply a persistent volume", manifest.implementedTopology?.dockerVolumeDeclared === false && !/^VOLUME\s+/m.test(dockerfile));
check("App backup is not classified as disaster recovery", manifest.applicationBackup?.disasterRecoveryBackup === false);
check("App backup excludes form submissions", backups.includes("submissionsIncluded: false"));
check("App backup excludes integration secrets", backups.includes("integrationSecretsIncluded: false"));
check("App backup excludes GraphQL history", backups.includes("graphqlHistoryIncluded: false"));

const evidence = resolveProductionDataTopologyEvidence(process.env);
if (requireEvidence) {
  check("Production DATABASE_URL is explicit", evidence.checks.explicitDatabaseUrl);
  check("Production DATABASE_URL matches implemented SQLite provider", evidence.checks.sqliteDatabaseUrl);
  check("Production SQLite target is absolute", evidence.checks.absoluteDatabaseTarget);
  check("Hosting provider identity is attested", evidence.checks.hostingProvider);
  check("Durable SQLite volume mount is identified", evidence.checks.volumeMount);
  check("Production SQLite target is inside the declared durable volume", evidence.checks.databaseTargetOnVolume);
  check("Production is explicitly single-instance", evidence.checks.singleInstance);
  check("SQLite filesystem is attested as durable", evidence.checks.durableVolume);
  check("Infrastructure snapshot backup is attested", evidence.checks.infrastructureSnapshot);
  check("Restore drill timestamp is present and valid", evidence.checks.restoreDrill);
}

const failed = checks.filter((row) => !row.ok);
for (const row of checks) console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}${row.detail ? ` · ${row.detail}` : ""}`);

if (!requireEvidence) {
  console.log(`Repository topology: SQLite · deployed topology: ${manifest.status}`);
  console.log("Agent/job persistence readiness remains blocked until deployed topology evidence is attested.");
} else if (!failed.length) {
  console.log(`Production topology evidence: ${evidence.status} · host=${evidence.hostingProvider} · volume=${evidence.volumeMount}`);
}

if (failed.length) {
  console.error(`VSN production data topology check: FAIL (${failed.length} missing/invalid contract item(s)).`);
  process.exit(1);
}
console.log(`VSN production data topology check: PASS (${checks.length}/${checks.length}).`);
