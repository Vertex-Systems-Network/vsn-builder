import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const sharedPath = "app/utils/builder-permissions.js";
const serverPath = "app/utils/builder-permissions.server.js";
const shared = read(sharedPath);
const server = read(serverPath);

check("shared permission contract exists", fs.existsSync(path.join(root, sharedPath)));
check("server authorization contract exists", fs.existsSync(path.join(root, serverPath)));
check("shared permission contract has no server imports", !/from\s+["'][^"']*\.server(?:\.[jt]sx?)?["']/.test(shared));
check("shared permission contract has no Prisma/db import", !/db\.server|@prisma|shopify\.server/.test(shared));
check("server permission contract owns DB access", /export async function getBuilderRoleAccess/.test(server));
check("server permission contract owns system authorization", /export async function canAccessBuilderSystem/.test(server));
check("pure role helpers moved out of .server module", !/export function (getBuilderRole|isBuilderOwner|canBuilder|builderActor|normalizeBuilderRoleAccess|getRoleSystemAccess)/.test(server));

const stockConfigPath = "app/config/stock-media.js";
const stockConfig = read(stockConfigPath);
check("stock media provider contract is client-safe", !/\.server(?:\.[jt]sx?)?["']|db\.server|shopify\.server|@prisma|process\.env|decryptSecret|encryptSecret/.test(stockConfig));
for (const [routeName, providerConst] of [["app.stock-images.jsx","STOCK_IMAGE_PROVIDERS"],["app.stock-videos.jsx","STOCK_VIDEO_PROVIDERS"],["app.stock-audio.jsx","STOCK_AUDIO_PROVIDERS"]]) {
  const route = read(`app/routes/${routeName}`);
  check(`${routeName} imports ${providerConst} from client-safe config`, new RegExp(`import\\s*\\{[^}]*\\b${providerConst}\\b[^}]*\\}\\s*from\\s*[\"']\.\.\/config\/stock-media\.js[\"']`).test(route));
  check(`${routeName} does not import ${providerConst} from .server module`, !new RegExp(`import\\s*\\{[^}]*\\b${providerConst}\\b[^}]*\\}\\s*from\\s*[\"'][^\"']*\.server`).test(route));
}

const routeDir = path.join(root, "app/routes");
const routeFiles = fs.readdirSync(routeDir).filter((name) => /\.[jt]sx?$/.test(name));
const unusedServerImports = [];
for (const name of routeFiles) {
  const rel = `app/routes/${name}`;
  const source = read(rel);
  const importPattern = /import\s*\{([^}]+)\}\s*from\s*["']([^"']*\.server(?:\.[jt]sx?)?)["'];?/g;
  for (const match of source.matchAll(importPattern)) {
    for (const rawPart of match[1].split(",")) {
      const raw = rawPart.trim();
      if (!raw) continue;
      const local = raw.includes(" as ") ? raw.split(/\s+as\s+/).pop().trim() : raw;
      const occurrences = (source.match(new RegExp(`\\b${local.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")) || []).length;
      if (occurrences <= 1) unusedServerImports.push(`${rel}: ${local} from ${match[2]}`);
    }
  }
}
check("route files contain no unused named .server imports", unusedServerImports.length === 0, unusedServerImports.join(" | "));

const appRoute = read("app/routes/app.jsx");
const pagesRoute = read("app/routes/app.pages.jsx");
const builderRoute = read("app/routes/app.builder.$id.jsx");
check("parent app route no longer imports canAccessBuilderEditor", !/builder-permissions\.server[^\n]*canAccessBuilderEditor|canAccessBuilderEditor[^\n]*builder-permissions\.server/.test(appRoute));
check("pages route no longer imports canAccessBuilderEditor", !/builder-permissions\.server[^\n]*canAccessBuilderEditor|canAccessBuilderEditor[^\n]*builder-permissions\.server/.test(pagesRoute));
check("builder route no longer imports canAccessBuilderEditor", !/builder-permissions\.server[^\n]*canAccessBuilderEditor|canAccessBuilderEditor[^\n]*builder-permissions\.server/.test(builderRoute));
const roleManagerRoute = read("app/routes/app.role-manager.jsx");
check("role manager client normalization imports shared module", /import\s*\{[\s\S]*?normalizeBuilderRoleAccess[\s\S]*?\}\s*from\s*["']\.\.\/utils\/builder-permissions\.js["']/.test(roleManagerRoute));

const sidebar = read("app/components/dashboard/Sidebar.jsx");
const topNav = read("app/components/dashboard/TopNav.jsx");
check("sidebar SPA button navigation restored", /<button key=\{item\.id\} onClick=\{\(\) => onNavigate\(item\.id\)\}/.test(sidebar));
check("sidebar hydration fallback links removed", !/hrefForNavigation|data-vsn-nav-href/.test(sidebar));
check("top navigation SPA buttons restored", /onClick=\{\(\) => onNavigate\('support'\)\}/.test(topNav) && /onClick=\{\(\) => onNavigate\('notifications'\)\}/.test(topNav));
check("temporary K2 hydration boot removed", !fs.existsSync(path.join(root, "app/entry.client.jsx")) && !fs.existsSync(path.join(root, "public/vsn-client-boot.js")));

const failed = checks.filter((row) => !row.ok);
for (const row of checks) console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}${row.detail ? ` — ${row.detail}` : ""}`);
console.log(`\nK.3 client/server boundary audit: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
