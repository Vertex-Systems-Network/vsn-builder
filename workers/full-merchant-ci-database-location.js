// CI-only Workerd boundary for the Node filesystem-based database helper.
// Do not infer a Neon URL or read secrets from process.env at module load.
const rejectSqlite = () => {
  const error = new Error("SQLite filesystem helpers cannot execute on Cloudflare Workers");
  error.code="VSN_WORKER_SQLITE_UNSUPPORTED";
  throw error;
};
export const VSN_PROJECT_ROOT = null;
export const VSN_DEFAULT_DATABASE_FILE = null;
export const normalizeSqliteFilePath = rejectSqlite;
export const sqliteUrlFromFile = rejectSqlite;
export function resolveVsnDatabaseLocation() {
  return Object.freeze({
    url:null,
    file:null,
    source:"Worker request-scoped Neon binding required",
  });
}
