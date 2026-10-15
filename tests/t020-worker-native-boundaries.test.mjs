import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import db,{ VSN_DATABASE_LOCATION } from "../workers/full-merchant-ci-db-boundary.js";
import * as shopify from "../workers/full-merchant-ci-shopify-boundary.js";

test("legacy Prisma route reads never connect to SQLite or allow unbound queries", async () => {
  assert.equal(VSN_DATABASE_LOCATION.status,"not-bound");
  assert.equal(VSN_DATABASE_LOCATION.provider,"neon");
  for(const operation of [
    () => db.session.findUnique({where:{id:"fake"}}),
    () => db.builderPage.create({data:{}}),
    () => db.$transaction(async () => {}),
    () => db.builderShopInstallation.updateMany({where:{}}),
  ]) {
    assert.throws(operation,error=>error?.code==="VSN_WORKER_REQUEST_DATABASE_REQUIRED");
  }
  assert.equal(db.then,undefined);
});

test("legacy Shopify authorization, OAuth, webhooks and document CSP fail closed",async()=>{
  for(const method of [
    shopify.authenticate.admin,
    shopify.authenticate.webhook,
    shopify.login,
    shopify.registerWebhooks,
    shopify.sessionStorage.loadSession,
  ]){
    await assert.rejects(method(new Request("https://example.org/app")),
      error=>error?.code==="VSN_WORKER_REQUEST_SHOPIFY_REQUIRED");
  }
  assert.throws(()=>shopify.addDocumentResponseHeaders(),
    error=>error?.code==="VSN_WORKER_REQUEST_SHOPIFY_REQUIRED");
});

test("the full merchant build rewrites only app/ legacy Node imports",()=>{
  const native=readFileSync("vite.full-merchant-cloudflare-ci.config.js","utf8");
  assert.match(native,/isolateNodeServerBootstrapsForWorkerd\(\)/);
  assert.match(native,/workerDbBoundary/);
  assert.match(native,/workerShopifyBoundary/);
  assert.match(native,/isOfficialSdk/);
  assert.match(native,/id === "@prisma\\/client"/);
  assert.match(native,/workerPrismaNamespace/);
  const edge = readFileSync("workers/full-merchant-ci-prisma-namespace.js","utf8");
  assert.match(edge,/PrismaClient/);
  assert.match(edge,/generated\\/prisma-edge\\/client\\.ts/);
  assert.doesNotMatch(edge,/new PrismaClient\\(/);

  assert.match(native,/workerPrismaNamespace/);
  assert.match(native,/load\(id\)/);
  assert.match(native,/normalized\.endsWith\("\/app\/db\.server\.js"\)/);
  assert.match(native,/normalized\.endsWith\("\/app\/shopify\.server\.js"\)/);
  assert.match(native,/\.includes\("\/app\/"\)/);
  const regular=readFileSync("vite.config.js","utf8");
  assert.doesNotMatch(regular,/full-merchant-ci-db-boundary/);
  assert.doesNotMatch(regular,/full-merchant-ci-shopify-boundary/);
  const dbSrc=readFileSync("workers/full-merchant-ci-db-boundary.js","utf8");
  assert.doesNotMatch(dbSrc,/from\s+["']@prisma\/client/);
  assert.match(dbSrc,/createWorkerNeonPrisma/);
  const shopSrc=readFileSync("workers/full-merchant-ci-shopify-boundary.js","utf8");
  assert.doesNotMatch(shopSrc,/adapters\/node/);
  assert.match(shopSrc,/createWorkerShopifySdkContext/);
  const prismaNs = readFileSync("workers/full-merchant-ci-prisma-namespace.js","utf8");
  assert.match(prismaNs,/generated\/prisma-edge\/client\.ts/);
  assert.doesNotMatch(prismaNs,/from\s+["']@prisma\/client/);
});
