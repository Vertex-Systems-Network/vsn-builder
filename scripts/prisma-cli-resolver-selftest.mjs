import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolvePrismaCli, resolvePrismaPackageJson, runPrisma } from "./lib/prisma-process.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "vsn-prisma-resolver-"));
try {
  const packageDir = path.join(root, "node_modules", "prisma");
  fs.mkdirSync(path.join(packageDir, "build"), { recursive: true });
  fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({
    name: "prisma",
    version: "6.19.3-test",
    main: "build/types.js",
    bin: { prisma: "build/index.js" },
  }, null, 2));
  // Intentionally DO NOT create build/types.js. This reproduces the Windows failure
  // caused by resolving the package main instead of package.json#bin.prisma.
  fs.writeFileSync(path.join(packageDir, "build", "index.js"), "if (process.argv.includes('--version')) console.log('prisma 6.19.3-test');\n");

  const packageJsonPath = resolvePrismaPackageJson({ cwd: root });
  const cliPath = resolvePrismaCli({ cwd: root });

  if (path.normalize(packageJsonPath) !== path.normalize(path.join(packageDir, "package.json"))) {
    throw new Error(`Unexpected Prisma package.json resolution: ${packageJsonPath}`);
  }
  if (path.normalize(cliPath) !== path.normalize(path.join(packageDir, "build", "index.js"))) {
    throw new Error(`Resolver selected the wrong Prisma CLI entry: ${cliPath}`);
  }
  if (cliPath.endsWith(path.join("build", "types.js"))) {
    throw new Error("Resolver incorrectly selected Prisma package main/type entry.");
  }
  runPrisma(["--version"], { cwd: root, label: "mock prisma --version" });

  console.log(`VSN Prisma CLI resolver self-test PASS · ${cliPath}`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
