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

const packageRuntime=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
const nvmRuntime=fs.readFileSync(path.join(root,".nvmrc"),"utf8").trim();
const nodeVersionRuntime=fs.readFileSync(path.join(root,".node-version"),"utf8").trim();
if(packageRuntime?.engines?.node!==">=22.18 <23"||nvmRuntime!=="22"||nodeVersionRuntime!=="22"){
  fail("Runtime version matrix regression: package engines, .nvmrc and .node-version must stay on the supported Node 22.18+ / <23 line");
}

const dockerfile=fs.readFileSync(path.join(root,"Dockerfile"),"utf8");
if(!/^FROM node:22-alpine3\.24(?:\s|$)/m.test(dockerfile))fail("Production Docker runtime must use the maintained Node 22 / Alpine 3.24 line");

const ciWorkflow=fs.readFileSync(path.join(root,".github/workflows/ci.yml"),"utf8");
if(!ciWorkflow.includes("node-version: 22.18.0"))fail("Runtime version matrix regression: CI must remain pinned to Node 22.18.0");
for(const stepBlock of ciWorkflow.split(/\n(?=\s{6}- )/)){
  if(stepBlock.includes("${{ secrets.")&&!stepBlock.includes("if: github.event_name != 'pull_request'")){
    fail("CI secret-bearing step must be disabled on pull_request events");
  }
}

const aiProvider=fs.readFileSync(path.join(root,"app/services/ai-provider.server.js"),"utf8");
for(const marker of ["SUPPORTED_PROVIDERS","RETRYABLE_STATUS","AbortSignal.timeout","fallbackProvider: null","AI provider request failed"]){
  if(!aiProvider.includes(marker))fail(`AI provider security contract regression detected: ${marker}`);
}
if(aiProvider.includes("payload?.error?.message"))fail("AI provider errors must not reflect vendor error messages verbatim");

const aiCommands=fs.readFileSync(path.join(root,"app/services/ai-command-registry.server.js"),"utf8");
for(const marker of ["runBuilderCommand","canAccessBuilderAction","getBuilderRuntimeEntitlements","getBlockingPageLock","canCollaborate","AI_COMMAND_STALE_VERSION","AI_COMMAND_PAGE_LOCKED","ai-command-undo","AI_COMMAND_EXPLICIT_APPROVAL_REQUIRED"]){
  if(!aiCommands.includes(marker))fail(`AI command boundary regression detected: ${marker}`);
}
if(aiCommands.includes("admin.graphql"))fail("AI command registry must not call Shopify Admin GraphQL directly");
if(aiCommands.includes("publishedJson"))fail("AI command registry must not mutate published content directly");
const aiCommandRoute=fs.readFileSync(path.join(root,"app/routes/app.ai-command.jsx"),"utf8");
for(const marker of ["assertTrustedMutationRequest","authenticate.admin","MAX_COMMAND_BYTES","executeAiCommand"]){
  if(!aiCommandRoute.includes(marker))fail(`AI command route security regression detected: ${marker}`);
}

const aiAgent=fs.readFileSync(path.join(root,"app/services/ai-agent.server.js"),"utf8");
for(const marker of ["AI_AGENT_OUTPUT_SCHEMA","AI_AGENT_EXECUTABLE_COMMANDS","scanBuilderPage","listRecentBuilderCommands","reserveAiUsage","executeAiCommand","checkpointRevisionId"]){
  if(!aiAgent.includes(marker))fail(`Editor Agent security boundary regression detected: ${marker}`);
}
if(["page.publish","setInterval(","Worker(","BullMQ","enqueue("].some((marker)=>aiAgent.includes(marker)))fail("Editor Agent must remain request-scoped and unable to publish directly");
if(["OPENAI_API_KEY","/v1/responses","Authorization:"].some((marker)=>aiAgent.includes(marker)))fail("Editor Agent must not bypass the shared provider boundary");

const aiAgentContract=fs.readFileSync(path.join(root,"app/ai/agent.js"),"utf8");
for(const marker of ["AI_AGENT_MAX_STEPS = 6","AI_AGENT_MAX_CONVERSATION_TURNS = 8","AI_AGENT_EXECUTABLE_COMMANDS","Agent plan exceeds"]){
  if(!aiAgentContract.includes(marker))fail(`Editor Agent bounded-plan regression detected: ${marker}`);
}
if(aiAgentContract.includes('"page.publish"'))fail("Editor Agent executable contract must not include page.publish");

const aiAgentContextContract=fs.readFileSync(path.join(root,"app/ai/agentContext.js"),"utf8");
for(const marker of ["AI_AGENT_CONTEXT_REQUEST_SCHEMA","AI_CONTEXT_MAX_REQUESTS","AI_CONTEXT_TOOL_NAMES","normalizeAgentContextRequests"]){
  if(!aiAgentContextContract.includes(marker))fail(`Agent context planner contract regression detected: ${marker}`);
}
for(const marker of ["agentContextToolsV1","VSN_FEATURE_AI_AGENT_CONTEXT_TOOLS","defaultValue: false"]){
  if(!fs.readFileSync(path.join(root,"app/config/featureFlags.js"),"utf8").includes(marker))fail(`Agent context feature flag regression detected: ${marker}`);
}
for(const marker of ["AI_AGENT_CONTEXT_REQUEST_SCHEMA","runAiContextTools","vsn_editor_agent_context_requests","Server-authoritative read-only context results","contextToolsEnabled"]){
  if(!aiAgent.includes(marker))fail(`Agent context orchestration regression detected: ${marker}`);
}
if(["executeDeveloperGraphql","page.publish","admin.graphql("].some((marker)=>aiAgent.includes(marker)))fail("Agent context orchestration must not bypass the sealed read-only context registry or publish boundary");

const aiAgentRoute=fs.readFileSync(path.join(root,"app/routes/app.ai-agent.jsx"),"utf8");
for(const marker of ["assertTrustedMutationRequest","authenticate.admin","canAccessBuilderEditor","MAX_AGENT_BYTES","runEditorAgentTurn","restoreEditorAgentCheckpoint"]){
  if(!aiAgentRoute.includes(marker))fail(`Editor Agent route security regression detected: ${marker}`);
}

const brandProfile=fs.readFileSync(path.join(root,"app/brand/brandProfile.js"),"utf8");
for(const marker of ["BRAND_PROFILE_VERSION = 1","UNSAFE_SCHEME","UNSAFE_DATA_HTML","MAX_RULES = 12","normalizeBrandProfile"]){
  if(!brandProfile.includes(marker))fail(`Brand Intelligence sanitizer regression detected: ${marker}`);
}
const brandKitService=fs.readFileSync(path.join(root,"app/services/brand-kits.server.js"),"utf8");
for(const marker of ["profileJson","brandProfileFromForm","normalizeBrandProfile"]){
  if(!brandKitService.includes(marker))fail(`Brand Intelligence persistence regression detected: ${marker}`);
}
if(aiAgent.includes("builderBrandKit.update")||aiAgent.includes("saveBrandKit"))fail("Editor Agent must not mutate Brand Intelligence");
if(!aiAgent.includes("publicVisualTokens")||!aiAgent.includes("loadAgentBrandContext"))fail("Editor Agent must bound Brand Intelligence context");

const brandExtraction=fs.readFileSync(path.join(root,"app/services/brand-extraction.server.js"),"utf8");
const brandExtractionContract=fs.readFileSync(path.join(root,"app/brand/brandExtraction.js"),"utf8");
const brandKitsRoute=fs.readFileSync(path.join(root,"app/routes/app.brand-kits.jsx"),"utf8");
for(const marker of ["publicHttpsRequest","BRAND_SOURCE_MAX_REDIRECTS","BRAND_SOURCE_MAX_BYTES","generateStructuredAi","reserveAiUsage","normalizeBrandProfile","UNTRUSTED_BRAND_SOURCE"]){
  if(!brandExtraction.includes(marker))fail(`Brand extraction security contract regression detected: ${marker}`);
}
for(const forbidden of ["saveBrandKit","builderBrandKit.create","builderBrandKit.update","builderBrandKit.upsert","publishedJson","designTokensJson","OPENAI_API_KEY","/v1/responses","Authorization:"]){
  if(brandExtraction.includes(forbidden))fail(`Brand extraction must remain preview-only/shared-provider; forbidden marker: ${forbidden}`);
}
for(const marker of ["BRAND_SOURCE_MAX_BYTES = 256 * 1024","BRAND_SOURCE_MAX_REDIRECTS = 3","BRAND_SOURCE_MAX_TEXT = 18000","publicBrandSourceText"]){
  if(!brandExtractionContract.includes(marker))fail(`Brand extraction bounded-source regression detected: ${marker}`);
}
for(const marker of ['intent==="extract-profile"',"assertTrustedMutationRequest","brandIntelligenceExtractionV1","authorized:String(form.get(\"authorized\"))===\"true\""]){
  if(!brandKitsRoute.includes(marker))fail(`Brand extraction route guard regression detected: ${marker}`);
}

const aiContextContract=fs.readFileSync(path.join(root,"app/ai/contextTools.js"),"utf8");
const aiContextService=fs.readFileSync(path.join(root,"app/services/ai-context-tools.server.js"),"utf8");
for(const marker of ["AI_CONTEXT_MAX_REQUESTS = 4","AI_CONTEXT_MAX_ITEMS = 10","AI_CONTEXT_MAX_RESOURCE_IDS = 5","AI_CONTEXT_TOOL_NAMES","normalizeAiContextRequests"]){
  if(!aiContextContract.includes(marker))fail(`AI context registry bound regression detected: ${marker}`);
}
for(const marker of ["AI_CONTEXT_SHOPIFY_QUERIES","VsnAiContextProducts","VsnAiContextFiles","VsnAiContextMarkets","VsnAiContextTranslations","loadCurrentPage","getVisitorSummary","loadPageExperiments"]){
  if(!aiContextService.includes(marker))fail(`AI context service contract regression detected: ${marker}`);
}
for(const forbidden of ["builderPage.update","builderPage.create","builderExperiment.update","builderExperiment.create","executeDeveloperGraphql","OPENAI_API_KEY","generateStructuredAi","publishedJson"]){
  if(aiContextService.includes(forbidden))fail(`AI context service must remain read-only/provider-independent: ${forbidden}`);
}
if(/\bmutation\s+VsnAiContext/i.test(aiContextService))fail("AI context fixed Shopify documents must not contain mutations");
if(aiAgentContract.includes("AI_CONTEXT_TOOL_NAMES")||aiAgentContract.includes("shopify.products.search"))fail("P1.3a must not broaden the executable Agent protocol before P1.3b");

const referenceContract=fs.readFileSync(path.join(root,"app/ai/referenceFidelity.js"),"utf8");
const referenceService=fs.readFileSync(path.join(root,"app/services/reference-analysis.server.js"),"utf8");
for(const marker of ["REFERENCE_ANALYSIS_VERSION = 1","REFERENCE_MAX_SECTIONS = 12","REFERENCE_MAX_COLORS = 8","REFERENCE_MAX_ASSETS = 16","normalizeReferenceAnalysis","scoreReferencePlanFidelity","notPixelScore"]){
  if(!referenceContract.includes(marker))fail(`Reference fidelity contract regression detected: ${marker}`);
}
for(const marker of ["REFERENCE_ANALYSIS_SCHEMA","generateStructuredAi","reserveAiUsage","vsn_reference_analysis","UNTRUSTED_REFERENCE_URL_TEXT","UNTRUSTED_STRUCTURED_REFERENCE","MAX_SCREENSHOT_CHARS","MAX_URL_TEXT_CHARS","MAX_STRUCTURED_CHARS"]){
  if(!referenceService.includes(marker))fail(`Reference analysis service regression detected: ${marker}`);
}
for(const forbidden of ["builderPage.update","builderPage.create","saveBrandKit","executeAiCommand","admin.graphql","fetch(","publicHttpsRequest","OPENAI_API_KEY","/v1/responses","Authorization:"]){
  if(referenceService.includes(forbidden))fail(`P1.4a reference analysis must remain non-mutating, network-free and provider-isolated: ${forbidden}`);
}

const aiEvalHarness=fs.readFileSync(path.join(root,"app/ai/evalHarness.js"),"utf8");
for(const marker of ["FORBIDDEN_ARTIFACT_KEYS","assertSafeEvalArtifact","storeRawPrompts","storeRawOutputs"]){
  if(!aiEvalHarness.includes(marker)&&!fs.readFileSync(path.join(root,".ai/evals/v1/config.json"),"utf8").includes(marker))fail(`AI eval artifact safety regression detected: ${marker}`);
}
const aiEvalProvider=fs.readFileSync(path.join(root,"scripts/ai-eval-provider.mjs"),"utf8");
for(const marker of ["VSN_AI_EVALS","NOT VERIFIED","inputHash","runAiBuilder","runEmailAi"]){
  if(!aiEvalProvider.includes(marker))fail(`AI provider eval safety/control regression detected: ${marker}`);
}
if(aiEvalProvider.includes("outputText:"))fail("AI eval artifacts must not persist raw model output");
if(!aiEvalProvider.includes("inputHash: hashEvalInput(testCase.prompt)"))fail("AI provider eval artifacts must persist only prompt hashes for case attribution");
const aiEvalConfig=JSON.parse(fs.readFileSync(path.join(root,".ai/evals/v1/config.json"),"utf8"));
for(const key of ["storeRawPrompts","storeRawOutputs","storeMerchantContext","storeCredentials"]){
  if(aiEvalConfig?.artifactPolicy?.[key]!==false)fail(`AI eval artifact policy must keep ${key}=false`);
}

const aiBehaviors=fs.readFileSync(path.join(root,"app/ai/behaviors.js"),"utf8");
for(const marker of ["untrusted data","Never invent merge-token paths"]){
  if(!aiBehaviors.includes(marker))fail(`AI behavior safety contract regression detected: ${marker}`);
}

const emailAi=fs.readFileSync(path.join(root,"app/services/email-ai.server.js"),"utf8");
for(const marker of ["EMAIL_BINDING_TOKENS","AI_EMAIL_TOKENS","AI_EMAIL_URL_TOKENS","sanitizeAiText","unsafeNetworkHost","generateStructuredAi","resolveAiBehavior"]){
  if(!emailAi.includes(marker))fail(`Email AI output sanitizer/provider regression detected: ${marker}`);
}
if(["OPENAI_API_KEY","/v1/responses","Authorization:"].some((marker)=>emailAi.includes(marker)))fail("Email AI must not bypass the shared AI provider boundary");
if(emailAi.includes("payload?.error?.message"))fail("Email AI provider errors must not be reflected verbatim");

const productionTopology=JSON.parse(fs.readFileSync(path.join(root,".ai/PRODUCTION_DATA_TOPOLOGY.json"),"utf8"));
if(productionTopology?.implementedTopology?.databaseEngine!=="sqlite"||productionTopology?.implementedTopology?.externalDatabaseSupport!=="NOT_IMPLEMENTED")fail("Production topology manifest must match the implemented SQLite provider");
if(productionTopology?.implementedTopology?.multiInstanceSqliteSupport!=="UNSUPPORTED")fail("Production topology must fail closed on multi-instance SQLite");
if(productionTopology?.agentJobReadiness!=="BLOCKED_ON_DEPLOYMENT_EVIDENCE")fail("Agent/job persistence readiness must remain blocked while deployment topology is unverified");
const productionRuntime=fs.readFileSync(path.join(root,"scripts/validate-production-runtime.mjs"),"utf8");
for(const marker of ["DATABASE_URL is required in production","supports SQLite only","file:"]){
  if(!productionRuntime.includes(marker))fail(`Production database runtime guard regression detected: ${marker}`);
}
const topologyCheck=fs.readFileSync(path.join(root,"scripts/production-data-topology-check.mjs"),"utf8");
for(const marker of ["--require-production-evidence","singleInstance","durableVolume","infrastructureSnapshot","restoreDrill"]){
  if(!topologyCheck.includes(marker))fail(`Production topology release guard regression detected: ${marker}`);
}

const requestSecurity=fs.readFileSync(path.join(root,"app/utils/request-security.server.js"),"utf8");
for(const marker of ["assertTrustedMutationRequest","untrusted-cross-site","shopify-admin-origin","configuredAppOrigin","SHOPIFY_APP_URL"]){
  if(!requestSecurity.includes(marker))fail(`Mutation-origin security control missing: ${marker}`);
}
if(requestSecurity.includes("forwardedOrigin")||/headers\?\.get\?\.\(["']x-forwarded-host["']\)/.test(requestSecurity))fail("Mutation-origin authorization must not trust client-controlled forwarded host headers");

for(const message of warnings)console.warn("SECURITY WARNING",message);
for(const message of findings)console.error("SECURITY ERROR",message);
console.log(`Security audit complete; ${findings.length} blocking finding(s), ${warnings.length} reviewed warning(s).`);
process.exit(findings.length?1:0);
