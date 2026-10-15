import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

export function inspectStagingCloudClient({ schema, sqliteSchema, ignoreFile, expected = 52 }) {
  const extract = (source) => [...source.matchAll(/^model\s+(\w+)\s*\{/gm)].map(m => m[1]);
  const cloudModels = extract(schema);
  const localModels = extract(sqliteSchema);
  const checks = {
    cloudPostgreSQL: /datasource\s+db\s*\{[^}]*provider\s*=\s*"postgresql"/m.test(schema),
    localStillSQLite: /datasource\s+db\s*\{[^}]*provider\s*=\s*"sqlite"/m.test(sqliteSchema),
    isolatedNodeClient: /generator\s+client\s*\{[^}]*output\s*=\s*"\.\.\/\.\.\/generated\/prisma-cloud"/s.test(schema),
    rustlessWorkerClient: /generator\s+workerClient\s*\{[^}]*engineType\s*=\s*"client"/s.test(schema),
    workerdTarget: /generator\s+workerEdge\s*\{[^}]*runtime\s*=\s*"workerd"/s.test(schema),
    workerdESM: /generator\s+workerEdge\s*\{[^}]*moduleFormat\s*=\s*"esm"/s.test(schema),
    exactCloudModelCount: cloudModels.length === expected && localModels.length === expected - 1,
    installFenceIncluded: cloudModels.includes("BuilderShopInstallation") && !localModels.includes("BuilderShopInstallation"),
    generatedDirectoriesIgnored: ["prisma-cloud", "prisma-worker", "prisma-edge"].every(
      name => ignoreFile.split(/\r?\n/).includes("/generated/" + name + "/")),
  };
  return {ready: Object.values(checks).every(Boolean), checks, cloudModels:cloudModels.length, localModels:localModels.length};
}

if (process.argv[1]?.endsWith("/staging-cloud-client-verify.mjs")) {
  const f=(p)=>readFileSync(p,"utf8");
  const result=inspectStagingCloudClient({
    schema:f("prisma/cloud/schema.prisma"),
    sqliteSchema:f("prisma/schema.prisma"),
    ignoreFile:f(".gitignore"),
  });
  for(const [name,ok] of Object.entries(result.checks))console.log((ok?"PASS":"FAIL")+" "+name);
  assert.ok(result.ready, "Staging Prisma schema and generated-client isolation must pass");
  if (process.argv.includes("--generated")) {
    const cloud = "generated/prisma-cloud/index.js";
    const worker = "generated/prisma-worker/index.js";
    const edge = "generated/prisma-edge/client.ts";
    for (const file of [cloud, worker, edge]) {
      assert.ok(existsSync(file), "Isolated generated client missing: " + file);
      assert.ok(statSync(file).size > 200, "Generated client unexpectedly empty: " + file);
    }
    const compiledSchema = f("generated/prisma-worker/schema.prisma");
    const generatedModels = [...compiledSchema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(m=>m[1]);
    assert.equal(generatedModels.length,52,"Generated Worker client model parity");
    assert.ok(compiledSchema.includes('engineType = "client"'),"Worker Prisma Client must be engine-free");
    const edgeSource=f(edge);
    assert.ok(!/^\s*module\.exports\s*=/m.test(edgeSource),"Generated Edge client cannot use CommonJS exports");
    assert.ok(existsSync("generated/prisma-edge/internal/class.ts"),"Prisma edge runtime internal module missing");
    console.log("Isolated Node + Workerd Prisma generation PASS (52 models); no database connection tested");
  }
}
