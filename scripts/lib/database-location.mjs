import path from "node:path";

function isWindowsAbsolute(value) {
  return /^[A-Za-z]:[\\/]/.test(String(value || ""));
}

export function sqliteUrlFromFile(filePath) {
  return `file:${path.normalize(filePath).replaceAll("\\", "/")}`;
}

export function resolveScriptDatabaseLocation({ cwd = process.cwd(), env = process.env } = {}) {
  const projectRoot = path.resolve(cwd);
  const defaultFile = path.join(projectRoot, "prisma", "dev.sqlite");
  const configured = String(env.DATABASE_URL || "").trim();
  if (configured && !configured.toLowerCase().startsWith("file:")) {
    return { url: configured, file: null, source: "DATABASE_URL" };
  }
  const raw = configured ? configured.slice("file:".length).trim() : "";
  let file = defaultFile;
  if (raw) {
    file = isWindowsAbsolute(raw) || path.isAbsolute(raw)
      ? path.normalize(raw)
      : path.resolve(projectRoot, "prisma", raw);
  }
  return { url: sqliteUrlFromFile(file), file, source: configured ? "DATABASE_URL" : "VSN default" };
}

export function withResolvedDatabaseEnv({ cwd = process.cwd(), env = process.env } = {}) {
  const location = resolveScriptDatabaseLocation({ cwd, env });
  return { ...env, DATABASE_URL: location.url };
}
