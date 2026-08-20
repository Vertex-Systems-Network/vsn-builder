import fs from 'node:fs';
import path from 'node:path';
import { buildEcosystemManifest } from './lib/ecosystem-manifest.mjs';
const root=process.cwd();
const manifest=await buildEcosystemManifest(root);
const text=JSON.stringify(manifest,null,2)+'\n';
for(const relative of ['app/config/ecosystem-manifest.json','docs/generated/ecosystem-manifest.json']){
  const file=path.join(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);
}
console.log(`VSN ecosystem manifest generated for ${manifest.version}: ${manifest.counts.widgets} widgets, ${manifest.counts.motionBuiltins} motion presets, ${manifest.counts.emailBlocks} email blocks.`);
