// T018 real-schema rehearsal on a SECOND disposable PostgreSQL 18 database.
// NEVER against Neon, localhost Dev SQLite, Shopify, a Worker, or Production.
// GitHub CI applies exactly the reviewed migrations into disposable "neondb",
// then queries the actual Prisma migration ledger as the protected postcheck
// would. Tamper drills run within ROLLED-BACK local PostgreSQL transactions.
import test from "node:test";
import assert from "node:assert/strict";
import prismaCloud from "../generated/prisma-cloud/index.js";
import {
  attestStagingMigrationLedger,
  expectedStagingMigrationChecksums,
  EXPECTED_STAGING_MIGRATIONS,
} from "../scripts/t018-staging-migration-ledger.mjs";

const disposable="postgresql://builder_ci:local_ephemeral_only@127.0.0.1:5432/neondb?schema=public";
assert.equal(process.env.CI,"true","Must run in isolated GitHub CI");
assert.equal(process.env.NODE_ENV,"test");
assert.equal(process.env.T018_PG18_REHEARSAL,"1");
assert.equal(process.env.DATABASE_URL,disposable);
assert.equal(process.env.DIRECT_URL,disposable);
for(const name of ["SHOPIFY_API_SECRET","CLOUDFLARE_API_TOKEN","NEON_API_KEY"]){
  assert(!process.env[name],"No external credentials allowed in the disposable replay");
}

const db=new prismaCloud.PrismaClient();
const hashes=expectedStagingMigrationChecksums();
const metadata=async client=>{
  const [rows,records]=await Promise.all([
    client.$queryRawUnsafe(
      "SELECT current_database() AS database, "+
      "(SELECT COUNT(*)::int FROM information_schema.tables "+
      "WHERE table_schema='public' AND table_type='BASE TABLE') AS tables, "+
      "(SELECT COUNT(*)::int FROM information_schema.tables "+
      "WHERE table_schema='public' AND table_name IN "+
      "('Session','BuilderPage','BuilderSubscription','BuilderShopInstallation')) "+
      "AS essential_tables"
    ),
    client.$queryRawUnsafe(
      'SELECT migration_name, checksum, started_at, finished_at, rolled_back_at '+
      'FROM public."_prisma_migrations" ORDER BY migration_name'
    ),
  ]);
  return {summary:rows?.[0],records,hashes};
};
test.before(async()=>db.$connect());
test.after(async()=>{await db.$disconnect()});

test("actual PostgreSQL18 Prisma migrate deploy writes only the 2 reviewed SQL migrations",async()=>{
  const rows=await metadata(db);
  const result=attestStagingMigrationLedger(rows);
  assert.equal(result.ready,true);
  assert.equal(rows.summary.database,"neondb");
  assert.deepEqual(rows.records.map(r=>r.migration_name).sort(),
    [...EXPECTED_STAGING_MIGRATIONS].sort());
  assert.equal(rows.records.length,2);
  assert.equal(result.zero_merchant_rows_inspected,true);
  assert.equal(result.production_touched,false);
});

test("transactionally tampered real Prisma checksum is rejected and rolled back",async()=>{
  const marker=new Error("EXPECTED_DISPOSABLE_ROLLBACK");
  await assert.rejects(db.$transaction(async tx=>{
    const affected=await tx.$executeRawUnsafe(
      'UPDATE public."_prisma_migrations" SET checksum = $1 WHERE migration_name = $2',
      "0".repeat(64),EXPECTED_STAGING_MIGRATIONS[0]
    );
    assert.equal(affected,1);
    const forged=await metadata(tx);
    assert.throws(()=>attestStagingMigrationLedger(forged),
      /T018_STAGING_MIGRATION_LEDGER_UNVERIFIED/);
    throw marker;
  }),err=>err===marker);
  const restored=await metadata(db);
  assert.equal(attestStagingMigrationLedger(restored).ready,true);
});

test("transactionally rolled-back or incomplete real Prisma record cannot certify",async()=>{
  const marker=new Error("EXPECTED_DISPOSABLE_ROLLBACK");
  await assert.rejects(db.$transaction(async tx=>{
    const affected=await tx.$executeRawUnsafe(
      'UPDATE public."_prisma_migrations" SET rolled_back_at=NOW(), finished_at=NULL WHERE migration_name=$1',
      EXPECTED_STAGING_MIGRATIONS[1]
    );
    assert.equal(affected,1);
    const incomplete=await metadata(tx);
    assert.throws(()=>attestStagingMigrationLedger(incomplete),
      /T018_STAGING_MIGRATION_LEDGER_UNVERIFIED/);
    throw marker;
  }),err=>err===marker);
  assert.equal(attestStagingMigrationLedger(await metadata(db)).ready,true);
});
