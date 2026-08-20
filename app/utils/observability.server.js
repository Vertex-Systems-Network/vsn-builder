import crypto from "node:crypto";
import db from "../db.server.js";

export function requestIdFrom(request) {
  return request.headers.get("x-request-id") || crypto.randomUUID();
}

export function startObservation(request, route, shop = "unknown") {
  const requestId = requestIdFrom(request);
  const startedAt = Date.now();
  return { requestId, startedAt, route, method: request.method, shop };
}

export async function finishObservation(ctx, { status = 200, message = null } = {}) {
  const durationMs = Math.max(0, Date.now() - ctx.startedAt);
  const payload = { requestId: ctx.requestId, shop: ctx.shop, route: ctx.route, method: ctx.method, status, durationMs, message };
  console.log(JSON.stringify({ type: "vsn.request", ...payload }));
  try {
    if (ctx.shop && ctx.shop !== "unknown") {
      await db.builderRequestLog.create({ data: payload });
    }
  } catch (error) {
    console.warn("VSN request log persistence failed:", error?.message || error);
  }
  return payload;
}

export async function recordOperationalError({ shop, code, message, route = null, pageId = null, status = null, details = null }) {
  console.error(JSON.stringify({ type: "vsn.error", shop, code, message, route, pageId, status, details }));
  if (!shop) return;
  try {
    await db.builderDiagnosticEvent.create({ data: { shop, level: "error", code, message, pageId, status, details: details ? JSON.stringify(details).slice(0, 8000) : null } });
  } catch {}
}

export function withRequestId(response, requestId) {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
