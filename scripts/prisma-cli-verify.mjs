import { getPrismaCliDiagnostics, getPrismaDatabaseDiagnostics, runPrisma } from "./lib/prisma-process.mjs";
import { assertSupportedNodeRuntime } from "./lib/runtime-compat.mjs";

try {
  const runtime = assertSupportedNodeRuntime({ context: "VSN Prisma verification" });
  console.log(`VSN runtime: Node ${runtime.raw} · supported · recommended ${runtime.recommended}`);
  const info = getPrismaCliDiagnostics();
  console.log("VSN Prisma CLI resolution:");
  console.log(`- Version: ${info.version}`);
  console.log(`- package.json: ${info.packageJsonPath}`);
  console.log(`- package.json#bin.prisma: ${info.bin}`);
  console.log(`- Executable: ${info.cliPath}`);
  const database = getPrismaDatabaseDiagnostics();
  console.log(`- Database target: ${database.file || database.url}`);
  runPrisma(["--version"]);
  console.log("VSN Prisma CLI verification PASS.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown Prisma verification error");
  console.error("VSN Prisma CLI verification FAILED.");
  console.error(`- ${message}`);
  console.error("- Use Node 22 LTS, then run npm install in this exact project folder and retry npm run prisma:verify.");
  console.error("- Do not delete prisma/dev.sqlite to fix a CLI/runtime resolution problem.");
  process.exit(1);
}
