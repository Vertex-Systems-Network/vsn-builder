import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const targets = [
  ".react-router",
  "build",
  "node_modules/.vite",
  ".vite",
];

await Promise.all(targets.map(async (target) => {
  try { await rm(resolve(process.cwd(), target), { recursive: true, force: true }); }
  catch (error) { console.warn(`[VSN] Could not clear ${target}:`, error?.message || error); }
}));
console.log("[VSN] Development/build caches cleared.");
