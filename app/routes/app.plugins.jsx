import { authenticate } from "../shopify.server";
import { getBuilderRole } from "../utils/builder-permissions.js";
import db from "../db.server.js";
import { canAccessBuilderAction, canAccessBuilderSystem } from "../utils/builder-permissions.server.js";
import { VSN_BASELINE } from "../config/baseline.js";
import { getServerFeatureFlags } from "../services/feature-flags.server.js";
import { ensureBuiltinSdkPlugins } from "../sdk/builtinPlugins.js";
import { listVsnDataProviders, listVsnPlugins, listVsnSdkErrors, listVsnWidgets } from "../sdk/registry.js";
import { registerCoreShopifyDataProviders, resolveVsnDataProvider } from "../sdk/dataProviders.server.js";
import { validatePluginManifest } from "../sdk/validation.js";
import { VSN_PLUGIN_ALLOWED_PERMISSIONS, VSN_PLUGIN_FORBIDDEN_APIS } from "../sdk/security.js";
import { VSN_SDK_API_VERSION, VSN_SDK_SCHEMA_VERSION } from "../sdk/version.js";
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";
import { getFeatureDecision } from "../services/entitlements.server.js";

function snapshot() {
  ensureBuiltinSdkPlugins(); registerCoreShopifyDataProviders();
  const plugins=listVsnPlugins(); const widgets=listVsnWidgets(); const providers=listVsnDataProviders();
  return { ok:true, version:VSN_BASELINE.version, sdkVersion:VSN_SDK_API_VERSION, manifestSchemaVersion:VSN_SDK_SCHEMA_VERSION, featureEnabled:getServerFeatureFlags().developerSdkV1===true, plugins, widgets, providers, errors:listVsnSdkErrors(), security:{allowedPermissions:VSN_PLUGIN_ALLOWED_PERMISSIONS,forbiddenApis:VSN_PLUGIN_FORBIDDEN_APIS}, counts:{plugins:plugins.length,widgets:widgets.length,providers:providers.length,errors:listVsnSdkErrors().length} };
}

export async function loader({request}) {
  const {session}=await authenticate.admin(request);
  const role=getBuilderRole(session);
  if(!(await canAccessBuilderSystem(db,session,"developerSdk"))||!(await canAccessBuilderAction(db,session,"plugins","view"))) throw new Response("Your VSN role does not have access to the Developer SDK.",{status:403});
  const entitlement=await getFeatureDecision(db,session.shop,"developerSdk");
  if(!entitlement.allowed) throw new Response(entitlement.message,{status:403});
  return {...snapshot(),role,entitlement,permissions:{view:true,configure:await canAccessBuilderAction(db,session,"plugins","configure"),install:await canAccessBuilderAction(db,session,"plugins","install")}};
}

export async function action({request}) {
  assertTrustedMutationRequest(request);
  const {admin,session}=await authenticate.admin(request);
  if(!(await canAccessBuilderSystem(db,session,"developerSdk"))) return Response.json({ok:false,error:"Developer SDK access denied."},{status:403});
  const entitlement=await getFeatureDecision(db,session.shop,"developerSdk");
  if(!entitlement.allowed)return Response.json({ok:false,error:entitlement.message,code:entitlement.code,entitlement},{status:403});
  const form=await request.formData(); const intent=String(form.get("intent")||"");
  if(["validate-manifest","self-test"].includes(intent)&&!(await canAccessBuilderAction(db,session,"plugins","configure"))) return Response.json({ok:false,intent,error:"Your VSN role cannot configure or test plugins."},{status:403});
  if(intent==="validate-manifest"){
    let manifest;try{manifest=JSON.parse(String(form.get("manifest")||"{}"));}catch{return Response.json({ok:false,intent,error:"Manifest must be valid JSON."},{status:400});}
    const result=validatePluginManifest(manifest,{appVersion:VSN_BASELINE.version});return Response.json({ok:result.ok,intent,result,message:result.ok?"Manifest is compatible with this VSN SDK build.":undefined,error:result.ok?undefined:result.errors.join(" ")},{status:result.ok?200:422});
  }
  if(intent==="self-test"){
    const results=[];
    try{const items=await resolveVsnDataProvider("example:static-items",{admin,shop:session.shop},{limit:2});results.push({key:"example-provider",label:"Example data provider",pass:Array.isArray(items)&&items.length===2,detail:`Returned ${Array.isArray(items)?items.length:0} items`});}catch(error){results.push({key:"example-provider",label:"Example data provider",pass:false,detail:error instanceof Error?error.message:String(error)});}
    const state=snapshot();results.push({key:"plugin-registry",label:"Plugin registry",pass:state.plugins.every(plugin=>plugin.status==="active"),detail:`${state.plugins.length} bundled plugins registered`});results.push({key:"widget-renderers",label:"SDK widget registry",pass:state.widgets.length>=2,detail:`${state.widgets.length} SDK-backed widgets`});results.push({key:"shopify-providers",label:"Shopify providers",pass:state.providers.filter(provider=>provider.id.startsWith("shopify:")).length>=6,detail:`${state.providers.filter(provider=>provider.id.startsWith("shopify:")).length} Shopify providers`});
    return Response.json({ok:results.every(row=>row.pass),intent,results,message:results.every(row=>row.pass)?"SDK self-test passed.":"SDK self-test found a problem."});
  }
  return Response.json({ok:false,error:"Unsupported Developer SDK action."},{status:400});
}

export default function PluginSdkRoute(){return null;}
