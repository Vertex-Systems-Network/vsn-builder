import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { hostIsNonPublic, safeExternalUrl } from "../app/utils/security.server.js";

const root=process.cwd();const files=[];function walk(p){for(const x of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,x.name);if(x.isDirectory()&&!q.includes("node_modules"))walk(q);else if(/\.(jsx?|mjs)$/.test(x.name))files.push(q)}}walk(path.join(root,"app"));let bad=0;for(const file of files){const s=fs.readFileSync(file,"utf8");if(/dangerouslySetInnerHTML/.test(s)&&!/sanitize|safeHtml|custom css|style/i.test(s)){console.log("REVIEW dangerouslySetInnerHTML",path.relative(root,file));bad++}if(/target=["']_blank["']/.test(s)&&!/rel=/.test(s)){console.log("REVIEW target=_blank rel",path.relative(root,file));}}

for(const host of ["localhost","127.0.0.1","10.0.0.1","100.64.0.1","169.254.169.254","172.16.0.1","192.168.1.1","0.0.0.0","224.0.0.1","::1","fd00:ec2::254","fe80::1","::ffff:127.0.0.1"]){assert.equal(hostIsNonPublic(host),true,`non-public host must be blocked: ${host}`)}
for(const url of ["https://localhost/hook","https://127.0.0.1/hook","https://169.254.169.254/latest/meta-data","https://[::1]/hook","https://user:pass@example.com/hook"]){assert.equal(safeExternalUrl(url),null,`unsafe outbound URL must be rejected: ${url}`)}
assert.ok(safeExternalUrl("https://example.com/webhook"),"public HTTPS webhook should remain allowed");
const automation=fs.readFileSync(path.join(root,"app/services/form-automation.server.js"),"utf8");assert.ok(automation.includes("validateWebhookTarget"),"Form automation must validate webhook DNS targets");assert.ok(automation.includes('redirect:"error"'),"Form automation must reject outbound redirects");
const ai=fs.readFileSync(path.join(root,"app/services/ai-builder.server.js"),"utf8");for(const token of ["MAX_INSPIRATION_BYTES","readTextLimited","UNTRUSTED public source text","MAX_IMAGE_DATA_CHARS"]){assert.ok(ai.includes(token),`AI network guard missing ${token}`)}
console.log(`Security audit complete; ${bad} high-priority review item(s).`);process.exit(bad?1:0);
