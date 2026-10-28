// CI-only Worker mapping of the real Prisma Edge client.
// The Node @prisma/client package resolves to .prisma/client/default which
// cannot load in Cloudflare Workerd. SDK-dependency imports must use the
// generated PostgreSQL/Neon-compatible Prisma runtime for this isolated test.
// Never instantiate a PrismaClient here: audited request-scoped Neon adapter
// binding is required separately to access any merchant data.
export { Prisma, PrismaClient } from "../generated/prisma-edge/client.ts";
