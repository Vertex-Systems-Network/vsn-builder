// AI providers offered in the editor. Shopify is the default: it opens Sidekick
// (Shopify's own assistant) and uses VSN's built-in generator for canvas output.
// Claude, Gemini and GPT generate through their APIs (shop key or app key) and can
// also drive VSN from their desktop/CLI apps over MCP. Cursor has no generation
// API, so it connects over MCP only.
export const AI_PROVIDERS = Object.freeze({
  shopify: { id: "shopify", label: "Shopify (Sidekick)", api: null, mcp: false, sidekick: true, help: "Default. Ask Shopify Sidekick in the admin; canvas generation uses VSN's built-in AI." },
  claude: { id: "claude", label: "Claude", api: "anthropic", mcp: true, help: "Anthropic API key, or connect Claude Desktop / Claude Code over MCP." },
  gemini: { id: "gemini", label: "Gemini", api: "gemini", mcp: true, help: "Google AI Studio API key, or connect Gemini CLI over MCP." },
  gpt: { id: "gpt", label: "GPT (OpenAI)", api: "openai", mcp: true, help: "OpenAI API key, or connect ChatGPT / Codex over MCP." },
  cursor: { id: "cursor", label: "Cursor", api: null, mcp: true, help: "Cursor has no generation API: connect it to the VSN MCP server." },
});
export const DEFAULT_SHOP_AI_PROVIDER = "shopify";
export const AI_PROVIDER_ORDER = Object.freeze(["shopify", "claude", "gemini", "gpt", "cursor"]);

const DEFAULT_MODELS = Object.freeze({ anthropic: "claude-sonnet-5-5", openai: "gpt-5-mini", gemini: "gemini-2.5-flash" });
export const MODEL_SUGGESTIONS = Object.freeze({
  anthropic: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"],
  openai: ["gpt-5-mini", "gpt-5"],
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro"],
});

export function apiProviderFor(providerId) { return AI_PROVIDERS[providerId]?.api || null; }
export function defaultModelFor(apiProvider) { return DEFAULT_MODELS[apiProvider] || DEFAULT_MODELS.anthropic; }
