import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlite=fs.readFileSync(path.join(root,"prisma/schema.prisma"),"utf8");
const cloud=fs.readFileSync(path.join(root,"prisma/cloud/schema.prisma"),"utf8");
const fails=[];
const assert=(test,label)=>{if(!test)fails.push(label);};
function blocks(text,kind){
  const re=new RegExp("^"+kind+"\\s+(\\w+)\\s*\\{","gm");
  const ret={};let match;
  while((match=re.exec(text))){
    let depth=1,start=re.lastIndex,end=start;
    while(depth&&end<text.length){
      const c=text[end++];
      if(c==="{")depth++;
      if(c==="}")depth--;
    }
    if(depth!==0)throw new Error("Unclosed "+kind+" "+match[1]);
    ret[match[1]]=text.slice(start,end-1).replace(/\r/g,"").trim();
    re.lastIndex=end;
  }
  return ret;
}
assert(/datasource\s+db\s*\{[^}]*provider\s*=\s*"sqlite"/s.test(sqlite),"Local Prisma must use SQLite");
assert(/datasource\s+db\s*\{[^}]*provider\s*=\s*"postgresql"/s.test(cloud),"Hosted schema must use PostgreSQL");
assert(cloud.includes('directUrl = env("DIRECT_URL")'),"Hosted schema must distinguish direct migrations URL");
for(const kind of ["model","enum"]){
  const a=blocks(sqlite,kind),b=blocks(cloud,kind);
  const keys=new Set([...Object.keys(a),...Object.keys(b)]);
  for(const key of keys) assert(a[key]!==undefined&&a[key]===b[key],kind+" "+key+" differs across database schemas");
  console.log(kind+"s="+Object.keys(a).length);
}
if(fails.length){for(const err of fails)console.error("FAIL "+err);process.exitCode=1;}
else console.log("Local SQLite / hosted PostgreSQL shared schema parity PASS; this is not database migration acceptance.");
