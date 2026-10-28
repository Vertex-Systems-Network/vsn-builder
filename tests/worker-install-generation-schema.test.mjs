import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const local=read("prisma/schema.prisma");
const hosted=read("prisma/cloud/schema.prisma");
const sqlite=read("prisma/migrations/20261013_builder_shop_installation_fence/migration.sql");
const postgres=read("prisma/cloud/migrations/20261013_builder_shop_installation_fence/migration.sql");
const revoker=read("app/services/worker-shopify-uninstall-session-revoke.js");
function model(source){
 const found=source.match(/^model BuilderShopInstallation \{[\s\S]*?^\}/m);
 assert(found,"Missing BuilderShopInstallation model");
 return found[0];
}
test("Local SQLite and hosted PostgreSQL have identical installation model contract",()=>{
 assert.equal(model(local),model(hosted));
 assert.match(model(local),/shop\s+String\s+@id/);
 assert.match(model(local),/installedAt\s+DateTime/);
 assert.match(model(local),/uninstalledAt\s+DateTime\?/);
 assert.match(model(local),/lastUninstallWebhookId\s+String\?/);
});
test("both forward SQL migrations create only isolated lifecycle table",()=>{
 for(const migration of [sqlite,postgres]){
  assert.match(migration,/CREATE TABLE "BuilderShopInstallation"/);
  for(const column of ["shop","installedAt","uninstalledAt","lastUninstallWebhookId","updatedAt"]){
   assert(migration.includes('"'+column+'"'),"Missing column "+column);
  }
  assert(!/\b(?:DROP|DELETE|TRUNCATE|ALTER\s+TABLE\s+"Session")\b/i.test(migration),"No destructive session SQL allowed");
 }
 assert.match(sqlite,/"installedAt" DATETIME NOT NULL/);
 assert.match(postgres,/"installedAt" TIMESTAMP\(3\) NOT NULL/);
 assert.match(postgres,/PRIMARY KEY \("shop"\)/);
});
test("session revocation remains behind transactional per-shop generation claim",()=>{
 assert.match(revoker,/context\.database\.\$transaction\(async\(tx\)/);
 assert.match(revoker,/builderShopInstallation\.updateMany|const fence=tx\?\.builderShopInstallation/);
 assert.match(revoker,/installedAt:attestedGeneration/);
 assert.doesNotMatch(revoker,/installedAt:\{lte:when\}/,"Unsigned timestamp must never authorize revocation");
 assert.match(revoker,/evidence\.webhookId!==event\.webhookId/);
 assert.match(revoker,/uninstalledAt:null/);
 assert.match(revoker,/await tx\.session\.deleteMany\(\{where:\{shop\}\}\)/);
 assert(!/context\.database\.session\.deleteMany/.test(revoker),"Never bypass transactional fence");
});
