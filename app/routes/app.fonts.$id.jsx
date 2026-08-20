import { authenticate } from "../shopify.server";
import db from "../db.server.js";
export async function loader({request,params}){const {session}=await authenticate.admin(request);const font=await db.builderCustomFont.findFirst({where:{id:String(params.id||''),shop:session.shop,deletedAt:null}});if(!font)throw new Response('Font not found.',{status:404});return new Response(font.fileData,{headers:{'Content-Type':font.mimeType||'application/octet-stream','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});}
export default function FontBinaryRoute(){return null;}
