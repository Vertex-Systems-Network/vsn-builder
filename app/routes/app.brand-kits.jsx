import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { canBuilder, getBuilderRole } from "../utils/builder-permissions.js";
import { canAccessBuilderEditor } from "../utils/builder-permissions.server.js";
import { FALLBACK_GOOGLE_FONTS, SYSTEM_FONTS } from "../data/font-catalog.js";
import { applyBrandKitToLibraryItem, saveBrandKit, serializeBrandKit, setDefaultBrandKit } from "../services/brand-kits.server.js";
import { extractOwnedSiteBrandProfile } from "../services/brand-extraction.server.js";
import { getServerFeatureFlags } from "../services/feature-flags.server.js";
import { assertTrustedMutationRequest, safeClientErrorMessage } from "../utils/request-security.server.js";

function safe(value){return String(value||"").trim();}
export async function loader({request}){
  const {session}=await authenticate.admin(request);if(!(await canAccessBuilderEditor(db,session)))throw new Response("Brand Kit access denied.",{status:403});
  const [kits,trash,library,setting,customFonts]=await Promise.all([
    db.builderBrandKit.findMany({where:{shop:session.shop,deletedAt:null},orderBy:[{isDefault:"desc"},{updatedAt:"desc"}]}).catch(()=>[]),
    db.builderBrandKit.findMany({where:{shop:session.shop,deletedAt:{not:null}},orderBy:{deletedAt:"desc"}}).catch(()=>[]),
    db.builderLibraryItem.findMany({where:{shop:session.shop,deletedAt:null,kind:{in:["page","section"]}},select:{id:true,title:true,kind:true,category:true},orderBy:{updatedAt:"desc"},take:300}),
    db.builderShopSetting.findUnique({where:{shop:session.shop},select:{designTokensJson:true}}),
    db.builderCustomFont.findMany({where:{shop:session.shop,deletedAt:null},select:{family:true},orderBy:{family:"asc"}}).catch(()=>[]),
  ]);
  const fontFamilies=[...SYSTEM_FONTS,...FALLBACK_GOOGLE_FONTS,...customFonts.map((font)=>({family:font.family,value:`'${font.family}', sans-serif`,provider:"Custom"}))];
  return {fontFamilies,kits:kits.map(serializeBrandKit),trash:trash.map(serializeBrandKit),library,designTokensJson:setting?.designTokensJson||"{}",aiBrandExtractionEnabled:getServerFeatureFlags().brandIntelligenceExtractionV1===true};
}

export async function action({request}){
  const {session}=await authenticate.admin(request);if(!(await canAccessBuilderEditor(db,session)))return Response.json({ok:false,error:"Brand Kit access denied."},{status:403});
  const role=getBuilderRole(session);if(!canBuilder(role,"edit"))return Response.json({ok:false,error:"Your role cannot change Brand Kits."},{status:403});
  const form=await request.formData();const intent=safe(form.get("intent"));const id=safe(form.get("id"));
  if(intent==="extract-profile"){
    assertTrustedMutationRequest(request);
    if(getServerFeatureFlags().brandIntelligenceExtractionV1!==true)return Response.json({ok:false,intent,code:"BRAND_EXTRACTION_DISABLED",error:"Brand Intelligence extraction is disabled."},{status:404});
    try{
      const result=await extractOwnedSiteBrandProfile({
        db,
        shop:session.shop,
        sourceUrl:form.get("sourceUrl"),
        authorized:String(form.get("authorized"))==="true",
      });
      return Response.json(result);
    }catch(error){
      const status=Number(error?.status||500);
      return Response.json({
        ok:false,
        intent,
        code:String(error?.code||"BRAND_EXTRACTION_FAILED"),
        error:process.env.NODE_ENV==="production"&&status>=500?"Brand extraction failed.":safeClientErrorMessage(error,"Brand extraction failed."),
      },{status:status>=400&&status<=599?status:500});
    }
  }
  if(intent==="save"){
    const kit=await saveBrandKit({db,shop:session.shop,id:id||null,name:form.get("name"),logoUrl:form.get("logoUrl"),isDefault:String(form.get("isDefault"))==="true",input:{primary:form.get("primary"),secondary:form.get("secondary"),accent:form.get("accent"),text:form.get("text"),background:form.get("background"),surface:form.get("surface"),bodyFont:form.get("bodyFont"),headingFont:form.get("headingFont"),headingScale:form.get("headingScale"),spacingBase:form.get("spacingBase"),containerMaxWidth:form.get("containerMaxWidth"),radiusSm:form.get("radiusSm"),radiusMd:form.get("radiusMd"),radiusLg:form.get("radiusLg"),buttonRadius:form.get("buttonRadius"),shadowSm:form.get("shadowSm"),shadowMd:form.get("shadowMd"),shadowLg:form.get("shadowLg"),brandSummary:form.get("brandSummary"),brandAudience:form.get("brandAudience"),brandToneVoice:form.get("brandToneVoice"),brandImageryDirection:form.get("brandImageryDirection"),brandMerchandisingRules:form.get("brandMerchandisingRules"),brandCtaRules:form.get("brandCtaRules"),brandComponentGuidance:form.get("brandComponentGuidance"),brandDoRules:form.get("brandDoRules"),brandDontRules:form.get("brandDontRules")}});return Response.json({ok:true,intent,id:kit.id,message:id?"Brand Kit updated.":"Brand Kit created."});
  }
  if(!id)return Response.json({ok:false,error:"Brand Kit ID is required."},{status:400});
  if(intent==="default"){await setDefaultBrandKit({db,shop:session.shop,id});return Response.json({ok:true,intent,id,message:"Brand Kit is now the store default and Global Design tokens were updated."});}
  if(intent==="trash"){await db.builderBrandKit.updateMany({where:{id,shop:session.shop},data:{deletedAt:new Date(),isDefault:false}});return Response.json({ok:true,intent,id,message:"Brand Kit moved to Trash."});}
  if(intent==="restore"){await db.builderBrandKit.updateMany({where:{id,shop:session.shop},data:{deletedAt:null}});return Response.json({ok:true,intent,id,message:"Brand Kit restored."});}
  if(intent==="delete"){await db.builderBrandKit.deleteMany({where:{id,shop:session.shop}});return Response.json({ok:true,intent,id,message:"Brand Kit permanently deleted."});}
  if(intent==="apply-template"){const libraryItemId=safe(form.get("libraryItemId"));if(!libraryItemId)return Response.json({ok:false,error:"Choose a Library template."},{status:400});await applyBrandKitToLibraryItem({db,shop:session.shop,kitId:id,libraryItemId});return Response.json({ok:true,intent,id,libraryItemId,message:"Brand Kit applied to the selected Library item."});}
  return Response.json({ok:false,error:"Unsupported Brand Kit action."},{status:400});
}

export default function BrandKitsRoute(){const data=useLoaderData();return <s-page heading="Brand Kits"><s-section><div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Brand Kits are integrated into Builder workspace</h2><p className="mt-2 text-sm text-[#666]">Manage logos, colors, typography, spacing, radii and shadows from Builder → Brand Kits.</p><p className="mt-3 text-sm">Active kits: <b>{data.kits?.length||0}</b></p><s-button href="/app/pages?panel=brand-kits" variant="primary">Open in Builder</s-button></div></s-section></s-page>}
