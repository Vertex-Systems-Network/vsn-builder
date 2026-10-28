import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {setImmediate as pause} from "node:timers/promises";
import {STAGING_EDITOR_UI_SCRIPT} from "../workers/staging-editor-ui.js";

// Exercise the ACTUAL Staging browser bundle in a minimal DOM, without
// installing Shopify apps, creating stores, or contacting a live merchant.
// Unlike source-regex smoke tests, this drives event listeners and mocked
// session-authenticated GET/POST requests across a full reload boundary.
const shop="merchant.myshopify.com",pageId="ckPage_1";
const initialPage=()=>({id:pageId,version:1,status:"draft",
  elements:[{id:"custom-1",type:"custom",props:{data:"preserve me"}}]});
class Element{
  constructor(attrs={}){
    this.attrs=attrs;this.events={};this.childNodes=[];
    this.value="";this.disabled=false;this._text="";
  }
  getAttribute(name){return this.attrs[name]??null}
  setAttribute(name,value){this.attrs[name]=String(value)}
  set textContent(value){this._text=String(value);this.childNodes=[]}
  get textContent(){return this._text}
  replaceChildren(...children){this.childNodes=children}
  append(...children){this.childNodes.push(...children)}
  addEventListener(name,cb){this.events[name]=cb}
  querySelector(selector){return this.nodes?.[selector]??null}
}
function ui(mode){
  const status=new Element();
  const root=new Element({"data-shop":shop});
  const nodes={status,root};
  const createForm=new Element();
  const field=new Element(),submit=new Element();
  if(mode==="create"){
    createForm.nodes={'button[type="submit"]':submit,'input[name="title"]':field};
    root.nodes={"[data-vsn-create-form]":createForm};
    Object.assign(nodes,{createForm,field,submit});
  }else{
    const editor=new Element({"data-page-id":pageId});
    const list=new Element(),preview=new Element(),add=new Element(),
      save=new Element(),versionLabel=new Element();
    editor.nodes={
      "[data-vsn-block-list]":list,"[data-vsn-preview]":preview,
      "[data-vsn-add-text]":add,"[data-vsn-save]":save,
      "[data-vsn-version]":versionLabel,
    };
    root.nodes={"[data-vsn-block-editor]":editor};
    Object.assign(nodes,{editor,list,preview,add,save,versionLabel});
  }
  const document={
    querySelector(selector){
      if(selector==="[data-vsn-stage-editor]")return root;
      if(selector==="[data-vsn-editor-status]")return status;
      return null;
    },
    createElement(){return new Element()},
  };
  return {document,nodes};
}
const flush=async()=>{for(let i=0;i<12;i++)await pause()};
function backend(){
  const state={page:null,requests:[],tokens:[],navigation:[],
    authorize:true,networkFailure:false,staleNextSave:false,readonly:false,
    holdNextSave:null};
  const fetch=async(url,options={})=>{
    const method=options.method||"GET";
    state.requests.push({url,method,options});
    const bearer=options.headers?.authorization;
    if(!state.authorize||!bearer?.startsWith("Bearer jwt-"))
      return new Response(null,{status:401});
    if(state.networkFailure)throw new Error("synthetic network failure");
    const parsed=new URL(url,"https://staging.builder.test");
    assert.equal(parsed.searchParams.get("shop"),shop);
    assert.equal(parsed.searchParams.size,1);
    assert.equal(options.credentials,"omit");
    assert.equal(options.redirect,"manual");
    assert.equal(options.cache,"no-store");
    if(method==="POST"&&parsed.pathname==="/app/__vsn/pages/create"){
      const submitted=JSON.parse(options.body);
      assert.deepEqual(Object.keys(submitted),["title"]);
      state.page=initialPage();
      state.page.title=submitted.title;
      return Response.json({id:pageId,status:"draft",version:1},{status:201});
    }
    if(parsed.pathname!=="/app/__vsn/pages/"+pageId+"/content")
      throw Error("Unexpected API path "+parsed.pathname);
    if(method==="GET"){
      if(!state.page)return new Response(null,{status:404});
      return Response.json({page:structuredClone(state.page)});
    }
    if(method==="POST"){
      if(state.readonly)return new Response(null,{status:403});
      const request=JSON.parse(options.body);
      assert.deepEqual(Object.keys(request).sort(),["elements","expectedVersion"]);
      // Pausing AFTER decoding the serialized body models an in-flight POST:
      // the user may keep typing, but that MUST NOT mutate the sent bytes.
      if(state.holdNextSave){
        const pauseUntil=state.holdNextSave;
        state.holdNextSave=null;
        await pauseUntil;
      }
      if(state.staleNextSave||request.expectedVersion!==state.page.version)
        return Response.json({code:"DRAFT_VERSION_CONFLICT"},{status:409});
      state.page.elements=structuredClone(request.elements);
      state.page.version+=1;
      return Response.json({id:pageId,version:state.page.version});
    }
    throw Error("Unsupported test method "+method);
  };
  const shopify={idToken:async()=>{
    const token="jwt-"+(state.tokens.length+1);
    state.tokens.push(token);
    return token;
  }};
  const location={assign:url=>state.navigation.push(url)};
  return {state,fetch,shopify,location};
}
function mount(mode,server,{withoutShopify=false}={}){
  const {document,nodes}=ui(mode);
  const context=vm.createContext({
    document,
    window:{shopify:withoutShopify?undefined:server.shopify,
      location:server.location},
    fetch:server.fetch,
    crypto:{randomUUID:()=>"a0b1c2d3-1111-4222-8333-eeeeeeeeeeee"},
    URL,
  });
  vm.runInContext(STAGING_EDITOR_UI_SCRIPT,context,{timeout:2500});
  return nodes;
}

test("Shopify owner creates draft, edits text, saves version and reloads persisted content",async()=>{
  const server=backend();
  const start=mount("create",server);
  start.field.value="  Merchant Landing  ";
  start.createForm.events.submit({preventDefault(){}});
  await flush();
  assert.equal(server.state.page.title,"Merchant Landing");
  assert.deepEqual(server.state.navigation,[
    "/app/__vsn/pages/"+pageId+"/view?shop="+shop,
  ]);
  assert.equal(server.state.requests.length,1);
  assert.equal(server.state.requests[0].method,"POST");
  assert.equal(server.state.requests[0].url,"/app/__vsn/pages/create?shop="+shop);
  assert.match(start.status.textContent,/Draft created/);

  const editor=mount("edit",server);
  await flush();
  assert.equal(editor.add.disabled,false);
  assert.equal(editor.save.disabled,false);
  assert.equal(editor.versionLabel.textContent,"1");
  assert.equal(editor.list.childNodes.length,1);
  editor.add.events.click();
  assert.equal(editor.list.childNodes.length,2);
  const input=editor.list.childNodes[1].childNodes[1];
  assert.equal(input.value,"");
  input.value="Edited real merchant copy";
  input.events.input();
  editor.save.events.click();
  await flush();
  assert.equal(server.state.page.version,2);
  assert.equal(server.state.page.elements.length,2);
  assert.deepEqual(server.state.page.elements[0],
    {id:"custom-1",type:"custom",props:{data:"preserve me"}});
  assert.equal(server.state.page.elements[1].props.text,"Edited real merchant copy");
  assert.equal(editor.versionLabel.textContent,"2");
  assert.match(editor.status.textContent,/Draft saved/);

  // Simulate full document reload (fresh App Bridge context, fresh GET).
  const reloaded=mount("edit",server);
  await flush();
  assert.equal(reloaded.versionLabel.textContent,"2");
  assert.equal(reloaded.list.childNodes.length,2);
  assert.equal(reloaded.list.childNodes[1].childNodes[1].value,
    "Edited real merchant copy");
  assert.equal(server.state.requests.filter(r=>r.method==="GET").length,2);
  assert.equal(server.state.tokens.length,4);
  assert.equal(new Set(server.state.requests.map(
    r=>r.options.headers.authorization)).size,4,
  "every operation fetches a fresh Shopify ID token");
});

test("version conflicts cannot overwrite another writer or fake a successful save",async()=>{
  const server=backend();server.state.page=initialPage();
  const editor=mount("edit",server);await flush();
  editor.add.events.click();
  server.state.page.version=2; // Concurrent writer commits first.
  editor.save.events.click();
  await flush();
  assert.equal(server.state.page.version,2);
  assert.equal(server.state.page.elements.length,1);
  assert.equal(editor.versionLabel.textContent,"1");
  assert.match(editor.status.textContent,/Another edit changed/);
});

test("Shopify session missing, refused role and invalid create fields do not create drafts",async()=>{
  const server=backend();
  const missing=mount("create",server,{withoutShopify:true});
  missing.field.value="Do not create";
  missing.createForm.events.submit({preventDefault(){}});
  await flush();
  assert.equal(server.state.page,null);
  assert.equal(server.state.requests.length,0);
  assert.match(missing.status.textContent,/Request failed/);

  const invalid=mount("create",server);
  invalid.field.value="   ";
  invalid.createForm.events.submit({preventDefault(){}});
  await flush();
  assert.equal(server.state.requests.length,0);
  assert.match(invalid.status.textContent,/Enter a title/);
  server.state.authorize=false;
  const denied=mount("create",server);
  denied.field.value="Unauthorized";
  denied.createForm.events.submit({preventDefault(){}});
  await flush();
  assert.equal(server.state.page,null);
  assert.deepEqual(server.state.navigation,[]);
  assert.match(denied.status.textContent,/HTTP 401/);
});

test("save without persisted paid edit permission leaves existing content intact",async()=>{
  const server=backend();server.state.page=initialPage();
  const editor=mount("edit",server);await flush();
  editor.add.events.click();
  server.state.readonly=true;
  editor.save.events.click();
  await flush();
  assert.equal(server.state.page.version,1);
  assert.equal(server.state.page.elements.length,1);
  assert.match(editor.status.textContent,/role cannot edit/);
});


test("in-flight edits are not mistaken for persisted save; follow-up save persists latest text",async()=>{
  const server=backend();
  server.state.page={...initialPage(),elements:[
    {id:"text1",type:"text",props:{text:"Before"}},
  ]};
  const editor=mount("edit",server);
  await flush();
  const input=editor.list.childNodes[0].childNodes[1];
  input.value="First draft";
  input.events.input();
  let release;
  server.state.holdNextSave=new Promise(resolve=>{release=resolve});
  editor.save.events.click();
  await flush();
  assert.equal(editor.save.disabled,true);
  input.value="Second draft, typed while first request is in flight";
  input.events.input();
  release();
  await flush();

  assert.equal(server.state.page.version,2);
  assert.equal(server.state.page.elements[0].props.text,"First draft");
  assert.equal(editor.versionLabel.textContent,"2");
  assert.match(editor.status.textContent,/newer edits are UNSAVED/);
  assert.equal(input.value,"Second draft, typed while first request is in flight");
  assert.equal(editor.save.disabled,false);
  editor.save.events.click();
  await flush();
  assert.equal(server.state.page.version,3);
  assert.equal(server.state.page.elements[0].props.text,
    "Second draft, typed while first request is in flight");
  assert.match(editor.status.textContent,/Draft saved/);
  assert.equal(server.state.tokens.length,3);
});
