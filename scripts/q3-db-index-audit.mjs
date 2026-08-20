import fs from "node:fs";
const schema=fs.readFileSync("prisma/schema.prisma","utf8");
const required={
  BuilderPage:["@@unique([shop, handle])","@@index([shop, deletedAt, updatedAt])"],
  BuilderMotionPreset:["@@index([shop, deletedAt, updatedAt])","@@index([shop, category])"],
  BuilderGlobalCode:["@@index([shop, deletedAt, enabled, priority])","@@index([shop, kind, scope])"],
  BuilderWishlist:["@@unique([shop, customerId])","@@index([shop, updatedAt])"],
  BuilderEmailTemplate:["@@index([shop, deletedAt, updatedAt])","@@index([shop, category, status])"],
};
let failed=0;
for(const [model,indexes] of Object.entries(required)){
  const match=schema.match(new RegExp(`model\\s+${model}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if(!match){console.error(`FAIL ${model} model missing`);failed++;continue;}
  for(const index of indexes){const ok=match[1].includes(index);console.log(`${ok?"PASS":"FAIL"} ${model} ${index}`);if(!ok)failed++;}
}
if(failed)process.exit(1);
console.log(`DB hot-path index audit: PASS (${Object.keys(required).length} models)`);
