import { paidMutationDenied } from "../services/paid-mutation-guard.server.js";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { ONBOARDING_TRACKS, onboardingStatus, seedDemoWorkspace } from "../services/commercialization.server.js";

function parse(v,f={}){try{return JSON.parse(v||"")||f}catch{return f}}
async function loadState(shop){const setting=await db.builderShopSetting.findUnique({where:{shop}});return parse(setting?.onboardingJson,{})}
async function saveState(shop,next){await db.builderShopSetting.upsert({where:{shop},create:{shop,onboardingJson:JSON.stringify(next)},update:{onboardingJson:JSON.stringify(next)}});return next;}

export async function loader({request}){
  const{session}=await authenticate.admin(request);const state=await loadState(session.shop);
  return{scope:session.scope||"",state,tracks:ONBOARDING_TRACKS,progress:await onboardingStatus(db,session.shop,state),developerMode:process.env.NODE_ENV!=="production"};
}

export async function action({request}){
  const{session}=await authenticate.admin(request);const form=await request.formData();const intent=String(form.get("intent")||"toggle");if(intent==="seed-demo"){const paidDenial=await paidMutationDenied(db,session.shop);if(paidDenial)return paidDenial;}const state=await loadState(session.shop);
  if(intent==="select-track"){
    const goal=String(form.get("goal")||"");if(!ONBOARDING_TRACKS.some((row)=>row.key===goal))return Response.json({ok:false,error:"Choose a valid onboarding goal."},{status:400});
    const next=await saveState(session.shop,{...state,goal});return Response.json({ok:true,intent,state:next,progress:await onboardingStatus(db,session.shop,next),message:`${ONBOARDING_TRACKS.find((row)=>row.key===goal)?.label} workflow selected.`});
  }
  if(intent==="seed-demo"){
    const goal=String(form.get("goal")||state.goal||ONBOARDING_TRACKS[0].key);let result;try{result=await seedDemoWorkspace(db,session.shop,goal)}catch(error){if(error?.status===403)return Response.json({ok:false,intent,error:error.message,code:error.code,entitlement:error.decision},{status:403});throw error}const next=await saveState(session.shop,{...state,goal,demoSeeded:true,demoSeededAt:new Date().toISOString()});
    await db.builderAuditLog.create({data:{shop:session.shop,action:"onboarding.demo_seeded",details:JSON.stringify({goal,created:result.created.map((row)=>row.id)})}}).catch(()=>{});
    return Response.json({ok:true,intent,state:next,progress:await onboardingStatus(db,session.shop,next),created:result.created,message:`Developer-safe demo workspace prepared for ${result.track.label}. Nothing was published to Shopify.`});
  }
  if(intent==="mark"){
    const key=String(form.get("key")||"");const value=String(form.get("value"))==="true";const next=await saveState(session.shop,{...state,[key]:value});return Response.json({ok:true,intent,state:next,progress:await onboardingStatus(db,session.shop,next),message:"Onboarding checkpoint updated."});
  }
  const key=String(form.get("key")||"");if(!key)return Response.json({ok:false,error:"Onboarding setting is missing."},{status:400});const next=await saveState(session.shop,{...state,[key]:String(form.get("value"))==="true"});return Response.json({ok:true,state:next,progress:await onboardingStatus(db,session.shop,next)});
}

export default function Onboarding(){
  const d=useLoaderData();const f=useFetcher();const progress=f.data?.progress||d.progress;const selected=progress?.selected||d.tracks[0];
  return <s-page heading="Launchpad & onboarding"><s-stack direction="block" gap="base">
    {f.data?.error?<s-banner tone="critical">{f.data.error}</s-banner>:null}{f.data?.message?<s-banner tone="success">{f.data.message}</s-banner>:null}
    <s-section heading="What are you building?"><s-stack direction="block" gap="base"><s-paragraph color="subdued">Choose a goal. The checklist adapts to the workflow instead of forcing every merchant through the same setup.</s-paragraph><s-grid gridTemplateColumns="@container (inline-size > 800px) repeat(5, 1fr), 1fr" gap="small-200">{d.tracks.map((track)=><s-clickable key={track.key} onClick={()=>f.submit({intent:"select-track",goal:track.key},{method:"post"})} accessibilityLabel={track.label} border="base" borderColor={selected.key===track.key?"strong":"base"} borderRadius="base" padding="base" background={selected.key===track.key?"subdued":"base"}><s-stack direction="block" gap="small-200"><s-text type="strong">{track.label}</s-text>{selected.key===track.key?<s-badge tone="success">Selected</s-badge>:null}<s-text color="subdued">{track.description}</s-text></s-stack></s-clickable>)}</s-grid></s-stack></s-section>
    <s-grid gridTemplateColumns="@container (inline-size > 900px) 1.4fr .6fr, 1fr" gap="base"><s-section heading={`${selected.label} checklist`}><s-stack direction="block" gap="base"><s-stack direction="inline" justifyContent="space-between" alignItems="center"><s-text color="subdued">{progress.completed}/{progress.total} complete · {progress.percent}%</s-text><s-heading>{progress.percent}%</s-heading></s-stack><s-box background="subdued" borderRadius="base" overflow="hidden" blockSize="8px"><div style={{height:"100%",width:`${progress.percent}%`,background:"var(--vsn-e-green)"}}/></s-box><s-stack direction="block" gap="small-200">{(progress.steps||[]).map((step,i)=><s-box key={step.key} border="base" borderRadius="base" padding="small-200 base" background={step.done?"subdued":"base"}><s-stack direction="inline" gap="small-200" alignItems="center"><s-badge tone={step.done?"success":"neutral"}>{step.done?"✓":i+1}</s-badge><s-text>{step.label}</s-text></s-stack></s-box>)}</s-stack></s-stack></s-section><s-section heading="Guided demo"><s-stack direction="block" gap="base"><s-paragraph color="subdued">Create local draft assets for this workflow. Demo seeding never publishes or modifies a live Shopify theme.</s-paragraph><s-stack direction="inline"><s-button variant="primary" disabled={f.state!=="idle"} onClick={()=>f.submit({intent:"seed-demo",goal:selected.key},{method:"post"})}>Prepare demo workspace</s-button></s-stack>{f.data?.created?.length?<s-unordered-list>{f.data.created.map((row)=><s-list-item key={row.id}>{row.title} · {row.template}</s-list-item>)}</s-unordered-list>:null}<s-text color="subdued">Demo flows available: Canvas → Native Section, Loop Builder, CRO, AI editable output and Campaign Builder.</s-text></s-stack></s-section></s-grid>
    <s-banner tone="info">Developer Mode is active. Onboarding can prepare data and readiness checks, but it does not deploy, activate billing or publish to a live store automatically.</s-banner>
  </s-stack></s-page>;
}
