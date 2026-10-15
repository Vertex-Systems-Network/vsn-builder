import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import fs from "node:fs";
const require=createRequire(import.meta.url);
test("Worker generated Prisma Client mirrors canonical PostgreSQL model inventory",()=>{
 const src=fs.readFileSync("generated/prisma-worker/schema.prisma","utf8");
 assert.match(src,/engineType\s*=\s*"client"/);
 assert.match(src,/provider\s*=\s*"postgresql"/);
 const reviewed=fs.readFileSync("prisma/cloud/schema.prisma","utf8");
 const expected=(reviewed.match(/^model\s+\w+/gm)||[]).length;
 assert.ok(expected>=52,"Shopify installation fence must exist in canonical schema");
 assert.equal((src.match(/^model\s+\w+/gm)||[]).length,expected,"Generated Worker Prisma model parity drift");
 const {PrismaClient}=require("../generated/prisma-worker/index.js");
 assert.equal(typeof PrismaClient,"function");
});
test("Worker Client cannot silently initialize without a runtime driver adapter",()=>{
 const {PrismaClient}=require("../generated/prisma-worker/index.js");
 assert.throws(()=>new PrismaClient(),/adapter|engine type|engineType|driver/i);
});
