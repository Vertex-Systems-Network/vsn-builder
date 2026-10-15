// T032 static theme-app extension contract: no Shopify/theme-store calls.
// This proves schema and local asset consistency, NOT live theme compatibility.
import {readdirSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

const BLOCK_DIR="extensions/vsn-page-builder-theme/blocks";
const ASSET_DIR="extensions/vsn-page-builder-theme/assets";
const ALLOWED_TARGETS=new Set(["section","body","head"]);
const ASSET_URL=/'([^']+\.(?:css|js|png|jpg|jpeg|svg|webp))'\s*\|\s*asset_url/g;
export function inspectBlock(name,source,assets){
 const errors=[];
 const blocks=[...source.matchAll(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/g)];
 if(blocks.length!==1)return {name,errors:["Expected exactly one Liquid schema"]};
 let schema;
 try{schema=JSON.parse(blocks[0][1])}
 catch{return {name,errors:["Invalid Liquid schema JSON"]}}
 if(typeof schema.name!=="string"||!schema.name.trim()||schema.name.length>25)
  errors.push("Invalid Shopify block schema name");
 if(!ALLOWED_TARGETS.has(schema.target))errors.push("Unsupported app block/embed target");
 if(!Array.isArray(schema.settings))errors.push("Missing settings array");
 const settings=Array.isArray(schema.settings)?schema.settings:[];
 const ids=new Set();
 for(const setting of settings){
  if(!setting||typeof setting.type!=="string"){
   errors.push("Invalid setting type");continue;
  }
  if(setting.type==="header"||setting.type==="paragraph")continue;
  if(typeof setting.id!=="string"||!setting.id||setting.id.length>50)
   errors.push("Missing/invalid setting ID");
  else if(ids.has(setting.id))errors.push("Duplicate setting ID "+setting.id);
  else ids.add(setting.id);
  if(setting.type==="range"){
   const {min,max,step,default:initial}=setting;
   if(![min,max,step,initial].every(Number.isFinite) || min>=max ||
      step<=0||initial<min||initial>max)
    errors.push("Invalid range setting "+setting.id);
  }
 }
 const dependencies=[schema.stylesheet,schema.javascript,
  ...[...source.matchAll(ASSET_URL)].map(match=>match[1])]
  .filter(Boolean);
 for(const dependency of new Set(dependencies)){
  if(dependency.includes("/")||dependency.includes("\\")||!assets.has(dependency))
   errors.push("Missing/unsafe asset "+dependency);
 }
 if(schema.available_if!==undefined &&
    (typeof schema.available_if!=="string"||!schema.available_if.includes("app.metafields.")))
  errors.push("Unverified conditional availability binding");
 return {name,errors,assets:[...new Set(dependencies)],target:schema.target,settingCount:settings.length};
}
export function inspectThemeExtension({root="."}={}){
 const dir=join(root,BLOCK_DIR);
 const assets=new Set(readdirSync(join(root,ASSET_DIR)));
 const blocks=readdirSync(dir).filter(name=>name.endsWith(".liquid")).sort();
 const inspected=blocks.map(name=>inspectBlock(name,readFileSync(join(dir,name),"utf8"),assets));
 const failures=inspected.flatMap(x=>x.errors.map(error=>x.name+": "+error));
 if(blocks.length<20)failures.push("Expected at least 20 native/page theme extension blocks");
 for(const name of ["page-builder.liquid","native-vsn-section.liquid","vsn-page-renderer.liquid"])
  if(!blocks.includes(name))failures.push("Missing central app block "+name);
 const targets=JSON.parse(readFileSync(join(root,"config/theme-matrix.json"),"utf8")).targets;
 if(!Array.isArray(targets)||targets.length<5 ||
    !["Dawn","Horizon","Prestige","Impulse","Custom"].every(name=>targets.some(t=>t.name===name)))
  failures.push("Missing supported-theme QA target declarations");
 return {blocks:blocks.length,assets:assets.size,inspected,failures,
  // Target definitions are NOT downloaded theme fixtures or real-store tests.
  fixtureThemesVerified:false,hostedThemeCompatibilityVerified:false};
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
 const result=inspectThemeExtension();
 for(const reason of result.failures)console.error("::error::T032 "+reason);
 if(result.failures.length)process.exitCode=1;
 else console.log("T032 static blocks/assets schemas PASS: "+result.blocks+" blocks, "+result.assets+" assets; live-theme acceptance NOT certified.");
}
