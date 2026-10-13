// End-to-end GraphQL Codegen CLI compatibility using a disposable local
// GraphQL schema and document. No Shopify credentials or external network.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";

const root=process.cwd();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"builder-graphql-codegen-ci-"));
try {
  const schema=path.join(temp,"schema.graphql");
  const docs=path.join(temp,"query.graphql");
  const out=path.join(temp,"generated.ts");
  const config=path.join(temp,"codegen.yml");
  fs.writeFileSync(schema,"type Query { hello: String! }\n");
  fs.writeFileSync(docs,"query TestLocalCodegen { hello }\n");
  // Unix-friendly temporary paths are deliberate: this is Linux CI only.
  fs.writeFileSync(config,
    "schema: "+JSON.stringify(schema)+"\n"+
    "documents: "+JSON.stringify(docs)+"\n"+
    "generates:\n  "+JSON.stringify(out)+":\n    plugins:\n      - typescript\n");
  const cli=path.join(root,"node_modules",".bin","graphql-codegen");
  assert(fs.existsSync(cli),"GraphQL Codegen CLI missing from audited dev dependency graph");
  const result=spawnSync(cli,["--config",config],{
    cwd:root,
    env:{
      ...process.env,
      // CI has no genuine Shopify identity and must not access remote schemas.
      SHOPIFY_API_KEY:"0123456789abcdef0123456789abcdef",
      SHOPIFY_API_SECRET:"synthetic-no-remote-graphql",
    },
    encoding:"utf8",
    timeout:45_000,
  });
  assert.equal(result.status,0,
    "Local GraphQL codegen CLI failed: "+String(result.stderr||result.stdout).slice(-2500));
  const generated=fs.readFileSync(out,"utf8");
  assert.match(generated,/export type Query/);
  assert.match(generated,/hello/);
  console.log("PASS local GraphQL Codegen CLI produced valid TypeScript from fixture schema (no Shopify API).");
}finally {
  fs.rmSync(temp,{recursive:true,force:true});
}
