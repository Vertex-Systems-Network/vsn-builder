/* eslint-env node */
import { authenticate } from "../shopify.server.js";
import db from "../db.server.js";
import { canAccessBuilderEditor } from "../utils/builder-permissions.server.js";
import { assertTrustedMutationRequest, safeClientErrorMessage } from "../utils/request-security.server.js";
import { aiUsageStatus, runAiBuilder } from "../services/ai-builder.server.js";
import { migrateBuilderContent } from "../builder/schemaMigrations.js";

const MAX_AI_REQUEST_BYTES = 16 * 1024 * 1024;

function parseJson(value,fallback){try{return JSON.parse(String(value||""));}catch{return fallback;}}
function requestTooLarge(request){
  const raw=String(request.headers.get("content-length")||"").trim();
  if(!raw)return false;
  const length=Number(raw);
  return Number.isFinite(length)&&length>MAX_AI_REQUEST_BYTES;
}
export async function loader({request}){const{session}=await authenticate.admin(request);if(!(await canAccessBuilderEditor(db,session)))throw new Response("Forbidden",{status:403});return Response.json(await aiUsageStatus({db,shop:session.shop}));}
export async function action({request}){
  assertTrustedMutationRequest(request);
  if(requestTooLarge(request))return Response.json({ok:false,error:"AI Builder request is too large."},{status:413});
  const{session}=await authenticate.admin(request);
  if(!(await canAccessBuilderEditor(db,session)))return Response.json({ok:false,error:"Your role cannot use AI Builder."},{status:403});
  if(!process.env.OPENAI_API_KEY)return Response.json({ok:false,code:"AI_NOT_CONFIGURED",error:"AI Builder is not configured for this developer environment. Add OPENAI_API_KEY to your .env file and restart Shopify CLI."},{status:503});
  const form=await request.formData();
  const operation=String(form.get("operation")||"section");
  const allowed=new Set(["section","page","screenshot","url","rewrite","responsive","accessibility","alternatives"]);
  if(!allowed.has(operation))return Response.json({ok:false,error:"Unsupported AI operation."},{status:400});
  try{
    const currentPage=migrateBuilderContent(parseJson(form.get("currentPage"),[]));
    const globalStyles=parseJson(form.get("globalStyles"),{});
    const result=await runAiBuilder({db,shop:session.shop,pageId:String(form.get("pageId")||"")||null,operation,prompt:String(form.get("prompt")||""),imageData:String(form.get("imageData")||""),currentPage,globalStyles,pageTemplate:String(form.get("pageTemplate")||"page"),sourceUrl:String(form.get("sourceUrl")||""),selectedElementId:String(form.get("selectedElementId")||""),commerceContext:parseJson(form.get("commerceContext"),{})});
    return Response.json(result);
  }catch(error){
    const message=safeClientErrorMessage(error,"AI Builder failed.");
    if(process.env.NODE_ENV==="production")console.error("VSN AI Builder error:",message);else console.warn("VSN AI Builder request failed:",message);
    return Response.json({ok:false,error:message},{status:500});
  }
}
