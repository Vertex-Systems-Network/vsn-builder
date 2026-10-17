import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {
  EXPECTED_STAGING_MIGRATIONS,
  expectedStagingMigrationChecksums,
  expectedStagingMigrationTables,
  attestStagingMigrationLedger,
} from "../scripts/t018-staging-migration-ledger.mjs";

const hashes=expectedStagingMigrationChecksums();
const expectedTables=expectedStagingMigrationTables();
const start=new Date("2026-10-17T10:00:00.000Z");
const end=new Date("2026-10-17T10:00:03.000Z");
function state(){
 return {
  summary:{database:"neondb",tables:53,essential_tables:4},
  records:EXPECTED_STAGING_MIGRATIONS.map(name=>({
    migration_name:name,checksum:hashes.get(name),
    started_at:start,finished_at:end,rolled_back_at:null,
  })),
  hashes:new Map(hashes),
  expectedTables:new Set(expectedTables),
  tables:[...expectedTables,"_prisma_migrations"].map(table_name=>({table_name})),
 };
}
const blocked=/T018_STAGING_MIGRATION_LEDGER_UNVERIFIED/;
test("reviewed source files establish distinct nonempty SHA256 migration identities",()=>{
 assert.equal(hashes.size,2);
 assert.notEqual(hashes.get(EXPECTED_STAGING_MIGRATIONS[0]),hashes.get(EXPECTED_STAGING_MIGRATIONS[1]));
 for(const name of EXPECTED_STAGING_MIGRATIONS){
  const bytes=readFileSync(new URL("../prisma/cloud/migrations/"+name+"/migration.sql",import.meta.url));
  assert.equal(hashes.get(name),createHash("sha256").update(bytes).digest("hex"));
 }
 assert.throws(()=>expectedStagingMigrationChecksums(()=>Buffer.alloc(2)),blocked);
 assert.throws(()=>expectedStagingMigrationChecksums(()=>"caller controlled string"),blocked);
});
test("both exactly hashed, nonrolledback migrations and required tables certify Staging ledger",()=>{
 const proof=attestStagingMigrationLedger(state());
 assert.equal(proof.ready,true);
 assert.equal(proof.migrations,2);
 assert.equal(proof.production_touched,false);
 assert.equal(proof.zero_merchant_rows_inspected,true);
 assert.equal(attestStagingMigrationLedger({...state(),records:state().records.reverse()}).ready,true);
});
test("wrong, missing, replayed, incomplete or unexpected migration history is denied",()=>{
 const mistakes=[
  o=>o.records.pop(),
  o=>o.records.push({...o.records[0]}),
  o=>o.records[1].migration_name=o.records[0].migration_name,
  o=>o.records[1].migration_name="20261013_unknown_manual_patch",
  o=>o.records[0].checksum="0".repeat(64),
  o=>o.records[0].checksum="D".repeat(64),
  o=>o.records[1].checksum=null,
  o=>o.records[1].started_at=null,
  o=>o.records[0].finished_at=null,
  o=>o.records[1].finished_at=new Date(0),
  o=>o.records[0].rolled_back_at=end,
  o=>o.hashes.delete(EXPECTED_STAGING_MIGRATIONS[1]),
  o=>o.hashes.set(EXPECTED_STAGING_MIGRATIONS[0],"f".repeat(64)),
 ];
 for(const mutate of mistakes){
  const stateNow=state();mutate(stateNow);
  assert.throws(()=>attestStagingMigrationLedger(stateNow),blocked);
 }
});
test("wrong DB, incomplete schema and manipulated count types fail closed",()=>{
 const changes=[
  o=>o.summary.database="brovexa",
  o=>o.summary.database="production",
  o=>o.summary.tables=52,
  o=>o.summary.tables="53",
  o=>o.summary.tables=NaN,
  o=>o.summary.essential_tables=3,
  o=>o.summary.essential_tables=5,
  o=>o.summary.essential_tables="4",
  o=>o.summary=null,
 ];
 for(const mutate of changes){
  const s=state();mutate(s);
  assert.throws(()=>attestStagingMigrationLedger(s),blocked);
 }
});
test("source contains only fixed read-only queries and guarded staging manual postcheck",()=>{
 const source=readFileSync(new URL("../scripts/phase3-staging-post-migrate-check.mjs",import.meta.url),"utf8");
 assert.match(source,/inspectStagingMigrationGate\(env\)/);
 assert.match(source,/attestStagingMigrationLedger/);
 assert.match(source,/expectedStagingMigrationChecksums/);
 assert.match(source,/SELECT migration_name, checksum, started_at, finished_at, rolled_back_at/);
 assert.doesNotMatch(source,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i);
});


test("T018 source-derived exact public table inventory is 52 reviewed Builder models",()=>{
 assert.equal(expectedTables.size,52);
 for(const name of ["Session","BuilderPage","BuilderSubscription","BuilderShopInstallation"])
   assert.equal(expectedTables.has(name),true);
 assert.equal(attestStagingMigrationLedger(state()).ready,true);
 assert.throws(()=>expectedStagingMigrationTables(()=>
   Buffer.from('CREATE TABLE "Arbitrary" (id text);'.repeat(5))),blocked);
});

test("T018 exact names reject wrong/duplicate tables even when counts look valid",()=>{
 const mutants=[
  s=>{s.tables[0]={table_name:"ManualReplacement"};},
  s=>{s.tables[0]={table_name:"BuilderPage"};},
  s=>{s.tables[0]={table_name:""};},
  s=>{s.tables[0]={table_name:null};},
  s=>{s.tables[0]={table_name:"_prisma_migrations"};},
  s=>{s.tables.push({table_name:"UnauthorizedExtra"});s.summary.tables=54;},
  s=>{s.tables.pop();},
  s=>{s.expectedTables.delete("BuilderPage");s.expectedTables.add("UnauthorizedExtra");},
  s=>{s.expectedTables=null;},
  s=>{s.tables=null;},
 ];
 for(const mutate of mutants){
  const s=state();mutate(s);
  assert.throws(()=>attestStagingMigrationLedger(s),blocked);
 }
});
