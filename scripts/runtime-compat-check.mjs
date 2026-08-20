import { assertSupportedNodeRuntime } from "./lib/runtime-compat.mjs";

try {
  const result = assertSupportedNodeRuntime({ context: "VSN Builder" });
  console.log(`VSN runtime compatibility PASS · Node ${result.raw} · recommended ${result.recommended}.`);
} catch (error) {
  console.error("VSN runtime compatibility FAILED.");
  console.error(`- ${error instanceof Error ? error.message : String(error)}`);
  console.error("- Install/use Node 22 LTS, open a fresh terminal, then run npm install and npm run db:prepare again.");
  process.exit(1);
}
