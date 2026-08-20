import { scanLibraryDependencies } from '../utils/library-transfer.js';
import { normalizeDesignTokenDocument, serializeDesignTokenDocument } from '../builder/designTokens2.js';

function parseJson(value, fallback = null) {
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

function unique(values = []) { return [...new Set(values.filter(Boolean).map(String))]; }

function inspectNodeSignals(content) {
  const bindings = new Set();
  const conditions = new Set();
  const motions = new Set();
  const visit = (value, key = '') => {
    if (value == null) return;
    if (Array.isArray(value)) { value.forEach((entry) => visit(entry, key)); return; }
    if (typeof value !== 'object') {
      if (/motionpresetid/i.test(key) && String(value).trim()) motions.add(String(value).trim());
      return;
    }
    if (value.dynamicSource?.enabled && value.dynamicSource?.source) bindings.add(String(value.dynamicSource.source));
    if (value.bindings && typeof value.bindings === 'object') {
      Object.values(value.bindings).forEach((binding) => { if (binding?.enabled && binding?.source) bindings.add(String(binding.source)); });
    }
    const groups = value.conditions?.groups || [];
    groups.forEach((group) => (group.rules || []).forEach((rule) => { if (rule?.rule) conditions.add(String(rule.rule)); }));
    if (value.conditions?.enabled && value.conditions?.rule) conditions.add(String(value.conditions.rule));
    Object.entries(value).forEach(([childKey, childValue]) => visit(childValue, childKey));
  };
  visit(content);
  return { bindings: unique([...bindings]), conditions: unique([...conditions]), motions: unique([...motions]) };
}

function addUsage(map, resource, usage) {
  if (!resource?.id || !usage?.id) return;
  if (!map.has(resource.id)) map.set(resource.id, { ...resource, usedBy: [] });
  const row = map.get(resource.id);
  if (!row.usedBy.some((item) => item.id === usage.id)) row.usedBy.push(usage);
}

function resourceId(type, key) { return `${type}:${String(key)}`; }

export async function buildUsageGraph(db, shop) {
  const [pages, library, fonts, svgAssets, motionPresets, brandKits, emails, customWidgets, experiments, globalCode] = await Promise.all([
    db.builderPage.findMany({ where:{shop,deletedAt:null}, select:{id:true,title:true,template:true,contentJson:true,status:true}, orderBy:{updatedAt:'desc'} }),
    db.builderLibraryItem.findMany({ where:{shop,deletedAt:null}, select:{id:true,title:true,kind:true,contentJson:true}, orderBy:{updatedAt:'desc'} }),
    db.builderCustomFont.findMany({ where:{shop,deletedAt:null}, select:{id:true,family:true,weight:true,style:true} }),
    db.builderSvgAsset.findMany({ where:{shop,deletedAt:null}, select:{id:true,name:true,fileName:true} }),
    db.builderMotionPreset.findMany({ where:{shop,deletedAt:null}, select:{id:true,name:true,category:true} }),
    db.builderBrandKit.findMany({ where:{shop,deletedAt:null}, select:{id:true,name:true,isDefault:true} }),
    db.builderEmailTemplate.findMany({ where:{shop,deletedAt:null}, select:{id:true,name:true,documentJson:true,status:true} }),
    db.builderCustomWidget.findMany({ where:{shop,deletedAt:null}, select:{id:true,widgetKey:true,name:true,enabled:true} }),
    db.builderExperiment.findMany({ where:{shop}, select:{id:true,name:true,pageId:true,targetNodeId:true,status:true} }),
    db.builderGlobalCode.findMany({ where:{shop,deletedAt:null}, select:{id:true,name:true,kind:true,scope:true,target:true,code:true,enabled:true} }),
  ]);

  const graph = new Map();
  const sources = [
    ...pages.map((row)=>({ id:`page:${row.id}`, type:'page', label:row.title, subtitle:row.template, content:parseJson(row.contentJson,[]) })),
    ...library.map((row)=>({ id:`library:${row.id}`, type:'library', label:row.title, subtitle:row.kind, content:parseJson(row.contentJson,[]) })),
  ];

  for (const source of sources) {
    const deps = scanLibraryDependencies(source.content || []);
    const signals = inspectNodeSignals(source.content || []);
    for (const widget of deps.widgets) addUsage(graph,{id:resourceId('widget',widget),type:'widget',label:widget},{id:source.id,type:source.type,label:source.label});
    for (const component of deps.components) addUsage(graph,{id:resourceId('component',component),type:'component',label:component},{id:source.id,type:source.type,label:source.label});
    for (const ref of deps.libraryRefs) addUsage(graph,{id:resourceId('library-ref',ref),type:'library-ref',label:ref},{id:source.id,type:source.type,label:source.label});
    for (const font of deps.fonts) addUsage(graph,{id:resourceId('font-family',font),type:'font',label:font},{id:source.id,type:source.type,label:source.label});
    for (const svg of deps.svgAssets) addUsage(graph,{id:resourceId('svg',svg),type:'svg',label:svg},{id:source.id,type:source.type,label:source.label});
    for (const query of deps.queries) addUsage(graph,{id:resourceId('query',query),type:'query',label:query},{id:source.id,type:source.type,label:source.label});
    for (const binding of signals.bindings) addUsage(graph,{id:resourceId('binding',binding),type:'binding',label:binding},{id:source.id,type:source.type,label:source.label});
    for (const condition of signals.conditions) addUsage(graph,{id:resourceId('condition',condition),type:'condition',label:condition},{id:source.id,type:source.type,label:source.label});
    for (const motion of signals.motions) addUsage(graph,{id:resourceId('motion',motion),type:'motion',label:motion},{id:source.id,type:source.type,label:source.label});
  }

  for (const font of fonts) {
    const id = resourceId('font-family',font.family);
    if (!graph.has(id)) graph.set(id,{id,type:'font',label:font.family,usedBy:[]});
  }
  for (const asset of svgAssets) {
    const id = resourceId('svg',asset.id);
    if (!graph.has(id)) graph.set(id,{id,type:'svg',label:asset.name || asset.fileName,usedBy:[]});
  }
  for (const preset of motionPresets) {
    const id = resourceId('motion',preset.id);
    if (!graph.has(id)) graph.set(id,{id,type:'motion',label:preset.name,subtitle:preset.category,usedBy:[]});
  }
  for (const widget of customWidgets) {
    const id = resourceId('widget',widget.widgetKey);
    if (!graph.has(id)) graph.set(id,{id,type:'widget',label:widget.name,subtitle:'Custom widget',usedBy:[]});
  }
  for (const kit of brandKits) {
    const id = resourceId('brand-kit',kit.id);
    if (!graph.has(id)) graph.set(id,{id,type:'brand-kit',label:kit.name,subtitle:kit.isDefault?'Default':'Brand kit',usedBy:[]});
  }
  for (const email of emails) {
    const content = String(email.documentJson || '');
    const matches = [...content.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)].map((match)=>match[1]);
    for (const token of unique(matches)) addUsage(graph,{id:resourceId('email-binding',token),type:'email-binding',label:token},{id:`email:${email.id}`,type:'email',label:email.name});
  }
  for (const experiment of experiments) addUsage(graph,{id:resourceId('page',experiment.pageId),type:'page-ref',label:experiment.pageId},{id:`experiment:${experiment.id}`,type:'experiment',label:experiment.name});
  for (const code of globalCode) {
    const target = String(code.target || '').trim();
    if (target) addUsage(graph,{id:resourceId('global-code-target',target),type:'global-code-target',label:target},{id:`code:${code.id}`,type:'global-code',label:code.name});
  }

  const resources = [...graph.values()].map((row)=>({ ...row, usageCount:row.usedBy.length })).sort((a,b)=>b.usageCount-a.usageCount || a.type.localeCompare(b.type) || a.label.localeCompare(b.label));
  const types = {};
  for (const row of resources) types[row.type] = (types[row.type] || 0) + 1;
  return {
    resources,
    types,
    stats:{ resources:resources.length, used:resources.filter((row)=>row.usageCount>0).length, unused:resources.filter((row)=>row.usageCount===0).length, pages:pages.length, library:library.length, emails:emails.length },
  };
}

export async function loadPlatformIntelligence(db, shop) {
  const [graph, setting] = await Promise.all([
    buildUsageGraph(db, shop),
    db.builderShopSetting.findUnique({ where:{shop}, select:{designTokensJson:true} }).catch(()=>null),
  ]);
  return { graph, tokenSystem:normalizeDesignTokenDocument(parseJson(setting?.designTokensJson,{})) };
}

export async function savePlatformTokenSystem(db, shop, document) {
  const serialized = serializeDesignTokenDocument(document);
  const text = JSON.stringify(serialized);
  if (text.length > 100000) throw new Error('Design token document is too large.');
  await db.builderShopSetting.upsert({ where:{shop}, create:{shop,designTokensJson:text}, update:{designTokensJson:text} });
  return normalizeDesignTokenDocument(serialized);
}
