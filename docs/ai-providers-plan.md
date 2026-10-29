# VSN AI providers — plan and status

Editor AI panel offers five providers. **Shopify is the default.**

| Provider | How it works | Status |
|---|---|---|
| Shopify (Sidekick) | Shopify does not expose a generation API to apps. Sidekick works the other way: it calls an app's *Sidekick app extension* tools, and the app can open Sidekick with `shopify.sidekick.launch()`. In VSN the editor shows **Ask Shopify Sidekick** when `shopify.sidekick.isEnabled()` is true; canvas generation uses VSN's built-in AI (app key). | Launch button: done. Sidekick tools extension: phase 3. |
| Claude | Anthropic Messages API (shop key or app `ANTHROPIC_API_KEY`), structured output via a forced tool call. Also Claude Desktop / Claude Code over MCP. | Done |
| Gemini | Gemini API JSON mode with the plan schema (shop key or app `GEMINI_API_KEY`). Also Gemini CLI over MCP. | Done |
| GPT | OpenAI Responses API with JSON schema (shop key or app `OPENAI_API_KEY`). Also ChatGPT connectors / Codex over MCP. | Done |
| Cursor | No generation API. Connects to the VSN MCP server. | Done (MCP) |

## Keys
- Shop keys are encrypted with AES-GCM (key derived from `SHOPIFY_API_SECRET`) in `BuilderShopSetting.appSettingsJson.ai.keys`, never sent to the browser.
- Resolution: chosen provider → shop key → app key; if the chosen provider has no API (Shopify, Cursor) the first API with a key is used (Claude, then OpenAI, then Gemini).
- All AI features (page builder, agent, email, brand extraction, reference analysis, quality fixes) use the same resolution and the plan's AI quota.

## MCP server
- Endpoint: `POST {app origin}/mcp` (Streamable HTTP, JSON responses, protocol 2025-06-18).
- Auth: `Authorization: Bearer vsnmcp_…` token created in the editor (AI panel → provider → "Connect over MCP"). Only a SHA-256 hash is stored; up to 10 tokens per shop; revocable.
- Tools: `vsn_list_pages`, `vsn_list_widgets`, `vsn_create_page` (plan page quota), and the AI command registry draft commands (`vsn_page_read`, `vsn_element_insert|move|rewrite|remove`, `vsn_revision_restore`). Every edit is version-checked and revision-backed. **Publishing is never an MCP tool.**
- Client setup snippets (Claude Code CLI, Cursor `mcp.json`, Gemini CLI `settings.json`, ChatGPT custom connector) are shown in the panel.

## Phase 3 — Shopify Sidekick app extension (needs `shopify app deploy`)
1. `shopify app generate extension --template app_data --name vsn-sidekick-tools` (target `admin.app.tools.data`).
2. Tools: search pages, open page in editor, create draft section from a description (calls the VSN backend with the admin session token).
3. Add `[sidekick] extensions_summary` to `shopify.app.toml` ("Search, create and edit VSN Builder pages and sections").
4. Deploy a draft app version on Staging (`t021-shopify-staging-app-version-draft`), test in Sidekick, then release. Requires the owner's approval because it creates a new app version.

## Image generation
- Done: AI panel task "Prompt → Image". OpenAI `gpt-image-1` or Gemini `gemini-2.5-flash-image` (shop key, else app key; Claude has no image model) → staged upload → `fileCreate` in Shopify Files → inserted as an Image widget. Counts toward the AI quota (`operation: "image"`).
- Shopify's own image AI (Shopify Magic) is admin-only, not an app API.
