import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const VSN_PROJECT_ROOT = PROJECT_ROOT;
export const VSN_DEFAULT_DATABASE_FILE = path.join(PROJECT_ROOT, "prisma", "dev.sqlite");

function isWindowsAbsolute(value) {
  return /^[A-Za-z]:[\\/]/.test(String(value || ""));
}

export function normalizeSqliteFilePath(value, { projectRoot = PROJECT_ROOT } = {}) {
  const raw = String(value || "").trim();
  if (!raw) return VSN_DEFAULT_DATABASE_FILE;
  if (isWindowsAbsolute(raw) || path.isAbsolute(raw)) return path.normalize(raw);
  // Prisma resolves relative SQLite file URLs from the schema directory.
  return path.resolve(projectRoot, "prisma", raw);
}

export function sqliteUrlFromFile(filePath) {
  return `file:${path.normalize(filePath).replaceAll("\\", "/")}`;
}

export function resolveVsnDatabaseLocation(env = process.env) {
  const configured = String(env.DATABASE_URL || "").trim();
  if (configured && !configured.toLowerCase().startsWith("file:")) {
    return { url: configured, file: null, source: "DATABASE_URL" };
  }
  const file = configured
    ? normalizeSqliteFilePath(configured.slice("file:".length))
    : VSN_DEFAULT_DATABASE_FILE;
  return {
    url: sqliteUrlFromFile(file),
    file,
    source: configured ? "DATABASE_URL" : "VSN default",
  };
}
