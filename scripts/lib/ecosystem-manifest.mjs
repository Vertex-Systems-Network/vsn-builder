import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function walk(dir, predicate=()=>true) {
  if (!fs.existsSync(dir)) return [];
  const rows=[];
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) rows.push(...walk(full,predicate));
    else if(predicate(full)) rows.push(full);
  }
  return rows;
}

export async function buildEcosystemManifest(root=process.cwd()) {
  const load = async (relative) => import(`${pathToFileURL(path.join(root,relative)).href}?vsn=${Date.now()}-${Math.random()}`);
  const [{widgetRegistry},{ANIMATE_CSS_PRESET_COUNT,GENERATED_VSN_PRESET_COUNT},{REFERENCE_LIBRARY_COUNT,REFERENCE_MOTION_CANDIDATE_COUNT},{builtinMotionPresets,builtinMotionDuplicateReport},{EMAIL_BLOCK_CATALOG},{VSN_WIDGET_FIELD_TYPES},{BUILDER_SYSTEM_DEFINITIONS,BUILDER_RESOURCE_DEFINITIONS},{VSN_BASELINE}] = await Promise.all([
    load('app/builder/widgetRegistry.js'),
    load('app/data/motion-preset-catalog.js'),
    load('app/data/motion-reference-catalog.js'),
    load('app/services/motion-library.server.js'),
    load('app/email/emailSchema.js'),
    load('app/config/widget-field-types.js'),
    load('app/utils/builder-permissions.js'),
    load('app/config/baseline.js'),
  ]);
  const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const migrationDirs=fs.existsSync(path.join(root,'prisma/migrations')) ? fs.readdirSync(path.join(root,'prisma/migrations'),{withFileTypes:true}).filter((entry)=>entry.isDirectory()).map((entry)=>entry.name).sort() : [];
  const routeFiles=walk(path.join(root,'app/routes'),(file)=>/\.[jt]sx?$/.test(file));
  const userDocs=walk(path.join(root,'docs/user'),(file)=>file.endsWith('.md'));
  const developerDocs=walk(path.join(root,'docs/developer'),(file)=>file.endsWith('.md'));
  const engineeringDocs=walk(path.join(root,'docs/engineering'),(file)=>file.endsWith('.md'));
  const permissionActionCount=BUILDER_RESOURCE_DEFINITIONS.reduce((sum,row)=>sum+row.actions.length,0);
  const motionBuiltins=builtinMotionPresets();
  const referenceMotionPresets=motionBuiltins.filter((row)=>row.tokens?.referenceOnly);
  const motionReferenceSources=[...new Set(referenceMotionPresets.map((row)=>row.source).filter(Boolean))];
  return {
    generatedAt:new Date().toISOString(),
    version:packageJson.version,
    milestone:VSN_BASELINE.milestone,
    baselineName:VSN_BASELINE.name,
    schema:{...VSN_BASELINE.schema},
    counts:{
      widgets:Object.keys(widgetRegistry).length,
      motionBuiltins:motionBuiltins.length,
      motionReferenceLibraries:REFERENCE_LIBRARY_COUNT,
      motionReferenceCandidates:REFERENCE_MOTION_CANDIDATE_COUNT,
      motionReferencePresets:referenceMotionPresets.length,
      motionDuplicatesRemoved:builtinMotionDuplicateReport().length,
      animateCssPresets:ANIMATE_CSS_PRESET_COUNT,
      generatedVsnPresets:GENERATED_VSN_PRESET_COUNT,
      emailBlocks:EMAIL_BLOCK_CATALOG.length,
      customWidgetFieldTypes:VSN_WIDGET_FIELD_TYPES.length,
      systems:BUILDER_SYSTEM_DEFINITIONS.length,
      permissionResources:BUILDER_RESOURCE_DEFINITIONS.length,
      permissionActions:permissionActionCount,
      migrations:migrationDirs.length,
      routeModules:routeFiles.length,
      userDocs:userDocs.length,
      developerDocs:developerDocs.length,
      engineeringDocs:engineeringDocs.length,
    },
    migrations:{latest:migrationDirs.at(-1)||null,all:migrationDirs},
    documentation:{
      user:userDocs.map((file)=>path.relative(root,file).replaceAll('\\','/')).sort(),
      developer:developerDocs.map((file)=>path.relative(root,file).replaceAll('\\','/')).sort(),
      engineering:engineeringDocs.map((file)=>path.relative(root,file).replaceAll('\\','/')).sort(),
    },
    systems:BUILDER_SYSTEM_DEFINITIONS.map(({key,label,group,ownerOnly=false})=>({key,label,group,ownerOnly})),
    permissions:BUILDER_RESOURCE_DEFINITIONS.map((row)=>({key:row.key,label:row.label,group:row.group,actions:row.actions.map((action)=>action.key)})),
    emailBlocks:EMAIL_BLOCK_CATALOG.map((row)=>row.type),
    customWidgetFieldTypes:VSN_WIDGET_FIELD_TYPES.map((row)=>row.id),
    motionReferenceSources,
  };
}

export function stableManifest(value) {
  const copy=structuredClone(value);
  delete copy.generatedAt;
  return JSON.stringify(copy,null,2);
}
