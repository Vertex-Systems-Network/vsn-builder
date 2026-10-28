// Real PostgreSQL18 redaction concurrency fence proof. NEVER runs on Neon.
// The outer Action still authenticates the Shopify HMAC + strict topic first.
import test from "node:test";
import assert from "node:assert/strict";
import prismaCloud from "../generated/prisma-cloud/index.js";
import {deleteVsnShopDataAfterVerifiedRedaction} from
  "../app/services/shop-data-lifecycle.server.js";

const local="postgresql://builder_ci:local_ephemeral_only@127.0.0.1:5432/builder_ci?schema=public";
assert.equal(process.env.CI,"true");
assert.equal(process.env.NODE_ENV,"test");
assert.equal(process.env.APP_ENV,"development");
assert.equal(process.env.DATABASE_URL,local);
assert.equal(process.env.DIRECT_URL,local);
for(const name of ["NEON_API_KEY","CLOUDFLARE_API_TOKEN","SHOPIFY_API_SECRET"]){
 assert(!process.env[name]);
}
const db=new prismaCloud.PrismaClient();
const redacted="vsn-pg-ci-gdpr-redact.myshopify.com";
const active="vsn-pg-ci-gdpr-active.myshopify.com";
const other="vsn-pg-ci-gdpr-other.myshopify.com";
const shops=[redacted,active,other];
const began=new Date("2026-10-10T09:00:00Z");
const closed=new Date("2026-10-11T09:00:00Z");
const session=shop=>({
 id:"offline_"+shop,shop,state:"",isOnline:false,
 accessToken:"synthetic-ci-token-"+shop,
});
async function cleanup(){
 await db.session.deleteMany({where:{shop:{in:shops}}});
 await db.builderShopInstallation.deleteMany({where:{shop:{in:shops}}});
}
test.before(async()=>{
 await db.$connect();
 await cleanup();
 for(const shop of shops){
  await db.builderShopInstallation.create({data:{
   shop,installedAt:began,uninstalledAt:shop===redacted?closed:null,
  }});
  await db.session.create({data:session(shop)});
 }
});
test.after(async()=>{try{await cleanup()}finally{await db.$disconnect()}});

test("real active PostgreSQL installation cannot be GDPR-purged by delayed redaction",async()=>{
 for(const shop of [active,other]){
  await assert.rejects(deleteVsnShopDataAfterVerifiedRedaction(db,shop),{
   code:"T024_SHOP_REDACT_GENERATION_NOT_VERIFIED",
  });
  assert.equal(await db.session.count({where:{shop}}),1);
  assert.equal((await db.builderShopInstallation.findUnique({
   where:{shop}
  })).uninstalledAt,null);
 }
});

test("real uninstalled PostgreSQL generation is locked before atomic scoped shop cleanup",async()=>{
 assert.deepEqual(await deleteVsnShopDataAfterVerifiedRedaction(db,redacted),{deleted:true});
 assert.equal(await db.session.count({where:{shop:redacted}}),0);
 // Preserve the durable tombstone, needed to recognize repeat deliveries
 // and to make a future reinstall start a new verified install generation.
 const tombstone=await db.builderShopInstallation.findUnique({
  where:{shop:redacted},
 });
 assert.equal(tombstone.installedAt.getTime(),began.getTime());
 assert.equal(tombstone.uninstalledAt.getTime(),closed.getTime());
 assert.equal(await db.session.count({where:{shop:active}}),1);
 assert.equal(await db.session.count({where:{shop:other}}),1);
});

test("real PostgreSQL GDPR replay is idempotent without crossing tenant boundaries",async()=>{
 assert.deepEqual(await deleteVsnShopDataAfterVerifiedRedaction(db,redacted),{deleted:true});
 assert.equal(await db.session.count({where:{shop:redacted}}),0);
 assert.equal(await db.session.count({where:{shop:active}}),1);
 assert.equal(await db.session.count({where:{shop:other}}),1);
});
