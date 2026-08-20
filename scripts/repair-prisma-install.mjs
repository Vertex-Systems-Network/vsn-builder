import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const targets = [
  path.join(root, "node_modules", "prisma"),
  path.join(root, "node_modules", "@prisma"),
  path.join(root, "node_modules", ".prisma"),
];

console.log("VSN Prisma dependency repair starting...");
console.log("This command does NOT touch prisma/dev.sqlite or merchant data.");
for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  console.log(`Removing dependency cache: ${target}`);
  fs.rmSync(target, { recursive: true, force: true });
}

const npmCli = process.env.npm_execpath;
if (!npmCli || !fs.existsSync(npmCli)) {
  console.error("VSN Prisma dependency repair FAILED.");
  console.error("- npm CLI path is unavailable. Run `npm install` manually in this project folder.");
  process.exit(1);
}

console.log("Reinstalling locked dependencies...");
const install = spawnSync(process.execPath, [npmCli, "install"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: false,
  windowsHide: true,
});
if (install.error || install.signal || install.status !== 0) {
  const detail = install.error?.message || (install.signal ? `signal ${install.signal}` : `exit code ${install.status}`);
  console.error(`VSN Prisma dependency repair FAILED during npm install: ${detail}`);
  process.exit(1);
}

console.log("VSN Prisma dependency repair PASS. Run `npm run prisma:verify`, then `npm run db:prepare`.");
