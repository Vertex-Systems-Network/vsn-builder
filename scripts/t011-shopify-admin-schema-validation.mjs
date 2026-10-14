import { readFileSync, writeFileSync } from "node:fs";
import { buildClientSchema, getIntrospectionQuery, parse, validate } from "graphql";

const VERSION = "2026-07";
const endpoint = `https://shopify.dev/admin-graphql-direct-proxy/${VERSION}`;
const astReport = JSON.parse(readFileSync("t011-graphql-ast-report.json", "utf8"));
const report = {
  api: "Shopify Admin GraphQL",
  apiVersion: VERSION,
  schemaEndpoint: endpoint,
  schemaFetched: false,
  documentsExamined: 0,
  valid: 0,
  invalid: 0,
  invalidDocuments: [],
  excludedNonAdminOperations: [],
};
try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: getIntrospectionQuery({ descriptions: false }) }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Shopify schema proxy returned HTTP ${response.status}`);
  const json = await response.json();
  if (!json.data?.__schema) {
    throw new Error(`Shopify schema introspection unavailable: ${JSON.stringify(json.errors || []).slice(0, 600)}`);
  }
  const schema = buildClientSchema(json.data);
  report.schemaFetched = true;
  for (const entry of astReport.results.filter((row) => row.valid)) {
    const operationNames = (entry.definitions || []).map((definition) => definition.name);
    if (entry.file === "app/services/shopify-subscription.server.js" &&
        operationNames.length === 1 && operationNames[0] === "VsnSubscriptionState") {
      report.excludedNonAdminOperations.push({
        file: entry.file,
        name: operationNames[0],
        reason: "Shopify Partner API at partners.shopify.com, not Shopify Admin API",
      });
      continue;
    }
    report.documentsExamined++;
    const problems = validate(schema, parse(entry.document)).map((issue) => issue.message);
    if (problems.length) {
      report.invalid++;
      report.invalidDocuments.push({ file: entry.file, definitions: entry.definitions, errors: problems.slice(0, 5) });
    } else {
      report.valid++;
    }
  }
  console.log("T011 Shopify Admin schema:", JSON.stringify({ version: VERSION, checked: report.documentsExamined, valid: report.valid, invalid: report.invalid, excludedPartnerApi: report.excludedNonAdminOperations.length }));
} catch (error) {
  report.error = String(error?.message || error);
  console.error("T011 Shopify schema verification BLOCKED:", report.error);
  process.exitCode = 1;
}
writeFileSync("t011-shopify-admin-schema-report.json", JSON.stringify(report, null, 2) + "\n");
if (report.schemaFetched && report.invalid) {
  console.log("T011 example schema mismatches:", JSON.stringify(report.invalidDocuments.slice(0, 8)));
  process.exitCode = 1;
}
