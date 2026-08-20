import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { getFontCatalog, getCustomFontCatalog } from "../services/font-registry.server.js";
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";

const ALLOWED = new Map([
  ["font/woff2", "woff2"], ["application/font-woff2", "woff2"], ["application/x-font-woff", "woff"], ["font/woff", "woff"],
  ["font/ttf", "ttf"], ["application/x-font-ttf", "ttf"], ["font/otf", "otf"], ["application/x-font-opentype", "otf"], ["application/vnd.ms-opentype", "otf"],
]);
function safeFamily(value){return String(value||"").trim().replace(/[<>\u0000-\u001f]/g,"").slice(0,100)}
function safeWeight(value){return Math.max(100,Math.min(900,Math.round((Number(value)||400)/100)*100))}
function safeStyle(value){return ["normal","italic"].includes(String(value||""))?String(value):"normal"}
function inferMime(file){const type=String(file?.type||"").toLowerCase();if(ALLOWED.has(type))return type;const name=String(file?.name||"").toLowerCase();if(name.endsWith('.woff2'))return 'font/woff2';if(name.endsWith('.woff'))return 'font/woff';if(name.endsWith('.ttf'))return 'font/ttf';if(name.endsWith('.otf'))return 'font/otf';return ''}
async function serializedRows(shop, deletedAt){
  const rows=await db.builderCustomFont.findMany({where:{shop,deletedAt},orderBy:[{family:"asc"},{weight:"asc"},{style:"asc"}],select:{id:true,family:true,weight:true,style:true,mimeType:true,fileName:true,createdAt:true,updatedAt:true,deletedAt:true}});
  return rows.map((font)=>({...font,provider:"Custom",value:`'${font.family}', sans-serif`,editorUrl:`/app/fonts/${font.id}`,storefrontUrl:`/apps/vsn-builder/font/${font.id}`}));
}
export async function loader({request}){
  const {session}=await authenticate.admin(request);
  const url=new URL(request.url);
  const mode=url.searchParams.get("mode");
  if(mode==="picker") return Response.json({ok:true,custom:await serializedRows(session.shop,null)});
  if(mode==="catalog"){
    const catalog=await getFontCatalog(db,session.shop);
    return Response.json({ok:true,...catalog});
  }
  const [custom,trash]=await Promise.all([serializedRows(session.shop,null),serializedRows(session.shop,{not:null})]);
  return Response.json({ok:true,custom,trash});
}
export async function action({request}){
  assertTrustedMutationRequest(request);
  const {session}=await authenticate.admin(request);let form;try{form=await request.formData();}catch(error){console.error("VSN font upload form parse failed:",error);return Response.json({ok:false,error:"The upload could not be read. Choose the file again; if it still fails, check the file size and restart the development server."},{status:400});}const intent=String(form.get('intent')||'');const id=String(form.get('id')||'');
  const existing=id?await db.builderCustomFont.findFirst({where:{id,shop:session.shop}}):null;
  if(["delete","trash"].includes(intent)){
    if(!existing)return Response.json({ok:false,error:'Custom font not found.'},{status:404});
    await db.builderCustomFont.update({where:{id},data:{deletedAt:new Date()}});return Response.json({ok:true,intent:"trash",id,message:"Font moved to Trash."});
  }
  if(intent==='restore'){
    if(!existing)return Response.json({ok:false,error:'Custom font not found.'},{status:404});
    const collision=await db.builderCustomFont.findFirst({where:{shop:session.shop,family:existing.family,weight:existing.weight,style:existing.style,deletedAt:null,id:{not:id}}});
    if(collision)return Response.json({ok:false,error:'An active font with the same family, weight and style already exists.'},{status:409});
    await db.builderCustomFont.update({where:{id},data:{deletedAt:null}});return Response.json({ok:true,intent,id,message:"Font restored."});
  }
  if(intent==='hard-delete'){
    if(!existing)return Response.json({ok:false,error:'Custom font not found.'},{status:404});
    await db.builderCustomFont.delete({where:{id}});return Response.json({ok:true,intent,id,message:"Font permanently deleted."});
  }
  if(intent==='update'){
    if(!existing)return Response.json({ok:false,error:'Custom font not found.'},{status:404});
    const family=safeFamily(form.get('family')||existing.family);const weight=safeWeight(form.get('weight')||existing.weight);const style=safeStyle(form.get('style')||existing.style);const file=form.get('file');
    if(!family)return Response.json({ok:false,error:'Font family is required.'},{status:400});
    const collision=await db.builderCustomFont.findFirst({where:{shop:session.shop,family,weight,style,id:{not:id}}});
    if(collision)return Response.json({ok:false,error:'A font with the same family, weight and style already exists.'},{status:409});
    const data={family,weight,style};
    if(file&&typeof file.arrayBuffer==='function'&&file.size>0){if(file.size>8*1024*1024)return Response.json({ok:false,error:'Font file must be 8 MB or smaller.'},{status:400});const mimeType=inferMime(file);if(!mimeType)return Response.json({ok:false,error:'Use WOFF2, WOFF, TTF, or OTF font files.'},{status:400});data.fileName=file.name;data.mimeType=mimeType;data.fileData=new Uint8Array(await file.arrayBuffer());}
    await db.builderCustomFont.update({where:{id},data});return Response.json({ok:true,intent,id,message:"Font updated."});
  }
  if(intent!=='upload')return Response.json({ok:false,error:'Unsupported font action.'},{status:400});
  const family=safeFamily(form.get('family'));const weight=safeWeight(form.get('weight'));const style=safeStyle(form.get('style'));const file=form.get('file');
  if(!family)return Response.json({ok:false,error:'Font family is required.'},{status:400});if(!file || typeof file.arrayBuffer !== 'function')return Response.json({ok:false,error:'Choose a font file.'},{status:400});if(file.size<=0||file.size>8*1024*1024)return Response.json({ok:false,error:'Font file must be between 1 byte and 8 MB.'},{status:400});const mimeType=inferMime(file);if(!mimeType)return Response.json({ok:false,error:'Use WOFF2, WOFF, TTF, or OTF font files.'},{status:400});
  const collision=await db.builderCustomFont.findFirst({where:{shop:session.shop,family,weight,style}});
  if(collision?.deletedAt){await db.builderCustomFont.update({where:{id:collision.id},data:{fileName:file.name,mimeType,fileData:new Uint8Array(await file.arrayBuffer()),deletedAt:null}});return Response.json({ok:true,intent,fontId:collision.id,message:'Existing trashed font restored with the new file.'});}
  if(collision)return Response.json({ok:false,error:'A font with the same family, weight and style already exists.'},{status:409});
  const bytes=new Uint8Array(await file.arrayBuffer());const font=await db.builderCustomFont.create({data:{shop:session.shop,family,weight,style,fileName:file.name,mimeType,fileData:bytes}});const custom=await getCustomFontCatalog(db,session.shop);return Response.json({ok:true,intent,font:custom.find(f=>f.id===font.id)||null,message:'Font uploaded.'});
}
export default function FontsRoute(){return null;}
