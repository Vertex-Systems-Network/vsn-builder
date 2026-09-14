import { timingSafeEqual } from "node:crypto";
import db from "../db.server.js";
import { cleanupBuilderData } from "../utils/cleanup.server";

function authorized(request) {
  const secret = String(process.env.CLEANUP_SECRET || "");
  if (!secret) return false;
  const auth = request.headers.get("authorization") || "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(auth);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function action({ request }) {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const shops = await db.session.findMany({ distinct: ["shop"], select: { shop: true } });
  const results = [];
  for (const { shop } of shops) {
    try {
      results.push({ shop, ok: true, stats: await cleanupBuilderData(shop) });
    } catch (error) {
      results.push({ shop, ok: false, error: error instanceof Error ? error.message : "Cleanup failed." });
    }
  }
  return Response.json({ ok: true, shops: results.length, results });
}

export async function loader() {
  return Response.json({ ok: false, error: "Method not allowed." }, { status: 405, headers: { Allow: "POST" } });
}
