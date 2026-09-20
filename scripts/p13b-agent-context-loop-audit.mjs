import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AI_AGENT_EXECUTABLE_COMMANDS,
} from "../app/ai/agent.js";
import {
  AI_AGENT_CONTEXT_REQUEST_SCHEMA,
  normalizeAgentContextRequests,
} from "../app/ai/agentContext.js";
import { AI_BEHAVIOR_DEFAULTS, resolveAiBehavior } from "../app/ai/behaviors.js";
import { getAiRuntimePolicy } from "../app/services/ai-provider.server.js";
import { runEditorAgentTurn } from "../app/services/ai-agent.server.js";

const read=(file)=>fs.readFileSync(file,"utf8");
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks+=1;};

ok(AI_AGENT_CONTEXT_REQUEST_SCHEMA?.properties?.requests?.maxItems===4,"Agent context planner must remain capped at four requests");
assert.deepEqual(AI_AGENT_EXECUTABLE_COMMANDS,[
  "element.insert",
  "element.move",
  "element.update-props",
  "element.update-styles",
  "element.rewrite",
  "element.remove",
]);
checks+=1;

const normalized=normalizeAgentContextRequests({requests:[
  {tool:"shopify.products.search",query:" title:Alpha ",id:"",resourceIdsJson:"[]",first:99,hours:0},
  {tool:"vsn.analytics.summary",query:"",id:"",resourceIdsJson:"[]",first:0,hours:168},
]});
ok(normalized.length===2&&normalized[0].input.query==="title:Alpha"&&normalized[0].input.first===10,"Agent context requests must reuse P1.3a normalization and bounds");
ok(normalized[1].input.hours===168,"Agent context planner may request only reviewed analytics windows");
assert.throws(()=>normalizeAgentContextRequests({requests:[{tool:"shopify.graphql",query:"",id:"",resourceIdsJson:"[]",first:1,hours:24}]}),/Unsupported AI context tool/);
checks+=1;

const behaviorV1=resolveAiBehavior({surface:"agent",operation:"edit",version:AI_BEHAVIOR_DEFAULTS.agent});
const behaviorV2=resolveAiBehavior({surface:"agent",operation:"edit",version:AI_BEHAVIOR_DEFAULTS.agentContext});
ok(behaviorV1.version==="agent-v1","P1.3b must preserve agent-v1");
ok(behaviorV2.version==="agent-v2"&&behaviorV2.instructions.includes("read-only context")&&behaviorV2.instructions.includes("Never publish"),"Agent v2 must keep read-only context and publish guardrails");
const policy=getAiRuntimePolicy({env:{}});
ok(policy.behaviorVersions.agent==="agent-v1"&&policy.behaviorVersions.agentContext==="agent-v2","Provider policy must keep v1 default plus explicit context-aware v2");

function makePage(){
  return {
    id:"page-ctx-1",shop:"context-agent.myshopify.com",title:"Product Landing",template:"product",
    workflowStatus:"draft",version:1,deletedAt:null,
    contentJson:JSON.stringify([{id:"heading-1",type:"heading",label:"Heading",props:{text:"Old"},styles:{},children:[]}]),
  };
}
function makeHarness(){
  const page=makePage();
  const usageUpdates=[];
  const db={
    builderPage:{findFirst:async({where})=>{
      if(where?.id&&where.id!==page.id)return null;
      if(where?.shop&&where.shop!==page.shop)return null;
      return {...page};
    }},
    builderRevision:{findMany:async()=>[]},
    builderAuditLog:{findMany:async()=>[]},
    builderAiUsage:{update:async({data})=>{usageUpdates.push({...data});return {};}},
  };
  const session={shop:page.shop,onlineAccessInfo:{associated_user:{account_owner:true,email:"owner@example.com"}}};
  return {page,db,session,usageUpdates};
}

const disabled=makeHarness();
let disabledGenerateCalls=0;
const disabledTurn=await runEditorAgentTurn({
  db:disabled.db,session:disabled.session,pageId:disabled.page.id,prompt:"Keep this page as-is",
  contextToolsEnabled:false,
  env:{VSN_AI_PROVIDER:"openai",VSN_AI_AGENT_BEHAVIOR_VERSION:"agent-v1"},
  providerConfigured:()=>true,
  reserveUsage:async()=>({id:"usage-disabled"}),
  getUsage:async()=>({used:1,quota:100,remaining:99}),
  runContextTools:async()=>{throw new Error("Context runner must not execute when disabled");},
  generate:async({behavior,schemaName})=>{
    disabledGenerateCalls+=1;
    ok(behavior.version==="agent-v1","Disabled context flag must retain agent-v1");
    ok(schemaName==="vsn_editor_agent","Disabled context flag must skip context planner schema");
    return {output:{status:"no_change",message:"No change needed.",steps:[]},usage:{input_tokens:4,output_tokens:2},provider:"openai",model:"test",responseId:"resp-disabled"};
  },
  executeCommand:async()=>{throw new Error("No command expected");},
});
ok(disabledGenerateCalls===1&&disabledTurn.contextTools.enabled===false&&disabledTurn.contextTools.requested.length===0,"Flag OFF must preserve the one-provider-call P1.1 path");

const enabled=makeHarness();
const providerCalls=[];
const contextCalls=[];
const commands=[];
const enabledTurn=await runEditorAgentTurn({
  db:enabled.db,session:enabled.session,pageId:enabled.page.id,prompt:"Use current product facts and improve the heading",
  admin:{graphql:async()=>{throw new Error("Direct admin call should be owned by the context executor");}},
  contextToolsEnabled:true,
  env:{VSN_AI_PROVIDER:"openai",VSN_AI_AGENT_CONTEXT_BEHAVIOR_VERSION:"agent-v2"},
  providerConfigured:()=>true,
  reserveUsage:async()=>({id:"usage-enabled"}),
  getUsage:async()=>({used:1,quota:100,remaining:99}),
  runContextTools:async(args)=>{
    contextCalls.push(args);
    ok(args.shop===enabled.page.shop&&args.pageId===enabled.page.id,"Context executor must use authenticated shop and canonical current page");
    ok(args.requests.length===1&&args.requests[0].tool==="shopify.products.search","Context executor must receive normalized allowlisted requests only");
    return {version:1,page:{id:enabled.page.id,template:"product",resourceId:"gid://shopify/Product/1"},results:[
      {tool:"shopify.products.search",ok:true,data:[{id:"gid://shopify/Product/1",title:"Alpha",handle:"alpha",status:"ACTIVE"}]},
    ]};
  },
  generate:async({behavior,input,schemaName})=>{
    providerCalls.push({behavior:behavior.version,input:JSON.stringify(input),schemaName});
    if(schemaName==="vsn_editor_agent_context_requests"){
      ok(behavior.version==="agent-v2","Context planner must use agent-v2");
      return {
        output:{requests:[{tool:"shopify.products.search",query:"title:Alpha",id:"",resourceIdsJson:"[]",first:6,hours:24}]},
        usage:{input_tokens:7,output_tokens:3},provider:"openai",model:"test",responseId:"resp-plan",
      };
    }
    ok(schemaName==="vsn_editor_agent","Final phase must retain the existing strict edit-plan schema");
    ok(JSON.stringify(input).includes("Server-authoritative read-only context results")&&JSON.stringify(input).includes("Alpha"),"Final provider input must receive normalized context as explicitly untrusted data");
    return {
      output:{status:"ready",message:"Updated from current product context.",steps:[
        {command:"element.update-props",summary:"Update heading",elementId:"heading-1",parentId:"",beforeId:"",afterId:"",nodeType:"",label:"",text:"",propsJson:JSON.stringify({text:"Alpha"}),stylesJson:"{}"},
      ]},
      usage:{input_tokens:11,output_tokens:5},provider:"openai",model:"test",responseId:"resp-final",
    };
  },
  executeCommand:async({name,input})=>{
    commands.push({name,input});
    ok(AI_AGENT_EXECUTABLE_COMMANDS.includes(name),"Context-aware Agent must still execute only P1.1 allowlisted commands");
    ok(input.pageId===enabled.page.id&&input.baseVersion===enabled.page.version,"Context data must never replace server-derived command authority");
    enabled.page.version+=1;
    return {commandId:"cmd-1",result:{version:enabled.page.version,revisionId:"rev-1",elementId:"heading-1",undo:{kind:"revision.restore",revisionId:"rev-checkpoint"}}};
  },
});
ok(providerCalls.length===2&&contextCalls.length===1&&commands.length===1,"Context-aware Agent must use one planner, one bounded context batch and one final plan");
ok(enabledTurn.behaviorVersion==="agent-v2"&&enabledTurn.contextTools.enabled===true,"Enabled context flag must select Agent v2");
ok(enabledTurn.contextTools.requested[0]==="shopify.products.search"&&enabledTurn.contextTools.results[0].ok===true,"Browser response may expose context tool metadata only");
ok(!JSON.stringify(enabledTurn.contextTools).includes("Alpha")&&!JSON.stringify(enabledTurn.contextTools).includes("gid://shopify/Product/1"),"Raw Shopify context must not be returned to the browser in Agent metadata");
const completedUsage=enabled.usageUpdates.find((row)=>row.status==="completed");
ok(completedUsage?.inputTokens===18&&completedUsage?.outputTokens===8&&completedUsage?.responseId==="resp-final","One Agent usage row must aggregate planner and final-provider token telemetry");

const degraded=makeHarness();
let degradedFinalInput="";
const degradedTurn=await runEditorAgentTurn({
  db:degraded.db,session:degraded.session,pageId:degraded.page.id,prompt:"Check current products before deciding",
  admin:{graphql:async()=>({})},contextToolsEnabled:true,
  env:{VSN_AI_PROVIDER:"openai",VSN_AI_AGENT_CONTEXT_BEHAVIOR_VERSION:"agent-v2"},
  providerConfigured:()=>true,
  reserveUsage:async()=>({id:"usage-degraded"}),
  getUsage:async()=>({used:1,quota:100,remaining:99}),
  runContextTools:async()=>{throw new Error("SECRET_TOKEN=must-not-leak");},
  generate:async({schemaName,input})=>{
    if(schemaName==="vsn_editor_agent_context_requests"){
      return {output:{requests:[{tool:"shopify.products.search",query:"status:active",id:"",resourceIdsJson:"[]",first:6,hours:24}]},usage:{input_tokens:2,output_tokens:1},provider:"openai",model:"test",responseId:"resp-degraded-plan"};
    }
    degradedFinalInput=JSON.stringify(input);
    return {output:{status:"no_change",message:"No safe change.",steps:[]},usage:{input_tokens:3,output_tokens:1},provider:"openai",model:"test",responseId:"resp-degraded-final"};
  },
  executeCommand:async()=>{throw new Error("No command expected");},
});
ok(degradedTurn.ok===true&&degradedTurn.contextTools.results[0].ok===false,"Context lookup failure must degrade to bounded metadata rather than bypass the Agent boundary");
ok(degradedFinalInput.includes("Server-authoritative context lookup was unavailable.")&&!degradedFinalInput.includes("SECRET_TOKEN"),"Raw context exceptions/secrets must not reach the final provider phase");

const flags=read("app/config/featureFlags.js");
ok(flags.includes('agentContextToolsV1')&&flags.includes('VSN_FEATURE_AI_AGENT_CONTEXT_TOOLS')&&flags.includes('defaultValue: false'),"Context-aware Agent must have an independent default-off kill switch");
const route=read("app/routes/app.ai-agent.jsx");
for(const marker of ["authenticate.admin","admin,","agentContextToolsV1","contextToolsEnabled"]){
  ok(route.includes(marker),`Agent route missing context-loop guard: ${marker}`);
}
const service=read("app/services/ai-agent.server.js");
for(const marker of ["AI_AGENT_CONTEXT_REQUEST_SCHEMA","normalizeAgentContextRequests","runAiContextTools","vsn_editor_agent_context_requests","Server-authoritative read-only context results","MAX_TOOL_CONTEXT_JSON_CHARS"]){
  ok(service.includes(marker),`Agent context orchestration contract missing: ${marker}`);
}
for(const forbidden of ["page.publish","executeDeveloperGraphql","OPENAI_API_KEY","/v1/responses","Authorization:"]){
  ok(!service.includes(forbidden),`Context-aware Agent must not broaden authority/provider transport: ${forbidden}`);
}
const contextContract=read("app/ai/contextTools.js");
ok(contextContract.includes("AI_CONTEXT_MAX_REQUESTS = 4")&&contextContract.includes("normalizeAiContextRequests"),"P1.3b must reuse the sealed P1.3a context registry");

console.log(`VSN P1.3b Agent context-loop audit: PASS (${checks}/${checks})`);
