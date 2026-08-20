import { loader as libraryPanelLoader, action as libraryPanelAction } from "../routes/app.library";
import { loader as marketplacePanelLoader, action as marketplacePanelAction } from "../routes/app.marketplace";
import { loader as brandKitsPanelLoader, action as brandKitsPanelAction } from "../routes/app.brand-kits";
import { loader as campaignsPanelLoader, action as campaignsPanelAction } from "../routes/app.campaigns";
import { loader as emailBuilderPanelLoader, action as emailBuilderPanelAction } from "../routes/app.email-builder";
import { loader as experimentsPanelLoader, action as experimentsPanelAction } from "../routes/app.experiments";
import { loader as floatingPanelLoader, action as floatingPanelAction } from "../routes/app.floating-elements";
import { loader as fontsPanelLoader, action as fontsPanelAction } from "../routes/app.fonts";
import { loader as svgAssetsPanelLoader, action as svgAssetsPanelAction } from "../routes/app.svg-assets";
import { loader as motionPanelLoader, action as motionPanelAction } from "../routes/app.motion-library";
import { loader as submissionsPanelLoader, action as submissionsPanelAction } from "../routes/app.form-submissions";
import { loader as formSettingsPanelLoader, action as formSettingsPanelAction } from "../routes/app.form-settings";
import { loader as onboardingPanelLoader, action as onboardingPanelAction } from "../routes/app.onboarding";
import { loader as backupsPanelLoader, action as backupsPanelAction } from "../routes/app.backups";
import { loader as plansPanelLoader, action as plansPanelAction } from "../routes/app.plans";
import { loader as roleManagerPanelLoader, action as roleManagerPanelAction } from "../routes/app.role-manager";
import { loader as controlCenterPanelLoader, action as controlCenterPanelAction } from "../routes/app.control-center";
import { loader as pluginsPanelLoader, action as pluginsPanelAction } from "../routes/app.plugins";
import { loader as widgetStudioPanelLoader, action as widgetStudioPanelAction } from "../routes/app.widget-studio";

const PANEL_LOADERS={library:libraryPanelLoader,marketplace:marketplacePanelLoader,"brand-kits":brandKitsPanelLoader,campaigns:campaignsPanelLoader,"email-builder":emailBuilderPanelLoader,experiments:experimentsPanelLoader,"floating-elements":floatingPanelLoader,fonts:fontsPanelLoader,"svg-assets":svgAssetsPanelLoader,animations:motionPanelLoader,"form-submissions":submissionsPanelLoader,"form-settings":formSettingsPanelLoader,onboarding:onboardingPanelLoader,backups:backupsPanelLoader,plans:plansPanelLoader,"role-manager":roleManagerPanelLoader,"control-center":controlCenterPanelLoader,"developer-sdk":pluginsPanelLoader,"widget-studio":widgetStudioPanelLoader};
const PANEL_ACTIONS={library:libraryPanelAction,marketplace:marketplacePanelAction,"brand-kits":brandKitsPanelAction,campaigns:campaignsPanelAction,"email-builder":emailBuilderPanelAction,experiments:experimentsPanelAction,"floating-elements":floatingPanelAction,fonts:fontsPanelAction,"svg-assets":svgAssetsPanelAction,animations:motionPanelAction,"form-submissions":submissionsPanelAction,"form-settings":formSettingsPanelAction,onboarding:onboardingPanelAction,backups:backupsPanelAction,plans:plansPanelAction,"role-manager":roleManagerPanelAction,"control-center":controlCenterPanelAction,"developer-sdk":pluginsPanelAction,"widget-studio":widgetStudioPanelAction};
function panelFailure(panel,{status=500,code="PANEL_LOAD_ERROR",message=""}={}) {
  const permissionDenied = status === 401 || status === 403;
  return {
    error: true,
    code,
    status,
    userTitle: permissionDenied ? "Access needs attention" : "This section is temporarily unavailable",
    userMessage: permissionDenied
      ? "Your current Shopify session or VSN Builder role does not allow this section to open."
      : `VSN Builder could not load ${String(panel || "this section").replace(/[-_]+/g," ")} right now. Your saved work was not changed.`,
    userHint: permissionDenied
      ? "Reopen VSN Builder from Shopify Admin. If the issue remains, ask the store owner to review your VSN role and app permissions."
      : "Try again once. If it still fails, open System Health to see the exact service, permission, or data check that needs attention.",
    diagnosticCode: code,
  };
}

export async function unwrapPanelResult(result,panel=""){
  if(result instanceof Response){
    const contentType=result.headers.get("content-type")||"";
    if(contentType.includes("application/json")) {
      const payload=await result.json();
      if(result.ok)return payload;
      return panelFailure(panel,{status:result.status,code:"PANEL_HTTP_ERROR",message:payload?.error||payload?.message||""});
    }
    const text=await result.text();
    if(result.ok)return text;
    return panelFailure(panel,{status:result.status,code:"PANEL_HTTP_ERROR",message:text});
  }
  return result;
}
const LAZY_PANEL_KEYS=new Set(["marketplace","brand-kits","campaigns","email-builder","experiments","floating-elements","fonts","svg-assets","animations","form-submissions","form-settings","control-center","developer-sdk","widget-studio"]);
export async function loadBuilderPanel(panel, request){
  const loader=PANEL_LOADERS[panel];
  if(!loader) return {error:"Unknown builder panel.",code:"PANEL_NOT_FOUND",status:404};
  try{
    return await unwrapPanelResult(await loader({request:request.clone()}),panel);
  }catch(error){
    if(error instanceof Response){
      const contentType=error.headers.get("content-type")||"";
      let detail="";
      try{detail=contentType.includes("application/json")?JSON.stringify(await error.json()):await error.text();}catch{}
      return panelFailure(panel,{status:error.status,code:"PANEL_HTTP_ERROR",message:detail||error.statusText});
    }
    console.error(`VSN builder panel load failed (${panel}):`,error);
    return panelFailure(panel,{status:500,code:"PANEL_LOAD_ERROR",message:error instanceof Error?error.message:"Panel failed to load."});
  }
}

export async function preloadBuilderPanels(request){const entries=await Promise.all(Object.entries(PANEL_LOADERS).filter(([key])=>!LAZY_PANEL_KEYS.has(key)).map(async([key,loader])=>{try{return[key,await loadBuilderPanel(key,request)]}catch(error){console.error(`VSN panel preload failed (${key}):`,error);return[key,{error:error instanceof Error?error.message:"Panel failed to load."}]}}));return Object.fromEntries(entries)}
export async function dispatchBuilderPanelAction(panel,request){const action=PANEL_ACTIONS[panel];if(!action)return null;return action({request})}
export async function loadBackupPanel(request){return backupsPanelLoader({request})}
