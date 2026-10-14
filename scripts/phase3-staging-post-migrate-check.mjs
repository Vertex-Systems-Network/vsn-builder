// Protected Staging database acceptance only — no writes or merchant payloads.
// Imported only AFTER Prisma generated the separate hosted PostgreSQL Client.
import { PrismaClient } from "../generated/prisma-cloud/index.js";

if(process.env.APP_ENV!=="staging" || process.env.NEON_PROJECT_ID!=="shiny-violet-61219572") {
  throw new Error("Staging Neon post-migration identity blocked");
}
const db=new PrismaClient();
try {
  const rows=await db.$queryRawUnsafe(
    "SELECT (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables, (SELECT COUNT(*)::int FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS completed_migrations, (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Session','BuilderPage','BuilderSubscription','BuilderShopInstallation')) AS essential_tables"
  );
  const row=rows?.[0]||{};
  if(Number(row.tables)<53 || Number(row.completed_migrations)<2 ||
     Number(row.essential_tables)!==4) {
    throw new Error("Staging PostgreSQL migration history/schema acceptance failed");
  }
  console.log("Staging Neon schema and Prisma migration history verified (no merchant data accessed)");
}finally{
  await db.$disconnect().catch(()=>{});
}
