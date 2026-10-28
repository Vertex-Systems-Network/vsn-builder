import test from "node:test";
import assert from "node:assert/strict";
import db from "../app/db.worker.server.js";
import {authenticate,addDocumentResponseHeaders,sessionStorage} from "../app/shopify.worker.server.js";
import {getWorkerRequestContext,runWithWorkerRequestContext} from "../app/services/worker-request-context.server.js";

function context(label){
  return {
    shopify:{
      authenticate:{admin:async()=>({shop:label}),webhook:async()=>({topic:label})},
      addDocumentResponseHeaders(_request,headers){headers.set("x-shopify-context",label);},
      sessionStorage:{loadSession:async()=>({id:label}),storeSession:async()=>true},
    },
    database:{
      builderPage:{findMany:async()=>[{shop:label}]},
      async $transaction(callback){return callback({shop:label});},
      async $disconnect(){},
    },
  };
}

test("Shopify SDK and Prisma proxies resolve the active request context",async()=>{
  const request=new Request("https://app.example/app?shop=a.myshopify.com");
  const result=await runWithWorkerRequestContext(context("a"),async()=>{
    const auth=await authenticate.admin(request);
    const rows=await db.builderPage.findMany();
    const stored=await sessionStorage.loadSession("session");
    const headers=new Headers();
    addDocumentResponseHeaders(request,headers);
    const tx=await db.$transaction(tx=>tx.shop);
    return {auth,rows,stored,header:headers.get("x-shopify-context"),tx};
  });
  assert.deepEqual(result,{auth:{shop:"a"},rows:[{shop:"a"}],stored:{id:"a"},header:"a",tx:"a"});
  assert.throws(()=>db.builderPage,err=>err.code==="VSN_WORKER_REQUEST_CONTEXT_REQUIRED");
});

test("parallel request contexts cannot cross Shopify sessions or Neon clients",async()=>{
  const run=label=>runWithWorkerRequestContext(context(label),async()=>{
    await new Promise(resolve=>setTimeout(resolve,label==="first"?8:1));
    const [auth,rows]=await Promise.all([
      authenticate.admin(new Request("https://app.example/app")),
      db.builderPage.findMany(),
    ]);
    return [auth.shop,rows[0].shop,getWorkerRequestContext().shopify.authenticate.admin!==undefined];
  });
  const [first,second]=await Promise.all([run("first"),run("second")]);
  assert.deepEqual(first,["first","first",true]);
  assert.deepEqual(second,["second","second",true]);
});
