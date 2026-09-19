import assert from "node:assert/strict";
import fs from "node:fs";
import { resolvePublicHttpsTarget } from "../app/utils/security.server.js";
import {
  BRAND_EXTRACTION_SCHEMA_VERSION,
  BRAND_SOURCE_MAX_BYTES,
  BRAND_SOURCE_MAX_REDIRECTS,
  BRAND_SOURCE_MAX_TEXT,
  publicBrandSourceText,
} from "../app/brand/brandExtraction.js";
import {
  extractOwnedSiteBrandProfile,
  readOwnedBrandSource,
} from "../app/services/brand-extraction.server.js";

const read=(file)=>fs.readFileSync(file,"utf8");
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks+=1;};

ok(BRAND_EXTRACTION_SCHEMA_VERSION===1,"Brand extraction schema version must remain explicit");
ok(BRAND_SOURCE_MAX_BYTES===256*1024,"Brand source response cap must remain 256 KB");
ok(BRAND_SOURCE_MAX_REDIRECTS===3,"Brand source redirects must remain tightly bounded");
ok(BRAND_SOURCE_MAX_TEXT===18000,"Brand source prompt text must remain bounded");

const stripped=publicBrandSourceText(`
<html><head><style>.secret{display:none}</style><script>ignore me</script></head>
<body><!-- comment --><h1>Quiet Luxury</h1><p>Natural materials &amp; calm editorial direction.</p>
<template>{{ dangerous }}</template><svg><script>alert(1)</script></svg></body></html>`);
ok(stripped.includes("Quiet Luxury")&&stripped.includes("Natural materials"),"Public source extraction must retain readable brand text");
ok(!/<|>|script|display:none|dangerous|alert\(1\)/i.test(stripped),"Public source extraction must remove markup, scripts, styles, templates and SVG source");

await assert.rejects(()=>readOwnedBrandSource("http://example.com",{request:async()=>({})}),/HTTPS/i);
checks+=1;
await assert.rejects(()=>readOwnedBrandSource("https://user:pass@example.com",{request:async()=>({})}),/credentials/i);
checks+=1;
await assert.rejects(()=>resolvePublicHttpsTarget("https://127.0.0.1/"),/public HTTPS|private|non-public/i);
checks+=1;
await assert.rejects(()=>resolvePublicHttpsTarget("https://localhost/"),/public HTTPS|private|non-public/i);
checks+=1;

const requests=[];
const redirectSource=await readOwnedBrandSource("https://brand.example/start",{
  request:async(url,options)=>{
    requests.push({url,options});
    if(requests.length===1)return {ok:false,status:302,headers:{location:"/home"},body:""};
    return {
      ok:true,status:200,headers:{"content-type":"text/html; charset=utf-8"},
      body:"<html><body><h1>Brand Home</h1><p>"+("Calm editorial product presentation. ".repeat(8))+"</p></body></html>",
    };
  },
});
ok(requests.length===2&&requests[0].url==="https://brand.example/start"&&requests[1].url==="https://brand.example/home","Relative redirects must be re-resolved through the bounded source reader");
ok(requests.every((row)=>row.options?.maxResponseBytes===BRAND_SOURCE_MAX_BYTES&&row.options?.method==="GET"),"Every source request must retain the strict GET/response-byte contract");
ok(redirectSource.host==="brand.example"&&redirectSource.text.includes("Brand Home"),"Brand source reader must return only bounded host/text metadata");

let redirectCalls=0;
await assert.rejects(()=>readOwnedBrandSource("https://loop.example/",{
  request:async()=>{redirectCalls+=1;return {ok:false,status:302,headers:{location:"https://loop.example/again"},body:""};},
}),/redirected too many times/i);
checks+=1;
ok(redirectCalls===BRAND_SOURCE_MAX_REDIRECTS+1,"Redirect limit must fail closed after the bounded number of requests");

await assert.rejects(()=>readOwnedBrandSource("https://binary.example/",{
  request:async()=>({ok:true,status:200,headers:{"content-type":"application/octet-stream"},body:"binary"}),
}),/HTML or plain-text/i);
checks+=1;

const fakeDb={
  builderAiUsage:{update:async()=>({})},
};
const sourceHtml="<html><body><h1>Pella Atelier</h1><p>"+("Premium understated interiors with natural light and precise craftsmanship. ".repeat(8))+"</p></body></html>";
let generatedInput="";
const result=await extractOwnedSiteBrandProfile({
  db:fakeDb,
  shop:"brand-test.myshopify.com",
  sourceUrl:"https://brand.example/",
  authorized:true,
  request:async()=>({ok:true,status:200,headers:{"content-type":"text/html"},body:sourceHtml}),
  providerConfigured:()=>true,
  reserveUsage:async()=>({id:"usage-1"}),
  getUsage:async()=>({used:1,quota:50,remaining:49}),
  env:{},
  generate:async({input,schema,schemaName})=>{
    generatedInput=JSON.stringify(input);
    ok(schemaName==="vsn_brand_profile_extract"&&schema?.additionalProperties===false,"Brand extraction provider output must use a strict schema");
    return {
      output:{
        summary:"Premium <script>atelier</script> {{ hidden }}",
        audience:"Design-conscious homeowners",
        toneVoice:"Calm, precise, evidence-led",
        imageryDirection:"Natural light, tactile materials, restrained composition",
        merchandisingRules:"Lead with craftsmanship and material proof",
        ctaRules:"Use direct, low-pressure action labels",
        componentGuidance:"Editorial hero, material detail cards, proof sections",
        doRules:["Use whitespace","Use whitespace","Keep claims factual"],
        dontRules:["Do not invent urgency","javascript:alert(1)"],
      },
      provider:"openai",model:"test-model",responseId:"resp-1",usage:{input_tokens:10,output_tokens:20},
    };
  },
});
ok(generatedInput.includes("UNTRUSTED_BRAND_SOURCE")&&generatedInput.includes("Pella Atelier"),"Brand source text must be explicitly delimited as untrusted provider input");
ok(result.ok===true&&result.intent==="extract-profile"&&result.sourceHost==="brand.example","Extraction result must be a preview response with source-host metadata only");
ok(!("text" in result)&&!("body" in result)&&!("html" in result)&&!("sourceText" in result),"Extraction response must never return raw source text or HTML");
ok(result.profile.version===1&&result.profile.summary.includes("Premium")&&!/[<>{}]|javascript\s*:/i.test(JSON.stringify(result.profile)),"Provider output must pass through Brand Profile v1 normalization");
ok(result.profile.doRules.length===2,"Suggested rules must inherit Brand Profile deduplication");
ok(result.behaviorVersion==="brand-extract-v1","Extraction must use the versioned Brand behavior");

await assert.rejects(()=>extractOwnedSiteBrandProfile({
  db:fakeDb,shop:"brand-test.myshopify.com",sourceUrl:"https://brand.example/",authorized:false,
}),/own, control, or are authorized/i);
checks+=1;

const service=read("app/services/brand-extraction.server.js");
for(const marker of ["publicHttpsRequest","BRAND_SOURCE_MAX_REDIRECTS","BRAND_SOURCE_MAX_BYTES","generateStructuredAi","reserveAiUsage","normalizeBrandProfile","UNTRUSTED_BRAND_SOURCE"]){
  ok(service.includes(marker),`Brand extraction service missing safety contract: ${marker}`);
}
for(const forbidden of ["saveBrandKit","builderBrandKit.create","builderBrandKit.update","builderBrandKit.upsert","designTokensJson","publishedJson"]){
  ok(!service.includes(forbidden),`Preview extraction must not contain mutation path: ${forbidden}`);
}
for(const forbidden of ["OPENAI_API_KEY","/v1/responses","Authorization:"]){
  ok(!service.includes(forbidden),`Brand extraction must not bypass shared provider transport: ${forbidden}`);
}

const flags=read("app/config/featureFlags.js");
ok(flags.includes('brandIntelligenceExtractionV1')&&flags.includes('VSN_FEATURE_BRAND_INTELLIGENCE_EXTRACTION')&&flags.includes('defaultValue: false'),"Brand extraction must have an independent default-off kill switch");

const route=read("app/routes/app.brand-kits.jsx");
for(const marker of ['intent==="extract-profile"',"assertTrustedMutationRequest","extractOwnedSiteBrandProfile",'authorized:String(form.get("authorized"))==="true"']){
  ok(route.includes(marker),`Brand Kits route missing extraction guard: ${marker}`);
}
const extractIndex=route.indexOf('intent==="extract-profile"');
const saveIndex=route.indexOf('intent==="save"');
ok(extractIndex>=0&&saveIndex>extractIndex,"Preview extraction must remain a separate action before the existing save path");

const ui=read("app/components/builder-panel/BrandProfileFields.jsx");
for(const marker of ["Analyze an owned website","I confirm that I own, control, or am authorized","preview only","Use suggestions","normal Brand Kit Save action"]){
  ok(ui.includes(marker),`Brand extraction UI missing explicit human-control wording: ${marker}`);
}
ok(!ui.includes('intent:"save"'),"Brand extraction UI component must not trigger Brand Kit persistence directly");

const host=read("app/components/BuilderPanelHost.jsx");
ok(host.includes('intent:"extract-profile"')&&host.includes("passivePreview"),"Builder host must route extraction as a passive preview without panel refresh mutation semantics");

const behaviors=read("app/ai/behaviors.js");
ok(behaviors.includes('"brand-extract-v1"')&&behaviors.includes("untrusted source material")&&behaviors.includes("never saves or publishes"),"Brand extraction behavior must stay versioned and preview-only");

console.log(`VSN P1.2b owned-site Brand extraction audit: PASS (${checks}/${checks})`);
