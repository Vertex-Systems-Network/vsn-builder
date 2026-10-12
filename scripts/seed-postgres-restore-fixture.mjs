// A non-sensitive, disposable restore fixture for the CI PostgreSQL service.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const only="postgresql://builder_ci:local_ephemeral_only@127.0.0.1:5432/builder_ci?schema=public";
assert.equal(process.env.DATABASE_URL,only,"Refusing to seed non-CI databases");
assert.equal(process.env.DIRECT_URL,only,"Refusing to touch hosted database");
assert.equal(process.env.NODE_ENV,"test");
const require=createRequire(import.meta.url);
const {PrismaClient}=require("../generated/prisma-cloud/index.js");
const db=new PrismaClient();
try{
 const record={id:"vsn-restore-ci-sentinel",shop:"restore-ci.myshopify.invalid",
  state:"ci-backup-source",accessToken:"not-a-real-shopify-token"};
 await db.session.upsert({where:{id:record.id},create:record,update:{state:record.state,shop:record.shop,accessToken:record.accessToken}});
 const stored=await db.session.findUnique({where:{id:record.id}});
 assert.equal(stored?.state,record.state);
 console.log("Disposable pre-backup record verified; no merchant data used.");
}finally{await db.$disconnect()}
