import fs from "node:fs";
import path from "node:path";
import { sanitizeEmailRichText } from "../app/email/emailRichText.js";
import { sanitizeSvg } from "../app/services/svg-assets.server.js";
import { safeFormRedirectUrl } from "../app/builder/formEngine.js";
import { serializeVsnDescriptor, vsnElement } from "../app/sdk/renderDescriptor.js";

const root=process.cwd();
const files=[];
const findings=[];
const warnings=[];
const REVIEWED_NEW_FUNCTION_FILES=new Set([
  "app/builder/customCode.js",
  "app/components/editor/CustomJsRuntime.jsx",
]);
const REVIEWED_DANGEROUS_HTML_FILES=new Set([
  "app/components/BuilderPanelHost.jsx",
  "app/components/builder-panel/WidgetStudioPanel.jsx",
  "app/components/editor/Canvas.jsx",
  "app/components/editor/PreviewRenderer.jsx",
  "app/components/email-studio/EmailRichTextEditor.jsx",
  "app/components/email-studio/EmailStudioCanvas.jsx",
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
function assertSafe(condition,message){if(!condition)fail(message);}

walk(path.join(root,"app"));

for(const file of files){
  const source=fs.readFileSync(file,"utf8");const relative=rel(file);

  if(/\bdangerouslySetInnerHTML\s*=/.test(source)){
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

  if(/(?:sk-[A-Za-z0-9_-]{20,}|shpat_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,})/.test(source))fail("Possible committed API token detected",file);
  if(/target=["']_blank["']/.test(source)&&!/rel=/.test(source))warn("target=_blank should include rel=noopener/noreferrer",file);
}

const aiBuilder=fs.readFileSync(path.join(root,"app/builder/aiBuilder.js"),"utf8");
for(const marker of ["safeLinkUrl(row.url)","safeMediaUrl(row.url)","safeMediaUrl(row.imageUrl)","sanitizeAiContext","unsafeNetworkHost","cleanAiText","cssLength"]){
  if(!aiBuilder.includes(marker))fail(`AI output/context sanitizer regression detected: ${marker}`);
}
if(/url:\s*cleanText\(row\.url/.test(aiBuilder)||/imageUrl:\s*cleanText\(row\.imageUrl/.test(aiBuilder))fail("AI-generated URLs must not bypass URL sanitization");

const aiService=fs.readFileSync(path.join(root,"app/services/ai-builder.server.js"),"utf8");
for(const marker of ["resolvePublicTarget","pinnedRequest","URL_FETCH_MAX_BYTES","URL_FETCH_MAX_REDIRECTS","UNTRUSTED_PUBLIC_SOURCE_TEXT","sanitizeAiContext","reserveAiUsage","AI_RESERVATION_TTL_MS","status: \"started\""]){
  if(!aiService.includes(marker))fail(`AI URL/prompt/quota security control missing: ${marker}`);
}
if(/await\s+fetch\(url\s*,/.test(aiService))fail("AI inspiration URLs must use DNS-pinned requests, not generic fetch()");
if(!/createdAt:\s*\{\s*gte:\s*monthStart/.test(aiService)||!aiService.includes("status: \"completed\""))fail("AI quota reservation must count monthly completed and active generations");

const aiRoute=fs.readFileSync(path.join(root,"app/routes/app.ai.jsx"),"utf8");
for(const marker of ["MAX_REQUEST_BYTES","MAX_IMAGE_DATA_CHARS","imageDataField","boundedFormData","assertTrustedMutationRequest","aiBuilderV1","AI Builder is disabled"]){
  if(!aiRoute.includes(marker))fail(`AI route security control missing: ${marker}`);
}

const securityUtils=fs.readFileSync(path.join(root,"app/utils/security.server.js"),"utf8");
for(const marker of ["resolvePublicHttpsTarget","publicHttpsRequest","lookup(host","unsafeExternalHost(row.address)","OUTBOUND_ABSOLUTE_MAX_BODY_BYTES","maxBodyBytes"]){
  if(!securityUtils.includes(marker))fail(`Public outbound-request security control missing: ${marker}`);
}
const formAutomation=fs.readFileSync(path.join(root,"app/services/form-automation.server.js"),"utf8");
if(!formAutomation.includes("publicHttpsRequest(safeUrl"))fail("Form automation webhook delivery must use DNS-pinned public HTTPS requests");
if(!formAutomation.includes("publicHttpsRequest(safe, {"))fail("File scanner delivery must use DNS-pinned public HTTPS requests");
if(/await\s+fetch\(safe\s*,/.test(formAutomation))fail("Validated file-scanner URLs must not be re-resolved by generic fetch()");
if(!formAutomation.includes("maxBodyBytes: 27 * 1024 * 1024"))fail("File scanner pinned transport must preserve the bounded 25 MB upload contract");

const formSettings=fs.readFileSync(path.join(root,"app/routes/app.form-settings.jsx"),"utf8");
for(const marker of ["canAccessBuilderSystem(db, session, \"formSettings\")","assertTrustedMutationRequest(request)","canBuilder(role, \"settings\")","Only the store owner can change form security"]){
  if(!formSettings.includes(marker))fail(`Form integration/secret authorization regression detected: ${marker}`);
}

assertSafe(safeFormRedirectUrl("javascript:alert(1)")==="","Form redirect sanitizer must reject javascript: URLs");
assertSafe(safeFormRedirectUrl("data:text/html,<script>alert(1)</script>")==="","Form redirect sanitizer must reject data: URLs");
assertSafe(safeFormRedirectUrl("//evil.example/path")==="","Form redirect sanitizer must reject protocol-relative redirects");
assertSafe(safeFormRedirectUrl("/thank-you")==="/thank-you","Form redirect sanitizer must preserve same-site relative redirects");
assertSafe(safeFormRedirectUrl("https://example.com/thanks").startsWith("https://example.com/thanks"),"Form redirect sanitizer must preserve http(s) redirects");

const visualTemplate=fs.readFileSync(path.join(root,"app/builder/visualTemplate.js"),"utf8");
for(const marker of ["safeStyleText","styles.includes(\"<\")","escapeHtml(value)","SAFE_ATTR","safeHref"]){
  if(!visualTemplate.includes(marker))fail(`Visual-template HTML/CSS sanitizer regression detected: ${marker}`);
}
const stylePipeline=fs.readFileSync(path.join(root,"app/builder/stylePipeline.js"),"utf8");
for(const marker of ["sanitizeCustomCss",".replace(/<\\/?style\\b"]){
  if(!stylePipeline.includes(marker))fail(`Custom CSS style-closing sanitizer regression detected: ${marker}`);
}

const widgetStudio=fs.readFileSync(path.join(root,"app/components/builder-panel/WidgetStudioPanel.jsx"),"utf8");
for(const marker of ["validateVisualTemplate","renderVisualTemplateHtml","parseVisualTemplate"]){
  if(!widgetStudio.includes(marker))fail(`Widget Studio reviewed HTML sink lost validation boundary: ${marker}`);
}

const svgAssets=fs.readFileSync(path.join(root,"app/services/svg-assets.server.js"),"utf8");
for(const marker of ["sanitizeSvg(row?.svgText", "EMPTY_SAFE_SVG", "foreignObject", "javascript\\s*:"]){
  if(!svgAssets.includes(marker))fail(`SVG preview/storage sanitizer regression detected: ${marker}`);
}
try{
  const hostileSvg='<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)"><rect width="10" height="10"/></a><image href="https://attacker.example/pixel"/></svg>';
  const cleaned=sanitizeSvg(hostileSvg);
  assertSafe(!/<script|onclick\s*=|javascript\s*:|attacker\.example/i.test(cleaned),"SVG sanitizer failed hostile-markup regression test");
}catch(error){fail(`SVG sanitizer regression test failed: ${error instanceof Error?error.message:String(error)}`);}

const emailRichText=fs.readFileSync(path.join(root,"app/email/emailRichText.js"),"utf8");
for(const marker of ["ALLOWED_TAGS","SAFE_STYLE_PROPERTIES","safeHref","sanitizeEmailRichText","noopener noreferrer"]){
  if(!emailRichText.includes(marker))fail(`Email rich-text sanitizer regression detected: ${marker}`);
}
const emailEditor=fs.readFileSync(path.join(root,"app/components/email-studio/EmailRichTextEditor.jsx"),"utf8");
if(!emailEditor.includes("sanitizeEmailRichText")||!emailEditor.includes("dangerouslySetInnerHTML={{__html:html}}"))fail("Email rich-text editor reviewed sink lost sanitizer boundary");
const emailCanvas=fs.readFileSync(path.join(root,"app/components/email-studio/EmailStudioCanvas.jsx"),"utf8");
if(!emailCanvas.includes("renderEmailRichText(raw,bindings)")||!emailCanvas.includes("dangerouslySetInnerHTML={{__html:rendered}}"))fail("Email Studio reviewed rich-text sink lost sanitizer boundary");
try{
  const cleaned=sanitizeEmailRichText('<img src=x onerror=alert(1)><script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)" style="background-color:url(javascript:alert(1))">safe</a>');
  assertSafe(!/<img|<script|onerror|onclick|javascript\s*:|url\s*\(/i.test(cleaned),"Email rich-text sanitizer failed hostile-markup regression test");
  assertSafe(/href="#"/.test(cleaned)&&/rel="noopener noreferrer"/.test(cleaned),"Email rich-text sanitizer failed safe-link fallback regression test");
}catch(error){fail(`Email rich-text sanitizer regression test failed: ${error instanceof Error?error.message:String(error)}`);}

const descriptorSource=fs.readFileSync(path.join(root,"app/sdk/renderDescriptor.js"),"utf8");
for(const marker of ["key === \"dangerouslySetInnerHTML\"","safeUrl","safeStyleValue","escapeText"]){
  if(!descriptorSource.includes(marker))fail(`SDK render-descriptor sanitizer regression detected: ${marker}`);
}
try{
  const serialized=serializeVsnDescriptor(vsnElement("a",{href:"javascript:alert(1)",onClick:"alert(1)",dangerouslySetInnerHTML:{__html:"<img src=x onerror=alert(1)>"}},["<script>alert(1)</script>"]));
  assertSafe(!/javascript\s*:|onClick|dangerouslySetInnerHTML|<script/i.test(serialized)&&serialized.includes("&lt;script&gt;"),"SDK descriptor serialization failed hostile-input regression test");
}catch(error){fail(`SDK descriptor sanitizer regression test failed: ${error instanceof Error?error.message:String(error)}`);}

const globalCode=fs.readFileSync(path.join(root,"app/services/global-code.server.js"),"utf8");
for(const marker of ["criticalGlobalCodeRisks","eval() is blocked","new Function() is blocked","javascript: URLs are blocked"]){
  if(!globalCode.includes(marker))fail(`Global Code executable-content guard regression detected: ${marker}`);
}

const sdkSecurity=fs.readFileSync(path.join(root,"app/sdk/security.js"),"utf8");
for(const marker of ["VSN_PLUGIN_FORBIDDEN_APIS","child_process","eval(","new Function(","process.env","document.cookie"]){
  if(!sdkSecurity.includes(marker))fail(`SDK plugin isolation denylist regression detected: ${marker}`);
}

const dockerfile=fs.readFileSync(path.join(root,"Dockerfile"),"utf8");
if(!/^FROM node:22-alpine3\.24(?:\s|$)/m.test(dockerfile))fail("Production Docker runtime must use the maintained Node 22 / Alpine 3.24 line");

const ciWorkflow=fs.readFileSync(path.join(root,".github/workflows/ci.yml"),"utf8");
for(const stepBlock of ciWorkflow.split(/\n(?=\s{6}- )/)){
  if(stepBlock.includes("${{ secrets.")&&!stepBlock.includes("if: github.event_name != 'pull_request'")){
    fail("CI secret-bearing step must be disabled on pull_request events");
  }
}

const emailAi=fs.readFileSync(path.join(root,"app/services/email-ai.server.js"),"utf8");
for(const marker of ["EMAIL_BINDING_TOKENS","AI_EMAIL_TOKENS","AI_EMAIL_URL_TOKENS","sanitizeAiText","unsafeNetworkHost","Never invent merge-token paths","AI provider request failed"]){
  if(!emailAi.includes(marker))fail(`Email AI output sanitizer regression detected: ${marker}`);
}
if(emailAi.includes("payload?.error?.message"))fail("Email AI provider errors must not be reflected verbatim");

const requestSecurity=fs.readFileSync(path.join(root,"app/utils/request-security.server.js"),"utf8");
for(const marker of ["assertTrustedMutationRequest","untrusted-cross-site","shopify-admin-origin","configuredAppOrigin","SHOPIFY_APP_URL"]){
  if(!requestSecurity.includes(marker))fail(`Mutation-origin security control missing: ${marker}`);
}
if(requestSecurity.includes("forwardedOrigin")||/headers\?\.get\?\.\(["']x-forwarded-host["']\)/.test(requestSecurity))fail("Mutation-origin authorization must not trust client-controlled forwarded host headers");

for(const message of warnings)console.warn("SECURITY WARNING",message);
for(const message of findings)console.error("SECURITY ERROR",message);
console.log(`Security audit complete; ${findings.length} blocking finding(s), ${warnings.length} reviewed warning(s).`);
process.exit(findings.length?1:0);
