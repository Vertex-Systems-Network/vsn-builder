import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlitePath=path.join(root,"prisma/schema.prisma");
const cloudPath=path.join(root,"prisma/cloud/schema.prisma");
const sqlite=fs.readFileSync(sqlitePath,"utf8");
const cloud=fs.readFileSync(cloudPath,"utf8");
const section=(s)=>s.match(/generator\s+client\s*\{([^}]*)\}/s)?.[1]||"";
assert(!/\boutput\s*=/.test(section(sqlite)), "Local SQLite client must use the normal @prisma/client output");
const gen=section(cloud);
const relative=gen.match(/\boutput\s*=\s*"([^"]+)"/)?.[1];
assert.equal(relative,"../../generated/prisma-cloud", "Cloud Prisma Client must use isolated generated output");
const out=path.resolve(path.dirname(cloudPath),relative);
assert.equal(out,path.join(root,"generated/prisma-cloud"),"Cloud client must stay in gitignored, dedicated directory");
const ignore=fs.readFileSync(path.join(root,".gitignore"),"utf8");
assert(ignore.split(/\r?\n/).includes("/generated/prisma-cloud/"),"Hosted Prisma Client must be gitignored");
assert(/provider\s*=\s*"sqlite"/.test(sqlite),"Local schema must be SQLite");
assert(/provider\s*=\s*"postgresql"/.test(cloud),"Cloud schema must be PostgreSQL");
if(process.argv.includes("--generated")){
 const localClientSchema=fs.readFileSync(path.join(root,"node_modules/.prisma/client/schema.prisma"),"utf8");
 const hostedClientSchema=fs.readFileSync(path.join(out,"schema.prisma"),"utf8");
 assert(/provider\s*=\s*"sqlite"/.test(localClientSchema),"Cloud generation modified local SQLite generated client");
 assert(/provider\s*=\s*"postgresql"/.test(hostedClientSchema),"Hosted generated client is not PostgreSQL");
 assert(fs.existsSync(path.join(out,"index.js")),"Hosted Client index.js missing");
 assert.equal((localClientSchema.match(/^model\s+\w+/gm)||[]).length,
              (hostedClientSchema.match(/^model\s+\w+/gm)||[]).length,
              "Cloud and Local generated clients have different model counts");
 console.log("Generated client isolation PASS; Local SQLite unchanged, Cloud PostgreSQL separate");
}else{
 console.log("Prisma Client static isolation PASS (generate in PostgreSQL CI for runtime artifact verification)");
}
