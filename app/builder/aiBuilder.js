import { widgetRegistry } from "./widgetRegistry.js";

export const AI_LAYOUT_SCHEMA_VERSION = 1;
export const AI_ALLOWED_TYPES = Object.freeze([
  "section","container","columns","heading","text","button","image","divider","spacer","video","icon","banner",
  "product-title","product-price","product-image","product-description","product-add-to-cart",
  "collection-title","collection-description","collection-image","collection-product-grid",
  "navigation-menu","announcement-bar","trust-badges","newsletter-form","accordion","faq","stats","logo-cloud"
].filter((type)=>Boolean(widgetRegistry[type])));

const ALLOWED = new Set(AI_ALLOWED_TYPES);
const textWidget = new Set(["heading","text","button","product-title","product-description","collection-title","collection-description","announcement-bar"]);
const AI_REDACTED_KEYS = new Set([
  "secret","password","authorization","apikey","api_key","access_token","accesstoken","refresh_token","refreshtoken",
  "private_key","privatekey","client_secret","clientsecret","signing_secret","signingsecret","customjs","custom_js","filedata","file_data",
  "token","id_token","idtoken","session_token","sessiontoken","bearer","cookie","set-cookie","credentials","credential",
  "customeremail","customer_email","email","phone","telephone","address1","address2","postalcode","postal_code","zipcode","zip_code",
]);

export function aiNodeId(prefix="ai") {
  try { if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`; } catch {}
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
}

function px(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? `${Math.min(2400,n)}px` : undefined;
}
function color(value) { return /^#[0-9a-f]{3,8}$/i.test(String(value||"")) ? String(value) : undefined; }
function cleanText(value, max=4000) { return String(value ?? "").replace(/\u0000/g,"").slice(0,max); }
function cleanAiText(value,max=4000){return cleanText(value,max).replace(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g,"");}
function cssLength(value){const raw=cleanText(value,40).trim().toLowerCase();if(!raw)return"";if(["auto","min-content","max-content","fit-content"].includes(raw))return raw;return /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|%|vw|vh|rem|em))$/.test(raw)?raw:"";}
function number(value, min, max, fallback=undefined) { const n=Number(value); return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback; }
function cleanUrlText(value,max=2000){return cleanText(value,max).replace(/[\u0000-\u001f\u007f]/g,"").trim();}
function unsafeNetworkHost(hostname=""){
  const host=String(hostname||"").toLowerCase().replace(/^\[|\]$/g,"").replace(/\.$/,"");
  if(!host||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local"))return true;
  const match=host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if(match){
    const parts=match.slice(1).map(Number);if(parts.some((n)=>n>255))return true;
    const[a,b,c]=parts;
    return a===0||a===10||a===127||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===192&&b===0&&c===0)||(a===192&&b===0&&c===2)||(a===198&&(b===18||b===19))||(a===198&&b===51&&c===100)||(a===203&&b===0&&c===113)||a>=224;
  }
  if(host.includes(":"))return host==="::"||host==="::1"||host.startsWith("::ffff:")||/^(?:fc|fd)[0-9a-f]{2}:/.test(host)||/^fe[89ab][0-9a-f]:/.test(host)||host.startsWith("2001:db8:");
  return false;
}
function safeWebUrl(value,{allowRelative=false,allowContact=false,max=2000}={}){
  const raw=cleanUrlText(value,max);if(!raw)return"";
  if(allowRelative&&raw.startsWith("#"))return raw;
  if(allowRelative&&raw.startsWith("/")&&!raw.startsWith("//"))return raw;
  let parsed;try{parsed=new URL(raw);}catch{return"";}
  const protocol=parsed.protocol.toLowerCase();
  if(protocol==="https:"||protocol==="http:"){if(parsed.username||parsed.password||unsafeNetworkHost(parsed.hostname))return"";return parsed.toString();}
  if(allowContact&&(protocol==="mailto:"||protocol==="tel:"))return raw;
  return"";
}
function safeLinkUrl(value){return safeWebUrl(value,{allowRelative:true,allowContact:true,max:1500});}
function safeMediaUrl(value){return safeWebUrl(value,{allowRelative:true,max:4000});}
function sensitiveAiKey(key){
  const normalized=String(key||"").toLowerCase().replace(/[-\s]/g,"_");
  return AI_REDACTED_KEYS.has(normalized)
    || normalized.endsWith("_secret")
    || normalized.endsWith("_password")
    || normalized.endsWith("_api_key")
    || normalized.endsWith("_access_token")
    || normalized.endsWith("_refresh_token")
    || normalized.endsWith("_private_key")
    || normalized.endsWith("_session_token")
    || (normalized.endsWith("token") && !normalized.endsWith("tokens"))
    || normalized.endsWith("_credential")
    || normalized.endsWith("_credentials");
}
export function sanitizeAiContext(value,depth=0){
  if(depth>8)return "[truncated]";
  if(value==null||typeof value==="boolean"||typeof value==="number")return value;
  if(typeof value==="string")return cleanText(value,4000);
  if(Array.isArray(value))return value.slice(0,120).map((item)=>sanitizeAiContext(item,depth+1));
  if(typeof value!=="object")return cleanText(value,1000);
  const out={};let count=0;
  for(const [key,item] of Object.entries(value)){
    if(count++>=120)break;
    out[key]=sensitiveAiKey(key)?"[redacted]":sanitizeAiContext(item,depth+1);
  }
  return out;
}

export function normalizeAiPlan(plan={}) {
  const raw = Array.isArray(plan?.elements) ? plan.elements : [];
  const refs = new Set();
  const elements = [];
  for (let i=0;i<raw.length && i<180;i++) {
    const row = raw[i] || {};
    const type = String(row.type || "").trim();
    if (!ALLOWED.has(type)) continue;
    let ref = cleanText(row.ref || `e${i+1}`,80).replace(/[^a-zA-Z0-9_-]/g,"_") || `e${i+1}`;
    while (refs.has(ref)) ref = `${ref}_${i+1}`;
    refs.add(ref);
    elements.push({
      ref,
      parentRef: cleanText(row.parentRef || "root",80).replace(/[^a-zA-Z0-9_-]/g,"_") || "root",
      type,
      label: cleanAiText(row.label || widgetRegistry[type]?.label || type,120),
      text: cleanAiText(row.text,4000),
      url: type==="button"?safeLinkUrl(row.url):(type==="video"?safeMediaUrl(row.url):""),
      imageUrl: type==="image"?safeMediaUrl(row.imageUrl):"",
      alt: cleanAiText(row.alt,500),
      tag: ["h1","h2","h3","h4","h5","h6","p","div"].includes(row.tag)?row.tag:"",
      columns: number(row.columns,1,6,0), gap: number(row.gap,0,200,0),
      backgroundColor: color(row.backgroundColor)||"", textColor: color(row.textColor)||"", fontSize:number(row.fontSize,8,180,0), fontWeight:number(row.fontWeight,100,900,0),
      paddingTop:number(row.paddingTop,0,400,0), paddingRight:number(row.paddingRight,0,400,0), paddingBottom:number(row.paddingBottom,0,400,0), paddingLeft:number(row.paddingLeft,0,400,0),
      marginTop:number(row.marginTop,0,400,0), marginRight:number(row.marginRight,0,400,0), marginBottom:number(row.marginBottom,0,400,0), marginLeft:number(row.marginLeft,0,400,0),
      width: cssLength(row.width), maxWidth: cssLength(row.maxWidth), height: cssLength(row.height), borderRadius:number(row.borderRadius,0,200,0),
      direction: ["row","column"].includes(row.direction)?row.direction:"", align: ["flex-start","center","flex-end","stretch"].includes(row.align)?row.align:"", justify:["flex-start","center","flex-end","space-between","space-around"].includes(row.justify)?row.justify:"",
      objectFit:["cover","contain","fill","none","scale-down"].includes(row.objectFit)?row.objectFit:"",
    });
  }
  const validRefs = new Set(elements.map((e)=>e.ref));
  for (const row of elements) if (row.parentRef !== "root" && !validRefs.has(row.parentRef)) row.parentRef="root";
  return {
    version: AI_LAYOUT_SCHEMA_VERSION,
    title: cleanAiText(plan?.title || "AI Design",120), summary: cleanAiText(plan?.summary,1200), replacementText: cleanAiText(plan?.replacementText,6000),
    elements,
    suggestions: (Array.isArray(plan?.suggestions)?plan.suggestions:[]).slice(0,20).map((s)=>({kind:cleanText(s?.kind||"general",40),message:cleanAiText(s?.message,1000),elementRef:cleanText(s?.elementRef,80)})),
  };
}

function applyAiFields(type, baseProps={}, row={}) {
  const props={...baseProps};
  if (textWidget.has(type) && row.text) {
    if (type === "button") props.text=row.text;
    else if (["product-title","product-description","collection-title","collection-description"].includes(type)) props.fallbackText=row.text;
    else props.text=row.text;
  }
  if (row.tag && ["heading","product-title","collection-title"].includes(type)) props.tag=row.tag;
  if (type === "button" && row.url) props.url=row.url;
  if (type === "image" && row.imageUrl) { props.sourceType="external"; props.externalUrl=row.imageUrl; props.src=row.imageUrl; props.alt=row.alt || ""; }
  if (type === "video" && row.url) { props.sourceType="auto"; props.url=row.url; }
  if (type === "columns" && row.columns) props.columns=row.columns;
  return props;
}

function applyAiStyles(baseStyles={}, row={}) {
  const styles=structuredClone(baseStyles||{});
  const spacing={...(styles.spacing||{})};
  for (const [key,val] of [["paddingTop",row.paddingTop],["paddingRight",row.paddingRight],["paddingBottom",row.paddingBottom],["paddingLeft",row.paddingLeft],["marginTop",row.marginTop],["marginRight",row.marginRight],["marginBottom",row.marginBottom],["marginLeft",row.marginLeft]]) if (val) spacing[key]=px(val);
  if (Object.keys(spacing).length) styles.spacing=spacing;
  if (row.backgroundColor) styles.background={...(styles.background||{}),type:"color",color:row.backgroundColor};
  if (row.textColor || row.fontSize || row.fontWeight) styles.typography={...(styles.typography||{}),...(row.textColor?{color:row.textColor}:{}),...(row.fontSize?{fontSize:px(row.fontSize)}:{}),...(row.fontWeight?{fontWeight:String(row.fontWeight)}:{})};
  if (row.gap) styles.gap=px(row.gap);
  if (row.width) styles.width=row.width;
  if (row.maxWidth) styles.maxWidth=row.maxWidth;
  if (row.height) styles.height=row.height;
  if (row.borderRadius) styles.border={...(styles.border||{}),radius:px(row.borderRadius)};
  if (row.direction) styles.flexDirection=row.direction;
  if (row.align) styles.alignItems=row.align;
  if (row.justify) styles.justifyContent=row.justify;
  if (row.objectFit) styles.objectFit=row.objectFit;
  return styles;
}

export function aiPlanToVsnNodes(plan={}) {
  const normalized=normalizeAiPlan(plan);
  const map=new Map();
  for (const row of normalized.elements) {
    const def=widgetRegistry[row.type];
    if (!def) continue;
    map.set(row.ref,{ id:aiNodeId(`ai-${row.type}`), type:row.type, label:row.label||def.label, props:applyAiFields(row.type,structuredClone(def.props||{}),row), styles:applyAiStyles(structuredClone(def.styles||{}),row), children:[] });
  }
  const roots=[];
  for (const row of normalized.elements) {
    const node=map.get(row.ref); if (!node) continue;
    const parent=map.get(row.parentRef);
    if (parent && widgetRegistry[parent.type]?.acceptsChildren) parent.children.push(node); else roots.push(node);
  }
  return roots;
}

function walk(nodes, fn, depth=0) { for (const node of Array.isArray(nodes)?nodes:[]) { fn(node,depth); walk(node?.children,fn,depth+1); } }
export function validateAiVsnOutput(nodes=[]) {
  const errors=[], warnings=[]; const ids=new Set();
  walk(nodes,(node,depth)=>{
    if (!widgetRegistry[node?.type]) errors.push(`Unsupported widget: ${node?.type||"unknown"}`);
    if (!node?.id || ids.has(node.id)) errors.push(`Invalid or duplicate element ID: ${node?.id||"missing"}`); else ids.add(node.id);
    if (depth>12) warnings.push(`Deep nesting at ${node?.label||node?.type}`);
    if (node?.type==="image" && !node?.props?.src && !node?.props?.externalUrl) warnings.push(`Image placeholder has no source: ${node?.label||node.id}`);
  });
  return {valid:errors.length===0,errors,warnings};
}

export function scanAiAccessibility(nodes=[]) {
  const issues=[]; let headingLevel=0;
  walk(nodes,(node)=>{
    if (node?.type==="image" && node?.props?.altMode!=="decorative" && !String(node?.props?.alt||"").trim()) issues.push({severity:"warning",elementId:node.id,message:"Image is missing alt text."});
    if (node?.type==="button" && !String(node?.props?.text||"").trim()) issues.push({severity:"error",elementId:node.id,message:"Button has no accessible text."});
    if (node?.type==="heading") { const next=Number(String(node?.props?.tag||"h2").replace("h",""))||2; if(headingLevel&&next>headingLevel+1) issues.push({severity:"warning",elementId:node.id,message:`Heading order jumps from H${headingLevel} to H${next}.`}); headingLevel=next; }
  });
  return issues;
}

export function scanAiResponsive(nodes=[]) {
  const issues=[];
  walk(nodes,(node)=>{
    const s=node?.styles||{}; const width=String(s.width||s?.size?.width||""); const minWidth=String(s.minWidth||s?.size?.minWidth||"");
    const pxWidth=parseFloat(width); const pxMin=parseFloat(minWidth);
    if (/px$/.test(width)&&pxWidth>480) issues.push({severity:"warning",elementId:node.id,message:`Fixed width ${width} may overflow on mobile.`});
    if (/px$/.test(minWidth)&&pxMin>480) issues.push({severity:"warning",elementId:node.id,message:`min-width ${minWidth} may force horizontal scrolling.`});
    if (node?.type==="button") { const fs=parseFloat(s?.typography?.fontSize||"0"); if(fs&&fs<12) issues.push({severity:"warning",elementId:node.id,message:"Button text may be too small on touch devices."}); }
  });
  return issues;
}

export function serializePageForAi(nodes=[], {maxNodes=120}={}) {
  const rows=[]; walk(nodes,(node,depth)=>{ if(rows.length>=maxNodes||["global-styles","template-settings"].includes(node?.type)) return; rows.push({id:node.id,type:node.type,label:node.label,depth,props:sanitizeAiContext(node.props||{}),styles:sanitizeAiContext(node.styles||{})}); }); return rows;
}

export function applyReplacementText(nodes=[], elementId, replacementText="") {
  if (!elementId || !replacementText) return nodes;
  const safeReplacement=cleanAiText(replacementText,6000);
  const visit=(items)=>(Array.isArray(items)?items:[]).map((node)=>{
    if(node.id===elementId){ const props={...(node.props||{})}; if("text" in props) props.text=safeReplacement; else if("fallbackText" in props) props.fallbackText=safeReplacement; else if("heading" in props) props.heading=safeReplacement; else return node; return {...node,props}; }
    return {...node,children:visit(node.children)};
  }); return visit(nodes);
}
