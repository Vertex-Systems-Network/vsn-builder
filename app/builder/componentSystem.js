import { acceptsChildren } from './widgetRegistry.js';

export const COMPONENT_SCHEMA_VERSION = 1;

function clone(value) { try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); } }
function slug(value='component'){ return String(value||'component').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'component'; }
function setPath(target, path, value) {
  const parts = String(path||'').split('.').filter(Boolean); if (!parts.length) return target;
  let cursor = target;
  for (let i=0;i<parts.length-1;i++){ const key=parts[i]; if(!cursor[key]||typeof cursor[key]!== 'object') cursor[key]={}; cursor=cursor[key]; }
  cursor[parts[parts.length-1]]=value; return target;
}
function getPath(target,path){ return String(path||'').split('.').filter(Boolean).reduce((acc,key)=>acc==null?undefined:acc[key],target); }
function walk(nodes, visit){ for(const node of Array.isArray(nodes)?nodes:[nodes]){ if(!node||typeof node!=='object')continue; visit(node); walk(node.children||[],visit); } }

const PROP_CANDIDATES = [
  ['text','Text','text'],['heading','Heading','text'],['title','Title','text'],['caption','Caption','text'],['label','Label','text'],
  ['url','URL','url'],['linkUrl','Link URL','url'],['src','Image','image'],['externalUrl','Image URL','image'],['alt','Alt text','text'],
  ['color','Color','color'],['backgroundColor','Background','color'],['showImage','Show image','boolean'],['showTitle','Show title','boolean']
];

export function discoverComponentProps(root){
  const props=[]; const used=new Set();
  walk(root,(node)=>{
    for(const [key,label,type] of PROP_CANDIDATES){
      if(node?.props?.[key]===undefined) continue;
      let name=slug(`${node.label||node.type}-${key}`).replace(/-/g,'_'); let base=name, n=2; while(used.has(name)) name=`${base}_${n++}`; used.add(name);
      props.push({ name, label:`${node.label||node.type} · ${label}`, type, targetNodeId:node.id, path:`props.${key}`, default:clone(node.props[key]) });
    }
  });
  return props.slice(0,40);
}

export function discoverComponentSlots(root){
  const slots=[];
  walk(root,(node)=>{ if(acceptsChildren(node.type)) slots.push({ name:slots.length?'content_'+(slots.length+1):'content', label:slots.length?`Content ${slots.length+1}`:'Content', targetNodeId:node.id }); });
  return slots.slice(0,8);
}

export function createComponentDefinition(root,{name='Component'}={}){
  const master=clone(root);
  return normalizeComponentDefinition({
    schemaVersion:COMPONENT_SCHEMA_VERSION, version:1, name, slug:slug(name), root:master,
    props:discoverComponentProps(master), slots:discoverComponentSlots(master),
    variants:[{id:'default',name:'Default',propValues:{},rootPatch:{}}], updatedAt:new Date().toISOString()
  });
}

export function normalizeComponentDefinition(input={}){
  const root=input?.root&&typeof input.root==='object'?clone(input.root):null;
  const props=Array.isArray(input?.props)?input.props.filter(p=>p?.name&&p?.targetNodeId&&p?.path).map(p=>({name:String(p.name),label:String(p.label||p.name),type:String(p.type||'text'),targetNodeId:String(p.targetNodeId),path:String(p.path),default:clone(p.default)})):[];
  const slots=Array.isArray(input?.slots)?input.slots.filter(s=>s?.name&&s?.targetNodeId).map(s=>({name:String(s.name),label:String(s.label||s.name),targetNodeId:String(s.targetNodeId)})):[];
  const variants=Array.isArray(input?.variants)&&input.variants.length?input.variants.map((v,i)=>({id:String(v?.id||`variant-${i+1}`),name:String(v?.name||`Variant ${i+1}`),propValues:v?.propValues&&typeof v.propValues==='object'?clone(v.propValues):{},rootPatch:v?.rootPatch&&typeof v.rootPatch==='object'?clone(v.rootPatch):{}})):[{id:'default',name:'Default',propValues:{},rootPatch:{}}];
  if(!variants.some(v=>v.id==='default')) variants.unshift({id:'default',name:'Default',propValues:{},rootPatch:{}});
  return {schemaVersion:COMPONENT_SCHEMA_VERSION,version:Math.max(1,Number(input?.version||1)),name:String(input?.name||'Component'),slug:slug(input?.slug||input?.name||'component'),root,props,slots,variants,updatedAt:input?.updatedAt||null};
}

export function componentDefinitionFromLibraryItem(item){
  if(!item||item.kind!=='component') return null;
  return normalizeComponentDefinition(item.content||{});
}

function nodeMap(root){ const map=new Map(); walk(root,n=>map.set(String(n.id),n)); return map; }
function mergeDeep(a={},b={}){ const out={...(a||{})}; for(const [k,v] of Object.entries(b||{})){ out[k]=v&&typeof v==='object'&&!Array.isArray(v)?mergeDeep(out[k]||{},v):clone(v); } return out; }
function remapIds(root,prefix){
  const idMap=new Map(); walk(root,n=>idMap.set(String(n.id),`${prefix}--${String(n.id).replace(/[^a-zA-Z0-9_-]/g,'_')}`));
  const recurse=(node)=>{ const next={...node,id:idMap.get(String(node.id))||node.id}; if(next.props?.targetId&&idMap.has(String(next.props.targetId))) next.props={...next.props,targetId:idMap.get(String(next.props.targetId))}; next.children=(node.children||[]).map(recurse); return next; };
  return recurse(root);
}

export function resolveComponentInstance(instance, libraryItems=[]){
  if(!instance||instance.type!=='component-instance') return null;
  const componentId=String(instance.props?.componentId||'');
  const item=(libraryItems||[]).find(x=>String(x.id)===componentId&&x.kind==='component');
  const definition=componentDefinitionFromLibraryItem(item); if(!definition?.root) return null;
  let root=clone(definition.root); const map=nodeMap(root);
  const variant=definition.variants.find(v=>v.id===String(instance.props?.variantId||'default'))||definition.variants[0];
  const values={...(variant?.propValues||{}),...(instance.props?.propValues||{})};
  for(const prop of definition.props){ const target=map.get(String(prop.targetNodeId)); if(!target)continue; const value=values[prop.name]!==undefined?values[prop.name]:prop.default; if(value!==undefined) setPath(target,prop.path,clone(value)); }
  if(variant?.rootPatch&&typeof variant.rootPatch==='object') root=mergeDeep(root,variant.rootPatch);
  if(instance.props?.overrides&&typeof instance.props.overrides==='object') root=mergeDeep(root,instance.props.overrides);
  const slots=definition.slots||[];
  const slotMap=nodeMap(root);
  for(const slot of slots){ const target=slotMap.get(String(slot.targetNodeId)); if(target) target.meta={...(target.meta||{}),__vsnComponentSlotName:String(slot.name)}; }
  if(slots.length&&Array.isArray(instance.children)&&instance.children.length){
    const active=slots.find(s=>s.name===String(instance.props?.activeSlot||slots[0].name))||slots[0]; const target=slotMap.get(String(active.targetNodeId)); if(target) target.children=clone(instance.children);
  }
  root=remapIds(root,String(instance.id||`component-${componentId}`));
  return { item, definition, variant, root, masterVersion:definition.version };
}

export function componentPropValue(instance, definition, prop){
  const variant=definition?.variants?.find(v=>v.id===String(instance?.props?.variantId||'default'))||definition?.variants?.[0];
  if(instance?.props?.propValues&&instance.props.propValues[prop.name]!==undefined) return instance.props.propValues[prop.name];
  if(variant?.propValues&&variant.propValues[prop.name]!==undefined) return variant.propValues[prop.name];
  return prop.default;
}

export function resetComponentInstance(instance,{keepSlot=false}={}){
  return {...instance,props:{...(instance.props||{}),variantId:'default',propValues:{},overrides:{},activeSlot:instance.props?.activeSlot||'content'},children:keepSlot?(instance.children||[]):[]};
}

export function addComponentVariant(definition,{name,propValues={},rootPatch={}}={}){
  const d=normalizeComponentDefinition(definition); const id=`variant-${slug(name||'variant')}-${Date.now().toString(36)}`;
  return {...d,version:d.version+1,variants:[...d.variants,{id,name:String(name||'Variant'),propValues:clone(propValues),rootPatch:clone(rootPatch)}],updatedAt:new Date().toISOString()};
}

export function updateComponentMasterDefaults(definition, propValues={}){
  const d=normalizeComponentDefinition(definition); const root=clone(d.root); const map=nodeMap(root);
  const props=d.props.map(prop=>{ const value=propValues[prop.name]!==undefined?clone(propValues[prop.name]):prop.default; const target=map.get(String(prop.targetNodeId)); if(target&&value!==undefined)setPath(target,prop.path,clone(value)); return {...prop,default:value}; });
  return {...d,root,props,version:d.version+1,updatedAt:new Date().toISOString()};
}

export function componentDependencies(pages=[], componentId=''){
  const hits=[]; for(const page of pages||[]){ let count=0; walk(page?.content||page?.elements||[],node=>{if(node?.type==='component-instance'&&String(node.props?.componentId||'')===String(componentId))count++;}); if(count) hits.push({id:page.id,title:page.title||page.handle||'Page',count}); }
  return hits;
}

export function componentPropInputType(type){ return ['text','url','image','color','number','boolean','select'].includes(type)?type:'text'; }
export { getPath };
