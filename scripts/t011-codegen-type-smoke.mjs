import { readFileSync, statSync } from "node:fs";
import ts from "typescript";
const file = "app/types/shopify-admin.generated.ts";
const content = readFileSync(file, "utf8");
const report = JSON.parse(readFileSync("t011-codegen-report.json", "utf8"));
const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (ast.parseDiagnostics.length) throw new Error("T011 invalid generated TypeScript: " + ast.parseDiagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")).join("; "));
const names = new Set(ast.statements.filter(ts.isTypeAliasDeclaration).map((node) => node.name.text));
const operations = report.operations || [];
if (operations.length < 50 || report.generatedOperations !== operations.length) throw new Error("T011 insufficient/mismatched generated operations");
for (const operation of operations) {
  for (const suffix of ["Data", "Variables"]) {
    const name = "ShopifyAdminOperation" + operation.id + suffix;
    if (!names.has(name)) throw new Error("T011 missing real generated type " + name);
  }
}
if (statSync(file).size < 1000) throw new Error("T011 generated declarations unexpectedly empty");
if (operations.length !== new Set(operations.map((x) => x.id)).size) throw new Error("T011 duplicate generated type identifiers");
const outputTypes = ast.statements.filter(ts.isTypeAliasDeclaration).filter((node) => node.name.text.endsWith("Data"));
const hasStructuredFields = outputTypes.filter((node) => ts.isTypeLiteralNode(node.type) && node.type.members.length > 0 || ts.isIntersectionTypeNode(node.type)).length;
if (hasStructuredFields < 50) throw new Error("T011 generated declarations are not actual schema-based output selections");
console.log("T011 generated TypeScript smoke pass", JSON.stringify({ declarations: names.size, operations: operations.length, structuredDataTypes: hasStructuredFields, partnerApiExcluded: report.excludedPartnerApi.length, outstandingDynamicOrSyntax: report.unvalidatedDynamicOrSyntax.length }));
