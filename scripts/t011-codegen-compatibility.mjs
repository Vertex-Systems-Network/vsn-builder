import { readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const config = readFileSync(new URL("../.graphqlrc.js", import.meta.url), "utf8");
const issues = [];
if (!pkg.scripts?.["graphql-codegen"]) issues.push("graphql-codegen npm script is missing");
if (!config.includes("@shopify/api-codegen-preset")) {
  issues.push("Shopify API project code generation configuration was removed");
} else {
  try { import.meta.resolve("@shopify/api-codegen-preset"); }
  catch { issues.push("Shopify API codegen configuration imports an unavailable dependency"); }
}
if (issues.length) {
  for (const issue of issues) console.error("BLOCKED T011 codegen compatibility: " + issue);
  process.exitCode = 1;
} else {
  console.log("T011 codegen script and configured Shopify preset are resolvable.");
}
