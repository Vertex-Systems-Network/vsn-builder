import { existsSync, readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const cfg = readFileSync(new URL("../.graphqlrc.js", import.meta.url), "utf8");
const problems = [];
if (!pkg.scripts?.["graphql-codegen"]?.includes("t011-graphql-typegen.mjs")) problems.push("actual type generator is not wired to graphql-codegen");
if (!pkg.devDependencies?.graphql) problems.push("audited standalone graphql parser dependency is missing");
if (!cfg.includes("2026-07") || !cfg.includes("admin-graphql-direct-proxy")) problems.push("versioned Shopify Admin schema project configuration missing");
if (cfg.includes("@shopify/api-codegen-preset")) problems.push("vulnerable/uninstalled Shopify codegen preset still referenced");
for (const file of ["scripts/t011-graphql-typegen.mjs", "scripts/t011-graphql-ast-analysis.mjs", "scripts/t011-graphql-document-inventory.mjs"]) {
  if (!existsSync(new URL("../" + file, import.meta.url))) problems.push("missing real generator dependency " + file);
}
if (problems.length) {
  for (const problem of problems) console.error("BLOCKED T011 codegen compatibility: " + problem);
  process.exitCode = 1;
} else {
  console.log("T011 static codegen wiring valid. CI must still execute generator, schema validation, generated-type compilation, and full security audit.");
}
