// Actual codegen config and extension glob sanitizer regression.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const project=(await import("../.graphqlrc.js")).default;
assert(project?.projects?.default,"Shopify Admin GraphQL project missing");
const config=project.projects.default;
assert(config.schema||config.schemaExtensions||config.extensions,"Shopify schema/provider missing");
assert(config.documents||config.extensions,"GraphQL documents config missing");
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"builder-codegen-guard-"));
const prior=process.cwd();
try {
  const root=path.join(temp,"extensions");
  fs.mkdirSync(root);
  fs.mkdirSync(path.join(root,"safe-extension"),{recursive:true});
  fs.writeFileSync(path.join(root,"safe-extension","schema.graphql"),"type Query { sample: String }\n");
  fs.mkdirSync(path.join(root,"{".repeat(90)+"bad"),{recursive:true});
  fs.writeFileSync(path.join(root,"{".repeat(90)+"bad","schema.graphql"),"type Query { sample: String }\n");
  fs.mkdirSync(path.join(root,"bad[glob]"),{recursive:true});
  fs.writeFileSync(path.join(root,"bad[glob]","schema.graphql"),"type Query { sample: String }\n");
  fs.mkdirSync(path.join(root,"symlink-schema"),{recursive:true});
  fs.symlinkSync(path.join(root,"safe-extension","schema.graphql"),path.join(root,"symlink-schema","schema.graphql"),"file");
  fs.mkdirSync(path.join(root,"x".repeat(80)),{recursive:true});
  fs.writeFileSync(path.join(root,"x".repeat(80),"schema.graphql"),"type Query { sample: String }\n");
  fs.symlinkSync(path.join(root,"safe-extension"),path.join(root,"aliased-safe"),"dir");
  process.chdir(temp);
  // Cache-bust so getConfig() reads the synthetic isolated extension directory.
  const fixture=(await import("../.graphqlrc.js?ci-extension-globs")).default;
  assert(fixture.projects.default,"Default Shopify project must remain available");
  assert(fixture.projects["safe-extension"],"Valid extension must be included");
  assert(!fixture.projects["bad[glob]"],"Glob syntax in filesystem name must be rejected");
  assert(!fixture.projects["{".repeat(90)+"bad"],"Unbounded brace nesting must be rejected");
  assert(!fixture.projects["symlink-schema"],"Symlink schema files must not be followed");
  assert(!fixture.projects["x".repeat(80)],"Unbounded directory names must be rejected");
  assert(!fixture.projects["aliased-safe"],"Filesystem symlinks must not be followed");
  assert.deepEqual(fixture.projects["safe-extension"].documents,["./extensions/safe-extension/**/*.graphql"]);
  console.log("PASS Shopify GraphQL codegen config and extension glob safety (synthetic fixtures)");
}finally {
  process.chdir(prior);
  fs.rmSync(temp,{recursive:true,force:true});
}
