import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BRAND_PROFILE_VERSION,
  brandProfileFromForm,
  brandProfileForm,
  brandProfileHasGuidance,
  normalizeBrandProfile,
} from "../app/brand/brandProfile.js";
import { brandKitToTokens, serializeBrandKit } from "../app/services/brand-kits.server.js";
import { buildEditorAgentContext } from "../app/services/ai-agent.server.js";
import { AI_AGENT_EXECUTABLE_COMMANDS } from "../app/ai/agent.js";

const read=(file)=>fs.readFileSync(file,"utf8");
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks+=1;};

ok(BRAND_PROFILE_VERSION===1,"Brand Profile version must remain explicit");

const hostile=normalizeBrandProfile({
  summary:"Premium {{ customer.email }} <script>alert(1)</script>",
  toneVoice:"Calm; javascript:alert(1); concise",
  doRules:Array.from({length:20},(_,i)=>`Rule ${i}`),
  dontRules:"No hype\nNo fake urgency\nNo hype",
});
ok(hostile.version===1,"Normalized profile must use v1");
ok(!/[<>]|\{\{|javascript\s*:/i.test(JSON.stringify(hostile)),"Brand Profile must remain plain guidance without executable/template syntax");
ok(hostile.doRules.length===12,"Brand Profile rule lists must be bounded");
ok(hostile.dontRules.length===2,"Brand Profile rules must be deduplicated");

const form=brandProfileForm({summary:"Quiet luxury",ctaRules:"Use direct action labels",doRules:["Use whitespace"]});
const roundTrip=brandProfileFromForm(form);
ok(roundTrip.summary==="Quiet luxury"&&roundTrip.ctaRules==="Use direct action labels","Brand Profile form round-trip must preserve normalized guidance");
ok(brandProfileHasGuidance(roundTrip),"Brand Profile guidance detection must recognize populated profiles");
ok(!brandProfileHasGuidance({}),"Empty legacy Brand Kits must not appear to have Brand Intelligence");

const legacyKit={
  id:"kit-legacy",shop:"brand-test.myshopify.com",name:"Legacy Kit",logoUrl:null,
  colorsJson:JSON.stringify({primary:"#112233",secondary:"#445566",accent:"#778899",text:"#111111",background:"#ffffff",surface:"#ffffff"}),
  typographyJson:JSON.stringify({bodyFont:"Inter",headingFont:"inherit",headingScale:1.25}),
  spacingJson:JSON.stringify({base:4,containerMaxWidth:"1200px"}),
  radiusJson:JSON.stringify({sm:"6px",md:"12px",lg:"20px",button:"8px"}),
  shadowsJson:JSON.stringify({sm:"none",md:"none",lg:"none"}),
  isDefault:true,updatedAt:new Date("2026-09-19T00:00:00Z"),
};
const serializedLegacy=serializeBrandKit(legacyKit);
ok(serializedLegacy.profile.version===1&&!brandProfileHasGuidance(serializedLegacy.profile),"Legacy Brand Kits without profileJson must deserialize safely");
const tokensBefore=brandKitToTokens(legacyKit);
const tokensAfter=brandKitToTokens({...legacyKit,profileJson:JSON.stringify({summary:"Must not affect tokens"})});
assert.deepEqual(tokensAfter,tokensBefore);
checks+=1;

const page={
  id:"page-1",shop:legacyKit.shop,title:"Home",template:"index",workflowStatus:"draft",version:4,deletedAt:null,
  contentJson:JSON.stringify([{id:"hero-title",type:"heading",label:"Hero",props:{text:"Hello"},styles:{},children:[]}]),
};
const defaultKit={...legacyKit,profileJson:JSON.stringify({
  summary:"Premium essentials",
  audience:"Design-conscious shoppers",
  toneVoice:"Concise, calm, evidence-led",
  imageryDirection:"Natural light, editorial product focus",
  merchandisingRules:"Lead with product value, then proof",
  ctaRules:"Use direct verbs; avoid false urgency",
  componentGuidance:"Use restrained hero and proof cards",
  doRules:["Use whitespace","Keep claims factual"],
  dontRules:["Do not invent scarcity"],
})};
const fakeDb={
  builderPage:{findFirst:async({where})=>where?.shop===page.shop&&where?.id===page.id?{...page}:null},
  builderRevision:{findMany:async()=>[]},
  builderAuditLog:{findMany:async()=>[]},
  builderBrandKit:{findFirst:async({where})=>where?.shop===page.shop?{...defaultKit}:null},
  builderShopSetting:{findUnique:async({where})=>where?.shop===page.shop?{designTokensJson:JSON.stringify({primaryColor:"#abcdef",unknownSecret:"never"})}:null},
};
const context=await buildEditorAgentContext({db:fakeDb,shop:page.shop,pageId:page.id,selectedIds:["hero-title"],breakpoint:"desktop"});
ok(context.brand?.kitId===defaultKit.id&&context.brand?.name==="Legacy Kit","Agent must load Brand Intelligence only from the authenticated shop Brand Kit");
ok(context.brand?.profile?.toneVoice.includes("Concise"),"Agent context must expose normalized Brand Profile guidance");
ok(context.brand?.visualTokens?.primaryColor==="#112233","Default Brand Kit visual tokens must remain authoritative");
ok(!Object.prototype.hasOwnProperty.call(context.brand?.visualTokens||{},"unknownSecret"),"Agent brand context must expose only known visual tokens");
ok(!AI_AGENT_EXECUTABLE_COMMANDS.some((name)=>name.startsWith("brand.")),"Agent executable commands must not mutate Brand Kits");
ok(!AI_AGENT_EXECUTABLE_COMMANDS.includes("page.publish"),"Brand Intelligence must not weaken the no-publish Agent boundary");

const schema=read("prisma/schema.prisma");
ok(schema.includes('profileJson    String   @default("{}")'),"BuilderBrandKit must have additive profileJson storage");
ok(!schema.includes("model BuilderBrandProfile"),"P1.2 baseline must not introduce a parallel Brand Profile table");
const migration=read("prisma/migrations/20260919151000_p12_brand_profile/migration.sql").trim();
ok(/^ALTER TABLE "BuilderBrandKit" ADD COLUMN "profileJson" TEXT NOT NULL DEFAULT '\{\}';$/.test(migration),"Brand Profile migration must be one additive column only");
ok(!/DROP|RENAME|DELETE|UPDATE/i.test(migration),"Brand Profile migration must not destructively alter existing data");

const service=read("app/services/brand-kits.server.js");
for(const token of ["profileJson","brandProfileFromForm","normalizeBrandProfile","brandKitToTokens"]){
  ok(service.includes(token),`Brand Kit service missing P1.2 contract: ${token}`);
}
const route=read("app/routes/app.brand-kits.jsx");
for(const token of ["brandToneVoice","brandImageryDirection","brandMerchandisingRules","brandCtaRules","brandDoRules","brandDontRules"]){
  ok(route.includes(token),`Brand Kit route missing profile field: ${token}`);
}
const host=read("app/components/BuilderPanelHost.jsx");
ok(host.includes("BrandProfileFields")&&host.includes("brandProfileForm"),"Builder host must delegate Brand Intelligence UI to the extracted component");
const fields=read("app/components/builder-panel/BrandProfileFields.jsx");
for(const token of ["Tone & voice","Imagery direction","Merchandising rules","CTA rules","Reusable component guidance","Do rules","Don't rules"]){
  ok(fields.includes(token),`Brand Profile editor missing field: ${token}`);
}

const backup=read("app/routes/app.backups.jsx");
ok(backup.includes("db.builderBrandKit.findMany")&&backup.includes("brandKits: brandKits.map"),"Backup export must preserve full Brand Kit rows including profileJson");
ok(backup.includes("payload.phase13?.brandKits")&&backup.includes("builderBrandKit.create"),"Backup restore must preserve profileJson through Brand Kit row restore");

const agent=read("app/services/ai-agent.server.js");
for(const token of ["loadAgentBrandContext","publicVisualTokens","normalizeBrandProfile","brandKitToTokens","brand,"]){
  ok(agent.includes(token),`Agent missing read-only Brand Intelligence contract: ${token}`);
}
ok(!agent.includes("builderBrandKit.update")&&!agent.includes("saveBrandKit"),"Editor Agent must not mutate Brand Intelligence");

console.log(`VSN P1.2 Brand Intelligence profile audit: PASS (${checks}/${checks})`);
