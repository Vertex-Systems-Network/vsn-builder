import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AI_CONTEXT_MAX_ITEMS,
  AI_CONTEXT_MAX_REQUESTS,
  AI_CONTEXT_MAX_RESOURCE_IDS,
  AI_CONTEXT_TOOL_NAMES,
  normalizeAiContextRequests,
} from "../app/ai/contextTools.js";
import {
  AI_CONTEXT_SHOPIFY_QUERIES,
  runAiContextTools,
} from "../app/services/ai-context-tools.server.js";
import { AI_AGENT_EXECUTABLE_COMMANDS } from "../app/ai/agent.js";

const read=(file)=>fs.readFileSync(file,"utf8");
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks+=1;};

ok(AI_CONTEXT_MAX_REQUESTS===4,"AI context batches must remain capped at four requests");
ok(AI_CONTEXT_MAX_ITEMS===10,"AI context list results must remain tightly bounded");
ok(AI_CONTEXT_MAX_RESOURCE_IDS===5,"Translation resource IDs must remain tightly bounded");
ok(AI_CONTEXT_TOOL_NAMES.length===11,"P1.3a context registry must expose only the reviewed initial tools");

assert.throws(()=>normalizeAiContextRequests(Array.from({length:5},()=>({tool:"vsn.page.current"}))),/4-request limit/);
checks+=1;
assert.throws(()=>normalizeAiContextRequests([{tool:"shopify.graphql",input:{query:"{ shop { name } }"}}]),/Unsupported AI context tool/);
checks+=1;
assert.throws(()=>normalizeAiContextRequests([{tool:"shopify.product.get",input:{id:"not-a-gid"}}]),/GraphQL GID/);
checks+=1;
assert.throws(()=>normalizeAiContextRequests([{tool:"shopify.translations.get",input:{resourceIds:Array.from({length:6},(_,i)=>`gid://shopify/Product/${i+1}`)}}]),/at most 5/);
checks+=1;

const normalized=normalizeAiContextRequests([
  {tool:"shopify.products.search",input:{query:"  title:shoe\n ",first:99,graphql:"mutation { nope }"}},
  {tool:"shopify.collection.get",input:{id:"gid://shopify/Collection/22",first:99}},
  {tool:"vsn.analytics.summary",input:{hours:999}},
]);
ok(normalized[0].input.query==="title:shoe"&&normalized[0].input.first===10&&!Object.prototype.hasOwnProperty.call(normalized[0].input,"graphql"),"Product context input must discard unknown fields and cap first");
ok(normalized[1].input.first===8,"Collection detail product sample must remain capped");
ok(normalized[2].input.hours===24,"Analytics windows must fail to a reviewed fixed window");

for(const [name,query] of Object.entries(AI_CONTEXT_SHOPIFY_QUERIES)){
  ok(/^\s*#graphql\s*\n?\s*query\b/i.test(query),`Shopify context query must be read-only query: ${name}`);
  ok(!/\bmutation\b/i.test(query),`Shopify context query must never contain a mutation: ${name}`);
  ok(!/\bcustomer|\bcustomers|\border\b|\borders\b|payment|accessToken|secret/i.test(query),`Shopify context query must not include sensitive domains: ${name}`);
}

assert.deepEqual(AI_AGENT_EXECUTABLE_COMMANDS,[
  "element.insert",
  "element.move",
  "element.update-props",
  "element.update-styles",
  "element.rewrite",
  "element.remove",
]);
checks+=1;

const page={
  id:"page-1",shop:"context-test.myshopify.com",title:"Product Landing",handle:"product-landing",template:"product",
  resourceId:"gid://shopify/Product/1",resourceHandle:"alpha",isDefault:false,status:"draft",workflowStatus:"draft",
  shopifyPageId:null,shopifyPageUrl:null,version:3,publishedVersion:1,updatedAt:new Date("2026-09-19T12:00:00Z"),deletedAt:null,
};
const fakeDb={
  builderPage:{findFirst:async({where})=>where?.id===page.id&&where?.shop===page.shop&&where?.deletedAt===null?{...page}:null},
  builderVisitorSession:{findMany:async({where})=>where?.shop===page.shop?[
    {country:"US",pageViews:4,lastSeenAt:new Date()},
    {country:"GB",pageViews:2,lastSeenAt:new Date(Date.now()-10*60*1000)},
  ]:[]},
  builderExperiment:{findMany:async({where})=>where?.shop===page.shop&&where?.pageId===page.id?[
    {id:"exp-1",name:"Hero test",status:"running",targetType:"section",targetNodeId:"hero",goalType:"purchase",goalValue:null,trafficPercent:50,minimumSessions:200,confidenceThreshold:.95,winnerVariantId:null,startedAt:new Date("2026-09-18T00:00:00Z"),endedAt:null,updatedAt:new Date("2026-09-19T00:00:00Z"),variants:[
      {id:"v-a",key:"a",name:"Control",weight:50,isControl:true},
      {id:"v-b",key:"b",name:"Variation",weight:50,isControl:false},
    ]},
  ]:[]},
};
const calls=[];
const fakeAdmin={
  graphql:async(query,{variables}={})=>{
    calls.push({query,variables});
    let data={};
    if(query.includes("VsnAiContextProducts"))data={products:{nodes:[{id:"gid://shopify/Product/1",title:"Alpha",handle:"alpha",status:"ACTIVE",vendor:"VSN",productType:"Shoes",tags:["premium"],totalInventory:8}]}};
    else if(query.includes("VsnAiContextProduct"))data={product:{id:"gid://shopify/Product/1",title:"Alpha",handle:"alpha",status:"ACTIVE",vendor:"VSN",productType:"Shoes",tags:["premium"],totalInventory:8,variants:{nodes:[{id:"gid://shopify/ProductVariant/11",title:"Default",sku:"A-1",price:"99.00",inventoryQuantity:8}]}}};
    else if(query.includes("VsnAiContextCollections"))data={collections:{nodes:[{id:"gid://shopify/Collection/22",title:"Featured",handle:"featured",updatedAt:"2026-09-19T00:00:00Z"}]}};
    else if(query.includes("VsnAiContextCollection"))data={collection:{id:"gid://shopify/Collection/22",title:"Featured",handle:"featured",updatedAt:"2026-09-19T00:00:00Z",products:{nodes:[{id:"gid://shopify/Product/1",title:"Alpha",handle:"alpha",status:"ACTIVE"}]}}};
    else if(query.includes("VsnAiContextFiles"))data={files:{nodes:[
      {__typename:"MediaImage",id:"gid://shopify/MediaImage/31",alt:"Alpha front",image:{url:"https://cdn.shopify.com/a.jpg",width:1200,height:1200}},
      {__typename:"GenericFile",id:"gid://shopify/GenericFile/32",alt:"Guide",url:"https://cdn.shopify.com/guide.pdf"},
    ]}};
    else if(query.includes("VsnAiContextMarkets"))data={markets:{nodes:[{id:"gid://shopify/Market/41",handle:"us",name:"United States",status:"ACTIVE",type:"REGION"}]}};
    else if(query.includes("VsnAiContextLocales"))data={shopLocales:[{locale:"en",name:"English",primary:true,published:true},{locale:"fr",name:"French",primary:false,published:true}]};
    else if(query.includes("VsnAiContextTranslations"))data={translatableResourcesByIds:{nodes:[{resourceId:"gid://shopify/Product/1",translatableContent:[{key:"title",value:"Alpha",locale:"en",digest:"must-not-leak"}]}]}};
    return {json:async()=>({data})};
  },
};

const batch=await runAiContextTools({
  db:fakeDb,admin:fakeAdmin,shop:page.shop,pageId:page.id,
  requests:[
    {tool:"vsn.page.current"},
    {tool:"shopify.product.get",input:{id:"gid://shopify/Product/1"}},
    {tool:"shopify.locales.list"},
    {tool:"vsn.experiments.page"},
  ],
});
ok(batch.version===1&&batch.page.id===page.id&&batch.page.resourceId===page.resourceId,"Context batch must expose only canonical current-page identity at the envelope");
ok(batch.results.length===4&&batch.results.every((row)=>row.ok),"Reviewed context tools must execute independently");
ok(batch.results[1].data.variants?.[0]?.sku==="A-1","Product detail must expose bounded variant context");
ok(batch.results[2].data.length===2&&batch.results[2].data[0].locale==="en","Locale context must be normalized");
ok(batch.results[3].data.length===1&&batch.results[3].data[0].variants.length===2,"Experiment context must stay page scoped and bounded");

const second=await runAiContextTools({
  db:fakeDb,admin:fakeAdmin,shop:page.shop,pageId:page.id,
  requests:[
    {tool:"shopify.products.search",input:{query:"title:Alpha",first:6}},
    {tool:"shopify.files.search",input:{query:"filename:alpha*",first:6}},
    {tool:"shopify.markets.list",input:{first:10}},
    {tool:"shopify.translations.get",input:{resourceIds:["gid://shopify/Product/1"]}},
  ],
});
ok(second.results.every((row)=>row.ok),"Shopify context batch must complete with fixed query documents");
ok(second.results[0].data[0].title==="Alpha","Product search result must be normalized");
ok(second.results[1].data[0].url.startsWith("https://cdn.shopify.com/"),"File context must expose only safe HTTPS media URLs");
ok(second.results[2].data[0].handle==="us","Market context must expose reviewed market metadata");
ok(!JSON.stringify(second.results[3]).includes("digest"),"Translation context must omit mutation-enabling digest values");

ok(calls.length===6,"Only Shopify-backed tools should invoke Admin GraphQL");
ok(calls.every((call)=>Object.values(AI_CONTEXT_SHOPIFY_QUERIES).includes(call.query)),"Admin GraphQL must receive only hard-coded reviewed context queries");
ok(calls.every((call)=>call.variables&&typeof call.variables==="object"&&!Object.prototype.hasOwnProperty.call(call.variables,"graphql")),"Admin GraphQL inputs must be bounded variables, never query documents");

const analytics=await runAiContextTools({db:fakeDb,admin:fakeAdmin,shop:page.shop,pageId:page.id,requests:[{tool:"vsn.analytics.summary",input:{hours:24}}]});
ok(analytics.results[0].ok&&analytics.results[0].data.sessions24h===2,"Analytics context must reuse tenant-scoped VSN summary data");

await assert.rejects(()=>runAiContextTools({db:fakeDb,admin:fakeAdmin,shop:"other.myshopify.com",pageId:page.id,requests:[{tool:"vsn.page.current"}]}),/page not found/i);
checks+=1;

const service=read("app/services/ai-context-tools.server.js");
for(const forbidden of ["builderPage.update","builderPage.create","builderExperiment.update","builderExperiment.create","admin.graphql(source","executeDeveloperGraphql","publishedJson","OPENAI_API_KEY"]){
  ok(!service.includes(forbidden),`AI context service must remain read-only and provider-independent: ${forbidden}`);
}
ok(service.includes("AI_CONTEXT_SHOPIFY_QUERIES")&&service.includes("normalizeAiContextRequests"),"AI context executor must use the reviewed registry and fixed query set");

const agent=read("app/ai/agent.js");
ok(!agent.includes("shopify.products.search")&&!agent.includes("AI_CONTEXT_TOOL_NAMES"),"P1.3a must not broaden the P1.1 Agent protocol yet");

console.log(`VSN P1.3a server-authoritative context audit: PASS (${checks}/${checks})`);
