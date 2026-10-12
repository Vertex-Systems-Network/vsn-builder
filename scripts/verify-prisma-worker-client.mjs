import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const cloud=fs.readFileSync(path.join(root,"prisma/cloud/schema.prisma"),"utf8");
const normal=cloud.match(/generator\s+client\s*\{([^}]*)\}/s)?.[1]||"";
const worker=cloud.match(/generator\s+workerClient\s*\{([^}]*)\}/s)?.[1]||"";
assert(/provider\s*=\s*"prisma-client-js"/.test(worker),"Worker generator must be prisma-client-js");
assert(/output\s*=\s*"\.\.\/\.\.\/generated\/prisma-worker"/.test(worker),"Worker output must be distinct");
assert(/engineType\s*=\s*"client"/.test(worker),"Worker Client must be Rust engine-free");
assert(!/engineType\s*=/.test(normal),"Node Cloud Client must retain native Prisma driver for CI");
assert(/output\s*=\s*"\.\.\/\.\.\/generated\/prisma-cloud"/.test(normal),"Node Cloud Client output changed");
const out=path.join(root,"generated/prisma-worker");
const ignore=fs.readFileSync(path.join(root,".gitignore"),"utf8");
assert(ignore.split(/\r?\n/).includes("/generated/prisma-worker/"),"Generated Worker Client must be gitignored");
if(process.argv.includes("--generated")){
 const generated=fs.readFileSync(path.join(out,"schema.prisma"),"utf8");
 assert(/provider\s*=\s*"postgresql"/.test(generated),"Worker Client must use Postgres");
 assert(/generator\s+workerClient\s*\{[^}]*engineType\s*=\s*"client"/s.test(generated),"Worker generated schema lost engine-less setting");
 assert.equal((generated.match(/^model\s+\w+/gm)||[]).length,51,"Worker Client model parity drift");
 assert(fs.existsSync(path.join(out,"index.js")),"Worker Prisma Client index.js missing");
}
console.log("Worker Prisma generator isolation PASS; adapter and runtime are NOT yet implemented.");
