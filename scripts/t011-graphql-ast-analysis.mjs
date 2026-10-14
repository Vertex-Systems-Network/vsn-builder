import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const inventory = JSON.parse(readFileSync("t011-graphql-operation-inventory.json", "utf8"));
let parse;
try { ({ parse } = require("graphql")); } catch { /* audited tree might not include parser yet */ }
const results = [];
const isGraphqlString = (value) => /^\s*(?:#graphql\b|(?:query|mutation|subscription)\s+(?:[A-Za-z_][A-Za-z0-9_]*\s*)?(?:\(|\{)|fragment\s+[A-Za-z_][A-Za-z0-9_]*\s+on\b)/.test(value);
const add = (file, kind, value, dynamic = false) => {
  if (dynamic) {
    results.push({ file, kind, valid: false, status: "dynamic-interpolation", reason: "Review document composition before validation" });
    return;
  }
  if (!parse) {
    results.push({ file, kind, valid: false, status: "parser-unavailable" });
    return;
  }
  try {
    const parsed = parse(value);
    const definitions = parsed.definitions.map((node) => ({
      kind: node.kind,
      name: node.name?.value ?? null,
      operation: node.operation ?? null,
    }));
    results.push({ file, kind, valid: true, definitions });
  } catch (error) {
    results.push({ file, kind, valid: false, status: "syntax-error", error: String(error.message) });
  }
};
for (const entry of inventory.entries) {
  const file = entry.file;
  const source = readFileSync(file, "utf8");
  if (entry.kind === "document-file") {
    add(file, "document-file", source);
    continue;
  }
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : file.endsWith(".jsx") ? ts.ScriptKind.JSX : file.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  function visit(node) {
    if (ts.isTaggedTemplateExpression(node) && /^(?:gql|graphql)$/.test(node.tag.getText(ast))) {
      const template = node.template;
      add(file, "tagged-template", ts.isNoSubstitutionTemplateLiteral(template) ? template.text : template.head.text, !ts.isNoSubstitutionTemplateLiteral(template));
      return;
    }
    if ((ts.isNoSubstitutionTemplateLiteral(node) || ts.isStringLiteral(node)) && isGraphqlString(node.text)) {
      add(file, "graphql-string", node.text);
    } else if (ts.isTemplateExpression(node) && isGraphqlString(node.head.text)) {
      add(file, "graphql-dynamic-template", node.head.text, true);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
const report = {
  status: parse ? "parsed" : "blocked-parser-unavailable",
  scannedCandidates: inventory.candidateFiles,
  discoveredDocuments: results.length,
  valid: results.filter((row) => row.valid).length,
  invalid: results.filter((row) => !row.valid).length,
  parserAvailable: Boolean(parse),
  results,
};
writeFileSync("t011-graphql-ast-report.json", JSON.stringify(report, null, 2) + "\n");
console.log("T011 GraphQL AST:", JSON.stringify({
  status: report.status,
  candidateFiles: report.scannedCandidates,
  discoveredDocuments: report.discoveredDocuments,
  parsedValid: report.valid,
  unvalidated: report.invalid,
}));
const reasons = results.filter((row) => !row.valid).reduce((acc, row) => {
  const key = row.status || "unknown";
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});
console.log("T011 unvalidated document classes:", JSON.stringify(reasons));
console.log("T011 example unvalidated documents:", JSON.stringify(results.filter((row) => !row.valid).slice(0,8).map((row) => ({ file: row.file, status: row.status, error: row.error }))));
console.log("NOTE: Syntax validity is NOT Shopify Admin schema validation or generated operation type safety.");
