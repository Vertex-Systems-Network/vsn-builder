import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const read=(file)=>fs.readFileSync(file,"utf8");
let total=0, failed=0;
const check=(name,ok,detail="")=>{total++; console.log(`${ok?"PASS":"FAIL"} ${name}${detail?` · ${detail}`:""}`); if(!ok) failed++;};
const pkg=JSON.parse(read("package.json"));
const lock=JSON.parse(read("package-lock.json"));
const helper=read("scripts/lib/prisma-process.mjs");
const prepare=read("scripts/prepare-database.mjs");
const postinstall=read("scripts/prisma-postinstall.mjs");
const q31=read("scripts/milestone-q31-database-bootstrap-audit.mjs");
const baseline=JSON.parse(read("BASELINE.json"));
const runtime=read("app/config/baseline.js");

check("Q4.1+ version lineage",Number(pkg.version.split(".").at(-1))>=85&&baseline.version===pkg.version&&runtime.includes(`version: "${pkg.version}"`)&&runtime.includes('milestone: "Q.'));
check("Prisma CLI/client versions pinned together",pkg.dependencies?.prisma==="6.19.3"&&pkg.dependencies?.["@prisma/client"]==="6.19.3");
check("Lockfile Prisma CLI/client versions match",lock.packages?.["node_modules/prisma"]?.version==="6.19.3"&&lock.packages?.["node_modules/@prisma/client"]?.version==="6.19.3");
check("Resolver reads prisma/package.json",helper.includes('require.resolve("prisma/package.json"')&&helper.includes('packageJson.bin'));
check("Resolver uses package bin.prisma",helper.includes("binField?.prisma")&&helper.includes("path.resolve(packageDir, relativeBin)"));
check("Package main resolution is not used as CLI",!helper.includes('require.resolve("prisma")'));
check("Resolver verifies CLI file exists",helper.includes("fs.existsSync(cliPath)")&&helper.includes("Prisma CLI executable is missing"));
check("Resolver supports direct node_modules fallback",helper.includes('node_modules", "prisma", "package.json'));
check("runPrisma executes bin with current Node",helper.includes("process.execPath")&&helper.includes("[prismaCli, ...args]"));
check("db:prepare prints resolved Prisma diagnostics",prepare.includes("getPrismaCliDiagnostics")&&prepare.includes("Prisma CLI:"));
check("postinstall uses shared runner",String(pkg.scripts?.postinstall||"").includes("prisma-postinstall.mjs")&&postinstall.includes("runPrisma"));
check("Prisma verify command packaged",String(pkg.scripts?.["prisma:verify"]||"").includes("prisma-cli-verify.mjs")&&fs.existsSync("scripts/prisma-cli-verify.mjs"));
check("Regression fixture self-test packaged",fs.existsSync("scripts/prisma-cli-resolver-selftest.mjs"));
let selfTest=false;
try{execFileSync(process.execPath,["scripts/prisma-cli-resolver-selftest.mjs"],{stdio:"pipe"});selfTest=true;}catch{}
check("Regression fixture reproduces main-vs-bin case",selfTest);
check("Q3.1 audit upgraded away from wrong resolver contract",!q31.includes('require.resolve("prisma")')&&q31.includes('require.resolve("prisma/package.json"'));
check("No npx.cmd database launcher regression",!["scripts/lib/prisma-process.mjs","scripts/prepare-database.mjs","scripts/repair-legacy-migration-history.mjs"].some(f=>read(f).includes("npx.cmd")));
check("Database reset remains prohibited as recovery",prepare.includes("Do not delete or reset prisma/dev.sqlite"));
check("Email migration remains packaged",fs.existsSync(path.join("prisma","migrations","20260808234540_milestone_n1_email_builder","migration.sql")));

console.log(`\nMilestone Q.4.1 Prisma CLI resolution audit: ${total-failed}/${total} PASS`);
if(failed) process.exit(1);
