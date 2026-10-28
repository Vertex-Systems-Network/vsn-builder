import test from "node:test";
import assert from "node:assert/strict";
import {getWorkerRequestContext} from "../app/services/worker-request-context.server.js";
import {createStagingFullAppRouterWorker} from "../app/services/worker-full-app-router-runtime.js";

const origin="https://vsn-builder-staging.vertexsystemsnetwork.workers.dev";
const stage={APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
  VSN_STAGING_REACT_ROUTER_ENABLED:"true"};

function fixture({response}={}){
  const calls=[];
  const runtime={shopify:{marker:"official-sdk"},database:{marker:"request-neon"},
    async close(){calls.push("close");}};
  const legacyWorker={async fetch(request){calls.push("legacy:"+new URL(request.url).pathname);return new Response("legacy");}};
  const worker=createStagingFullAppRouterWorker({
    mode:"production",
    makeRequestHandler(build,mode){
      calls.push("handler:"+mode);
      return async(request,loadContext)=>{
        assert.equal(loadContext.cloudflare.env.VSN_WORKER_NAME,"vsn-builder-staging");
        assert.equal(getWorkerRequestContext(),runtime);
        calls.push("router:"+new URL(request.url).pathname);
        return response?response():new Response("full-app",{headers:{"content-type":"text/html"}});
      };
    },
    loadServerBuild:async()=>({routes:{"app":"real"}}),
    async createSdkContext(request){calls.push("sdk:"+new URL(request.url).pathname);return runtime;},
    legacyWorker,
  });
  return {worker,calls,runtime};
}

test("only the exact opt-in Staging Worker uses the full route graph",async()=>{
  const f=fixture();
  const legacy=await f.worker.fetch(new Request(origin+"/app?shop=demo.myshopify.com"),{...stage,VSN_STAGING_REACT_ROUTER_ENABLED:"false"});
  assert.equal(await legacy.text(),"legacy");
  const production=await f.worker.fetch(new Request(origin+"/app?shop=demo.myshopify.com"),{...stage,APP_ENV:"production",VSN_WORKER_NAME:"vsn-builder-production"});
  assert.equal(await production.text(),"legacy");
  assert.equal(f.calls.filter(x=>x.startsWith("sdk:")).length,0);
  const enabled=await f.worker.fetch(new Request(origin+"/app?shop=demo.myshopify.com"),stage);
  assert.equal(await enabled.text(),"full-app");
  assert.equal(f.runtime.runtimeTier,"staging");
  assert.equal(f.calls.filter(x=>x.startsWith("sdk:")).length,1);
  assert.equal(f.calls.at(-1),"close");
});

test("health and isolated Worker APIs stay on the audited legacy handlers",async()=>{
  const f=fixture();
  for(const path of ["/healthz","/readyz","/__vsn/database-health","/__vsn/staging-editor-ui.js","/app/__vsn/verified-session"]){
    const response=await f.worker.fetch(new Request(origin+path),stage);
    assert.equal(await response.text(),"legacy");
  }
  assert.equal(f.calls.filter(x=>x.startsWith("sdk:")).length,0);
});

test("assets use the Cloudflare assets binding without opening a merchant session",async()=>{
  const f=fixture();
  const response=await f.worker.fetch(new Request(origin+"/assets/app.js"),{
    ...stage,ASSETS:{async fetch(req){return new Response("asset:"+new URL(req.url).pathname);}},
  });
  assert.equal(await response.text(),"asset:/assets/app.js");
  assert.equal(f.calls.filter(x=>x.startsWith("sdk:")).length,0);
  assert.equal((await f.worker.fetch(new Request(origin+"/assets/missing.js"),stage)).status,404);
});

test("Neon context stays open through SSR stream consumption and closes once",async()=>{
  const f=fixture({response:()=>new Response(new ReadableStream({
    pull(controller){
      const runtime=getWorkerRequestContext();
      controller.enqueue(new TextEncoder().encode(runtime.database.marker));
      controller.close();
    },
  }),{headers:{"content-type":"text/html"}})});
  const response=await f.worker.fetch(new Request(origin+"/app/plans"),stage);
  assert.equal(f.calls.includes("close"),false);
  assert.equal(await response.text(),"request-neon");
  assert.equal(f.calls.filter(x=>x==="close").length,1);
});

test("cancelled and bodyless responses also release request-scoped Neon exactly once",async()=>{
  const pending=fixture({response:()=>new Response(new ReadableStream({
    pull(){return new Promise(()=>{});},cancel(){},
  }))});
  const response=await pending.worker.fetch(new Request(origin+"/app/pages"),stage);
  await response.body.cancel();
  assert.equal(pending.calls.filter(x=>x==="close").length,1);

  const empty=fixture({response:()=>new Response(null,{status:302,headers:{location:"/auth/login"}})});
  const redirected=await empty.worker.fetch(new Request(origin+"/app?shop=demo.myshopify.com"),stage);
  assert.equal(redirected.status,302);
  assert.equal(empty.calls.filter(x=>x==="close").length,1);
});

test("shop-less entry documents go to the legacy login flow, never the embedded SSR",async()=>{
  const f=fixture();
  for(const path of ["/","/app","/auth/login"]){
    const response=await f.worker.fetch(new Request(origin+path),stage);
    assert.equal(await response.text(),"legacy",path);
  }
  assert.equal(f.calls.filter(x=>x.startsWith("sdk:")).length,0);
});

test("a shop-less preview link gets a plain notice, never the embedded SSR",async()=>{
  const f=fixture();
  const response=await f.worker.fetch(new Request(origin+"/preview"),stage);
  assert.equal(response.status,400);
  assert.match(await response.text(),/Open the preview from the VSN editor/);
  assert.match(response.headers.get("content-security-policy"),/frame-ancestors 'none'/);
  assert.equal(f.calls.length,0);
});
