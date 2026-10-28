import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const script=readFileSync("extensions/vsn-page-builder-theme/assets/page-builder.js","utf8");
function block(handle="new-page",path="/apps/vsn-builder"){
 return {
  isConnected:true,innerHTML:"Loading…",
  dataset:{pageHandle:handle,proxyPath:path},
  matches(selector){return selector===".vsn-builder-block"},
  querySelectorAll(){return []},
  appendChild(){throw Error("unexpected external script")},
 };
}
function runtime(initial=[]){
 const events=new Map(),calls=[],errors=[];
 const document={
  readyState:"complete",
  querySelectorAll(selector){assert.equal(selector,".vsn-builder-block");return initial;},
  addEventListener(name,handler){events.set(name,handler);},
  createElement(){throw Error("script not expected")},
 };
 const fetch=(url,opts)=>{
  let resolve,reject;
  const response=new Promise((a,b)=>{resolve=a;reject=b});
  calls.push({url,opts,resolve,reject});
  return response;
 };
 runInNewContext(script,{
  document,fetch,AbortController,WeakMap,Set,String,encodeURIComponent,
  console:{error(...args){errors.push(args)}},
 },{timeout:1500});
 return {calls,errors,
  event(name,target){assert(events.has(name),name);events.get(name)({target});},
 };
}
const response=(html)=>({ok:true,text:async()=>html});
const section=(items)=>({
 matches(){return false},
 querySelectorAll(selector){assert.equal(selector,".vsn-builder-block");return items},
});
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

test("initial section render happens once; repeated load never issues duplicate GET",async()=>{
 const node=block("first"),app=runtime([node]);
 assert.equal(app.calls.length,1);
 assert.equal(app.calls[0].url,"/apps/vsn-builder/first?fragment=1");
 assert.equal(app.calls[0].opts.credentials,"same-origin");
 assert.equal(app.calls[0].opts.headers.Accept,"text/html");
 app.event("shopify:section:load",section([node]));
 assert.equal(app.calls.length,1);
 app.calls[0].resolve(response("<p>first content</p>"));
 await settle();
 assert.equal(node.innerHTML,"<p>first content</p>");
 app.event("shopify:section:load",section([node]));
 assert.equal(app.calls.length,1,"completed block is not repeatedly fetched");
});
test("theme editor reselect aborts prior GET and never allows stale preview overwrite",async()=>{
 const node=block("old"),app=runtime([node]);
 node.dataset.pageHandle="new";
 app.event("shopify:block:select",node);
 assert.equal(app.calls.length,2);
 assert.equal(app.calls[0].opts.signal.aborted,true);
 app.calls[1].resolve(response("<div>fresh content</div>"));
 await settle();
 assert.equal(node.innerHTML,"<div>fresh content</div>");
 app.calls[0].resolve(response("<div>STALE</div>"));
 await settle();
 assert.equal(node.innerHTML,"<div>fresh content</div>");
 assert.equal(app.errors.length,0);
});
test("unload aborts request and suppresses late DOM writes; reinsertion is allowed",async()=>{
 const node=block("section"),app=runtime([node]);
 app.event("shopify:section:unload",section([node]));
 node.isConnected=false;
 assert.equal(app.calls[0].opts.signal.aborted,true);
 assert.equal(node.dataset.vsnLoaded,"false");
 app.calls[0].resolve(response("<div>STALE</div>"));
 await settle();
 assert.equal(node.innerHTML,"Loading…");
 node.isConnected=true;
 app.event("shopify:section:load",section([node]));
 assert.equal(app.calls.length,2);
 app.calls[1].resolve(response("<div>reloaded</div>"));
 await settle();
 assert.equal(node.innerHTML,"<div>reloaded</div>");
});
test("app block can be section event target itself and its URL handle is encoded",async()=>{
 const app=runtime([]);
 const node=block("name?fragment=1");
 app.event("shopify:section:load",node);
 assert.equal(app.calls.length,1);
 assert.equal(app.calls[0].url,"/apps/vsn-builder/name%3Ffragment%3D1?fragment=1");
 app.calls[0].resolve(response("  "));
 await settle();
 assert.equal(node.dataset.vsnLoaded,"false");
 assert.match(node.innerHTML,/Builder content could not be loaded/);
 assert.equal(app.errors.length,1);
});
test("missing handle or unexpected proxy URL never starts network request",()=>{
 const app=runtime([]);
 for(const node of [
  block("","/apps/vsn-builder"),
  block("test","//evil.example.com/apps/vsn-builder"),
  block("test","/apps/other"),
  block("test","/apps/vsn-builder/../admin"),
 ])app.event("shopify:section:load",node);
 assert.equal(app.calls.length,0);
});
test("SDK/lifecycle failures stay scoped and can be retried without stale overwrite",async()=>{
 const node=block("retry"),app=runtime([node]);
 app.calls[0].reject(new Error("synthetic network unavailable"));
 await settle();
 assert.equal(node.dataset.vsnLoaded,"false");
 assert.match(node.innerHTML,/Builder content could not be loaded/);
 app.event("shopify:section:load",section([node]));
 assert.equal(app.calls.length,2);
 app.calls[1].resolve(response("<p>recovered</p>"));
 await settle();
 assert.equal(node.dataset.vsnLoaded,"true");
 assert.equal(node.innerHTML,"<p>recovered</p>");
});
