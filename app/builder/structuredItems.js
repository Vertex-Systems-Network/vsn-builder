const uid = (prefix='item') => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2,8)}`}`;

export const STRUCTURED_ITEM_SCHEMAS = Object.freeze({
  'navigation-menu': [ ['label','Label','text'], ['url','URL','url'] ],
  breadcrumbs: [ ['label','Label','text'], ['url','URL','url'] ],
  'icon-list': [ ['icon','Icon / symbol','text'], ['label','Text','text'], ['url','URL','url'] ],
  accordion: [ ['title','Title','text'], ['content','Content','textarea'] ],
  faq: [ ['question','Question','text'], ['answer','Answer','textarea'] ],
  testimonials: [ ['quote','Quote','textarea'], ['name','Name','text'], ['role','Role / Company','text'] ],
  'logo-cloud': [ ['label','Brand name','text'], ['imageUrl','Logo image URL','media'], ['url','Link','url'] ],
  stats: [ ['value','Value','text'], ['label','Label','text'] ],
  'team-grid': [ ['name','Name','text'], ['role','Role','text'], ['imageUrl','Photo','media'] ],
  tabs: [ ['label','Tab label','text'], ['content','Content','textarea'] ],
  'trust-badges': [ ['icon','Icon / symbol','text'], ['label','Label','text'] ],
  'related-collections': [ ['label','Label','text'], ['url','Collection URL','url'], ['imageUrl','Image','media'] ],
  'mega-menu': [ ['label','Label','text'], ['url','URL','url'] ],
  'social-icons': [ ['label','Network','text'], ['url','URL','url'], ['icon','Icon / initials','text'] ],
  timeline: [ ['eyebrow','Date / label','text'], ['title','Title','text'], ['description','Description','textarea'] ],
});

const FIELD_KEYS = Object.fromEntries(Object.entries(STRUCTURED_ITEM_SCHEMAS).map(([type,fields])=>[type,fields.map(([key])=>key)]));

export function supportsStructuredItems(type='') { return Boolean(STRUCTURED_ITEM_SCHEMAS[type]); }
export function structuredItemSchema(type='') { return STRUCTURED_ITEM_SCHEMAS[type] || []; }

function parseLegacy(type, text='') {
  const keys = FIELD_KEYS[type] || [];
  const lines = String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  return lines.map((line,index)=>{
    const values = line.split('|').map(x=>x.trim());
    const item={id:uid(`${type}-item`)};
    keys.forEach((key,i)=>item[key]=values[i] || '');
    if(type==='timeline' && !item.title){ item.title=item.description||''; item.description=''; }
    return item;
  });
}

export function normalizeStructuredItems(type='', props={}) {
  const existing = Array.isArray(props?.items) ? props.items.filter(Boolean) : [];
  const source = existing.length ? existing : parseLegacy(type, props?.itemsText || '');
  return source.map((item,index)=>({ id:item?.id || uid(`${type}-${index}`), ...(item||{}) }));
}

export function createStructuredItem(type='', index=0) {
  const item={id:uid(`${type}-item`)};
  for(const [key] of structuredItemSchema(type)) item[key]='';
  if(type==='faq'){item.question=`Question ${index+1}?`;item.answer='Answer';}
  if(type==='stats'){item.value='100+';item.label='Metric';}
  if(type==='tabs'){item.label=`Tab ${index+1}`;item.content='Tab content';}
  return item;
}

export function structuredItemsToLegacyText(type='', items=[]) {
  const keys=FIELD_KEYS[type]||[];
  return (Array.isArray(items)?items:[]).map(item=>keys.map(key=>String(item?.[key]||'').replace(/\r?\n/g,' ')).join('|')).join('\n');
}
