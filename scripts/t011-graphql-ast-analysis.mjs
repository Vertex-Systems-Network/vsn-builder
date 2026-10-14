import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
let parse;
let parserAvailable=true;
try { ({ parse }=require("graphql")); }
catch { parserAvailable=false; }
if (!parserAvailable) {
  const inventory=JSON.parse(readFileSync("t011-graphql-operation-inventory.json","utf8"));
  const report={
    status:"blocked-parser-unavailable",
    scannedCandidates:inventory.candidateFiles,
    parsedDocuments:0,
    valid:0,
    invalid:0,
    results:[],
    reason:"graphql parser is absent from the audited dependency tree; no GraphQL document has been syntax-validated",
  };
  writeFileSync("t011-graphql-ast-report.json",JSON.stringify(report,null,2)+"\\n");
  console.log("T011 GraphQL AST analyzer blocked: parser unavailable; report generated without false validation claims.");
  process.exit(0);
}
const inventory=JSON.parse(readFileSync("t011-graphql-operation-inventory.json","utf8"));
const results=[];
for(const row of inventory.entries){
  const text=readFileSync(row.file,"utf8");
  if(row.kind==="document-file"){
    try {const ast=parse(text);results.push({file:row.file,type:"document-file",definitions:ast.definitions.map(d=>d.kind),valid:true});}
    catch(e){results.push({file:row.file,type:"document-file",valid:false,error:String(e.message)});}
    continue;
  }
  const kind=row.file.endsWith(".tsx")?ts.ScriptKind.TSX:row.file.endsWith(".jsx")?ts.ScriptKind.JSX:row.file.endsWith(".ts")?ts.ScriptKind.TS:ts.ScriptKind.JS;
  const ast=ts.createSourceFile(row.file,text,ts.ScriptTarget.Latest,true,kind);
  function walk(node){
    if(ts.isTaggedTemplateExpression(node)&&/^(gql|graphql)$/.test(node.tag.getText(ast))){
      const template=node.template;
      const hasInterpolation=!ts.isNoSubstitutionTemplateLiteral(template);
      if(hasInterpolation){results.push({file:row.file,type:"tagged",valid:false,reason:"dynamic-interpolation"});}
      else{
        try{const parsed=parse(template.text);results.push({file:row.file,type:"tagged",valid:true,definitions:parsed.definitions.map(d=>({kind:d.kind,name:d.name?.value||null}))});}
        catch(e){results.push({file:row.file,type:"tagged",valid:false,error:String(e.message)});}
      }
    }
    ts.forEachChild(node,walk);
  }
  walk(ast);
}
const report={scannedCandidates:inventory.candidateFiles,parsedDocuments:results.length,valid:results.filter(x=>x.valid).length,invalid:results.filter(x=>!x.valid).length,results};
writeFileSync("t011-graphql-ast-report.json",JSON.stringify(report,null,2)+"\n");
console.log("T011 GraphQL AST analysis:",JSON.stringify({scannedCandidates:report.scannedCandidates,parsedDocuments:report.parsedDocuments,valid:report.valid,invalid:report.invalid}));
console.log("NOTE: Parsed GraphQL documents do not imply schema-validated, generated operation TypeScript types.");
