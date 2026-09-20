import assert from "node:assert/strict";
import fs from "node:fs";
import { FEATURE_FLAGS, normalizeFeatureFlags } from "../app/config/featureFlags.js";
import { analyzeReferenceSource } from "../app/services/reference-analysis.server.js";

const read=(file)=>fs.readFileSync(file,"utf8");
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks+=1;};

ok(FEATURE_FLAGS.referenceFidelityV1?.env==="VSN_FEATURE_REFERENCE_FIDELITY","P1.4b feature flag env contract missing");
ok(FEATURE_FLAGS.referenceFidelityV1?.defaultValue===false,"Reference fidelity feature must remain default-OFF");
ok(normalizeFeatureFlags({}).referenceFidelityV1===false,"Normalized reference fidelity flag must fail closed");

let reserveCalls=0;
let usageCalls=0;
const providerOutput={
  sourceType:"url",
  summary:"Reference hierarchy",
  sections:[{key:"hero",role:"hero",label:"Hero",order:1,layout:"split",columns:2,alignment:"center",emphasis:"primary",contentHint:"Product introduction"}],
  tokens:{colors:["#111111","#ffffff"],typography:[{role:"heading",scale:56,weight:700}],spacing:[24,48],radii:[12]},
  assets:[{kind:"image",role:"Hero product",positionHint:"right",required:true}],
  responsiveHints:["Stack on mobile"],
  fidelityPriorities:["Preserve hero hierarchy"],
  transformationNotes:["Transform rather than copy"],
};
const analysis=await analyzeReferenceSource({
  db:{},
  shop:"p14b-test.myshopify.com",
  sourceType:"url",
  sourceText:"Public reference hierarchy with a hero, product image and supporting content.",
  meterUsage:false,
  env:{VSN_AI_PROVIDER:"openai",VSN_AI_REFERENCE_BEHAVIOR_VERSION:"reference-v1"},
  providerConfigured:()=>true,
  reserveUsage:async()=>{reserveCalls+=1;return{id:"unexpected"};},
  getUsage:async()=>{usageCalls+=1;return{};},
  generate:async()=>({
    output:providerOutput,
    usage:{input_tokens:17,output_tokens:23},
    provider:"openai",
    model:"test",
    responseId:"resp-p14b",
  }),
});
ok(reserveCalls===0&&usageCalls===0,"Internally orchestrated reference analysis must not reserve or recount quota");
ok(analysis.usage===null&&analysis.telemetry.inputTokens===17&&analysis.telemetry.outputTokens===23,"Unmetered reference analysis must return bounded token telemetry for aggregation");
ok(!JSON.stringify(analysis).includes("Public reference hierarchy with"),"Reference result must not echo raw URL source text");

const route=read("app/routes/app.ai.jsx");
for(const marker of [
  "analyzeReferenceSource",
  "referenceAnalysisEnabled: featureFlags.referenceFidelityV1 === true",
  "referenceAnalyzer: analyzeReferenceSource",
]){
  ok(route.includes(marker),`AI route reference-fidelity wiring missing: ${marker}`);
}

const builder=read("app/services/ai-builder.server.js");
for(const marker of [
  "scoreReferencePlanFidelity",
  "shouldAnalyzeReference",
  "referenceAnalysisEnabled === true",
  "meterUsage: false",
  "context.referenceAnalysis",
  "urlText && !referenceAnalysis",
  "imageData && !referenceAnalysis",
  "referenceInputTokens + Number(result.usage?.input_tokens || 0)",
  "referenceOutputTokens + Number(result.usage?.output_tokens || 0)",
  "fidelity: referenceFidelity",
]){
  ok(builder.includes(marker),`AI Builder P1.4b contract missing: ${marker}`);
}
ok(!builder.includes("builderPage.update")&&!builder.includes("builderPage.create"),"P1.4b must not add page persistence to AI generation service");

const referenceService=read("app/services/reference-analysis.server.js");
for(const marker of ["meterUsage = true","meterUsage ? await reserveUsage","telemetry: Object.freeze"]){
  ok(referenceService.includes(marker),`Reference analysis internal-metering contract missing: ${marker}`);
}

const env=read(".env.example");
ok(env.includes("VSN_FEATURE_REFERENCE_FIDELITY=false"),"Reference fidelity flag must be documented default-OFF");

const roadmap=read(".ai/ROADMAP.md");
ok(roadmap.includes("P1.4b")&&roadmap.includes("default-off"),"Roadmap must record P1.4b guarded integration state");

console.log(`VSN P1.4b reference integration audit: PASS (${checks}/${checks})`);
