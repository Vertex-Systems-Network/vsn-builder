import { PrismaClient } from "@prisma/client";
import { resolveVsnDatabaseLocation } from "./utils/database-location.server.js";

const prismaRuntime = globalThis;
export const VSN_DATABASE_LOCATION = resolveVsnDatabaseLocation(process.env);
// Prisma schema now uses env("DATABASE_URL"). Make the development default explicit
// before constructing PrismaClient so app runtime and CLI scripts cannot drift to
// different relative SQLite files.
process.env.DATABASE_URL = VSN_DATABASE_LOCATION.url;

function createPrismaClient() {
  return new PrismaClient({
    datasources: {
      db: { url: VSN_DATABASE_LOCATION.url },
    },
  });
}

if (process.env.NODE_ENV !== "production") {
  if (!prismaRuntime.prismaGlobal) {
    prismaRuntime.prismaGlobal = createPrismaClient();
  }
}

const prisma = prismaRuntime.prismaGlobal ?? createPrismaClient();

export default prisma;
