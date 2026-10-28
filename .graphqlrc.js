// Shopify Admin schema and extension projects. Extension names become
// GraphQL glob paths: reject untrusted filesystem names and symlinks before
// interpolation. Do not rely on glob libraries to escape nested braces.
import fs from "node:fs";
const projects={
  default:{
    schema:"https://shopify.dev/admin-graphql-direct-proxy/2026-10",
    documents:["./app/**/*.{js,jsx,ts,tsx}"],
    extensions:{vsn:{operationTypegen:"scripts/t011-graphql-typegen.mjs"}},
  },
};
const SAFE_NAME=/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
let folders;
try{folders=fs.readdirSync("./extensions",{withFileTypes:true})}
catch(error){if(error?.code!=="ENOENT")throw error;folders=[]}
for(const item of folders){
  if(!item.isDirectory() || !SAFE_NAME.test(item.name))continue;
  const schema="./extensions/"+item.name+"/schema.graphql";
  // lstat (not stat): a symlink to a schema outside the extension is unsafe.
  try{if(!fs.lstatSync(schema).isFile())continue}
  catch(error){if(error?.code==="ENOENT")continue;throw error}
  projects[item.name]={
    schema,
    documents:["./extensions/"+item.name+"/**/*.graphql"],
  };
}
export default {projects};
