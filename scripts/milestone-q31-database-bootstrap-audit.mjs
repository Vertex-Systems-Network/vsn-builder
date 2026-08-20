import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
let failed = 0;
let total = 0;
const check = (name, ok, detail = "") => {
  total += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` · ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const pkg = JSON.parse(read("package.json"));
const baseline = JSON.parse(read("BASELINE.json"));
const runtime = read("app/config/baseline.js");
const prepare = read("scripts/prepare-database.mjs");
const repair = read("scripts/repair-legacy-migration-history.mjs");
const helper = read("scripts/lib/prisma-process.mjs");
const web = read("shopify.web.toml");

check("Q3.1 bootstrap preserved on current Q release", Number(pkg.version.split(".").at(-1)) >= 83 && pkg.version === baseline.version && runtime.includes(`version: "${pkg.version}"`));
check("Q3.1 bootstrap remains inside Q lineage", String(baseline.milestone||"").startsWith("Q.") && runtime.includes(`milestone: "${baseline.milestone}"`));
check("Shopify predev still prepares database", web.includes('predev = "npm run db:prepare"'));
check("Database prep uses shared Prisma runner", prepare.includes('from "./lib/prisma-process.mjs"') && prepare.includes("runPrisma"));
check("Prisma CLI resolves from package bin metadata", helper.includes('require.resolve("prisma/package.json"') && helper.includes("binField?.prisma") && helper.includes("process.execPath"));
check("Windows cmd launcher removed from database bootstrap", !prepare.includes("npx.cmd") && !repair.includes("npx.cmd") && !helper.includes("npx.cmd"));
check("Child process startup errors are surfaced", helper.includes("result.error") && helper.includes("could not start"));
check("Non-zero Prisma exits are surfaced", helper.includes("result.status !== 0") && helper.includes("failed with exit code"));
check("Database prep has explicit five-stage diagnostics", prepare.includes("[${index + 1}/${stages.length}]") && prepare.includes("Prisma migrate deploy") && prepare.includes("Database schema verification"));
check("Database prep warns against destructive reset", prepare.includes("Do not delete or reset prisma/dev.sqlite"));
check("Legacy migration repair also uses Node Prisma runner", repair.includes('import { runPrisma } from "./lib/prisma-process.mjs"') && repair.includes('runPrisma(["migrate", "resolve"'));
check("Email Builder migration remains packaged", fs.existsSync("prisma/migrations/20260808234540_milestone_n1_email_builder/migration.sql"));
check("Schema health verification remains packaged", fs.existsSync("scripts/database-schema-check.mjs"));

console.log(`\nMilestone Q.3.1 database bootstrap audit: ${total - failed}/${total} PASS`);
if (failed) process.exit(1);
