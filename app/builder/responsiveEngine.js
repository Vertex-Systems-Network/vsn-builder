export const RESPONSIVE_SCHEMA_VERSION = 2;

const DEFAULTS = Object.freeze([
  { id: 'desktop', label: 'Desktop', minWidth: 990, maxWidth: null, previewWidth: 1440, orientation: 'landscape', locked: true },
  { id: 'tablet', label: 'Tablet', minWidth: 750, maxWidth: 989, previewWidth: 768, orientation: 'portrait', locked: true },
  { id: 'mobile', label: 'Mobile', minWidth: 0, maxWidth: 749, previewWidth: 390, orientation: 'portrait', locked: true },
]);

function num(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value); return Number.isFinite(n) ? n : fallback;
}
export function breakpointId(value='custom') { return String(value||'custom').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'custom'; }
export function defaultResponsiveBreakpoints(){ return DEFAULTS.map((item)=>({...item})); }

export function normalizeResponsiveBreakpoints(input = {}) {
  const legacyMobile = Math.max(320, num(input?.mobileBreakpoint, 749));
  const legacyTablet = Math.max(legacyMobile + 1, num(input?.tabletBreakpoint, 989));
  const source = Array.isArray(input) ? input : Array.isArray(input?.responsiveBreakpoints) ? input.responsiveBreakpoints : null;
  let rows = source?.length ? source.map((bp, index) => ({
    id: breakpointId(bp?.id || bp?.label || `custom-${index+1}`),
    label: String(bp?.label || bp?.id || `Breakpoint ${index+1}`).slice(0,50),
    minWidth: Math.max(0, num(bp?.minWidth, 0)),
    maxWidth: num(bp?.maxWidth, null),
    previewWidth: Math.max(240, num(bp?.previewWidth, bp?.maxWidth || bp?.minWidth || 1024)),
    orientation: bp?.orientation === 'landscape' ? 'landscape' : 'portrait',
    locked: bp?.locked === true || ['desktop','tablet','mobile'].includes(String(bp?.id||'')),
  })) : [
    { ...DEFAULTS[0], minWidth: legacyTablet + 1 },
    { ...DEFAULTS[1], minWidth: legacyMobile + 1, maxWidth: legacyTablet },
    { ...DEFAULTS[2], maxWidth: legacyMobile },
  ];

  // Guarantee legacy IDs so old responsive JSON remains readable.
  for (const base of DEFAULTS) if (!rows.some((row)=>row.id===base.id)) rows.push({ ...base, ...(base.id==='mobile'?{maxWidth:legacyMobile}:base.id==='tablet'?{minWidth:legacyMobile+1,maxWidth:legacyTablet}:{minWidth:legacyTablet+1}) });
  const seen = new Set();
  rows = rows.filter((row)=>{ if(seen.has(row.id))return false; seen.add(row.id); return true; });
  rows = rows.map((row)=>({ ...row, maxWidth: row.maxWidth == null ? null : Math.max(row.minWidth, Number(row.maxWidth)) }));
  // Inheritance order is widest -> narrowest. Unbounded/large ranges go first.
  rows.sort((a,b)=>{
    const aMax=a.maxWidth==null?Number.MAX_SAFE_INTEGER:a.maxWidth;
    const bMax=b.maxWidth==null?Number.MAX_SAFE_INTEGER:b.maxWidth;
    return bMax-aMax || b.minWidth-a.minWidth;
  });
  return rows;
}

export function breakpointById(input, id){ return normalizeResponsiveBreakpoints(input).find((bp)=>bp.id===id) || normalizeResponsiveBreakpoints(input)[0]; }
export function breakpointMediaQuery(bp){
  const parts=[]; if(Number(bp?.minWidth)>0)parts.push(`(min-width: ${Math.max(0,Number(bp.minWidth))}px)`); if(bp?.maxWidth!=null)parts.push(`(max-width: ${Math.max(0,Number(bp.maxWidth))}px)`); return parts.join(' and ') || '(min-width: 0px)';
}
export function breakpointForWidth(input, width){ const w=Math.max(0,Number(width)||0); const rows=normalizeResponsiveBreakpoints(input); return rows.find((bp)=>w>=Number(bp.minWidth||0)&&(bp.maxWidth==null||w<=Number(bp.maxWidth))) || rows[0]; }
export function responsiveInheritanceOrder(input, activeId){ const rows=normalizeResponsiveBreakpoints(input); const index=Math.max(0,rows.findIndex((bp)=>bp.id===activeId)); return rows.slice(0,index+1).map((bp)=>bp.id); }
export function inheritedBreakpointSource(node, input, activeId){ const order=responsiveInheritanceOrder(input,activeId).reverse(); for(const id of order){const cfg=node?.responsive?.[id];if(cfg&&(Object.keys(cfg.styles||{}).length||Object.keys(cfg.props||{}).length))return id;}return 'base'; }

export function createCustomBreakpoint(input, { label = 'Laptop', maxWidth = 1199, minWidth = 990, previewWidth = 1180, orientation = 'landscape' } = {}) {
  const rows=normalizeResponsiveBreakpoints(input); let id=breakpointId(label); let n=2; while(rows.some((bp)=>bp.id===id))id=`${breakpointId(label)}-${n++}`;
  return [...rows,{id,label,minWidth:Math.max(0,Number(minWidth)||0),maxWidth:maxWidth==null?null:Math.max(0,Number(maxWidth)||0),previewWidth:Math.max(240,Number(previewWidth)||1024),orientation:orientation==='portrait'?'portrait':'landscape',locked:false}];
}

export function buildFluidClamp({ min = 16, max = 32, minViewport = 320, maxViewport = 1440, unit = 'px' } = {}) {
  const a=Number(min), b=Number(max), v1=Math.max(1,Number(minViewport)), v2=Math.max(v1+1,Number(maxViewport));
  if(![a,b,v1,v2].every(Number.isFinite)) return '';
  const slope=(b-a)/(v2-v1)*100; const intercept=a-(slope*v1/100);
  const lo=Math.min(a,b), hi=Math.max(a,b);
  return `clamp(${Number(lo.toFixed(4))}${unit}, calc(${Number(intercept.toFixed(4))}${unit} + ${Number(slope.toFixed(4))}vw), ${Number(hi.toFixed(4))}${unit})`;
}

export function normalizeContainerQuery(value={}){
  return { enabled:value?.enabled===true, name:breakpointId(value?.name||'vsn-container'), minWidth:Math.max(0,num(value?.minWidth,0)), maxWidth:num(value?.maxWidth,null), styles:value?.styles&&typeof value.styles==='object'?value.styles:{}, props:value?.props&&typeof value.props==='object'?value.props:{} };
}
export function containerQueryCondition(query){ const q=normalizeContainerQuery(query); const parts=[]; if(q.minWidth>0)parts.push(`(min-width: ${q.minWidth}px)`); if(q.maxWidth!=null)parts.push(`(max-width: ${Math.max(q.minWidth,Number(q.maxWidth))}px)`); return parts.join(' and ') || '(min-width: 0px)'; }

function px(value){ const m=String(value??'').trim().match(/^(-?\d+(?:\.\d+)?)px$/i); return m?Number(m[1]):null; }
function flatten(nodes,result=[]){ for(const n of nodes||[]){ if(!n||typeof n!=='object')continue; result.push(n); flatten(n.children||[],result);} return result; }
export function scanResponsiveIssues(nodes=[], input={}){
  const issues=[]; const breakpoints=normalizeResponsiveBreakpoints(input); const narrowest=[...breakpoints].filter(bp=>bp.maxWidth!=null).sort((a,b)=>a.maxWidth-b.maxWidth)[0] || breakpoints[breakpoints.length-1];
  for(const node of flatten(nodes)){
    const label=node.label||node.type||'Element'; const width=px(node.styles?.size?.width); const minWidth=px(node.styles?.size?.minWidth); const height=px(node.styles?.size?.height);
    if(width!=null&&narrowest?.maxWidth!=null&&width>narrowest.maxWidth) issues.push({level:'warn',code:'fixed-width',nodeId:node.id,text:`${label}: fixed width ${width}px can overflow ${narrowest.label} (${narrowest.maxWidth}px).`});
    if(minWidth!=null&&narrowest?.maxWidth!=null&&minWidth>narrowest.maxWidth) issues.push({level:'error',code:'min-width',nodeId:node.id,text:`${label}: min-width ${minWidth}px is wider than ${narrowest.label}.`});
    if(node.styles?.layout?.overflowX==='scroll'||node.styles?.layout?.overflowX==='auto') issues.push({level:'info',code:'horizontal-scroll',nodeId:node.id,text:`${label}: horizontal scrolling is enabled; verify it is intentional.`});
    if(height!=null&&height<44&&['button','product-add-to-cart','product-buy-now','icon','cart-icon'].includes(node.type)) issues.push({level:'warn',code:'tap-target',nodeId:node.id,text:`${label}: ${height}px height may be too small for a touch target.`});
    if(node.styles?.layout?.overflow==='hidden'&&height!=null&&node.styles?.typography?.fontSize) issues.push({level:'info',code:'clip-risk',nodeId:node.id,text:`${label}: fixed height + overflow hidden can clip responsive text.`});
    const absolute=node.styles?.layout?.position==='absolute'; if(absolute&&width!=null)issues.push({level:'info',code:'absolute-fixed',nodeId:node.id,text:`${label}: absolute positioning with a fixed width should be checked at every breakpoint.`});
  }
  // Detect overlapping named ranges.
  for(let i=0;i<breakpoints.length;i++)for(let j=i+1;j<breakpoints.length;j++){const a=breakpoints[i],b=breakpoints[j];const aMax=a.maxWidth??Infinity,bMax=b.maxWidth??Infinity;if(Math.max(a.minWidth,b.minWidth)<=Math.min(aMax,bMax)&&a.id!==b.id)issues.push({level:'warn',code:'breakpoint-overlap',nodeId:null,text:`Responsive ranges overlap: ${a.label} and ${b.label}.`});}
  return issues;
}
