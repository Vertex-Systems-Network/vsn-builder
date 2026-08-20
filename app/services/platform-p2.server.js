import crypto from 'node:crypto';
import { migrateBuilderContent, readDocumentSchemaVersion } from '../builder/schemaMigrations.js';
import { ensureBuiltinSdkPlugins } from '../sdk/builtinPlugins.js';
import { listVsnPlugins } from '../sdk/registry.js';
import { VSN_PLUGIN_ALLOWED_PERMISSIONS } from '../sdk/security.js';
import { validatePluginManifest } from '../sdk/validation.js';
import { listRecentBuilderCommands } from './command-bus.server.js';

function parseJson(value,fallback={}){try{return JSON.parse(String(value||''));}catch{return fallback;}}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter((key)=>!['updatedAt','createdAt'].includes(key)).map((key)=>[key,stable(value[key])]));return value;}
function hash(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,16);}
function walk(value,visit,key=''){if(value==null)return;visit(value,key);if(Array.isArray(value)){value.forEach((item)=>walk(item,visit,key));return;}if(value&&typeof value==='object')Object.entries(value).forEach(([childKey,child])=>walk(child,visit,childKey));}
function pageMetrics(content){
  const stats={nodes:0,mediaRefs:0,dynamicBindings:0,customCodeBytes:0,externalOrigins:new Set(),contentBytes:Buffer.byteLength(JSON.stringify(content||[]),'utf8')};
  walk(content,(value,key)=>{
    if(value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.type==='string')stats.nodes++;
    if(typeof value==='string'){
      if(/(?:image|video|media|src|url)/i.test(key)&&/^(?:https?:|shopify:|gid:)/.test(value))stats.mediaRefs++;
      if(/(?:customcss|customjs|code|html)/i.test(key))stats.customCodeBytes+=Buffer.byteLength(value,'utf8');
      if(/^https?:\/\//.test(value)){try{stats.externalOrigins.add(new URL(value).origin);}catch{}}
    }
    if(/dynamicSource|binding/i.test(key)&&value&&typeof value==='object'&&value.enabled!==false)stats.dynamicBindings++;
  });
  const limits={nodes:[800,1200],contentBytes:[400*1024,700*1024],mediaRefs:[80,140],customCodeBytes:[60*1024,120*1024],externalOrigins:[12,20]};
  const current={...stats,externalOrigins:stats.externalOrigins.size}; const issues=[]; let status='pass';
  for(const [metric,[warn,fail]] of Object.entries(limits)){const value=current[metric];if(value>=fail){status='fail';issues.push({metric,severity:'fail',value,limit:fail});}else if(value>=warn){if(status==='pass')status='warn';issues.push({metric,severity:'warn',value,limit:warn});}}
  const score=Math.max(0,100-(issues.filter(x=>x.severity==='warn').length*8)-(issues.filter(x=>x.severity==='fail').length*22));
  return {...current,status,score,issues};
}
function structuralSummary(content){const types={};let nodes=0;walk(content,(value)=>{if(value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.type==='string'){nodes++;types[value.type]=(types[value.type]||0)+1;}});return{hash:hash(content),nodes,types};}

async function readP2Settings(db,shop){const row=await db.builderShopSetting.findUnique({where:{shop},select:{appSettingsJson:true}}).catch(()=>null);return parseJson(row?.appSettingsJson,{});}
async function writeP2Settings(db,shop,patch){const current=await readP2Settings(db,shop);const next={...current,platformP2:{...(current.platformP2||{}),...patch}};await db.builderShopSetting.upsert({where:{shop},create:{shop,appSettingsJson:JSON.stringify(next)},update:{appSettingsJson:JSON.stringify(next)}});return next.platformP2;}

export async function buildVisualRegressionReport(db,shop){
  const pages=await db.builderPage.findMany({where:{shop,deletedAt:null},select:{id:true,title:true,handle:true,contentJson:true,updatedAt:true},orderBy:{updatedAt:'desc'}});
  const settings=await readP2Settings(db,shop);const baselines=settings.platformP2?.visualBaselines||{};
  const rows=pages.map((page)=>{const content=parseJson(page.contentJson,[]);const current=structuralSummary(content);const baseline=baselines[page.id]||null;return{id:page.id,title:page.title,handle:page.handle,current,baseline,status:!baseline?'missing':baseline.hash===current.hash?'pass':'changed'};});
  return {rows,counts:{total:rows.length,pass:rows.filter(r=>r.status==='pass').length,changed:rows.filter(r=>r.status==='changed').length,missing:rows.filter(r=>r.status==='missing').length},browserRunner:{script:'npm run qa:visual-regression',requires:['VSN_E2E_EDITOR_URL','VSN_E2E_PAGE_ID'],viewports:['desktop','tablet','mobile']}};
}
export async function captureVisualBaselines(db,shop){
  const pages=await db.builderPage.findMany({where:{shop,deletedAt:null},select:{id:true,title:true,contentJson:true}});const visualBaselines={};
  for(const page of pages)visualBaselines[page.id]={...structuralSummary(parseJson(page.contentJson,[])),title:page.title,capturedAt:new Date().toISOString()};
  await writeP2Settings(db,shop,{visualBaselines});return{count:Object.keys(visualBaselines).length,visualBaselines};
}
export async function buildPerformanceBudgetReport(db,shop){
  const pages=await db.builderPage.findMany({where:{shop,deletedAt:null},select:{id:true,title:true,handle:true,contentJson:true,status:true},orderBy:{updatedAt:'desc'}});
  const rows=pages.map((page)=>({id:page.id,title:page.title,handle:page.handle,pageStatus:page.status,...pageMetrics(parseJson(page.contentJson,[]))}));
  return {rows,counts:{total:rows.length,pass:rows.filter(r=>r.status==='pass').length,warn:rows.filter(r=>r.status==='warn').length,fail:rows.filter(r=>r.status==='fail').length},budgets:{nodes:{warn:800,fail:1200},contentKB:{warn:400,fail:700},mediaRefs:{warn:80,fail:140},customCodeKB:{warn:60,fail:120},externalOrigins:{warn:12,fail:20}}};
}
function permissionRisk(permission){if(permission==='network:external'||permission==='storefront:render')return'high';if(permission.startsWith('data:shopify.'))return'medium';return'low';}
export function evaluateExtensionManifest(input){
  const checked=validatePluginManifest(input||{});const permissions=Array.isArray(input?.permissions)?input.permissions:[];
  return {...checked,risk:{level:permissions.some(p=>permissionRisk(p)==='high')?'high':permissions.some(p=>permissionRisk(p)==='medium')?'medium':'low',permissions:permissions.map((permission)=>({permission,risk:permissionRisk(permission),allowed:VSN_PLUGIN_ALLOWED_PERMISSIONS.includes(permission)})),networkOrigins:Array.isArray(input?.networkOrigins)?input.networkOrigins:[]}};
}
export function buildExtensionPermissionSandbox(){ensureBuiltinSdkPlugins();const plugins=listVsnPlugins();return{allowedPermissions:[...VSN_PLUGIN_ALLOWED_PERMISSIONS],plugins:plugins.map((row)=>({id:row.manifest?.id,name:row.manifest?.name,status:row.status,permissions:(row.manifest?.permissions||[]).map((permission)=>({permission,risk:permissionRisk(permission)})),networkOrigins:row.manifest?.networkOrigins||[],widgets:row.widgets?.length||0,dataProviders:row.dataProviders?.length||0,warnings:row.warnings||[]}))};}
export async function simulateReleaseMigrations(db,shop){
  const [pages,library]=await Promise.all([db.builderPage.findMany({where:{shop,deletedAt:null},select:{id:true,title:true,contentJson:true}}),db.builderLibraryItem.findMany({where:{shop,deletedAt:null},select:{id:true,title:true,contentJson:true,kind:true}})]);
  const inputs=[...pages.map(x=>({...x,resourceType:'page'})),...library.map(x=>({...x,resourceType:'library'}))];const rows=[];
  for(const row of inputs){try{const before=parseJson(row.contentJson,[]);const beforeVersion=readDocumentSchemaVersion(before);const migrated=migrateBuilderContent(before);rows.push({id:row.id,title:row.title,type:row.resourceType,beforeVersion,afterVersion:readDocumentSchemaVersion(migrated),changed:hash(before)!==hash(migrated),status:'pass'});}catch(error){rows.push({id:row.id,title:row.title,type:row.resourceType,status:'fail',error:error instanceof Error?error.message:String(error)});}}
  return {dryRun:true,rows,counts:{total:rows.length,pass:rows.filter(r=>r.status==='pass').length,fail:rows.filter(r=>r.status==='fail').length,changed:rows.filter(r=>r.changed).length}};
}
export async function loadPlatformP2(db,shop){const [visual,performance,commands]=await Promise.all([buildVisualRegressionReport(db,shop),buildPerformanceBudgetReport(db,shop),listRecentBuilderCommands(db,shop,30)]);return{visual,performance,extensions:buildExtensionPermissionSandbox(),commands};}
