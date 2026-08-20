import { runPrisma } from "./lib/prisma-process.mjs";

try {
  runPrisma(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error || "Prisma command failed"));
  process.exit(1);
}
