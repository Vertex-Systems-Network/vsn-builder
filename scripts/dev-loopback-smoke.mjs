// Local/Dev runtime smoke test on the current, built application.
// No Shopify CLI, merchant, hosted secrets, Neon, Cloudflare or external calls.
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const bundle=path.join(root,"build/server/index.js");
assert(fs.existsSync(bundle),"Build first: npm run build");
const ciOnly=process.env.CI==="true" && process.env.NODE_ENV==="test";
assert(ciOnly,"This test must only run in disposable GitHub CI (never serve with real developer credentials)");
const envPattern=fs.readFileSync(path.join(root,".env.local.example"),"utf8");
const scopes=envPattern.match(/^SCOPES=(.*)$/m)?.[1]||"";
assert(scopes.startsWith("read_locales,"),"Dev canonical Shopify scopes missing");
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"vsn-builder-dev-smoke-"));
const host="127.0.0.1";
async function unusedPort(){
 const server=net.createServer();
 await new Promise((resolve,reject)=>server.once("error",reject).listen(0,host,resolve));
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));
 return port;
}
const port=await unusedPort();
const url="http://"+host+":"+port;
const env={
 ...process.env,
 NODE_ENV:"test",
 APP_ENV:"development",
 SHOPIFY_BILLING_TEST_MODE:"true",
 SHOPIFY_API_KEY:"0123456789abcdef0123456789abcdef",
 SHOPIFY_API_SECRET:"synthetic-ci-only-shopify-secret",
 SHOPIFY_APP_URL:url,
 SCOPES:scopes,
 DATABASE_URL:"file:./ci.sqlite",
 VSN_DEFAULT_PLAN:"",
 DIRECT_URL:"",
 NEON_PROJECT_ID:"",
 NEON_API_KEY:"",
 CLOUDFLARE_API_TOKEN:"",
 PORT:String(port),
 HOST:host
};
let output="";
const app=spawn("npm",["exec","--","react-router-serve","./build/server/index.js"],{
 cwd:root,env,stdio:["ignore","pipe","pipe"]
});
for(const stream of [app.stdout,app.stderr])stream.on("data",chunk=>{
 output=(output+chunk.toString()).slice(-12000);
});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stop=async()=>{
 if(app.exitCode!==null)return;
 app.kill("SIGTERM");
 await Promise.race([new Promise(resolve=>app.once("exit",resolve)),sleep(2500)]);
 if(app.exitCode===null)app.kill("SIGKILL");
};
const probe=async(urlPath,options={})=>{
 const response=await fetch(url+urlPath,{redirect:"manual",signal:AbortSignal.timeout(5000),...options});
 const body=(await response.text()).slice(0,350000);
 return {status:response.status,headers:response.headers,body};
};
let tested=0;
try{
 let ready=false;
 for(let i=0;i<65;i++){
  if(app.exitCode!==null)throw Error("Local app crashed before listening (exit="+app.exitCode+")");
  try{const response=await probe("/");if(response.status) {ready=true;break}}
  catch{}
  await sleep(450);
 }
 assert(ready,"Dev HTTP server did not become reachable in 30 seconds. Recent output: "+output.replace(/(secret|token|password)[^\n]*/gi,"[redacted]").slice(-1700));
 const home=await probe("/");
 assert.equal(home.status,200,"Unauthenticated Dev landing page must render successfully");
 assert.match(home.headers.get("content-type")||"",/text\/html/);
 assert.match(home.body,/VSN\s*\|\s*Builder\s*\(Development\)/);
 assert(!home.body.includes("A short heading about [your app]"),"Template homepage placeholder must be removed");
 console.log("PASS Dev index GET / -> 200 and exact environment title");tested++;
 const intercepted=await probe("/?shop=ci-example.myshopify.com");
 assert([301,302,303,307,308].includes(intercepted.status),"Shop-scoped root should redirect to Shopify-authenticated path");
 const redirect=intercepted.headers.get("location")||"";
 assert(redirect.startsWith("/app?")||redirect.includes("/app?"),"Invalid Shopify redirect destination");
 console.log("PASS Shop scoped entry requires /app login route");tested++;
 const restricted=await probe("/app");
 assert([301,302,303,307,308,401,403].includes(restricted.status),
  "Unauthenticated dashboard must redirect or deny (got "+restricted.status+")");
 assert(!restricted.body.includes("VSN Builder dashboard workspace"),"Dashboard data may not be available without auth");
 console.log("PASS Unauthenticated GET /app is redirected or denied");tested++;
 const unknown=await probe("/__vsn_ci_route_missing__");
 assert.equal(unknown.status,404,"Unrecognized route must not become an app page");
 console.log("PASS Unknown route returns 404");tested++;
 console.log("Development loopback HTTP acceptance PASS ("+tested+"/4), port local-only");
}catch(err){
 const detail=(err?.message||String(err)).slice(0,1500);
 console.error("Development HTTP acceptance FAILED: "+detail);
 // Do not dump raw server output since it may contain SDK diagnostics.
 process.exitCode=1;
}finally{
 await stop();
 fs.rmSync(temp,{recursive:true,force:true});
}
