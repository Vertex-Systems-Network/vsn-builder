import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolveScriptDatabaseLocation, withResolvedDatabaseEnv } from "./database-location.mjs";

const require = createRequire(import.meta.url);

function readableError(error) {
  return error instanceof Error ? error.message : String(error || "unknown module resolution error");
}

function candidatePackageJsonPaths(cwd) {
  const roots = [];
  for (const root of [cwd, process.cwd()]) {
    if (!root) continue;
    const normalized = path.resolve(root);
    if (!roots.includes(normalized)) roots.push(normalized);
  }
  return roots.map((root) => path.join(root, "node_modules", "prisma", "package.json"));
}

/**
 * Resolve Prisma's package.json, never Prisma's package "main" entry.
 * Prisma's package main/type entry is not the CLI executable. The executable
 * is declared in package.json#bin.prisma (currently build/index.js).
 */
export function resolvePrismaPackageJson({ cwd = process.cwd() } = {}) {
  const attempts = [];

  try {
    const resolved = require.resolve("prisma/package.json", { paths: [path.resolve(cwd)] });
    if (fs.existsSync(resolved)) return resolved;
    attempts.push(`resolved package.json did not exist: ${resolved}`);
  } catch (error) {
    attempts.push(`module resolution: ${readableError(error)}`);
  }

  for (const candidate of candidatePackageJsonPaths(cwd)) {
    try {
      if (fs.existsSync(candidate)) return candidate;
      attempts.push(`not found: ${candidate}`);
    } catch (error) {
      attempts.push(`cannot inspect ${candidate}: ${readableError(error)}`);
    }
  }

  throw new Error(
    `Prisma CLI package is not installed or cannot be located. Run npm install first. ${attempts.join(" | ")}`,
  );
}

export function resolvePrismaCli({ cwd = process.cwd() } = {}) {
  const packageJsonPath = resolvePrismaPackageJson({ cwd });
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read Prisma package metadata at ${packageJsonPath}: ${readableError(error)}`);
  }

  const binField = packageJson?.bin;
  const relativeBin = typeof binField === "string" ? binField : binField?.prisma;
  if (!relativeBin || typeof relativeBin !== "string") {
    throw new Error(
      `Installed Prisma package ${packageJson?.version || "unknown"} does not declare package.json#bin.prisma (${packageJsonPath}).`,
    );
  }

  const packageDir = path.dirname(packageJsonPath);
  const cliPath = path.resolve(packageDir, relativeBin);
  if (!fs.existsSync(cliPath)) {
    throw new Error(
      `Prisma CLI executable is missing. Expected ${cliPath} from package.json#bin.prisma=${JSON.stringify(relativeBin)} ` +
      `(Prisma ${packageJson?.version || "unknown"}). Re-run npm install; if it persists, remove node_modules and package-lock install state only, not prisma/dev.sqlite.`,
    );
  }

  return cliPath;
}

export function getPrismaCliDiagnostics({ cwd = process.cwd() } = {}) {
  const packageJsonPath = resolvePrismaPackageJson({ cwd });
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const cliPath = resolvePrismaCli({ cwd });
  return {
    version: String(packageJson?.version || "unknown"),
    packageJsonPath,
    cliPath,
    bin: typeof packageJson?.bin === "string" ? packageJson.bin : packageJson?.bin?.prisma || null,
  };
}

export function runProcess(command, args = [], { label = null, cwd = process.cwd(), env = process.env } = {}) {
  const printable = label || [command, ...args].join(" ");
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    const code = result.error.code ? ` [${result.error.code}]` : "";
    throw new Error(`${printable} could not start${code}: ${result.error.message}`);
  }

  if (result.signal) {
    throw new Error(`${printable} was terminated by signal ${result.signal}.`);
  }

  if (result.status !== 0) {
    throw new Error(`${printable} failed with exit code ${result.status ?? "unknown"}.`);
  }

  return result;
}

export function runNodeScript(relativeScript, args = [], options = {}) {
  return runProcess(process.execPath, [relativeScript, ...args], {
    ...options,
    label: options.label || `node ${relativeScript}${args.length ? ` ${args.join(" ")}` : ""}`,
  });
}

export function getPrismaDatabaseDiagnostics({ cwd = process.cwd(), env = process.env } = {}) {
  return resolveScriptDatabaseLocation({ cwd, env });
}

export function runPrisma(args = [], options = {}) {
  const cwd = options.cwd || process.cwd();
  const prismaCli = resolvePrismaCli({ cwd });
  const env = withResolvedDatabaseEnv({ cwd, env: options.env || process.env });
  return runProcess(process.execPath, [prismaCli, ...args], {
    ...options,
    env,
    cwd,
    label: options.label || `prisma ${args.join(" ")}`,
  });
}
