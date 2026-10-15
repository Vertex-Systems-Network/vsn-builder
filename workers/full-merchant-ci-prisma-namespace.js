// T020 CI-only native Prisma namespace for the actual Builder route graph.
// Dashboard metrics uses Prisma.sql for SELECT 1; no PrismaClient is created.
// The production Worker must still inject an authenticated Neon adapter DB
// before any merchant query/mutation, enforced by the locked Worker entry.
import { Prisma } from "../generated/prisma-edge/client.ts";
export { Prisma };
