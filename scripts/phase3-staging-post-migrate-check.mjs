// Protected, manual, read-only Staging post-migration acceptance.
// Verify the *exact* reviewed SQL file checksums in Prisma's own ledger,
// not simply an arbitrary count of successfully marked migrations.
// Never query user/merchant rows, touch Live or emit Neon credentials.
import { PrismaClient } from "../generated/prisma-cloud/index.js";
import {inspectStagingMigrationGate} from "./phase3-staging-migration-preflight.mjs";
import {
  attestStagingMigrationLedger,expectedStagingMigrationChecksums,
} from "./t018-staging-migration-ledger.mjs";

const ERROR="T018_STAGING_POST_MIGRATE_LEDGER_BLOCKED";
async function main(env=process.env) {
  // Re-verify manual approval, protected branch, exact Neon tier, both URL
  // identities and pinned snapshot policy *after* prisma migrate deploy.
  if(env.GITHUB_REPOSITORY!=="Vertex-Systems-Network/vsn-builder" ||
     !inspectStagingMigrationGate(env).ready)
    throw new Error(ERROR);
  const hashes=expectedStagingMigrationChecksums();
  const db=new PrismaClient();
  try {
    // Both selects read database/catalog metadata only. Never fetch session
    // tokens, merchant documents, Shopify billing values or user records.
    const [metrics,records]=await Promise.all([
      db.$queryRawUnsafe(
        "SELECT current_database() AS database, "+
        "(SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables, "+
        "(SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Session','BuilderPage','BuilderSubscription','BuilderShopInstallation')) AS essential_tables"
      ),
      db.$queryRawUnsafe(
        'SELECT migration_name, checksum, started_at, finished_at, rolled_back_at FROM public."_prisma_migrations" ORDER BY migration_name'
      ),
    ]);
    const proof=attestStagingMigrationLedger({
      summary:metrics?.[0],records,hashes,
    });
    if(proof.ready!==true)throw new Error(ERROR);
    console.log("T018 Staging migration PASS: two exact reviewed SQL checksums, unrolled Prisma ledger and required schema verified; read-only metadata only.");
  }finally{
    await db.$disconnect().catch(()=>{});
  }
}
try{
  await main();
}catch{
  // Prisma errors can contain DSNs, SQL paths or credentials. Never echo.
  console.error("::error::"+ERROR);
  process.exitCode=1;
}
