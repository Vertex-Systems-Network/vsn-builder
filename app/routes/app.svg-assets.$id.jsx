import { authenticate } from "../shopify.server";
import db from "../db.server.js";
export async function loader({request,params}){const {session}=await authenticate.admin(request);const asset=await db.builderSvgAsset.findFirst({where:{id:String(params.id||""),shop:session.shop,deletedAt:null}});if(!asset)throw new Response("SVG not found.",{status:404});return new Response(asset.svgText,{headers:{"Content-Type":"image/svg+xml; charset=utf-8","Cache-Control":"private, max-age=300","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'","X-Content-Type-Options":"nosniff"}})}
export default function SvgBinaryRoute(){return null;}
