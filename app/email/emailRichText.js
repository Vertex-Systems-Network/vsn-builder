const ALLOWED_TAGS=new Set(["p","div","br","strong","b","em","i","u","s","ul","ol","li","a","span"]);
const SAFE_STYLE_PROPERTIES=new Set(["color","background-color","font-size","font-weight","font-style","text-decoration","text-align","line-height"]);

export function escapeEmailHtml(value=""){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}

function safeHref(value=""){
  const raw=String(value||"").trim();
  if(!raw)return "#";
  if(/^\{\{[\s\S]+\}\}$/.test(raw))return raw;
  if(/^(https?:|mailto:|tel:|\/|#)/i.test(raw))return raw;
  return "#";
}

function cleanStyle(value=""){
  return String(value||"").split(";").map((item)=>item.trim()).filter(Boolean).map((declaration)=>{
    const index=declaration.indexOf(":");if(index<1)return "";
    const prop=declaration.slice(0,index).trim().toLowerCase();let val=declaration.slice(index+1).trim();
    if(!SAFE_STYLE_PROPERTIES.has(prop))return "";
    if(/url\s*\(|expression\s*\(|javascript:/i.test(val))return "";
    if(prop==="font-size"&&!/^\d+(?:\.\d+)?(?:px|em|rem|%)$/.test(val))return "";
    if(prop==="text-align"&&!/^(left|center|right)$/.test(val))return "";
    if(prop==="font-weight"&&!/^(normal|bold|[1-9]00)$/.test(val))return "";
    if(prop==="color"||prop==="background-color")val=val.replace(/[^#(),.%\sa-zA-Z0-9-]/g,"");
    return `${prop}:${val}`;
  }).filter(Boolean).join(";");
}

function cleanAttributes(tag,source=""){
  const attrs=[];const pattern=/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;let match;
  while((match=pattern.exec(source))){
    const name=match[1].toLowerCase();const raw=match[2]??match[3]??match[4]??"";
    if(name.startsWith("on"))continue;
    if(name==="style"){const style=cleanStyle(raw);if(style)attrs.push(`style="${escapeEmailHtml(style)}"`);continue;}
    if(tag==="a"&&name==="href"){attrs.push(`href="${escapeEmailHtml(safeHref(raw))}"`);continue;}
    if(tag==="a"&&name==="title"){attrs.push(`title="${escapeEmailHtml(raw).slice(0,300)}"`);continue;}
    if(tag==="a"&&name==="target"){attrs.push('target="_blank"');continue;}
  }
  if(tag==="a"&&!attrs.some((item)=>item.startsWith("href=")))attrs.push('href="#"');
  if(tag==="a")attrs.push('rel="noopener noreferrer"');
  return attrs.length?` ${attrs.join(" ")}`:"";
}

export function sanitizeEmailRichText(input=""){
  let html=String(input??"");
  html=html.replace(/<!--[\s\S]*?-->/g,"").replace(/<(script|style|iframe|object|embed|form|input|button|svg|math)[\s\S]*?<\/\1\s*>/gi,"").replace(/<(script|style|iframe|object|embed|form|input|button|svg|math)\b[^>]*\/?\s*>/gi,"");
  return html.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g,(full,name,attrs)=>{
    const tag=String(name||"").toLowerCase();if(!ALLOWED_TAGS.has(tag))return "";
    if(full.startsWith("</"))return tag==="br"?"":`</${tag}>`;
    if(tag==="br")return "<br>";
    return `<${tag}${cleanAttributes(tag,attrs)}>`;
  });
}

function lookup(source,path){return String(path||"").split(".").filter(Boolean).reduce((value,key)=>value&&typeof value==="object"?value[key]:undefined,source);}

export function renderEmailRichText(input="",bindings=null){
  const source=String(input??"");
  const withValues=bindings?source.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,(match,path)=>{
    const value=lookup(bindings,path);if(value==null||value==="")return match;if(Array.isArray(value))return escapeEmailHtml(value.join(", "));return escapeEmailHtml(String(value));
  }):source;
  return sanitizeEmailRichText(withValues);
}

export function plainTextFromEmailRichText(input=""){
  return sanitizeEmailRichText(input).replace(/<br\s*\/?>/gi,"\n").replace(/<\/(p|div|li)>/gi,"\n").replace(/<li[^>]*>/gi,"• ").replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\n{3,}/g,"\n\n").trim();
}

export function richTextFromPlainText(input=""){
  const escaped=escapeEmailHtml(String(input??""));
  return escaped.split(/\n{2,}/).map((paragraph)=>`<p>${paragraph.replace(/\n/g,"<br>")}</p>`).join("")||"<p><br></p>";
}

export const resolveEmailRichText = renderEmailRichText;
