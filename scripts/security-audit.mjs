import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const files=[];
const findings=[];
const warnings=[];

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

walk(path.join(root,"app"));

for(const file of files){
  const source=fs.readFileSync(file,"utf8");
  if(/\bdangerouslySetInnerHTML\b/.test(source)&&!/sanitize|safeHtml|purif|trusted html/i.test(source))fail("dangerouslySetInnerHTML without an obvious sanitization boundary",file);
  if(/\beval\s*\(/.test(source))fail("eval() is not allowed in application code",file);
  if(/\bnew\s+Function\s*\(/.test(source))fail("new Function() is not allowed in application code",file);
  if(/(?:node:)?child_process/.test(source))fail("child_process requires explicit security review",file);
  if(/\$(?:queryRawUnsafe|executeRawUnsafe)\s*\(/.test(source))fail("Unsafe raw Prisma query API detected",file);
  if(/(?:sk-[A-Za-z0-9_-]{20,}|shpat_[A-Za-z0-9]{20,})/.test(source))fail("Possible committed API token detected",file);
  if(/target=["']_blank["']/.test(source)&&!/rel=/.test(source))warn("target=_blank should include rel=noopener/noreferrer",file);
}

const aiBuilder=fs.readFileSync(path.join(root,"app/builder/aiBuilder.js"),"utf8");
if(!/safeLinkUrl\(row\.url\)/.test(aiBuilder))fail("AI button URL protocol allowlisting regression detected");
if(!/safeMediaUrl\(row\.url\)/.test(aiBuilder)||!/safeMediaUrl\(row\.imageUrl\)/.test(aiBuilder))fail("AI media URL protocol allowlisting regression detected");
if(/url:\s*cleanText\(row\.url/.test(aiBuilder)||/imageUrl:\s*cleanText\(row\.imageUrl/.test(aiBuilder))fail("AI-generated URLs must not bypass URL sanitization");

const aiService=fs.readFileSync(path.join(root,"app/services/ai-builder.server.js"),"utf8");
for(const marker of ["resolvePublicTarget","pinnedRequest","URL_FETCH_MAX_BYTES","redirects<URL_FETCH_MAX_REDIRECTS","UNTRUSTED_PUBLIC_SOURCE_TEXT"]){
  if(!aiService.includes(marker))fail(`AI URL/prompt security control missing: ${marker}`);
}
if(/await\s+fetch\(url\s*,/.test(aiService))fail("AI inspiration URLs must use DNS-pinned requests, not generic fetch()");

const aiRoute=fs.readFileSync(path.join(root,"app/routes/app.ai.jsx"),"utf8");
for(const marker of ["MAX_REQUEST_BYTES","MAX_IMAGE_DATA_CHARS","imageDataField","content-length"]){
  if(!aiRoute.includes(marker))fail(`AI request validation control missing: ${marker}`);
}

for(const message of warnings)console.warn("SECURITY WARNING",message);
for(const message of findings)console.error("SECURITY ERROR",message);
console.log(`Security audit complete; ${findings.length} blocking finding(s), ${warnings.length} warning(s).`);
process.exit(findings.length?1:0);
