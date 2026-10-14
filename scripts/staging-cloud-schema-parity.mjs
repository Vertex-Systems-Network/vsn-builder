import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function inspectCloudSchemaParity(localSource, cloudSource, migrations) {
  const parseModels = (source) => new Map([...source.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map((m) => [
    m[1],
    m[2].split("\n").map((line) => line.trim()).filter((line) => /^[A-Za-z_]\w+\s+\S+/.test(line))
      .map((line) => {
        const [field, type] = line.split(/\s+/);
        return { field, type };
      }),
  ]));
  const local = parseModels(localSource);
  const cloud = parseModels(cloudSource);
  const missingModels = [...local.keys()].filter((name) => !cloud.has(name));
  const cloudOnly = [...cloud.keys()].filter((name) => !local.has(name));
  const mismatch = [];
  for (const [model, fields] of local) {
    if (!cloud.has(model)) continue;
    const available = cloud.get(model);
    const localMap = new Map(fields.map(({field,type}) => [field,type]));
    const cloudMap = new Map(available.map(({field,type}) => [field,type]));
    for (const [field,type] of localMap) {
      if (cloudMap.get(field) !== type) mismatch.push(model + "." + field + ": " + type + " != " + (cloudMap.get(field) || "MISSING"));
    }
    for (const field of cloudMap.keys()) if (!localMap.has(field)) mismatch.push(model + "." + field + ": CLOUD_ONLY");
  }
  const createTables = [...migrations.matchAll(/CREATE TABLE\s+"([^"]+)"/g)].map((m) => m[1]);
  const uncreatedModels = [...cloud.keys()].filter((name) => !createTables.includes(name));
  const checks = {
    localIsSqlite: /datasource\s+db\s*\{[^}]*provider\s*=\s*"sqlite"/m.test(localSource),
    cloudIsPostgreSQL: /datasource\s+db\s*\{[^}]*provider\s*=\s*"postgresql"/m.test(cloudSource),
    cloudClientSeparate: cloudSource.includes("generated/prisma-edge") &&
      cloudSource.includes('runtime                = "workerd"'),
    expectedInstallationFence: cloudOnly.length === 1 && cloudOnly[0] === "BuilderShopInstallation",
    migrationIncludesEveryModel: uncreatedModels.length === 0,
    noMissingLocalModels: missingModels.length === 0,
    noFieldOrTypeMismatch: mismatch.length === 0,
  };
  return { ready: Object.values(checks).every(Boolean), modelCounts: { local: local.size, cloud: cloud.size },
    checks, missingModels, cloudOnly, mismatch, uncreatedModels };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = (name) => readFileSync(name, "utf8");
  const migrationFiles = [
    "prisma/cloud/migrations/20261013_builder_cloud_baseline/migration.sql",
    "prisma/cloud/migrations/20261013_builder_shop_installation_fence/migration.sql",
  ];
  const result = inspectCloudSchemaParity(file("prisma/schema.prisma"),
    file("prisma/cloud/schema.prisma"), migrationFiles.map(file).join("\n"));
  console.log("VSN Cloud staging Prisma parity:", JSON.stringify(result));
  console.log("No SQL was executed; schema parity is not proof that Neon migrations were applied.");
  if (!result.ready) process.exitCode = 1;
}
