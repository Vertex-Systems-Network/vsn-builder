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
  const{session}=await authenticate.admin(request);const form=await request.formData();const intent=String(form.get("intent")||"toggle");const state=await loadState(session.shop);
  if(intent==="select-track"){
    const goal=String(form.get("goal")||"");if(!ONBOARDING_TRACKS.some((row)=>row.key===goal))return Response.json({ok:false,error:"Choose a valid onboarding goal."},{status:400});
    const next=await saveState(session.shop,{...state,goal});return Response.json({ok:true,intent,state:next,progress:await onboardingStatus(db,session.shop,next),message:`${ONBOARDING_TRACKS.find((row)=>row.key===goal)?.label} workflow selected.`});
  }
  if(intent==="seed-demo"){
    const goal=String(form.get("goal")||state.goal||ONBOARDING_TRACKS[0].key);const result=await seedDemoWorkspace(db,session.shop,goal);const next=await saveState(session.shop,{...state,goal,demoSeeded:true,demoSeededAt:new Date().toISOString()});
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
  return <s-page heading="Launchpad & onboarding"><s-section><div className="space-y-5 pb-10">
    {f.data?.error?<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{f.data.error}</div>:null}{f.data?.message?<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{f.data.message}</div>:null}
    <div className="rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">What are you building?</h2><p className="mt-1 text-sm text-[#666]">Choose a goal. The checklist adapts to the workflow instead of forcing every merchant through the same setup.</p><div className="mt-4 grid gap-3 md:grid-cols-5">{d.tracks.map((track)=><button key={track.key} type="button" onClick={()=>f.submit({intent:"select-track",goal:track.key},{method:"post"})} className={`rounded-xl border p-4 text-left ${selected.key===track.key?"border-emerald-400 bg-emerald-50":"bg-white"}`}><b className="text-sm">{track.label}</b><p className="mt-1 text-xs leading-5 text-[#666]">{track.description}</p></button>)}</div></div>
    <div className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]"><div className="rounded-xl border bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">{selected.label} checklist</h2><p className="mt-1 text-xs text-[#666]">{progress.completed}/{progress.total} complete · {progress.percent}%</p></div><div className="text-2xl font-semibold">{progress.percent}%</div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#eee]"><div className="h-full bg-emerald-500" style={{width:`${progress.percent}%`}}/></div><div className="mt-4 space-y-2">{(progress.steps||[]).map((step,i)=><div key={step.key} className={`flex items-center gap-3 rounded-lg border px-3 py-3 ${step.done?"border-emerald-200 bg-emerald-50":""}`}><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${step.done?"bg-emerald-600 text-white":"bg-[#eee]"}`}>{step.done?"✓":i+1}</span><span className="text-sm">{step.label}</span></div>)}</div></div><div className="rounded-xl border bg-white p-5"><h2 className="text-sm font-semibold">Guided demo</h2><p className="mt-1 text-xs leading-5 text-[#666]">Create local draft assets for this workflow. Demo seeding never publishes or modifies a live Shopify theme.</p><s-button variant="primary" disabled={f.state!=="idle"} onClick={()=>f.submit({intent:"seed-demo",goal:selected.key},{method:"post"})}>Prepare demo workspace</s-button>{f.data?.created?.length?<ul className="mt-3 space-y-1 text-xs text-[#666]">{f.data.created.map((row)=><li key={row.id}>{row.title} · {row.template}</li>)}</ul>:null}<div className="mt-4 text-xs text-[#777]">Demo flows available: Canvas → Native Section, Loop Builder, CRO, AI editable output and Campaign Builder.</div></div></div>
    <div className="rounded-xl border bg-[#fafafa] p-4 text-xs text-[#666]">Developer Mode is active. Onboarding can prepare data and readiness checks, but it does not deploy, activate billing or publish to a live store automatically.</div>
  </div></s-section></s-page>;
}
