import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildClientSchema, getIntrospectionQuery, getNamedType, isEnumType, isInputObjectType, isListType, isNonNullType, isScalarType, parse, validate, GraphQLNonNull } from "graphql";

const VERSION = "2026-10";
const ENDPOINT = "https://shopify.dev/admin-graphql-direct-proxy/" + VERSION;
const INPUT_PREFIX = "ShopifyAdminInput_";
const report = JSON.parse(readFileSync("t011-graphql-ast-report.json", "utf8"));
if (!report.parserAvailable) throw new Error("T011: GraphQL parser not available");
const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ query: getIntrospectionQuery({ descriptions: false }) }),
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error("T011: Shopify schema HTTP " + response.status);
const payload = await response.json();
if (!payload.data?.__schema) throw new Error("T011: Shopify Admin introspection schema missing");
const schema = buildClientSchema(payload.data);
const inputTypes = new Map();
const scalar = (name) => ({ ID: "string", String: "string", Int: "number", Float: "number", Boolean: "boolean", DateTime: "string", Date: "string", Decimal: "string", URL: "string", JSON: "unknown", Money: "string", UnsignedInt64: "string" })[name] || "unknown";
function renderEnum(named) {
  return named.getValues().map((x) => JSON.stringify(x.value)).join(" | ") || "never";
}
function inputType(type) {
  if (isNonNullType(type)) return inputTypeNonNull(type.ofType);
  return inputTypeNonNull(type) + " | null";
}
function inputTypeNonNull(type) {
  if (isListType(type)) return "Array<" + inputType(type.ofType) + ">";
  const named = getNamedType(type);
  if (isScalarType(named)) return scalar(named.name);
  if (isEnumType(named)) return renderEnum(named);
  if (isInputObjectType(named)) {
    inputTypes.set(named.name, named);
    return INPUT_PREFIX + named.name;
  }
  throw new Error("T011 unsupported GraphQL input type: " + String(type));
}
function outputType(type, selection, fragments, visited) {
  if (isNonNullType(type)) return outputNonNull(type.ofType, selection, fragments, visited);
  return outputNonNull(type, selection, fragments, visited) + " | null";
}
function outputNonNull(type, selection, fragments, visited) {
  if (isListType(type)) return "Array<" + outputType(type.ofType, selection, fragments, visited) + ">";
  const named = getNamedType(type);
  if (isScalarType(named)) return scalar(named.name);
  if (isEnumType(named)) return renderEnum(named);
  if (!selection) throw new Error("T011: composite output missing GraphQL selection: " + named.name);
  return renderSelection(named, selection, fragments, visited);
}
function renderSelection(parent, selection, fragments, visited = new Set()) {
  const fields = [];
  const additions = [];
  for (const node of selection.selections) {
    if (node.kind === "Field") {
      const key = node.alias?.value || node.name.value;
      const type = node.name.value === "__typename"
        ? JSON.stringify(parent.name)
        : node.name.value === "__schema" ? new GraphQLNonNull(schema.getType("__Schema"))
        : node.name.value === "__type" ? schema.getType("__Type")
        : parent.getFields?.()[node.name.value]?.type;
      if (!type) throw new Error("T011: unresolved output field " + parent.name + "." + node.name.value);
      const value = node.name.value === "__typename"
        ? (parent.astNode?.kind === "ObjectTypeDefinition" ? JSON.stringify(parent.name) : "string")
        : outputType(type, node.selectionSet, fragments, visited);
      const optional = node.directives?.some((d) => ["include", "skip"].includes(d.name.value)) || false;
      fields.push("readonly " + JSON.stringify(key) + (optional ? "?" : "") + ": " + value + ";");
    } else if (node.kind === "InlineFragment") {
      const conditional = node.typeCondition ? schema.getType(node.typeCondition.name.value) : parent;
      if (!conditional) throw new Error("T011: unknown inline fragment type");
      const part = renderSelection(conditional, node.selectionSet, fragments, visited);
      additions.push(node.typeCondition ? "Partial<" + part + ">" : part);
    } else if (node.kind === "FragmentSpread") {
      const name = node.name.value;
      const fragment = fragments.get(name);
      if (!fragment || visited.has(name)) throw new Error("T011: unresolved/cyclic fragment " + name);
      const condition = schema.getType(fragment.typeCondition.name.value);
      const next = new Set(visited); next.add(name);
      additions.push("Partial<" + renderSelection(condition, fragment.selectionSet, fragments, next) + ">");
    } else {
      throw new Error("T011: unsupported selection kind " + node.kind);
    }
  }
  return ["{" + fields.join(" ") + "}", ...additions].join(" & ");
}
function renderVariables(operation) {
  const lines = (operation.variableDefinitions || []).map((variable) => {
    const { typeFromAST } = graphqlHelpers;
    const result = typeFromAST(schema, variable.type);
    if (!result) throw new Error("T011: unresolved variable type " + variable.variable.name.value);
    const required = isNonNullType(result) && !variable.defaultValue;
    return "readonly " + JSON.stringify(variable.variable.name.value) + (required ? "" : "?") + ": " + inputType(result) + ";";
  });
  return "{" + lines.join(" ") + "}";
}
const graphqlHelpers = await import("graphql");
const entries = report.results.filter((item) => item.valid);
const exclusions = [];
const schemaFailures = [];
const declarations = [];
const operations = [];
for (const item of entries) {
  const doc = parse(item.document);
  const isPartner = (
    item.file === "app/services/shopify-subscription.server.js"
      && doc.definitions.some((d) => d.name?.value === "VsnSubscriptionState")
  ) || (
    item.file === "app/services/worker-shopify-subscription-sync.js"
      && doc.definitions.some((d) => d.name?.value === "VsnStagingSubscription")
  );
  if (isPartner) {
    exclusions.push({ file: item.file, operation: "VsnSubscriptionState", reason: "Shopify Partner API, not Admin API" });
    continue;
  }
  const errors = validate(schema, doc);
  if (errors.length) {
    schemaFailures.push({ file: item.file, errors: errors.map((e) => e.message) });
    continue;
  }
  const fragments = new Map(doc.definitions.filter((d) => d.kind === "FragmentDefinition").map((d) => [d.name.value, d]));
  for (const operation of doc.definitions.filter((d) => d.kind === "OperationDefinition")) {
    const root = operation.operation === "query" ? schema.getQueryType()
      : operation.operation === "mutation" ? schema.getMutationType() : schema.getSubscriptionType();
    if (!root) throw new Error("T011: missing root type " + operation.operation);
    const id = String(operations.length + 1).padStart(3, "0");
    const prefix = "ShopifyAdminOperation" + id;
    declarations.push("// " + item.file + " :: " + (operation.name?.value || "anonymous"));
    declarations.push("export type " + prefix + "Data = " + renderSelection(root, operation.selectionSet, fragments) + ";");
    declarations.push("export type " + prefix + "Variables = " + renderVariables(operation) + ";");
    operations.push({ id, file: item.file, name: operation.name?.value || null, kind: operation.operation });
  }
}
// Aggregate EVERY failing operation before erroring, so developers can fix
// the whole Shopify Admin schema drift in a single audited CI cycle.
// Never generate partial types or report this run as a pass.
if (schemaFailures.length) {
  const messages = schemaFailures.map((failure) =>
    failure.file + ": " + failure.errors.join("; ")
  );
  throw new Error(
    "T011 Shopify Admin schema validation FAILED for " +
    schemaFailures.length + " GraphQL documents:\n" + messages.join("\n")
  );
}
const renderedInputs = new Set();
let next;
while ((next = [...inputTypes.entries()].find(([name]) => !renderedInputs.has(name)))) {
  const [name, type] = next;
  renderedInputs.add(name);
  const parts = Object.entries(type.getFields()).map(([key, field]) => {
    const required = isNonNullType(field.type) && field.defaultValue === undefined;
    return "readonly " + JSON.stringify(key) + (required ? "" : "?") + ": " + inputType(field.type) + ";";
  });
  declarations.push("export type " + INPUT_PREFIX + name + " = {" + parts.join(" ") + "};");
}
if (operations.length < 50) throw new Error("T011: expected at least 50 validated Shopify Admin operations, found " + operations.length);
const outstanding = report.results.filter((item) => !item.valid);
mkdirSync("app/types", { recursive: true });
const header = [
  "// AUTO-GENERATED by scripts/t011-graphql-typegen.mjs. DO NOT EDIT.",
  "// Shopify Admin API version: " + VERSION,
  "// Operation typings cover statically extracted Admin GraphQL documents only.",
  "// Dynamic templates and Shopify Partner API documents are excluded; see t011-codegen-report.json.",
];
writeFileSync("app/types/shopify-admin.generated.ts", header.concat("", declarations, "").join("\n"));
const summary = { version: VERSION, generatedOperations: operations.length, generatedInputObjects: inputTypes.size,
  excludedPartnerApi: exclusions, unvalidatedDynamicOrSyntax: outstanding.map((x) => ({ file: x.file, status: x.status, error: x.error || null })), operations };
writeFileSync("t011-codegen-report.json", JSON.stringify(summary, null, 2) + "\n");
console.log("T011 actual Shopify Admin TypeScript generation:", JSON.stringify({
  generatedOperations: summary.generatedOperations, generatedInputObjects: summary.generatedInputObjects,
  excludedPartnerApi: exclusions.length, outstanding: outstanding.length
}));
