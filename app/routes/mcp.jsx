import db from "../db.server.js";
import { authenticateMcpToken, handleMcpMessage } from "../services/mcp-server.server.js";

// Public MCP endpoint (Streamable HTTP, JSON responses). Auth: Bearer vsnmcp_… token
// created in the editor's AI settings. No cookies, no Shopify admin session.
const headers = { "content-type": "application/json", "cache-control": "no-store" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function loader() {
  return json({ error: "Use POST with a JSON-RPC MCP message." }, 405);
}

export async function action({ request }) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const token = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const session = await authenticateMcpToken({ db, token });
  if (!session) return new Response(JSON.stringify({ error: "Invalid or revoked VSN MCP token." }), { status: 401, headers: { ...headers, "www-authenticate": 'Bearer realm="vsn-mcp"' } });
  const raw = await request.text();
  if (raw.length > 1_000_000) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large." } }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error." } }, 400); }
  const messages = Array.isArray(body) ? body.slice(0, 20) : [body];
  const replies = (await Promise.all(messages.map((message) => handleMcpMessage({ db, session, message })))).filter(Boolean);
  if (!replies.length) return new Response(null, { status: 202, headers: { "cache-control": "no-store" } });
  return json(Array.isArray(body) ? replies : replies[0]);
}
