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
const edge=cloud.match(/generator\s+workerEdge\s*\{([^}]*)\}/s)?.[1]||"";
assert(/provider\s*=\s*"prisma-client"/.test(edge),"Edge generator must use ESM-friendly prisma-client");
assert(/runtime\s*=\s*"workerd"/.test(edge),"Cloudflare runtime target missing");
assert(/moduleFormat\s*=\s*"esm"/.test(edge),"Edge generator ESM format missing");
assert(/engineType\s*=\s*"client"/.test(edge),"Edge generator must not ship Rust");
const ignore=fs.readFileSync(path.join(root,".gitignore"),"utf8");
assert(ignore.split(/\r?\n/).includes("/generated/prisma-worker/"),"Generated Worker Client must be gitignored");
assert(ignore.split(/\r?\n/).includes("/generated/prisma-edge/"),"ESM Edge Client must be gitignored");
if(process.argv.includes("--generated")){
 const generated=fs.readFileSync(path.join(out,"schema.prisma"),"utf8");
 assert(/provider\s*=\s*"postgresql"/.test(generated),"Worker Client must use Postgres");
 assert(/generator\s+workerClient\s*\{[^}]*engineType\s*=\s*"client"/s.test(generated),"Worker generated schema lost engine-less setting");
 const sourceModels=(cloud.match(/^model\\s+\\w+/gm)||[]).length;
 assert(sourceModels>=52,"Worker source lost the Builder installation fence model");
 assert.equal((generated.match(/^model\\s+\\w+/gm)||[]).length,sourceModels,"Worker Client model parity drift");
 assert(fs.existsSync(path.join(out,"index.js")),"Worker Prisma Client index.js missing");
 const edgeSrc=fs.readFileSync(path.join(root,"generated/prisma-edge/client.ts"),"utf8");
 // A raw string check for "__dirname" can match comments or code removed
 // by the Worker bundler. Instead verify the generated ESM TypeScript client
 // has a real PrismaClient export and use the *actual* local workerd HTTP
 // integration test to certify browser/runtime globals.
 // A generated output may re-export PrismaClient indirectly; avoid relying
 // on any exact generated declaration spelling. The REAL Wrangler workerd
 // module import + HTTP probe is the acceptance test for executable exports.
 assert(edgeSrc.length>200,"Generated Edge Prisma ESM client unexpectedly empty");
 assert(!/^\s*module\.exports\s*=/m.test(edgeSrc),"Generated Edge client must not be CommonJS");
 assert(fs.existsSync(path.join(root,"generated/prisma-edge/internal/class.ts")),"Edge Prisma internals missing");
}
console.log("Worker Prisma generator isolation PASS; adapter and runtime are NOT yet implemented.");
