import { getPrismaCliDiagnostics, getPrismaDatabaseDiagnostics, runNodeScript, runPrisma } from "./lib/prisma-process.mjs";
import { assertSupportedNodeRuntime } from "./lib/runtime-compat.mjs";

const stages = [
  ["Prisma client generate", () => runPrisma(["generate"])],
  ["Legacy migration-history repair pass 1", () => runNodeScript("scripts/repair-legacy-migration-history.mjs")],
  ["Legacy migration-history repair pass 2", () => runNodeScript("scripts/repair-legacy-migration-history.mjs")],
  ["Email Builder migration reconciliation (pre-deploy)", () => runNodeScript("scripts/reconcile-email-builder-migration.mjs", ["--phase=pre"])],
  ["Prisma migrate deploy", () => runPrisma(["migrate", "deploy"])],
  ["Email Builder migration reconciliation (post-deploy)", () => runNodeScript("scripts/reconcile-email-builder-migration.mjs", ["--phase=post"])],
  ["Database schema verification", () => runNodeScript("scripts/database-schema-check.mjs")],
];

console.log("VSN database preparation starting...");
try {
  const runtime = assertSupportedNodeRuntime({ context: "VSN database preparation" });
  console.log(`Node runtime: v${runtime.raw} · supported`);
  const prisma = getPrismaCliDiagnostics();
  const database = getPrismaDatabaseDiagnostics();
  console.log(`Prisma CLI: v${prisma.version} · ${prisma.cliPath}`);
  console.log(`Database target: ${database.file || database.url}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown Prisma resolver error");
  console.error("\nVSN database preparation FAILED.");
  console.error(`- ${message}`);
  console.error("- Run `npm install` in this exact app folder, then run `npm run prisma:verify`.");
  console.error("- Do not delete or reset prisma/dev.sqlite unless you intentionally want to erase development data.");
  process.exit(1);
}

try {
  for (let index = 0; index < stages.length; index += 1) {
    const [name, execute] = stages[index];
    console.log(`\n[${index + 1}/${stages.length}] ${name}`);
    execute();
  }
  console.log("\nVSN database preparation PASS.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown database preparation error.");
  console.error("\nVSN database preparation FAILED.");
  console.error(`- ${message}`);
  console.error("- Run this command directly for the full diagnostic: npm run db:prepare");
  console.error("- Do not delete or reset prisma/dev.sqlite unless you intentionally want to erase development data.");
  process.exit(1);
}
