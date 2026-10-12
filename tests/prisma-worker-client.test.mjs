import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import fs from "node:fs";
const require=createRequire(import.meta.url);
test("Worker generated Prisma Client exists as an isolated, engine-less 51-model client",()=>{
 const src=fs.readFileSync("generated/prisma-worker/schema.prisma","utf8");
 assert.match(src,/engineType\s*=\s*"client"/);
 assert.match(src,/provider\s*=\s*"postgresql"/);
 assert.equal((src.match(/^model\s+\w+/gm)||[]).length,51);
 const {PrismaClient}=require("../generated/prisma-worker/index.js");
 assert.equal(typeof PrismaClient,"function");
});
test("Worker Client cannot silently initialize without a runtime driver adapter",()=>{
 const {PrismaClient}=require("../generated/prisma-worker/index.js");
 assert.throws(()=>new PrismaClient(),/adapter|engine type|engineType|driver/i);
});
