// T032: real, pinned Shopify Dawn/Horizon section fixture compatibility.
// Offline only: verifies legal section app-block placement and actual Liquid
// block rendering. Does NOT certify Shopify-hosted theme/editor behavior.
import {readFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const FIXTURES="tests/fixtures/theme-compat";
const APP_BLOCK="extensions/vsn-page-builder-theme/blocks/page-builder.liquid";
const SECTION_BLOCK="extensions/vsn-page-builder-theme/blocks/native-vsn-section.liquid";

export function inspectPlacementSection(sectionName,source){
 const errors=[];
 const matches=[...source.matchAll(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/g)];
 if(matches.length!==1)return {sectionName,acceptsApp:false,rendersApp:false,
   errors:["Expected exactly one Shopify section schema"]};
 let schema;
 try{schema=JSON.parse(matches[0][1]);}
 catch{return {sectionName,acceptsApp:false,rendersApp:false,
   errors:["Invalid Shopify section schema"]};}
 const acceptsApp=Array.isArray(schema.blocks)&&schema.blocks.some(b=>b?.type==="@app");
 const rendersApp=/{%-?\s*render\s+block\s*-?%}/.test(source)||
   /{%-?\s*content_for\s+['"]blocks['"]\s*-?%}/.test(source);
 if(acceptsApp&&!rendersApp)errors.push("Schema advertises @app without rendering blocks");
 return {sectionName,acceptsApp,rendersApp,errors};
}

function parseAppBlock(name,source){
 const matches=[...source.matchAll(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/g)];
 if(matches.length!==1)throw new Error("T032 invalid local "+name+" app block schema");
 const schema=JSON.parse(matches[0][1]);
 if(schema.target!=="section")throw new Error("T032 local "+name+" target must be section");
 if(!schema.stylesheet||!schema.javascript)
  throw new Error("T032 local "+name+" must explicitly declare packaged stylesheet and JavaScript");
 return schema;
}

export function inspectPinnedThemeFixtures({root="."}={}){
 const metadata=JSON.parse(readFileSync(join(root,FIXTURES,"manifest.json"),"utf8"));
 const errors=[],rows=[];
 // Verify source-real fixtures against our ACTUAL packaged app block target.
 for(const filename of [APP_BLOCK,SECTION_BLOCK]){
  const name=filename.split("/").at(-1);
  parseAppBlock(name,readFileSync(join(root,filename),"utf8"));
 }
 if(metadata.targets?.length!==2 ||
    !["Dawn","Horizon"].every(name=>metadata.targets.some(t=>t.name===name)))
   errors.push("Missing official Dawn/Horizon open-source pinned theme fixture");
 for(const theme of metadata.targets||[]){
  if(!/^Shopify\/(dawn|horizon)$/.test(theme.repo)||!/^[a-f0-9]{40}$/.test(theme.sha))
   errors.push("Unpinned or untrusted upstream fixture "+theme.name);
  if(!Array.isArray(theme.sections))continue;
  for(const section of theme.sections){
   if(!/^sections\/[a-z-]+\.liquid$/.test(section.path))
    {errors.push("Unsafe or invalid fixture section path");continue;}
   const pathname=join(root,FIXTURES,theme.name.toLowerCase(),section.path);
   let inspected;
   try{inspected=inspectPlacementSection(theme.name+"/"+section.path,
     readFileSync(pathname,"utf8"));}
   catch{errors.push("Missing pinned theme fixture "+theme.name+"/"+section.path);continue;}
   errors.push(...inspected.errors.map(message=>theme.name+"/"+section.path+": "+message));
   if(inspected.acceptsApp!==section.acceptsApp)
    errors.push("App-block placement contract drift "+theme.name+"/"+section.path);
   rows.push({...inspected,theme:theme.name,placement:section.route,
    upstreamCommit:theme.sha});
  }
 }
 const dawnApps=rows.find(r=>r.theme==="Dawn"&&r.sectionName.endsWith("/apps.liquid"));
 const dawnPage=rows.find(r=>r.theme==="Dawn"&&r.sectionName.endsWith("/main-page.liquid"));
 const horizonPage=rows.find(r=>r.theme==="Horizon"&&r.sectionName.endsWith("/main-page.liquid"));
 if(!dawnApps?.acceptsApp||!dawnApps.rendersApp||dawnPage?.acceptsApp)
  errors.push("Dawn placement requires the independent Apps section");
 if(!horizonPage?.acceptsApp||!horizonPage?.rendersApp)
  errors.push("Horizon main-page must render app blocks");
 if(metadata.hostedCompatibilityVerified!==false)
  errors.push("Offline fixtures cannot certify hosted Shopify behavior");
 const outstanding=["Prestige","Impulse","Custom"];
 if(JSON.stringify(metadata.unverifiedTargets)!==JSON.stringify(outstanding))
  errors.push("Unverified proprietary/custom targets must remain explicitly pending");
 return {errors,rows,verifiedOpenSourceFixtures:errors.length===0?["Dawn","Horizon"]:[],
  unverifiedTargets:outstanding,hostedCompatibilityVerified:false,
  fullSupportedMatrixVerified:false};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const result=inspectPinnedThemeFixtures();
 for(const error of result.errors)console.error("::error::T032 "+error);
 console.log("T032 open-source theme fixture sections: "+result.rows.length+
  ", verified candidates: "+result.verifiedOpenSourceFixtures.join(", ")+
  "; premium/custom themes and hosted Shopify E2E NOT certified.");
 if(result.errors.length)process.exitCode=1;
}
