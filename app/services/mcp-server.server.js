// VSN MCP server (Streamable HTTP, JSON responses). Lets Claude Desktop / Code,
// Cursor, ChatGPT and Gemini CLI read and edit *draft* pages with a per-shop
// access token. Tools reuse the AI command registry, so every edit is
// version-checked and revision-backed, and publishing stays a manual step.
import { executeAiCommand, listAiCommandDefinitions } from "./ai-command-registry.server.js";
import { createPageWithQuota } from "./entitlements.server.js";
import { paidMutationDenied } from "./paid-mutation-guard.server.js";
import { createWidget, widgetRegistry } from "../builder/widgetRegistry.js";

export const MCP_PROTOCOL_VERSION = "2025-06-18";
const encoder = new TextEncoder();
const hex = (bytes) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
const b64url = (text) => btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (text) => { try { return atob(text.replace(/-/g, "+").replace(/_/g, "/")); } catch { return ""; } };
const sha256 = async (text) => hex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
const SHOP = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

function parse(value) { try { return JSON.parse(value || "{}") || {}; } catch { return {}; } }
async function readSettings(db, shop) { const row = await db.builderShopSetting.findUnique({ where: { shop }, select: { appSettingsJson: true } }).catch(() => null); return parse(row?.appSettingsJson); }
async function writeTokens(db, shop, tokens) {
  const current = await readSettings(db, shop);
  const next = { ...current, ai: { ...(current.ai || {}), mcpTokens: tokens } };
  await db.builderShopSetting.upsert({ where: { shop }, create: { shop, appSettingsJson: JSON.stringify(next) }, update: { appSettingsJson: JSON.stringify(next) } });
}

export async function listMcpTokens({ db, shop }) {
  return ((await readSettings(db, shop)).ai?.mcpTokens || []).map(({ id, label, createdAt, lastUsedAt }) => ({ id, label, createdAt, lastUsedAt: lastUsedAt || null }));
}

// Returns the plain token once; only its hash is stored.
export async function createMcpToken({ db, shop, label = "" }) {
  const random = hex(crypto.getRandomValues(new Uint8Array(24)));
  const token = `vsnmcp_${b64url(shop)}_${random}`;
  const tokens = (await readSettings(db, shop)).ai?.mcpTokens || [];
  if (tokens.length >= 10) throw new Error("Revoke an old MCP token first (limit 10).");
  const row = { id: random.slice(0, 8), label: String(label || "MCP client").slice(0, 60), hash: await sha256(token), createdAt: new Date().toISOString() };
  await writeTokens(db, shop, [...tokens, row]);
  return { token, id: row.id };
}

export async function revokeMcpToken({ db, shop, id }) {
  const tokens = (await readSettings(db, shop)).ai?.mcpTokens || [];
  await writeTokens(db, shop, tokens.filter((row) => row.id !== id));
}

export async function authenticateMcpToken({ db, token }) {
  const match = String(token || "").match(/^vsnmcp_([A-Za-z0-9_-]+)_([a-f0-9]{48})$/);
  const shop = match ? unb64url(match[1]) : "";
  if (!SHOP.test(shop)) return null;
  const tokens = (await readSettings(db, shop)).ai?.mcpTokens || [];
  const hash = await sha256(token);
  const row = tokens.find((item) => item.hash === hash);
  if (!row) return null;
  if (!row.lastUsedAt || Date.now() - Date.parse(row.lastUsedAt) > 60 * 60 * 1000) await writeTokens(db, shop, tokens.map((item) => item === row ? { ...item, lastUsedAt: new Date().toISOString() } : item)).catch(() => {});
  return { shop, accessToken: "mcp", id: `mcp:${row.id}` };
}

const SPEC_TYPES = { string: "string", integer: "integer", object: "object" };
function schemaFromSpec(spec = {}) {
  const properties = {}; const required = [];
  for (const [key, raw] of Object.entries(spec)) {
    if (key === "sourceGenerationId") continue;
    const optional = String(raw).endsWith("?");
    properties[key] = { type: SPEC_TYPES[String(raw).replace("?", "")] || "string" };
    if (!optional) required.push(key);
  }
  return { type: "object", properties, required, additionalProperties: false };
}

const COMMAND_HELP = {
  "page.read": "Read a page's current draft content and version.",
  "element.insert": "Insert a widget (nodeType from vsn_list_widgets) into a draft page. Needs the page version from page.read.",
  "element.move": "Move an element to another parent/position in a draft page.",
  "element.rewrite": "Replace the text of a heading/text/button element.",
  "element.remove": "Remove an element from a draft page.",
  "revision.restore": "Restore a draft page to an earlier revision.",
};

export function mcpTools() {
  const commands = listAiCommandDefinitions().filter((item) => item.directExecution && item.kind !== "consequential").map((item) => ({
    name: `vsn_${item.name.replace(/\./g, "_")}`, command: item.name,
    description: COMMAND_HELP[item.name] || `VSN command ${item.name}.`, inputSchema: schemaFromSpec(item.input),
  }));
  return [
    { name: "vsn_list_pages", description: "List builder pages (id, title, template, status, version).", inputSchema: { type: "object", properties: { limit: { type: "integer" } }, additionalProperties: false } },
    { name: "vsn_list_widgets", description: "List widget types with their default props, to use with element.insert.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "vsn_create_page", description: "Create a new empty draft page (counts toward the plan's page limit).", inputSchema: { type: "object", properties: { title: { type: "string" } }, required: ["title"], additionalProperties: false } },
    ...commands,
  ];
}

async function callTool({ db, session, name, args = {} }) {
  if (name === "vsn_list_pages") {
    const rows = await db.builderPage.findMany({ where: { shop: session.shop, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: Math.max(1, Math.min(100, Number(args.limit) || 30)), select: { id: true, title: true, template: true, status: true, version: true, updatedAt: true } });
    return rows;
  }
  if (name === "vsn_list_widgets") return Object.entries(widgetRegistry).map(([type, def]) => ({ type, label: def.label, acceptsChildren: Boolean(def.acceptsChildren), defaultProps: createWidget(type).props || {} }));
  const tool = mcpTools().find((item) => item.name === name);
  if (!tool) throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
  const denied = await paidMutationDenied(db, session.shop);
  if (denied) throw new Error("This store's plan does not allow builder edits.");
  if (name === "vsn_create_page") {
    const title = String(args.title || "AI page").slice(0, 120);
    const handle = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "page"}-${Date.now().toString(36)}`;
    const result = await createPageWithQuota(db, session.shop, { title, handle, template: "page", status: "draft", contentJson: "[]" });
    if (!result.page) throw new Error(result.quota?.message || "Page limit reached for this plan.");
    return { id: result.page.id, title: result.page.title, version: result.page.version };
  }
  return executeAiCommand({ db, session, actor: session.id, role: "mcp", name: tool.command, input: args });
}

const rpcResult = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

export async function handleMcpMessage({ db, session, message }) {
  const { id, method, params = {} } = message || {};
  if (message?.jsonrpc !== "2.0" || typeof method !== "string") return rpcError(id, -32600, "Invalid JSON-RPC request.");
  if (id === undefined) return null; // notification (e.g. notifications/initialized)
  if (method === "initialize") return rpcResult(id, { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "vsn-builder", version: "1.0.0" }, instructions: "VSN Builder for Shopify. Read pages, then edit drafts with the vsn_element_* tools using the page version from vsn_page_read. Publishing is done by the merchant in the editor." });
  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") return rpcResult(id, { tools: mcpTools().map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
  if (method === "tools/call") {
    try {
      const data = await callTool({ db, session, name: String(params.name || ""), args: params.arguments || {} });
      return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: Array.isArray(data) ? { items: data } : data, isError: false });
    } catch (error) {
      if (error?.code === -32602) return rpcError(id, -32602, error.message);
      return rpcResult(id, { content: [{ type: "text", text: error instanceof Error ? error.message : "Tool failed." }], isError: true });
    }
  }
  return rpcError(id, -32601, `Method not found: ${method}`);
}
