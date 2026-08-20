import { normalizeEmailDocument } from "./emailSchema.js";

const CLIENTS = Object.freeze([
  {key:"gmail",label:"Gmail",platform:"Web / Android / iOS"},
  {key:"outlook-classic",label:"Outlook Classic",platform:"Windows desktop"},
  {key:"outlook-modern",label:"Outlook",platform:"New Outlook / Outlook.com"},
  {key:"apple-mail",label:"Apple Mail",platform:"macOS / iOS"},
  {key:"yahoo",label:"Yahoo Mail",platform:"Web / mobile"},
]);

function issue(code,severity,title,message,clients=[],blockId="") { return {code,severity,title,message,clients,blockId}; }
function bytes(value=""){try{return new TextEncoder().encode(String(value)).length;}catch{return String(value).length;}}
function safeFont(value=""){const normalized=String(value||"").trim().replace(/^[\'"]|[\'"](?=,|$)/g,"");return /^(Arial|Helvetica|Verdana|Tahoma|Trebuchet MS|Georgia|Times New Roman|Courier New|system-ui|sans-serif|serif|monospace)(\s*,|$)/i.test(normalized);}
function luminance(hex){const raw=String(hex||"").replace("#","");if(!/^[0-9a-f]{6}$/i.test(raw))return null;const vals=[0,2,4].map(i=>parseInt(raw.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*vals[0]+.7152*vals[1]+.0722*vals[2];}
function contrast(a,b){const x=luminance(a),y=luminance(b);if(x==null||y==null)return null;return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}

export function analyzeEmailCompatibility(documentInput,{subject="",preheader="",html=""}={}){
  const document=normalizeEmailDocument(documentInput);const issues=[];const settings=document.settings;const size=bytes(html);
  if(size>95*1024)issues.push(issue("gmail-clipping-risk",size>102*1024?"danger":"warning","Gmail clipping risk",`Compiled HTML is ${(size/1024).toFixed(1)} KB. Gmail can clip large messages near 102 KB, so reduce repeated markup or content.`,["gmail"]));
  if(settings.contentWidth>640)issues.push(issue("wide-content","warning","Wide email canvas",`${settings.contentWidth}px can force horizontal scaling in narrower clients. 600–640px is the safest general range.`,["gmail","outlook-classic","yahoo"]));
  if(!safeFont(settings.fontFamily))issues.push(issue("web-font-fallback","warning","Non-standard email font",`“${settings.fontFamily}” may be replaced by a fallback font in Gmail or Outlook.`,["gmail","outlook-classic","yahoo"]));
  const subjectLength=String(subject||"").length;if(subjectLength>70)issues.push(issue("long-subject","info","Long subject line",`${subjectLength} characters may truncate on mobile inboxes.`,["gmail","outlook-modern","apple-mail"]));
  const preheaderLength=String(preheader||"").length;if(preheaderLength>140)issues.push(issue("long-preheader","info","Long preheader",`${preheaderLength} characters may be truncated by inbox previews.`,["gmail","outlook-modern","apple-mail"]));
  if(!document.blocks.some(block=>block.type==="footer"))issues.push(issue("missing-footer","warning","Footer missing","Add a footer for sender identity, preferences and unsubscribe/compliance copy.",[]));
  for(const block of document.blocks){const c=block.content||{},s=block.style||{},logic=block.logic||{};
    if(["image","logo"].includes(block.type)&&!String(c.alt||"").trim())issues.push(issue("missing-alt","warning","Image has no alt text","Some clients block images by default; useful alt text keeps the message understandable.",["gmail","outlook-classic","yahoo"],block.id));
    if(block.type==="image-text"&&!String(c.image||"").trim())issues.push(issue("missing-image","warning","Image + Text has no image","Add an email-safe image URL or use a different content block.",["gmail","outlook-classic","yahoo"],block.id));
    if(block.type==="product-grid"&&Number(c.count||2)>3)issues.push(issue("four-product-grid","info","Four-column product grid",`Four columns can feel cramped on narrow clients and will stack on supported mobile clients.`,["outlook-classic"],block.id));
    if(block.type==="columns"&&(c.columns||[]).length>=3)issues.push(issue("three-columns","info","Three-column layout",`Three columns remain table-safe, but classic Outlook does not apply mobile media-query stacking.`,["outlook-classic"],block.id));
    if(block.type==="columns"){const total=(c.columns||[]).reduce((sum,col)=>sum+Number(col?.width||0),0);if(Math.abs(total-100)>1)issues.push(issue("column-width-total","warning","Column widths do not total 100%",`Current column widths total ${total.toFixed(1)}%. Normalize widths to avoid inconsistent client rendering.`,["outlook-classic","gmail"],block.id));}
    if(logic.condition?.enabled&&!String(logic.condition?.path||"").trim())issues.push(issue("condition-missing-field","warning","Conditional block has no data field","Choose the dynamic data field that controls this block, or disable the condition.",[],block.id));
    if(logic.repeat?.enabled&&!String(logic.repeat?.source||"").trim())issues.push(issue("repeat-missing-source","warning","Repeated block has no collection","Choose Products, Order line items or Cart items as the repeat source.",[],block.id));
    if(block.visibility?.desktop===false&&block.visibility?.mobile===false)issues.push(issue("hidden-all-devices","warning","Block hidden on every device","This block is disabled for both desktop and mobile email clients. Enable at least one responsive visibility target or remove the block.",[],block.id));
    if(block.type==="button"&&Number(s.buttonRadius??s.radius??0)>0)issues.push(issue("rounded-button-vml","info","Rounded button uses Outlook fallback","VSN emits an MSO/VML fallback for classic Outlook while modern clients use the rounded HTML button.",["outlook-classic"],block.id));
    if(["hero","section"].includes(block.type)&&String(s.background||"").includes("gradient"))issues.push(issue("css-gradient","warning","CSS gradient background","Classic Outlook has limited CSS gradient support. Prefer a solid fallback color.",["outlook-classic"],block.id));
  }
  if(settings.darkModeEnabled){
    const light=contrast(settings.textColor,settings.contentBackground);const dark=contrast(settings.darkTextColor,settings.darkContentBackground);
    if(light!=null&&light<4.5)issues.push(issue("light-contrast","danger","Low light-mode contrast",`Text contrast is ${light.toFixed(2)}:1; target at least 4.5:1 for normal text.`,[]));
    if(dark!=null&&dark<4.5)issues.push(issue("dark-contrast","danger","Low dark-mode contrast",`Dark preview text contrast is ${dark.toFixed(2)}:1; target at least 4.5:1.`,["apple-mail","outlook-modern"]));
    issues.push(issue("dark-mode-client-differences","info","Dark mode varies by client","VSN includes color-scheme metadata and dark CSS, but some Gmail/Outlook variants may still auto-invert colors.",["gmail","outlook-classic","outlook-modern"]));
  }
  const severityWeight={danger:12,warning:6,info:1};const penalty=issues.reduce((sum,item)=>sum+(severityWeight[item.severity]||0),0);const score=Math.max(0,Math.min(100,100-penalty));
  const clientScores={};for(const client of CLIENTS){const clientPenalty=issues.filter(item=>item.clients.includes(client.key)).reduce((sum,item)=>sum+(severityWeight[item.severity]||0),0);clientScores[client.key]=Math.max(0,100-clientPenalty);}
  return {score,htmlBytes:size,issues,clients:CLIENTS.map(client=>({...client,score:clientScores[client.key]})),counts:{danger:issues.filter(i=>i.severity==="danger").length,warning:issues.filter(i=>i.severity==="warning").length,info:issues.filter(i=>i.severity==="info").length,total:issues.length}};
}

export { CLIENTS as EMAIL_CLIENTS };
