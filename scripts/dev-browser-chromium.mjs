// Real Chromium browser acceptance on the built Local/Dev application.
// No Shopify Partner credentials, hosted services, merchant login or cloud access.
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const bundle=path.join(root,"build/server/index.js");
assert.equal(process.env.CI,"true","Disposable CI runner is required");
assert.equal(process.env.NODE_ENV,"test","Never run browser acceptance with real credentials");
assert(fs.existsSync(bundle),"Run npm run build before Chromium tests");
const envText=fs.readFileSync(path.join(root,".env.local.example"),"utf8");
const scopes=envText.match(/^SCOPES=(.+)$/m)?.[1];
assert(scopes&&scopes.startsWith("read_locales,"),"Canonical Local scopes missing");
const host="127.0.0.1";
const server=net.createServer();
await new Promise((ok,fail)=>server.once("error",fail).listen(0,host,ok));
const port=server.address().port;
await new Promise(ok=>server.close(ok));
const origin="http://"+host+":"+port;
const env={
 ...process.env,
 APP_ENV:"development",
 NODE_ENV:"test",
 SHOPIFY_BILLING_TEST_MODE:"true",
 SHOPIFY_API_KEY:"0123456789abcdef0123456789abcdef",
 SHOPIFY_API_SECRET:"synthetic-ci-only-shopify-secret",
 SHOPIFY_APP_URL:origin,
 DATABASE_URL:"file:./ci.sqlite",
 DIRECT_URL:"",
 NEON_PROJECT_ID:"",
 NEON_API_KEY:"",
 CLOUDFLARE_API_TOKEN:"",
 VSN_DEFAULT_PLAN:"",
 SCOPES:scopes,
 HOST:host,
 PORT:String(port)
};
const child=spawn("npm",["exec","--","react-router-serve","./build/server/index.js"],{
 cwd:root,env,stdio:["ignore","pipe","pipe"]
});
const logTail=[];
for(const stream of [child.stdout,child.stderr])stream.on("data",chunk=>{
 for(const line of chunk.toString().split("\n")){
   if(line)logTail.push(line.replace(/(token|secret|password|api[_-]?key)[^\n]{0,150}/ig,"[redacted]"));
 }
 while(logTail.length>25)logTail.shift();
});
const sleep=(ms)=>new Promise(ok=>setTimeout(ok,ms));
const screenshotDir=path.join(root,"dev-browser-artifacts");
fs.mkdirSync(screenshotDir,{recursive:true});
let browser;
let passed=0;
let currentPage;
const check=(condition,description)=>{
 assert(condition,description);
 console.log("PASS browser "+description);
 passed++;
};
const deny=(status)=>[301,302,303,307,308,401,403,410].includes(status);
try{
 let ready=false;
 for(let i=0;i<65;i++){
  if(child.exitCode!==null)throw Error("Local React Router server terminated before acceptance");
  try{
   const response=await fetch(origin,{signal:AbortSignal.timeout(4000)});
   if(response.status===200){ready=true;break}
  }catch{}
  await sleep(400);
 }
 assert(ready,"Built Dev server did not become ready on loopback");

 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const sizes=[
  {name:"desktop",width:1440,height:900,mobile:false},
  {name:"mobile",width:390,height:844,mobile:true}
 ];
 for(const size of sizes){
  const context=await browser.newContext({
   viewport:{width:size.width,height:size.height},
   deviceScaleFactor:1,isMobile:size.mobile,hasTouch:size.mobile,
  });
  // Browsers must not call Shopify/CDN/API services from synthetic CI.
  await context.route("**/*",async route=>{
   const requested=new URL(route.request().url());
   if(requested.origin!==origin){
    await route.abort("blockedbyclient");
    return;
   }
   await route.continue();
  });
  const page=await context.newPage();
  currentPage=page;
  const start=await page.goto(origin+"/",{waitUntil:"domcontentloaded",timeout:20000});
  check(start?.status()===200,size.name+" homepage responds HTTP 200");
  const h1=page.locator("h1").first();
  await h1.waitFor({state:"visible",timeout:15000});
  check((await h1.innerText()).trim()==="VSN | Builder (Development)",size.name+" displays exact Dev app title");
  const shop=page.locator('input[name="shop"]');
  check(await shop.isVisible(),size.name+" displays Shopify shop-domain login input");
  await shop.fill("example-development.myshopify.com");
  check(await shop.inputValue()==="example-development.myshopify.com",size.name+" login input is keyboard editable");
  const metrics=await page.evaluate(()=>({
   scrollWidth:document.documentElement.scrollWidth,
   viewportWidth:document.documentElement.clientWidth,
  }));
  check(metrics.scrollWidth<=metrics.viewportWidth+3,size.name+" homepage fits viewport without horizontal overflow");
  await page.screenshot({path:path.join(screenshotDir,size.name+"-dev-home.png"),fullPage:true});
  await context.close();
  currentPage=null;
 }

 const context=await browser.newContext({viewport:{width:1365,height:768}});
 await context.route("**/*",async route=>{
  const request=new URL(route.request().url());
  if(request.origin!==origin){await route.abort("blockedbyclient");return}
  await route.continue();
 });
 const page=await context.newPage();currentPage=page;
 for(const route of ["/app","/app/pages","/app/builder/__ci_unknown_page__"]){
   const response=await page.goto(origin+route,{waitUntil:"domcontentloaded",timeout:20000});
   check(deny(response?.status()),"unauthenticated "+route+" redirects or denies (HTTP "+response?.status()+")");
   const body=await page.locator("body").innerText().catch(()=>"");
   check(!/VSN Builder dashboard workspace|page editor canvas|builder publishing controls/i.test(body),
    "unauthenticated "+route+" does not expose dashboard/editor content");
 }
 const unknown=await page.goto(origin+"/__builder_browser_missing__",{waitUntil:"domcontentloaded",timeout:20000});
 check(unknown?.status()===404,"unknown route returns HTTP 404 in real Chromium");
 await context.close();currentPage=null;
 console.log("VSN Dev real Chromium acceptance PASS ("+passed+"/17 checks). No merchant authentication was attempted.");
}catch(e){
 const sanitized=String(e?.message||e).replace(/(token|secret|password|api[_-]?key)[^\n]{0,150}/ig,"[redacted]");
 console.error("VSN Dev real Chromium acceptance FAIL after "+passed+" checks: "+sanitized.slice(0,1000));
 try{if(currentPage)await currentPage.screenshot({path:path.join(screenshotDir,"failure.png"),fullPage:true,timeout:3500})}catch{}
 process.exitCode=1;
}finally{
 if(browser)await browser.close().catch(()=>{});
 if(child.exitCode===null){
  child.kill("SIGTERM");
  await Promise.race([new Promise(ok=>child.once("exit",ok)),sleep(2200)]);
  if(child.exitCode===null)child.kill("SIGKILL");
 }
}
