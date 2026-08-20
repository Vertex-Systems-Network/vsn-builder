const SOURCE_CATALOG = Object.freeze([
  {value:'loop.title',label:'Loop Item · Title',types:['text']},
  {value:'loop.description',label:'Loop Item · Description',types:['text']},
  {value:'loop.meta',label:'Loop Item · Meta / Price',types:['text','number']},
  {value:'loop.handle',label:'Loop Item · Handle',types:['text']},
  {value:'loop.url',label:'Loop Item · URL',types:['url']},
  {value:'loop.image.url',label:'Loop Item · Image',types:['image','url']},
  {value:'loop.vendor',label:'Loop Item · Vendor',types:['text']},
  {value:'loop.type',label:'Loop Item · Type',types:['text']},
  {value:'loop.date',label:'Loop Item · Date',types:['text','date']},
  {value:'product.title',label:'Current Product · Title',types:['text']},
  {value:'product.description',label:'Current Product · Description',types:['text']},
  {value:'product.vendor',label:'Current Product · Vendor',types:['text']},
  {value:'product.handle',label:'Current Product · Handle',types:['text','url']},
  {value:'product.featuredImage.url',label:'Current Product · Featured Image',types:['image','url']},
  {value:'product.price',label:'Current Product · Price',types:['text','number']},
  {value:'product.compareAtPrice',label:'Current Product · Compare Price',types:['text','number']},
  {value:'product.metafield',label:'Current Product · Metafield',types:['text','number','url','image']},
  {value:'collection.title',label:'Current Collection · Title',types:['text']},
  {value:'collection.description',label:'Current Collection · Description',types:['text']},
  {value:'collection.handle',label:'Current Collection · Handle',types:['text','url']},
  {value:'collection.image.url',label:'Current Collection · Image',types:['image','url']},
  {value:'article.title',label:'Current Article · Title',types:['text']},
  {value:'article.excerpt',label:'Current Article · Excerpt',types:['text']},
  {value:'article.contentHtml',label:'Current Article · Content',types:['text']},
  {value:'article.author',label:'Current Article · Author',types:['text']},
  {value:'article.publishedAt',label:'Current Article · Date',types:['text','date']},
  {value:'article.image.url',label:'Current Article · Image',types:['image','url']},
  {value:'blog.title',label:'Current Blog · Title',types:['text']},
  {value:'customer.name',label:'Customer · Name',types:['text']},
  {value:'customer.email',label:'Customer · Email',types:['text']},
  {value:'search.query',label:'Search · Query',types:['text']},
  {value:'query.search',label:'URL · Query Parameter',types:['text','url']},
  {value:'metaobject.field',label:'Metaobject · Field',types:['text','number','url','image']},
]);

export const DYNAMIC_FIELD_MAP = Object.freeze({
  heading:[{path:'props.text',label:'Heading',type:'text'}],
  text:[{path:'props.text',label:'Text',type:'text'}],
  button:[{path:'props.text',label:'Button Text',type:'text'},{path:'props.url',label:'Button URL',type:'url'}],
  image:[{path:'props.src',label:'Image',type:'image'},{path:'props.alt',label:'Alt Text',type:'text'},{path:'props.linkUrl',label:'Link URL',type:'url'}],
  'image-box':[{path:'props.src',label:'Image',type:'image'},{path:'props.alt',label:'Alt Text',type:'text'},{path:'props.heading',label:'Heading',type:'text'},{path:'props.text',label:'Text',type:'text'},{path:'props.url',label:'URL',type:'url'}],
  'collection-image':[{path:'props.fallbackSrc',label:'Fallback Image',type:'image'},{path:'props.alt',label:'Alt Text',type:'text'}],
  'product-image':[{path:'props.fallbackSrc',label:'Fallback Image',type:'image'},{path:'props.alt',label:'Alt Text',type:'text'}],
  'article-featured-image':[{path:'props.fallbackSrc',label:'Fallback Image',type:'image'},{path:'props.alt',label:'Alt Text',type:'text'}],
  video:[{path:'props.url',label:'Video URL',type:'url'}],
  'product-title':[{path:'props.fallbackText',label:'Fallback Title',type:'text'}],
  'product-description':[{path:'props.fallbackText',label:'Fallback Description',type:'text'}],
  'collection-title':[{path:'props.fallbackText',label:'Fallback Title',type:'text'}],
  'collection-description':[{path:'props.fallbackText',label:'Fallback Description',type:'text'}],
  'article-title':[{path:'props.fallbackText',label:'Fallback Title',type:'text'}],
  'article-content':[{path:'props.fallbackText',label:'Fallback Content',type:'text'}],
});

export function dynamicFieldsForWidget(type='') { return DYNAMIC_FIELD_MAP[type] || []; }
export function dynamicSourcesForType(type='text') { return SOURCE_CATALOG.filter(item=>item.types.includes(type)).map(({value,label})=>({value,label})); }
export function normalizeBindings(value={}) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }

function readPath(source,path){ return String(path||'').split('.').reduce((v,k)=>v==null?undefined:v[k],source); }
function moneyValue(value){
  if(value && typeof value==='object' && value.amount!=null){ try{return new Intl.NumberFormat('en-US',{style:'currency',currency:value.currencyCode||'USD'}).format(Number(value.amount));}catch{return `${value.amount} ${value.currencyCode||''}`.trim();} }
  return value;
}
function resolveSource(binding, context={}){
  const source=binding?.source||'';
  if(source==='product.price') return moneyValue(context.product?.price || context.product?.priceRangeV2?.minVariantPrice || context.product?.variants?.nodes?.[0]?.price);
  if(source==='product.compareAtPrice') return moneyValue(context.product?.compareAtPrice || context.product?.compareAtPriceRange?.minVariantCompareAtPrice || context.product?.variants?.nodes?.[0]?.compareAtPrice);
  if(source==='product.metafield'){
    const list=context.product?.metafields?.nodes || context.product?.metafields || [];
    return list.find(item=>item?.namespace===(binding.namespace||'custom') && item?.key===binding.key)?.value;
  }
  if(source==='query.search'){
    const params=context.queryParams || {};
    return params[binding.key||''] ?? context.search?.query;
  }
  if(source==='metaobject.field'){
    const signature=`${binding.metaobjectType||''}|${binding.metaobjectId||''}|${binding.key||''}`;
    return context.dynamicMetaobjects?.[signature];
  }
  if(source==='product.handle' && binding.type==='url'){ const h=context.product?.handle; return h?`/products/${h}`:undefined; }
  if(source==='collection.handle' && binding.type==='url'){ const h=context.collection?.handle; return h?`/collections/${h}`:undefined; }
  return readPath({loop:context.loop,product:context.product,collection:context.collection,article:context.article,blog:context.blog,customer:context.customer,search:context.search},source);
}
function transform(value,binding={}){
  if(value==null || value==='') value=binding.fallback;
  if(value==null || value==='') return value;
  if(binding.type==='image'||binding.type==='url') return String(value);
  let out=moneyValue(value);
  out=String(out);
  if(binding.format==='uppercase') out=out.toUpperCase();
  else if(binding.format==='lowercase') out=out.toLowerCase();
  else if(binding.format==='capitalize') out=out.replace(/\b\w/g,m=>m.toUpperCase());
  if(binding.truncate && Number(binding.truncate)>0 && out.length>Number(binding.truncate)) out=`${out.slice(0,Number(binding.truncate))}…`;
  return `${binding.before||''}${out}${binding.after||''}`;
}
function setPath(target,path,value){
  const parts=String(path||'').split('.').filter(Boolean); if(!parts.length)return target;
  let cursor=target; for(let i=0;i<parts.length-1;i++){ const key=parts[i]; cursor[key]={...(cursor[key]||{})}; cursor=cursor[key]; }
  cursor[parts.at(-1)]=value; return target;
}

export function resolveDynamicBinding(binding = {}, context = {}) {
  const raw = resolveSource(binding, context);
  const value = transform(raw, binding);
  return { raw, value, usedFallback: (raw == null || raw === "") && binding?.fallback != null && binding?.fallback !== "" };
}

export function inspectDynamicBindings(node = {}, context = {}) {
  const rows = [];
  const bindings = normalizeBindings(node?.bindings);
  for (const field of dynamicFieldsForWidget(node?.type)) {
    const binding = bindings[field.path] || {};
    if (!binding?.enabled || !binding?.source) continue;
    const resolved = resolveDynamicBinding(binding, context);
    rows.push({ path: field.path, label: field.label, type: field.type, source: binding.source, fallback: binding.fallback || "", ...resolved });
  }
  const legacy = node?.dynamicSource;
  if (legacy?.enabled && legacy?.source) {
    const binding = { ...legacy, type: legacy.target === "src" ? "image" : legacy.target === "url" ? "url" : "text" };
    const resolved = resolveDynamicBinding(binding, context);
    rows.push({ path: `dynamicSource.${legacy.target || "text"}`, label: "Legacy Dynamic Source", type: binding.type, source: binding.source, fallback: binding.fallback || "", ...resolved });
  }
  return rows;
}
export function applyDynamicBindings(node, context={}){
  const bindings=normalizeBindings(node?.bindings); const entries=Object.entries(bindings).filter(([,b])=>b?.enabled&&b?.source);
  if(!entries.length)return node;
  const next={...node,props:{...(node.props||{})}};
  for(const [path,binding] of entries){ const value=transform(resolveSource(binding,context),binding); if(value!=null&&value!=='')setPath(next,path,value); }
  return next;
}
