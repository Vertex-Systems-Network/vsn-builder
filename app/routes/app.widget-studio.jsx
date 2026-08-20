import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { canBuilder, getBuilderRole } from "../utils/builder-permissions.js";
import { canAccessBuilderSystem } from "../utils/builder-permissions.server.js";
import { loadWidgetStudio, mutateCustomWidget, resetWidgetTemplate, saveCustomWidget, saveWidgetTemplate } from "../services/widget-studio.server.js";
import { listVsnCategories, listVsnControls, listVsnDataProviders, listVsnFieldTypes, listVsnInspectorPanels, listVsnPlugins, listVsnTemplateTypes, listVsnWidgets } from "../sdk/registry.js";
import { ensureBuiltinSdkPlugins } from "../sdk/builtinPlugins.js";
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";

ensureBuiltinSdkPlugins();
function json(value,fallback){try{const parsed=JSON.parse(String(value||""));return parsed??fallback;}catch{return fallback;}}
function sdkSnapshot(){return{plugins:listVsnPlugins(),widgets:listVsnWidgets(),providers:listVsnDataProviders(),categories:listVsnCategories(),fieldTypes:listVsnFieldTypes(),controls:listVsnControls(),templateTypes:listVsnTemplateTypes(),inspectorPanels:listVsnInspectorPanels()};}

export async function loader({request}){
  const {session}=await authenticate.admin(request);
  if(!(await canAccessBuilderSystem(db,session,"widgetStudio")))throw new Response("Your role does not have access to Widget Studio.",{status:403});
  return{...(await loadWidgetStudio(db,session.shop)),sdk:sdkSnapshot()};
}

export async function action({request}){
  assertTrustedMutationRequest(request);
  const {session}=await authenticate.admin(request);
  if(!(await canAccessBuilderSystem(db,session,"widgetStudio")))return Response.json({ok:false,error:"Your role does not have access to Widget Studio."},{status:403});
  const role=getBuilderRole(session);if(!canBuilder(role,"edit"))return Response.json({ok:false,error:"Your role cannot change widgets."},{status:403});
  const form=await request.formData();const intent=String(form.get("intent")||"");
  try{
    if(intent==="save-template"){
      const item=await saveWidgetTemplate(db,session.shop,{widgetType:String(form.get("widgetType")||""),html:String(form.get("html")||""),css:String(form.get("css")||""),enabled:String(form.get("enabled"))!=="false"});
      return Response.json({ok:true,intent,item,message:"Widget template override saved."});
    }
    if(intent==="reset-template"){
      const item=await resetWidgetTemplate(db,session.shop,String(form.get("widgetType")||""));return Response.json({ok:true,intent,item,message:"Widget template reset to the VSN renderer."});
    }
    if(intent==="save-custom"){
      const item=await saveCustomWidget(db,session.shop,{id:form.get("id"),widgetKey:form.get("widgetKey"),name:form.get("name"),category:form.get("category"),icon:form.get("icon"),description:form.get("description"),fields:json(form.get("fields"),[]),templateHtml:form.get("templateHtml"),templateCss:form.get("templateCss"),enabled:String(form.get("enabled"))!=="false"});
      return Response.json({ok:true,intent,item,message:form.get("id")?"Custom widget updated.":"Custom widget created and added to the editor."});
    }
    if(["trash","restore","hard-delete","toggle","duplicate"].includes(intent)){
      if(intent==="hard-delete"&&!canBuilder(role,"delete"))return Response.json({ok:false,error:"Your role cannot permanently delete widgets."},{status:403});
      const item=await mutateCustomWidget(db,session.shop,{id:String(form.get("id")||""),intent});return Response.json({ok:true,intent,item,message:intent==="hard-delete"?"Custom widget permanently deleted.":`Custom widget ${intent.replace("-"," ")} complete.`});
    }
    return Response.json({ok:false,error:"Unsupported Widget Studio action."},{status:400});
  }catch(error){console.error(`VSN Widget Studio action failed (${intent}):`,error);return Response.json({ok:false,error:error instanceof Error?error.message:"Widget Studio could not complete that action."},{status:400});}
}

export default function WidgetStudioRoute(){return null;}
