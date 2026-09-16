import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const files=[];
const findings=[];
const warnings=[];
const REVIEWED_NEW_FUNCTION_FILES=new Set([
  "app/builder/customCode.js",
  "app/components/editor/CustomJsRuntime.jsx",
]);
const REVIEWED_DANGEROUS_HTML_FILES=new Set([
  "app/components/builder-panel/WidgetStudioPanel.jsx",
  "app/components/editor/Canvas.jsx",
  "app/components/editor/PreviewRenderer.jsx",
]);
const STATIC_SECURITY_ANALYZER_FILES=new Set([
  "app/sdk/security.js",
  "app/services/global-code.server.js",
]);

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()&&!full.includes("node_modules"))walk(full);
    else if(/\.(jsx?|mjs)$/.test(entry.name))files.push(full);
  }
}
function rel(file){return path.relative(root,file).replaceAll("\\","/");}
function fail(message,file){findings.push(file?`${message} (${rel(file)})`:message);}
function warn(message,file){warnings.push(file?`${message} (${rel(file)})`:message);}
function countMatches(source,regex){return [...source.matchAll(regex)].length;}

walk(path.join(root,"app"));

for(const file of files){
  const source=fs.readFileSync(file,"utf8");const relative=rel(file);

  if(/\bdangerouslySetInnerHTML\b/.test(source)){
    if(REVIEWED_DANGEROUS_HTML_FILES.has(relative))warn("Reviewed generated HTML/CSS sink present; upstream sanitizer regression checks must remain green",file);
    else fail("dangerouslySetInnerHTML is not allowed outside reviewed generated-content sinks",file);
  }

  if(!STATIC_SECURITY_ANALYZER_FILES.has(relative)&&/\beval\s*\(/.test(source))fail("eval() execution is not allowed in application code",file);

  if(!STATIC_SECURITY_ANALYZER_FILES.has(relative)&&/\bnew\s+Function\s*\(/.test(source)){
    if(REVIEWED_NEW_FUNCTION_FILES.has(relative))warn("Reviewed merchant Custom JS compiler/runtime present; AI output must never feed this path",file);
    else fail("new Function() is not allowed outside reviewed merchant Custom JS paths",file);
  }

  if(/(?:from\s*["'](?:node:)?child_process["']|require\s*\(\s*["'](?:node:)?child_process["']\s*\))/.test(source))fail("child_process import requires explicit security review",file);

  const unsafeRawTotal=countMatches(source,/\$(?:queryRawUnsafe|executeRawUnsafe)\s*\(/g);
  if(unsafeRawTotal){
    const staticLiteral=countMatches(source,/\$(?:queryRawUnsafe|executeRawUnsafe)\s*\(\s*(["'])[^\r\n]*?\1\s*\)/g);
    if(staticLiteral!==unsafeRawTotal)fail("Dynamic unsafe raw Prisma query API detected",file);
    else warn("Static-literal unsafe Prisma query remains; prefer Prisma.sql/$queryRaw when practical",file);
  }

  if(/(?:sk-[A-Za-z0-9_-]{20,}|shpat_[A-Za-z0-9]{20,})/.test(source))fail("Possible committed API token detected",file);
  if(/target=["']_blank["']/.test(source)&&!/rel=/.test(source))warn("target=_blank should include rel=noopener/noreferrer",file);
}

const aiBuilder=fs.readFileSync(path.join(root,"app/builder/aiBuilder.js"),"utf8");
for(const marker of ["safeLinkUrl(row.url)","safeMediaUrl(row.url)","safeMediaUrl(row.imageUrl)","sanitizeAiContext"]){
  if(!aiBuilder.includes(marker))fail(`AI output/context sanitizer regression detected: ${marker}`);
}
if(/url:\s*cleanText\(row\.url/.test(aiBuilder)||/imageUrl:\s*cleanText\(row\.imageUrl/.test(aiBuilder))fail("AI-generated URLs must not bypass URL sanitization");

const aiService=fs.readFileSync(path.join(root,"app/services/ai-builder.server.js"),"utf8");
for(const marker of ["resolvePublicTarget","pinnedRequest","URL_FETCH_MAX_BYTES","redirects<URL_FETCH_MAX_REDIRECTS","UNTRUSTED_PUBLIC_SOURCE_TEXT","sanitizeAiContext"]){
  if(!aiService.includes(marker))fail(`AI URL/prompt security control missing: ${marker}`);
}
if(/await\s+fetch\(url\s*,/.test(aiService))fail("AI inspiration URLs must use DNS-pinned requests, not generic fetch()");

const aiRoute=fs.readFileSync(path.join(root,"app/routes/app.ai.jsx"),"utf8");
for(const marker of ["MAX_REQUEST_BYTES","MAX_IMAGE_DATA_CHARS","imageDataField","content-length","aiBuilderV1","AI Builder is disabled"]){
  if(!aiRoute.includes(marker))fail(`AI route security control missing: ${marker}`);
}

const visualTemplate=fs.readFileSync(path.join(root,"app/builder/visualTemplate.js"),"utf8");
for(const marker of ["safeStyleText","styles.includes(\"<\")","escapeHtml(value)","SAFE_ATTR","safeHref"]){
  if(!visualTemplate.includes(marker))fail(`Visual-template HTML/CSS sanitizer regression detected: ${marker}`);
}
const stylePipeline=fs.readFileSync(path.join(root,"app/builder/stylePipeline.js"),"utf8");
if(!stylePipeline.includes("sanitizeCustomCss")||!stylePipeline.includes("style\\b"))fail("Custom CSS style-closing sanitizer regression detected");

const widgetStudio=fs.readFileSync(path.join(root,"app/components/builder-panel/WidgetStudioPanel.jsx"),"utf8");
for(const marker of ["validateVisualTemplate","renderVisualTemplateHtml","parseVisualTemplate"]){
  if(!widgetStudio.includes(marker))fail(`Widget Studio reviewed HTML sink lost validation boundary: ${marker}`);
}

const globalCode=fs.readFileSync(path.join(root,"app/services/global-code.server.js"),"utf8");
for(const marker of ["criticalGlobalCodeRisks","eval() is blocked","new Function() is blocked","javascript: URLs are blocked"]){
  if(!globalCode.includes(marker))fail(`Global Code executable-content guard regression detected: ${marker}`);
}

const sdkSecurity=fs.readFileSync(path.join(root,"app/sdk/security.js"),"utf8");
for(const marker of ["VSN_PLUGIN_FORBIDDEN_APIS","child_process","eval(","new Function(","process.env","document.cookie"]){
  if(!sdkSecurity.includes(marker))fail(`SDK plugin isolation denylist regression detected: ${marker}`);
}

const requestSecurity=fs.readFileSync(path.join(root,"app/utils/request-security.server.js"),"utf8");
for(const marker of ["assertTrustedMutationRequest","untrusted-cross-site","shopify-admin-origin"]){
  if(!requestSecurity.includes(marker))fail(`Mutation-origin security control missing: ${marker}`);
}

for(const message of warnings)console.warn("SECURITY WARNING",message);
for(const message of findings)console.error("SECURITY ERROR",message);
console.log(`Security audit complete; ${findings.length} blocking finding(s), ${warnings.length} reviewed warning(s).`);
process.exit(findings.length?1:0);
