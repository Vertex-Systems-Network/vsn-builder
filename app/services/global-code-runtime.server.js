import { parseEnterpriseSettings } from "./enterprise-hardening.server.js";
import { buildGlobalCssBundle, buildGlobalJsBundle, resolveGlobalCodeBundle } from "./global-code.server.js";

function runtimeResponse(source, kind, safeMode = false) {
  return new Response(String(source || ""), {
    status: 200,
    headers: {
      "Content-Type": kind === "css" ? "text/css; charset=utf-8" : "application/javascript; charset=utf-8",
      "Cache-Control": safeMode ? "no-store" : "public, max-age=15, stale-while-revalidate=30",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function serveGlobalCodeRuntime({ db, shop, kind, context = {} }) {
  let safeMode = false;
  try {
    const setting = await db.builderShopSetting.findUnique({ where: { shop }, select: { enterpriseJson: true } });
    safeMode = parseEnterpriseSettings(setting?.enterpriseJson).safeMode === true;
  } catch (error) {
    console.error("VSN Global Code Safe Mode lookup failed:", error);
  }
  if (safeMode) return runtimeResponse(`/* VSN Safe Mode: Global ${kind === "css" ? "CSS" : "JavaScript"} disabled. */`, kind, true);
  const rows = await resolveGlobalCodeBundle(db, shop, kind, context);
  return runtimeResponse(kind === "css" ? buildGlobalCssBundle(rows) : buildGlobalJsBundle(rows), kind, false);
}
