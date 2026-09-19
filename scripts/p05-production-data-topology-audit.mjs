import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveProductionDataTopologyEvidence } from "../app/config/productionDataTopology.js";

const read = (file) => fs.readFileSync(file, "utf8");
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

const manifest = JSON.parse(read(".ai/PRODUCTION_DATA_TOPOLOGY.json"));
ok(manifest.schemaVersion === 1, "Topology manifest version must be explicit");
ok(manifest.status === "NOT_VERIFIED", "Actual deployment must not be claimed verified without infrastructure evidence");
ok(manifest.implementedTopology?.databaseEngine === "sqlite" && manifest.implementedTopology?.prismaProvider === "sqlite", "Implemented database topology must match Prisma");
ok(manifest.implementedTopology?.externalDatabaseSupport === "NOT_IMPLEMENTED", "External database support must not be claimed before a Prisma provider migration");
ok(manifest.implementedTopology?.multiInstanceSqliteSupport === "UNSUPPORTED", "Multi-instance SQLite must remain unsupported");
ok(manifest.agentJobReadiness === "BLOCKED_ON_DEPLOYMENT_EVIDENCE", "Agent/job persistence readiness must fail closed");

const schema = read("prisma/schema.prisma");
ok(/provider\s*=\s*"sqlite"/.test(schema), "Prisma datasource must still be SQLite");
ok(read("prisma/migrations/migration_lock.toml").includes('provider = "sqlite"'), "Migration history provider must still be SQLite");

const dockerfile = read("Dockerfile");
ok(!/^VOLUME\s+/m.test(dockerfile), "Current Dockerfile must not be misdocumented as declaring persistent storage");

const backups = read("app/routes/app.backups.jsx");
for (const token of ["submissionsIncluded: false", "integrationSecretsIncluded: false", "graphqlHistoryIncluded: false"]) {
  ok(backups.includes(token), `App-level backup exclusion changed: ${token}`);
}

const unknown = resolveProductionDataTopologyEvidence({});
ok(unknown.status === "NOT_VERIFIED" && unknown.missing.includes("explicitDatabaseUrl") && unknown.missing.includes("durableVolume"), "Missing deployment evidence must remain NOT_VERIFIED");

const attested = resolveProductionDataTopologyEvidence({
  DATABASE_URL: "file:/data/vsn-builder.sqlite",
  VSN_PRODUCTION_HOSTING_PROVIDER: "example-host",
  VSN_SQLITE_VOLUME_MOUNT: "/data",
  VSN_SQLITE_INSTANCE_MODE: "single-instance",
  VSN_SQLITE_DURABILITY: "durable-volume",
  VSN_SQLITE_BACKUP_MODE: "infrastructure-snapshot",
  VSN_SQLITE_RESTORE_TESTED_AT: "2026-09-18T00:00:00Z",
});
ok(attested.status === "ATTESTED" && attested.missing.length === 0, "Complete explicit deployment evidence must become ATTESTED");

const wrongDatabase = resolveProductionDataTopologyEvidence({
  DATABASE_URL: "postgresql://db.example/vsn",
  VSN_PRODUCTION_HOSTING_PROVIDER: "example-host",
  VSN_SQLITE_VOLUME_MOUNT: "/data",
  VSN_SQLITE_INSTANCE_MODE: "single-instance",
  VSN_SQLITE_DURABILITY: "durable-volume",
  VSN_SQLITE_BACKUP_MODE: "infrastructure-snapshot",
  VSN_SQLITE_RESTORE_TESTED_AT: "2026-09-18T00:00:00Z",
});
ok(wrongDatabase.status === "NOT_VERIFIED" && wrongDatabase.missing.includes("sqliteDatabaseUrl"), "Postgres/MySQL URLs must not be accepted while Prisma provider is SQLite");

const productionCheck = read("scripts/production-data-topology-check.mjs");
for (const token of ["--require-production-evidence", "sqlite_master", "PRAGMA database_list", "infrastructureSnapshot", "restoreDrill"]) {
  ok(productionCheck.includes(token), `Topology release check missing ${token}`);
}

const runtime = read("scripts/validate-production-runtime.mjs");
ok(runtime.includes("DATABASE_URL") && runtime.includes("file:"), "Production runtime must reject implicit/non-SQLite database configuration");

const pkg = JSON.parse(read("package.json"));
ok(pkg.scripts?.["qa:p05"] === "node scripts/p05-production-data-topology-audit.mjs && node scripts/production-data-topology-check.mjs", "P0.5 QA command missing");
ok(pkg.scripts?.["release:production:check"]?.includes("production-data-topology-check.mjs --require-production-evidence"), "Production release must require topology evidence");

console.log(`VSN P0.5 production data topology audit: PASS (${checks}/${checks})`);
