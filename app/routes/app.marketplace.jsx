import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { builderActor, getBuilderRole } from "../utils/builder-permissions.js";
import { canAccessBuilderAction } from "../utils/builder-permissions.server.js";
import { getPlan, getPlanUsage } from "../utils/plan.server.js";
import { getMinimumPlanDecision, getQuotaDecision } from "../services/entitlements.server.js";
import { findCatalogItem, getMarketplaceCatalog, installMarketplaceItem, rollbackMarketplaceInstall, toggleMarketplaceFavorite } from "../services/marketplace.server.js";
import { VSN_BASELINE } from "../config/baseline.js";

const CURRENT_VERSION=VSN_BASELINE.version;
export async function loader({request}) {
  const {session}=await authenticate.admin(request);
  if(!(await canAccessBuilderAction(db,session,"marketplace","browse")))throw new Response("Your role does not have permission to browse Marketplace.",{status:403});
  const [catalog,plan]=await Promise.all([getMarketplaceCatalog({db,shop:session.shop,currentVersion:CURRENT_VERSION}),getPlan(db,session.shop)]);
  return {...catalog,plan:{key:plan.key,name:plan.name,templateQuota:plan.templateQuota,marketplacePro:plan.marketplacePro},usage:await getPlanUsage(db,session.shop,plan),developerMode:Boolean(plan.developerMode)};
}

export async function action({request}) {
  const {session}=await authenticate.admin(request); if(!(await canAccessBuilderAction(db,session,"marketplace","browse")))return Response.json({ok:false,error:"Marketplace access denied."},{status:403});
  const role=getBuilderRole(session); const form=await request.formData(); const intent=String(form.get("intent")||""); const catalogId=String(form.get("catalogId")||"");
  if(!catalogId)return Response.json({ok:false,error:"Template ID is required."},{status:400});
  if(intent==="favorite"){
    if(!(await canAccessBuilderAction(db,session,"marketplace","favorite")))return Response.json({ok:false,error:"Your role cannot manage Marketplace favorites."},{status:403});
    const favorite=String(form.get("favorite"))==="true"; await toggleMarketplaceFavorite({db,shop:session.shop,catalogId,favorite}); return Response.json({ok:true,intent,catalogId,favorite,message:favorite?"Added to favorites.":"Removed from favorites."});
  }
  if(intent==="rollback"){
    if(!(await canAccessBuilderAction(db,session,"marketplace","rollback")))return Response.json({ok:false,error:"Your role cannot roll back Marketplace installs."},{status:403});
    await rollbackMarketplaceInstall({db,shop:session.shop,catalogId}); return Response.json({ok:true,intent,catalogId,message:"Marketplace install rolled back safely."});
  }
  if(intent!=="install")return Response.json({ok:false,error:"Unsupported Marketplace action."},{status:400});
  if(!(await canAccessBuilderAction(db,session,"marketplace","install")))return Response.json({ok:false,error:"Your role cannot install or update templates."},{status:403});
  const [catalog,plan]=await Promise.all([getMarketplaceCatalog({db,shop:session.shop,currentVersion:CURRENT_VERSION}),getPlan(db,session.shop)]); const item=findCatalogItem(catalog,catalogId);
  if(!item)return Response.json({ok:false,error:"Template is no longer available in the catalog."},{status:404});
  const tierDecision=await getMinimumPlanDecision(db,session.shop,item.planTier||"core",{plan,label:`${item.title} Marketplace template`});
  if(!tierDecision.allowed)return Response.json({ok:false,error:tierDecision.message,code:tierDecision.code,entitlement:tierDecision},{status:403});
  const existingInstall=await db.builderMarketplaceInstall.findUnique({where:{shop_catalogId:{shop:session.shop,catalogId}}}).catch(()=>null);
  if(!existingInstall){const quota=await getQuotaDecision(db,session.shop,"marketplaceInstalls",{plan});if(!quota.allowed)return Response.json({ok:false,error:quota.message,code:quota.code,entitlement:quota},{status:403});}
  if(!item.compatible)return Response.json({ok:false,error:"This template requires a newer builder version."},{status:409});
  const result=await installMarketplaceItem({db,shop:session.shop,item,actor:builderActor(session)});
  await db.builderAuditLog.create({data:{shop:session.shop,actor:builderActor(session),role,action:result.updated?"marketplace.updated":"marketplace.installed",details:JSON.stringify({catalogId,itemVersion:item.version,libraryItemId:result.libraryItem.id,assetsDeduplicated:result.assetCount})}}).catch(()=>{});
  return Response.json({ok:true,intent,catalogId,libraryItemId:result.libraryItem.id,updated:result.updated,message:result.updated?"Marketplace template updated. The previous installed version can be rolled back.":"Marketplace template installed for editor use. It remains separate from My Library."});
}

export default function MarketplaceRoute(){const data=useLoaderData();return <s-page heading="Template Marketplace"><s-section><div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Marketplace is integrated into Builder workspace</h2><p className="mt-2 text-sm text-[#666]">Open Builder → Marketplace for filters, live preview, favorites, recommendations and safe installs.</p><p className="mt-3 text-sm">Available catalog: <b>{data.counts?.pages||0}</b> page templates · <b>{data.counts?.sections||0}</b> sections.</p><s-button href="/app/pages?panel=marketplace" variant="primary">Open in Builder</s-button></div></s-section></s-page>}
