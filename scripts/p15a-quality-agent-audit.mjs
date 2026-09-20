import assert from "node:assert/strict";
import fs from "node:fs";
import { buildQualityReport, QUALITY_MAX_NODES, QUALITY_REPORT_VERSION } from "../app/ai/qualityAgent.js";

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks+=1;};

const motion=(id,x,reducedMotion="allow")=>({
  id,
  name:id,
  enabled:true,
  trigger:{type:"viewport-enter",once:true,threshold:.15},
  timeline:{duration:300,delay:0,easing:"ease",stagger:0,repeat:0,yoyo:false,reducedMotion},
  actions:[{id:`${id}-a`,type:"animate",target:{mode:"self",selector:"",slot:""},from:{opacity:1,x:0,y:0,scale:1,rotate:0,filter:""},to:{opacity:1,x,y:0,scale:1,rotate:0,filter:""}}],
});

const nodes=[{
  id:"root",
  type:"section",
  props:{},
  styles:{},
  interactions:{timelines:[motion("motion-a",12),motion("motion-b",24,"instant")]},
  children:[
    {id:"hero-image",type:"image",props:{src:"/hero.jpg",alt:"",loading:"eager",fetchPriority:"high"},styles:{},children:[]},
    {id:"image-2",type:"image",props:{src:"/2.jpg",alt:"Two",loading:"eager",fetchPriority:"high"},styles:{},children:[]},
    {id:"image-3",type:"image",props:{src:"/3.jpg",alt:"Three",loading:"eager",fetchPriority:"high"},styles:{},children:[]},
    {id:"image-4",type:"image",props:{src:"/4.jpg",alt:"Four",loading:"eager"},styles:{},children:[]},
    {id:"bad-link",type:"button",props:{text:"Unsafe",url:"javascript:alert(1)"},styles:{width:"620px"},children:[]},
    {id:"bad-binding",type:"text",props:{text:"Bound"},styles:{},bindings:{"props.text":{enabled:true,source:"secret.token",type:"text"}},children:[]},
    {id:"product-context",type:"product-title",props:{fallbackText:"Product"},styles:{},children:[]},
    {id:"unknown",type:"unknown-widget",props:{},styles:{},children:[]},
  ],
}];

const inputSnapshot=JSON.stringify(nodes);
const options={
  pageTemplate:"page",
  bindingContext:{product:null},
  emailDocument:{
    settings:{contentWidth:700},
    blocks:[{id:"mail-image",type:"image",content:{image:"https://cdn.example.test/image.jpg",alt:""},style:{},visibility:{desktop:true,mobile:true}}],
  },
  emailMeta:{subject:"Quality audit"},
};

const first=buildQualityReport(nodes,options);
const second=buildQualityReport(nodes,options);
ok(QUALITY_REPORT_VERSION===1,"Quality report contract version must remain explicit");
ok(first.deterministic===true&&first.validatorsAuthoritative===true,"Quality report must declare deterministic validator authority");
ok(JSON.stringify(first)===JSON.stringify(second),"Identical quality inputs must produce identical output");
ok(JSON.stringify(nodes)===inputSnapshot,"Quality reporting must not mutate Builder nodes");
ok(first.pass===false&&first.counts.severity.blockers>0,"Error/danger findings must block deterministic pass");
ok(first.counts.category.accessibility>0,"Accessibility scanner findings must be included");
ok(first.counts.category.responsive>0,"Responsive scanner findings must be included");
ok(first.counts.category.bindings>0,"Dynamic binding findings must be included");
ok(first.counts.category.links>0,"Link findings must be included");
ok(first.counts.category.shopify>0,"Shopify/VSN validity findings must be included");
ok(first.counts.category.performance>0,"Performance findings must be included");
ok(first.counts.category.motion>0,"Motion findings must be included");
ok(first.counts.category.email>0,"Optional email compatibility findings must be included");

const codes=new Set(first.findings.map((item)=>item.code));
for(const code of [
  "unsafe-link-protocol",
  "binding-source-invalid",
  "resource-widget-template-mismatch",
  "too-many-eager-images",
  "motion-property-conflict",
  "reduced-motion-allow",
]){
  ok(codes.has(code),`Expected deterministic quality code missing: ${code}`);
}
ok(first.findings.some((item)=>item.category==="email"&&["missing-alt","missing-footer","wide-content"].includes(item.code)),"Email compatibility issues must be normalized into the quality report");
ok(first.explanation.priorities.length<=5,"Explainable deterministic priority list must stay bounded");
ok(first.score>=0&&first.score<=100,"Quality score must remain bounded to 0–100");

const large=Array.from({length:QUALITY_MAX_NODES+10},(_,index)=>({id:`n-${index}`,type:"spacer",props:{height:"20px"},styles:{},children:[]}));
const bounded=buildQualityReport(large);
ok(bounded.bounds.nodesScanned===QUALITY_MAX_NODES&&bounded.bounds.nodesTruncated===true,"Quality scan must hard-bound page traversal");
ok(bounded.findings.some((item)=>item.code==="node-scan-truncated"),"Bounded scan truncation must be explicit");

const source=fs.readFileSync("app/ai/qualityAgent.js","utf8");
for(const forbidden of ["fetch(","generateStructuredAi","OPENAI_API_KEY","builderPage.update","builderPage.create","db.","admin.graphql","executeAiCommand"]){
  ok(!source.includes(forbidden),`P1.5a quality foundation must remain read-only/provider-free: ${forbidden}`);
}
for(const marker of ["validateAiVsnOutput","scanAiAccessibility","scanAiResponsive","inspectDynamicBindings","motionConflictWarnings","analyzeEmailCompatibility","validatorsAuthoritative"]){
  ok(source.includes(marker),`Quality Agent deterministic integration missing: ${marker}`);
}

console.log(`VSN P1.5a quality agent audit: PASS (${checks}/${checks})`);
