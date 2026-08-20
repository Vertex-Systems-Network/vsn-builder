import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { BUILDER_PANEL_SYSTEM_MAP } from "../utils/builder-permissions.js";
import { canAccessBuilderSystem } from "../utils/builder-permissions.server.js";
import { dispatchBuilderPanelAction, loadBuilderPanel, unwrapPanelResult } from "../services/builder-panels.server.js";
import { assertTrustedMutationRequest, safeClientErrorMessage } from "../utils/request-security.server.js";

function humanPanelError(data, panel) {
  const raw=String(data?.error||"").trim();
  const lower=raw.toLowerCase();
  const readablePanel=String(panel||"this panel").replaceAll("-"," ");
  if(data?.status===401 || /unauthor|session|login/.test(lower)) {
    return "Your Shopify admin session expired. Refresh the embedded app and try again.";
  }
  if(data?.status===403 || /permission|access denied|scope/.test(lower)) {
    return `Shopify or Builder permissions are blocking ${readablePanel}. Refresh the embedded app. If this is a Shopify permission change, re-run shopify app dev, approve the requested scopes, then reopen the app.`;
  }
  if(/table.*does not exist|p2021|no such table|unknown column|p2022|migration/.test(lower)) {
    return "This Builder system is available in the code, but its database migration is missing or out of date. Run Prisma generate and the development migrations, then restart the app.";
  }
  if(/p1000|p1001|p1017|database.*unavailable|can.t reach database|connection.*database/.test(lower)) {
    return "The Builder cannot reach its database right now. Check DATABASE_URL / the development database, restart the dev server, then retry.";
  }
  if(/graphqlqueryerror|graphql client|admin api|graphql.*error/.test(lower)) {
    return `Shopify Admin API rejected the ${readablePanel} request. Open System Health → Shopify & Permissions to see the current scopes and live API status.`;
  }
  if(/fetch failed|network|econn|timeout|aborted|cloudflare|tunnel/.test(lower)) {
    return "The Builder could not reach a required service. Check the development tunnel/network and try again.";
  }
  if(/prismaclient|typeerror:|referenceerror:|syntaxerror:| at \/|node_modules|\.jsx?:\d/.test(lower)) {
    return `The ${readablePanel} system hit an internal runtime error. Check the development terminal for the technical trace; the rest of the Builder can continue running.`;
  }
  return raw || `Could not load ${readablePanel}.`;
}

function panelResponse(data, panel, fallbackStatus=200) {
  if(data?.error){
    const status=Number(data.status)||fallbackStatus||500;
    return Response.json({...data,status:status>=400?status:500,error:humanPanelError(data,panel)});
  }
  return Response.json(data||{ok:true});
}

export async function loader({request, params}) {
  const panel=String(params.panel||"");
  const {session}=await authenticate.admin(request.clone());
  const system=BUILDER_PANEL_SYSTEM_MAP[panel];
  if(system && !(await canAccessBuilderSystem(db,session,system))) return panelResponse({error:"VSN role permission denied.",status:403},panel,403);
  const data=await loadBuilderPanel(panel,request);
  return panelResponse(data,panel,200);
}

export async function action({request, params}) {
  assertTrustedMutationRequest(request);
  const panel=String(params.panel||"");
  const {session}=await authenticate.admin(request.clone());
  const system=BUILDER_PANEL_SYSTEM_MAP[panel];
  if(system && !(await canAccessBuilderSystem(db,session,system))) return panelResponse({error:"VSN role permission denied.",status:403},panel,403);
  try{
    const result=await dispatchBuilderPanelAction(panel,request);
    if(result==null) return panelResponse({error:"Unknown Builder panel action.",code:"PANEL_ACTION_NOT_FOUND",status:404},panel,404);
    if(result instanceof Response){
      const status=result.status;
      const data=await unwrapPanelResult(result);
      return panelResponse(data,panel,status);
    }
    return panelResponse(result,panel,200);
  }catch(error){
    if(error instanceof Response){
      const status=error.status;
      let data;
      try{data=await unwrapPanelResult(error);}catch{data={error:error.statusText||`Builder panel action failed with HTTP ${status}.`,status};}
      return panelResponse(data,panel,status);
    }
    console.error(`VSN builder panel action failed (${panel}):`,error);
    return panelResponse({error:safeClientErrorMessage(error,"Builder panel action failed."),code:"PANEL_ACTION_ERROR",status:500},panel,500);
  }
}
