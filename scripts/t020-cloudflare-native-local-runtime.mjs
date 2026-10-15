import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

assert.equal(process.env.CI,"true","CI-only: never run against merchants");
assert.equal(process.env.APP_ENV,"development");
assert.equal(process.env.NODE_ENV,"test");
assert.equal(process.env.VSN_CLOUDFLARE_NATIVE_CI,"1");
assert(existsSync("dist/server/index.js"),"Cloudflare Vite SSR build missing");

const prohibited=["CLOUDFLARE_API_TOKEN","CLOUDFLARE_ACCOUNT_ID",
  "SHOPIFY_API_KEY","SHOPIFY_API_SECRET","DIRECT_URL"];
for(const name of prohibited) assert(!process.env[name],"Hosted secret prohibited: "+name);
const env={...process.env, CI:"true",BROWSER:"none",
  WRANGLER_SEND_METRICS:"false",SHOPIFY_API_KEY:"",
  SHOPIFY_API_SECRET:"",CLOUDFLARE_API_TOKEN:"",
  CLOUDFLARE_ACCOUNT_ID:"",DATABASE_URL:"",DIRECT_URL:""};
const port=8797, origin="http://127.0.0.1:"+port;
let logs="";
const command=spawn(process.execPath,[
  "./node_modules/vite/bin/vite.js","preview",
  "--config","vite.full-merchant-cloudflare-ci.config.js",
  "--host","127.0.0.1","--port",String(port),"--strictPort",
],{env,stdio:["ignore","pipe","pipe"],detached:true});
for(const pipe of [command.stdout,command.stderr]) pipe.on("data",data=>{
  logs=(logs+data.toString()).slice(-9000);
});
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const safe=x=>String(x||"")
  .replace(/(?:password|secret|token|api.?key|DATABASE_URL)\s*[:=]\s*\S+/gi,"[redacted]")
  .replace(/postgres(?:ql)?:\/\/\S+/gi,"[database]")
  .slice(-1800);
const request=async (path,method="GET")=>fetch(origin+path,{
  method,redirect:"manual",signal:AbortSignal.timeout(4500),
});
const stop=async()=>{
  const send=s=>{try{process.kill(-command.pid,s)}
    catch{try{command.kill(s)}catch{}}};
  send("SIGTERM");
  if(command.exitCode==null && command.signalCode==null)
    await Promise.race([new Promise(ok=>command.once("exit",ok)),sleep(2000)]);
  send("SIGKILL");
};
try{
  let live=false;
  for(let i=0;i<85;i++){
    if(logs.includes("newest date supported by this server binary"))
      throw Error("WORKER_RUNTIME_DATE_OUTDATED_FOR_2026_10_13");
    if(command.exitCode!==null)throw Error("Vite Preview exited: "+safe(logs));
    try{
      const response=await request("/app");
      if(response.status===503){live=true;break}
    }catch{}
    await sleep(350);
  }
  assert(live,"Native local preview never reached locked Worker: "+safe(logs));
  const response=await request("/__vsn/cf-vite-merchant-graph");
  if(response.status!==200){
    let category="UNCLASSIFIED_WORKER_RESPONSE";
    try{
      const result=await response.json();
      const allowed=new Set([
        "REACT_ROUTER_MANIFEST_INVALID","NODE_FILE_URL_BOOTSTRAP",
        "NODE_DATABASE_CLIENT","SHOPIFY_MODULE_BOOTSTRAP",
        "NODE_MODULE_IMPORT","MERCHANT_SERVER_MODULE",
      ]);
      if(result?.ciOnly===true && allowed.has(result?.blocked))
        category=result.blocked;
    }catch{}
    throw new Error("Full merchant runtime import blocked: "+category+
      ", HTTP "+response.status);
  }
  const data=await response.json();
  assert.deepEqual(data,{ciOnly:true,actualMerchantGraphLoaded:true,
    routeCountAboveMinimum:true});
  for(const path of ["/","/app","/app/pages","/auth/callback",
    "/readyz","/webhooks/app/uninstalled","/__vsn/cf-vite-merchant-graph?shop=bad"]){
    assert.equal((await request(path)).status,503,"Unsafe route enabled: "+path);
  }
  assert.equal((await request("/__vsn/cf-vite-merchant-graph","POST")).status,503);
  console.log("PASS native Cloudflare Vite Workerd loads the full merchant ServerBuild");
  console.log("PASS all Shopify, billing, OAuth and data routes remain locked");
}catch(error){
  console.error("T020 local native Cloudflare runtime NOT READY: "+safe(error?.message||error));
  process.exitCode=1;
}finally{await stop()}
