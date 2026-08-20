import { getPrismaCliDiagnostics, runPrisma } from "./lib/prisma-process.mjs";

try {
  const info = getPrismaCliDiagnostics();
  console.log(`VSN Prisma postinstall · Prisma ${info.version} · ${info.bin}`);
  runPrisma(["generate"]);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown Prisma postinstall error");
  console.error(`VSN Prisma postinstall FAILED: ${message}`);
  process.exit(1);
}
