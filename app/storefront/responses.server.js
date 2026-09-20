import { applyVsnSecurityHeaders } from "../utils/request-security.server.js";

function secureHeaders(values) {
  return applyVsnSecurityHeaders(values);
}

export function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: secureHeaders({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control":
        status === 200
          ? "public, max-age=15, stale-while-revalidate=30"
          : "no-store",
      Vary: "Accept-Encoding",
    }),
  });
}

export function javascriptResponse(source, status = 200) {
  return new Response(String(source || ""), {
    status,
    headers: secureHeaders({
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    }),
  });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: secureHeaders({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    }),
  });
}
