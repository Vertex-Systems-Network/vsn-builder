import { authenticate } from "../shopify.server";
import db from "../db.server.js";

function safeDownloadName(value) {
  return String(value || "upload").replace(/[\r\n\"]+/g, "_").slice(0, 180) || "upload";
}

export async function loader({ request, params }) {
  const { session } = await authenticate.admin(request);
  const item = await db.builderFormUpload.findFirst({ where: { id: String(params.id || ""), shop: session.shop } });
  if (!item) return new Response("Not found", { status: 404 });
  return new Response(item.fileData, {
    headers: {
      "Content-Type": item.mimeType || "application/octet-stream",
      "Content-Length": String(item.size || item.fileData?.length || 0),
      "Content-Disposition": `attachment; filename="${safeDownloadName(item.fileName)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
