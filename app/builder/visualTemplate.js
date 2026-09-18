const ALLOWED_TAGS=new Set(["div","section","article","aside","nav","span","strong","em","small","p","a","button","ul","ol","li","figure","figcaption","img"]);
const VOID_TAGS=new Set(["img"]);
const SAFE_ATTR=/^(class|id|title|role|href|target|rel|alt|src|width|height|loading|decoding|type|tabindex|data-[a-z0-9_.:-]+|aria-[a-z0-9_.:-]+)$/i;
const TOKEN=/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;

function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function tokenValue(name,props={}){if(name==="vsn.content")return null;if(name.startsWith("vsn."))return "";const key=name.startsWith("prop.")?name.slice(5):name;return props?.[key]??"";}
function safeStyleText(value=""){const source=String(value||"");if(source.includes("<"))return"";return source;}
export function interpolateVisualTemplateText(text,props={}){return String(text??"").replace(TOKEN,(_,name)=>name==="vsn.content"?"{{vsn.content}}":String(tokenValue(name,props)));}

export function validateVisualTemplate(html="",css="",{requireContent=true,fieldKeys=[]}={}){
  const source=String(html||"").trim();const styles=String(css||"");const errors=[];const warnings=[];
  if(!source)errors.push("Template HTML is required.");
  if(!/{{\s*vsn\.root\s*}}/.test(source))errors.push("Template must include the protected {{vsn.root}} token on its root element.");
  if(requireContent&&!/{{\s*vsn\.content\s*}}/.test(source))errors.push("Template must include the protected {{vsn.content}} slot.");
  if(/<\s*(script|iframe|object|embed|form|style|link|meta)\b/i.test(source))errors.push("Script, iframe, form, style and document-level tags are not allowed in widget templates.");
  if(/\son[a-z]+\s*=|javascript\s*:|data\s*:\s*text\/html/i.test(source))errors.push("Inline event handlers and unsafe URL schemes are not allowed.");
  const ids=[...source.matchAll(/\sid\s*=\s*["']([^"']+)["']/gi)].map((m)=>m[1]);if(new Set(ids).size!==ids.length)errors.push("Duplicate HTML ids are not allowed inside one template.");
  if(styles.includes("<"))errors.push("Template CSS cannot contain HTML markup or style-closing sequences.");
  if(/@import|expression\s*\(|javascript\s*:|url\s*\(\s*["']?\s*data:/i.test(styles))errors.push("Scoped CSS contains an unsafe construct.");
  if(/@/i.test(styles))errors.push("CSS at-rules are not supported in Template Lab because every override must remain widget-scoped. Use Motion Library for reusable animation.");
  const known=new Set(["vsn.root","vsn.content","vsn.items","vsn.attributes",...fieldKeys,...fieldKeys.map((key)=>`prop.${key}`)]);
  const tokens=[...source.matchAll(TOKEN)].map((m)=>m[1]);for(const token of tokens)if(!known.has(token)&&!token.startsWith("prop."))warnings.push(`Unresolved token: {{${token}}}`);
  try{parseVisualTemplate(source);}catch(error){errors.push(error instanceof Error?error.message:String(error));}
  return{ok:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}

function parseAttrs(raw=""){
  const attrs={};let source=String(raw||"").replace(/{{\s*vsn\.root\s*}}/g,"");
  const re=/([:@a-zA-Z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;let match;
  while((match=re.exec(source))){const key=match[1];const value=match[2]??match[3]??"";if(/^on/i.test(key)||key.toLowerCase()==="style"||!SAFE_ATTR.test(key))continue;attrs[key]=value;}
  return attrs;
}

function textNodes(text){
  const nodes=[];let last=0;const re=/{{\s*vsn\.content\s*}}/g;let match;
  while((match=re.exec(text))){if(match.index>last)nodes.push({type:"text",value:text.slice(last,match.index)});nodes.push({type:"slot"});last=match.index+match[0].length;}
  if(last<text.length)nodes.push({type:"text",value:text.slice(last)});return nodes;
}

export function parseVisualTemplate(html=""){
  const source=String(html||"").trim();const root={type:"root",children:[]};const stack=[root];const token=/<\/?[a-zA-Z][^>]*>|[^<]+/g;let match;
  while((match=token.exec(source))){const part=match[0];if(part.startsWith("</")){const name=(part.match(/^<\/\s*([a-zA-Z0-9-]+)/)||[])[1]?.toLowerCase();if(stack.length===1||stack.at(-1).tag!==name)throw new Error(`Template HTML has an unmatched closing </${name||"?"}> tag.`);stack.pop();continue;}
    if(part.startsWith("<")){const open=part.match(/^<\s*([a-zA-Z0-9-]+)([\s\S]*?)\/?\s*>$/);if(!open)continue;const tag=open[1].toLowerCase();if(!ALLOWED_TAGS.has(tag))throw new Error(`Template tag <${tag}> is not supported.`);const node={type:"element",tag,attrs:parseAttrs(open[2]),rootToken:/{{\s*vsn\.root\s*}}/.test(open[2]),children:[]};stack.at(-1).children.push(node);const self=part.endsWith("/>")||VOID_TAGS.has(tag);if(!self)stack.push(node);continue;}
    stack.at(-1).children.push(...textNodes(part));
  }
  if(stack.length!==1)throw new Error(`Template HTML is missing a closing </${stack.at(-1).tag}> tag.`);
  const elements=root.children.filter((node)=>node.type==="element");if(elements.length!==1||root.children.some((node)=>node.type==="text"&&node.value.trim()))throw new Error("Template must have exactly one root element.");
  if(!elements[0].rootToken)throw new Error("The {{vsn.root}} token must be placed on the root opening tag.");
  return elements[0];
}

function attrValue(value,props){return interpolateVisualTemplateText(value,props);}
function safeHref(value){const raw=String(value||"").trim();if(!raw)return"";if(raw.startsWith("/")||raw.startsWith("#"))return raw;try{const u=new URL(raw);if(["https:","http:","mailto:","tel:"].includes(u.protocol))return raw;}catch{}return"";}
function attrsHtml(node,props,templateKey){const attrs=[];for(const[key,raw]of Object.entries(node.attrs||{})){let value=attrValue(raw,props);if(key.toLowerCase()==="href"||key.toLowerCase()==="src")value=safeHref(value);if(value==="")continue;attrs.push(`${key}="${escapeHtml(value)}"`);}if(node.rootToken){attrs.push(`data-vsn-template="${escapeHtml(templateKey)}"`);attrs.push('data-vsn-template-root="1"');}return attrs.length?` ${attrs.join(" ")}`:"";}
export function renderVisualTemplateHtml(tree,{props={},slotHtml="",templateKey="custom"}={}){const render=(node)=>{if(node.type==="slot")return String(slotHtml||"");if(node.type==="text")return escapeHtml(interpolateVisualTemplateText(node.value,props));if(node.type!=="element")return"";const attrs=attrsHtml(node,props,templateKey);if(VOID_TAGS.has(node.tag))return`<${node.tag}${attrs}>`;return`<${node.tag}${attrs}>${(node.children||[]).map(render).join("")}</${node.tag}>`;};return render(tree);}

export function scopeVisualTemplateCss(css="",templateKey="custom"){
  const source=safeStyleText(css).trim();if(!source||/@/g.test(source))return"";const prefix=`[data-vsn-template="${String(templateKey).replace(/[^a-zA-Z0-9:_-]/g,"")}"]`;
  return source.replace(/(^|})\s*([^{}]+)\{/g,(all,boundary,selectors)=>{const scoped=selectors.split(",").map((selector)=>{const clean=selector.trim();if(!clean)return"";if(clean.includes(":root")||clean.startsWith(prefix))return clean.replace(":root",prefix);return`${prefix} ${clean}`;}).filter(Boolean).join(", ");return`${boundary}${scoped}{`;});
}

export function visualTemplateTreeToDescriptor(tree,{props={},slot=null,templateKey="custom"}={}){const walk=(node)=>{if(node.type==="slot")return slot;if(node.type==="text")return interpolateVisualTemplateText(node.value,props);if(node.type!=="element")return null;const descriptorProps={};for(const[key,raw]of Object.entries(node.attrs||{})){let value=attrValue(raw,props);const normalized=key==="class"?"className":key.toLowerCase()==="tabindex"?"tabIndex":key;if(["href","src"].includes(normalized))value=safeHref(value);if(value!=="")descriptorProps[normalized]=value;}if(node.rootToken){descriptorProps["data-vsn-template"]=templateKey;descriptorProps["data-vsn-template-root"]="1";}return{__vsnSdkDescriptor:true,tag:node.tag,props:descriptorProps,children:(node.children||[]).map(walk).flat().filter((value)=>value!==null&&value!==false)};};return walk(tree);}

export function applyVisualTemplateOverride(template,node,slotHtml="") {
  if(!template?.enabled||!template?.html)return String(slotHtml||"");
  const tree=parseVisualTemplate(template.html);
  const key=String(node?.type||template.widgetType||"custom");
  const html=renderVisualTemplateHtml(tree,{props:node?.props||{},slotHtml,templateKey:key});
  const css=scopeVisualTemplateCss(template.css||"",key);
  return `${css?`<style data-vsn-widget-template-style="${key.replace(/[^a-z0-9:_-]/gi,"")}">${css}</style>`:""}${html}`;
}
