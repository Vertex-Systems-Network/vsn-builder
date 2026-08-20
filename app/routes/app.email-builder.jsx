import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { canAccessBuilderSystem } from "../utils/builder-permissions.server.js";
import { captureEmailRevision, compileEmailTemplateInput, deleteEmailReusableBlock, listEmailBuilder, loadEmailCommerceCatalog, loadEmailPreviewBindings, saveEmailReusableBlock, starterInput } from "../services/email-builder.server.js";
import { findEmailMarketplaceTemplate } from "../email/emailMarketplace.js";
import { aiUsageStatus } from "../services/ai-builder.server.js";
import { runEmailAi } from "../services/email-ai.server.js";
import { getPlan } from "../utils/plan.server.js";
import { getMinimumPlanDecisionFromPlan, getMinimumPlanDecision } from "../services/entitlements.server.js";
import { ensureFeatureSchema, isMissingDatabaseTableError, schemaRecoveryMessage, VsnSchemaNotReadyError } from "../services/database-health.server.js";
import { assertTrustedMutationRequest, safeClientErrorMessage } from "../utils/request-security.server.js";

async function allowed(session){return canAccessBuilderSystem(db,session,"emailBuilder");}
function parseJsonForm(value,fallback={}){try{const parsed=JSON.parse(String(value||""));return parsed&&typeof parsed==="object"?parsed:fallback;}catch{return fallback;}}

export async function loader({request}){
  const {session,admin}=await authenticate.admin(request);
  if(!(await allowed(session))) throw new Response("Your role does not have access to Email Builder.",{status:403});
  try { await ensureFeatureSchema(db,"emailBuilder"); } catch (error) {
    if (error instanceof VsnSchemaNotReadyError || isMissingDatabaseTableError(error)) throw new Response(schemaRecoveryMessage(error,"Email Builder"),{status:503});
    throw error;
  }
  const [data,preview,commerce,ai,plan]=await Promise.all([listEmailBuilder(db,session.shop),loadEmailPreviewBindings(admin,session.shop),loadEmailCommerceCatalog(admin,session.shop),aiUsageStatus({db,shop:session.shop}),getPlan(db,session.shop)]);
  const marketplace=(data.marketplace||[]).map((item)=>({...item,available:getMinimumPlanDecisionFromPlan(plan,item.planTier||"core",{label:item.title}).allowed}));
  return {...data,marketplace,commerceCatalog:commerce,aiStatus:ai,plan:{key:plan.key,name:plan.name,marketplacePro:Boolean(plan.marketplacePro)},previewBindings:preview.bindings,previewMeta:preview.meta};
}

export async function action({request}){
  assertTrustedMutationRequest(request);
  const {session,admin}=await authenticate.admin(request);
  if(!(await allowed(session))) return Response.json({ok:false,error:"Your role does not have access to Email Builder."},{status:403});
  try { await ensureFeatureSchema(db,"emailBuilder"); } catch (error) {
    if (error instanceof VsnSchemaNotReadyError || isMissingDatabaseTableError(error)) return Response.json({ok:false,error:schemaRecoveryMessage(error,"Email Builder"),code:"VSN_SCHEMA_NOT_READY"},{status:503});
    throw error;
  }
  const form=await request.formData();const intent=String(form.get("intent")||"");const id=String(form.get("id")||"");
  try{
    if(intent==="save-reusable-block"){const item=await saveEmailReusableBlock(db,session.shop,{name:String(form.get("name")||"Reusable email block"),block:form.get("block"),createdBy:null});return Response.json({ok:true,intent,item,message:"Reusable email block saved."});}
    if(intent==="delete-reusable-block"){const result=await deleteEmailReusableBlock(db,session.shop,id);return Response.json({ok:true,intent,...result,message:"Reusable email block removed."});}
    if(intent==="ai-generate"){const commerce=await loadEmailCommerceCatalog(admin,session.shop);const result=await runEmailAi({db,shop:session.shop,operation:String(form.get("operation")||"email"),prompt:String(form.get("prompt")||""),currentDocument:parseJsonForm(form.get("document"),{}),meta:parseJsonForm(form.get("meta"),{}),commerceContext:{products:commerce.products.slice(0,8),collections:commerce.collections.slice(0,6)}});return Response.json({...result,intent});}
    if(intent==="create"){
      const starter=String(form.get("starter")||"");
      if(starter.startsWith("marketplace:")){const item=findEmailMarketplaceTemplate(starter.replace(/^marketplace:/,""));if(item){const entitlement=await getMinimumPlanDecision(db,session.shop,item.planTier||"core",{label:`${item.title} email template`});if(!entitlement.allowed)return Response.json({ok:false,error:entitlement.message,code:entitlement.code,entitlement},{status:403});}}
      const input=starterInput(starter);
      const row=await db.builderEmailTemplate.create({data:{shop:session.shop,...input}});
      return Response.json({ok:true,intent,id:row.id,message:"Email template created."});
    }
    const row=id?await db.builderEmailTemplate.findFirst({where:{id,shop:session.shop}}):null;
    if(!row)return Response.json({ok:false,error:"Email template not found."},{status:404});
    if(intent==="update"){
      const document=form.get("document")||row.documentJson;
      const input=compileEmailTemplateInput({name:form.get("name")||row.name,category:form.get("category")||row.category,subject:form.get("subject")||row.subject,preheader:form.get("preheader")??row.preheader,document,status:form.get("status")||row.status});
      await captureEmailRevision(db,session.shop,row,{label:String(form.get("versionLabel")||"Before save")});
      await db.builderEmailTemplate.update({where:{id},data:{...input,deletedAt:null}});
      return Response.json({ok:true,intent,id,message:"Email template updated."});
    }
    if(intent==="duplicate"){
      const copy=await db.builderEmailTemplate.create({data:{shop:session.shop,name:`${row.name} Copy`,category:row.category,subject:row.subject,preheader:row.preheader,documentJson:row.documentJson,compiledHtml:row.compiledHtml,plainText:row.plainText,status:"draft"}});
      return Response.json({ok:true,intent,id:copy.id,message:"Email template duplicated."});
    }
    if(intent==="trash"){await db.builderEmailTemplate.update({where:{id},data:{deletedAt:new Date()}});return Response.json({ok:true,intent,id,message:"Email template moved to Trash."});}
    if(intent==="restore"){await db.builderEmailTemplate.update({where:{id},data:{deletedAt:null}});return Response.json({ok:true,intent,id,message:"Email template restored."});}
    if(intent==="hard-delete"){await db.builderRevision.deleteMany({where:{shop:session.shop,pageId:`email:${id}`,kind:"email-save"}}).catch(()=>{});await db.builderEmailTemplate.delete({where:{id}});return Response.json({ok:true,intent,id,message:"Email template permanently deleted."});}
    return Response.json({ok:false,error:"Unsupported Email Builder action."},{status:400});
  }catch(error){console.error(`VSN Email Builder action failed (${intent}):`,error);if(isMissingDatabaseTableError(error))return Response.json({ok:false,error:schemaRecoveryMessage(error,"Email Builder"),code:"VSN_SCHEMA_NOT_READY"},{status:503});return Response.json({ok:false,error:safeClientErrorMessage(error,"Email Builder could not complete that action.")},{status:500});}
}

export default function EmailBuilderRoute(){return null;}
