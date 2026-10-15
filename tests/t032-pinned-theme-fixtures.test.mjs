import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,cpSync,rmSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {inspectPinnedThemeFixtures,inspectPlacementSection} from "../scripts/t032-pinned-theme-fixtures.mjs";

test("pinned official Dawn and Horizon source sections prove different app-block placement rules",()=>{
 const result=inspectPinnedThemeFixtures();
 assert.deepEqual(result.errors,[]);
 assert.deepEqual(result.verifiedOpenSourceFixtures,["Dawn","Horizon"]);
 assert.deepEqual(result.unverifiedTargets,["Prestige","Impulse","Custom"]);
 assert.equal(result.fullSupportedMatrixVerified,false);
 assert.equal(result.hostedCompatibilityVerified,false);
 assert.equal(result.rows.length,3);
 const target=(name,filename)=>result.rows.find(x=>x.theme===name&&x.sectionName.endsWith(filename));
 assert.equal(target("Dawn","/apps.liquid").acceptsApp,true);
 assert.equal(target("Dawn","/apps.liquid").rendersApp,true);
 assert.equal(target("Dawn","/main-page.liquid").acceptsApp,false);
 assert.equal(target("Horizon","/main-page.liquid").acceptsApp,true);
 assert.equal(target("Horizon","/main-page.liquid").rendersApp,true);
 assert.equal(new Set(result.rows.map(x=>x.upstreamCommit)).size,2);
});

test("schema @app alone cannot falsely certify real placement when Liquid fails to render",()=>{
 const pretend='{% schema %}'+JSON.stringify({name:"Fake",blocks:[{type:"@app"}]})+'{% endschema %}';
 const check=inspectPlacementSection("fake.liquid",pretend);
 assert.equal(check.acceptsApp,true);
 assert.equal(check.rendersApp,false);
 assert(check.errors.some(x=>x.includes("without rendering")));
 assert.deepEqual(inspectPlacementSection("invalid.liquid","{% schema %}INVALID{% endschema %}").errors,
  ["Invalid Shopify section schema"]);
 assert(inspectPlacementSection("missing.liquid","<div>no schema</div>").errors.length);
});

test("Dawn apps section fixture cannot be swapped with unsupported main-page template",()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),"vsn-t032-fixture-"));
 try{
  const original=path.resolve("tests/fixtures/theme-compat");
  const clone=path.join(root,"tests/fixtures/theme-compat");
  cpSync(original,clone,{recursive:true});
  for(const file of [
   "extensions/vsn-page-builder-theme/blocks/page-builder.liquid",
   "extensions/vsn-page-builder-theme/blocks/native-vsn-section.liquid",
  ]){
    const output=path.join(root,file);
    mkdirSync(path.dirname(output),{recursive:true});
    writeFileSync(output,readFileSync(file));
  }
  const source=path.join(clone,"dawn/sections/apps.liquid");
  writeFileSync(source,readFileSync(path.join(clone,"dawn/sections/main-page.liquid")));
  const result=inspectPinnedThemeFixtures({root});
  assert(result.errors.some(x=>x.includes("Dawn/apps.liquid")||x.includes("Dawn placement")));
  assert.equal(result.verifiedOpenSourceFixtures.length,0);
 }finally{rmSync(root,{recursive:true,force:true})}
});

test("unverified proprietary or Custom themes cannot be promoted to supported without fixtures",()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),"vsn-t032-false-"));
 try{
  const files=path.join(root,"tests/fixtures/theme-compat");
  cpSync("tests/fixtures/theme-compat",files,{recursive:true});
  for(const file of [
   "extensions/vsn-page-builder-theme/blocks/page-builder.liquid",
   "extensions/vsn-page-builder-theme/blocks/native-vsn-section.liquid",
  ]){
   const out=path.join(root,file);
   mkdirSync(path.dirname(out),{recursive:true});
   writeFileSync(out,readFileSync(file));
  }
  const m=path.join(files,"manifest.json");
  const j=JSON.parse(readFileSync(m,"utf8"));
  j.unverifiedTargets=[];
  j.hostedCompatibilityVerified=true;
  writeFileSync(m,JSON.stringify(j));
  const result=inspectPinnedThemeFixtures({root});
  assert(result.errors.some(x=>x.includes("Offline fixtures cannot certify hosted")));
  assert(result.errors.some(x=>x.includes("remain explicitly pending")));
 }finally{rmSync(root,{recursive:true,force:true})}
});
