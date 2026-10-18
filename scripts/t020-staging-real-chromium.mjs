// Real Chromium acceptance of the actual Staging Shopify editor HTML+JS.
// ALL requests are intercepted in memory. No Shopify account, Neon database,
// app installation, Worker deployment, or production storefront is contacted.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {chromium} from "playwright";
import {STAGING_EDITOR_UI_SCRIPT} from "../workers/staging-editor-ui.js";
import {
  renderVerifiedStagingMerchantDashboard,renderVerifiedStagingPageInspection,
} from "../app/services/worker-shopify-staging-dashboard.js";
import {decorateVerifiedStagingEditorUi} from "../app/services/worker-shopify-staging-editor-html.js";

assert.equal(process.env.CI,"true","CI-only synthetic merchant browser");
assert.equal(process.env.NODE_ENV,"test","No real Shopify session/credentials");
assert.equal(process.env.APP_ENV,"development","Never execute in hosted Staging");
assert(!process.env.CLOUDFLARE_API_TOKEN && !process.env.NEON_API_KEY,
  "No provider write credentials in real Chromium test");

const shop="synthetic-testing.myshopify.com";
const apiKey="a".repeat(32);
const pageId="page_42";
const origin="https://builder-stage-ci.example.test";
const updatedAt="2026-10-18T00:00:00.000Z";
const state={page:null,version:0,requests:[],denied:false,clash:false};
const status=(code,body)=>new Response(body===null?null:JSON.stringify(body),{
  status:code,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"},
});
const summary={total:0,draft:0,published:0,recent:[]};
const meta=()=>({id:pageId,title:state.page?.title||"Synthetic page",
  template:"page",status:"draft",version:state.version||1,
  handle:"synthetic",updatedAt});
const contentState=()=>({id:pageId,version:state.version||1,updatedAt,
  elements:state.page?.elements||[]});
const trustedHtml=async(view)=>{
  const response=view==="dashboard"?
    renderVerifiedStagingMerchantDashboard({shop,apiKey,summary}):
    renderVerifiedStagingPageInspection({
      shop,apiKey,metadata:meta(),content:contentState(),
    });
  return decorateVerifiedStagingEditorUi(response,{
    shop,...(view==="editor"?{pageId}:{}),
  });
};
function bodyResponse(res){
  return {status:res.status,headers:Object.fromEntries(res.headers.entries())};
}
let checks=0;
function check(condition,label){
  assert(condition,label);
  checks++;
  console.log("PASS Staging synthetic Chromium: "+label);
}
let browser;
try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const contexts=[];
  for(const [device,size] of [["desktop",{width:1280,height:900}],
    ["mobile",{width:390,height:844}]]){
    const context=await browser.newContext({
      viewport:size,deviceScaleFactor:1,
      isMobile:device==="mobile",hasTouch:device==="mobile",
      serviceWorkers:"block",
    });
    contexts.push(context);
    const browserErrors=[];
    const page=await context.newPage();
    page.on("pageerror",error=>browserErrors.push(error.message));
    await context.route("**/*",async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.href==="https://cdn.shopify.com/shopifycloud/app-bridge.js"){
        await route.fulfill({status:200,contentType:"application/javascript",
          body:"window.__shopifyTokenCount=0;window.shopify={idToken:async()=>{window.__shopifyTokenCount++;return 'synthetic-jwt-'+window.__shopifyTokenCount}};"});
        return;
      }
      // Reject all real network requests. Browser hits this exact synthetic origin.
      if(url.origin!==origin){await route.abort("blockedbyclient");return}
      if(url.pathname==="/__vsn/staging-editor-ui.js"){
        await route.fulfill({status:200,contentType:"application/javascript",
          body:STAGING_EDITOR_UI_SCRIPT});return;
      }
      if(url.pathname==="/app" || url.pathname==="/app/__vsn/pages/"+pageId+"/view"){
        const response=await trustedHtml(url.pathname==="/app"?"dashboard":"editor");
        await route.fulfill({...bodyResponse(response),body:await response.text()});
        return;
      }
      if(url.pathname.startsWith("/app/__vsn/pages/")){
        const options=req.headers();
        state.requests.push({method:req.method(),path:url.pathname,
          shop:url.searchParams.get("shop"),auth:options.authorization});
        if(url.searchParams.size!==1||url.searchParams.get("shop")!==shop ||
           !options.authorization?.startsWith("Bearer synthetic-jwt-")){
          await route.fulfill({status:401,body:""});return;
        }
        if(state.denied){
          await route.fulfill({status:403,body:""});return;
        }
        if(url.pathname==="/app/__vsn/pages/create"&&req.method()==="POST"){
          const submitted=req.postDataJSON();
          assert.deepEqual(Object.keys(submitted),["title"]);
          state.page={title:submitted.title,elements:[]};
          state.version=1;
          const r=status(201,{id:pageId,status:"draft",version:1,
            handle:"synthetic"});
          await route.fulfill({...bodyResponse(r),body:await r.text()});
          return;
        }
        if(url.pathname==="/app/__vsn/pages/"+pageId+"/content"){
          if(!state.page){await route.fulfill({status:404,body:""});return}
          if(req.method()==="GET"){
            const r=status(200,{page:contentState()});
            await route.fulfill({...bodyResponse(r),body:await r.text()});
            return;
          }
          const payload=req.postDataJSON();
          if(state.clash || payload.expectedVersion!==state.version){
            const r=status(409,{code:"DRAFT_VERSION_CONFLICT",
              currentVersion:state.version});
            await route.fulfill({...bodyResponse(r),body:await r.text()});
            return;
          }
          state.page.elements=structuredClone(payload.elements);
          state.version++;
          const r=status(200,{id:pageId,version:state.version});
          await route.fulfill({...bodyResponse(r),body:await r.text()});
          return;
        }
      }
      await route.fulfill({status:404,body:"Not found"});
    });
    if(device==="desktop"){
      await page.goto(origin+"/app?shop="+shop,{waitUntil:"domcontentloaded"});
      check(await page.getByRole("heading",{name:"Builder overview"}).isVisible(),
        "auth-scoped dashboard rendered with actual shipped HTML");
      await page.locator('input[name="title"]').fill("Synthetic merchant page");
      await page.getByRole("button",{name:"Create draft"}).click();
      await page.waitForURL("**/app/__vsn/pages/"+pageId+"/view?shop="+shop);
      check(state.version===1 && state.page.title==="Synthetic merchant page",
        "create draft form committed synthetic page and navigated to editor");
      await page.getByRole("button",{name:"Add text block"}).click();
      await page.locator("textarea").fill("Hello from real Chromium");
      check(await page.locator("[data-vsn-preview]").innerText()===
        "Hello from real Chromium","browser text preview updates without publishing");
      await page.getByRole("button",{name:"Save draft"}).click();
      await page.getByText("Draft saved.",{exact:false}).waitFor();
      check(state.version===2 &&
        state.page.elements[0].props.text==="Hello from real Chromium",
        "first authenticated save persisted exact synthetic content");
      await page.reload({waitUntil:"domcontentloaded"});
      await page.locator("textarea").waitFor();
      check(await page.locator("textarea").inputValue()==="Hello from real Chromium" &&
        await page.locator("[data-vsn-version]").innerText()==="2",
        "full Chromium reload rehydrated saved text and version 2");
      state.clash=true;
      await page.locator("textarea").fill("Should not overwrite");
      await page.getByRole("button",{name:"Save draft"}).click();
      await page.getByText(/Another edit changed this page/).waitFor();
      check(state.version===2 &&
        state.page.elements[0].props.text==="Hello from real Chromium",
        "409 optimistic-lock conflict refuses to overwrite persisted draft");
      state.clash=false;
    }else{
      await page.goto(origin+"/app/__vsn/pages/"+pageId+"/view?shop="+shop,{
        waitUntil:"domcontentloaded"});
      await page.locator("textarea").waitFor();
      check(await page.locator("textarea").inputValue()==="Hello from real Chromium",
        "mobile Chromium loads same saved document without new merchant");
      const widths=await page.evaluate(()=>({
        scroll:document.documentElement.scrollWidth,
        client:document.documentElement.clientWidth,
      }));
      check(widths.scroll<=widths.client+3,
        "mobile editor fits viewport without horizontal overflow");
    }
    check(browserErrors.length===0,
      device+" browser runtime has no uncaught JS errors: "+browserErrors.join(", "));
    const output=path.join("dev-browser-artifacts",
      "staging-editor-synthetic-"+device+".png");
    fs.mkdirSync(path.dirname(output),{recursive:true});
    await page.screenshot({path:output,fullPage:true});
    await context.close();
  }
  check(state.requests.length>=5 &&
    state.requests.every(q=>q.shop===shop && q.auth?.startsWith("Bearer synthetic-jwt-")),
    "all synthetic API calls carried Shopify-scoped fresh bearer tokens");
  console.log("PASS "+checks+" synthetic real Chromium assertions, NO real provider calls");
}catch(error){
  console.error("FAIL synthetic Staging Chromium:",String(error.message||error).slice(0,1700));
  process.exitCode=1;
}finally{
  if(browser)await browser.close().catch(()=>{});
}
