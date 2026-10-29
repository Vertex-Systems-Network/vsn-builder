import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { VsnButton, VsnTextField } from "./EditorUi";

// Provider picker shown at the top of the AI panel: Shopify (Sidekick, default),
// Claude, Gemini, GPT and Cursor. API providers take the shop's own key; MCP
// providers get connection steps for their desktop / CLI apps.
export default function AiProviderSettings({ prompt = "" }) {
  const loader = useFetcher();
  const saver = useFetcher();
  const [apiKey, setApiKey] = useState("");
  const [sidekick, setSidekick] = useState(false);
  useEffect(() => { if (loader.state === "idle" && !loader.data) loader.load("/app/ai-settings"); }, [loader]);
  useEffect(() => { let alive = true; Promise.resolve(window.shopify?.sidekick?.isEnabled?.()).then((on) => { if (alive) setSidekick(on === true); }).catch(() => {}); return () => { alive = false; }; }, []);
  const settings = saver.data?.settings || loader.data?.settings;
  const providers = loader.data?.providers || [];
  if (!settings) return <div className="vsn-ai-context">Loading AI providers…</div>;
  const current = providers.find((item) => item.id === settings.provider) || providers[0] || {};
  const keyState = current.api ? settings.keys?.[current.api] : null;
  const save = (fields) => saver.submit(fields, { method: "post", action: "/app/ai-settings" });
  const models = loader.data?.models?.[current.api] || [];
  return <div className="vsn-ai-providers">
    <span className="vsn-ai-label">AI provider</span>
    <div className="vsn-ai-provider-grid" role="radiogroup" aria-label="AI provider">
      {providers.map((item) => <button key={item.id} type="button" role="radio" aria-checked={item.id === current.id} className={item.id === current.id ? "is-active" : ""} onClick={() => save({ provider: item.id })}>{item.label}</button>)}
    </div>
    <p className="vsn-help-text">{current.help}</p>
    {current.sidekick ? <div className="vsn-ai-context">
      {sidekick ? <VsnButton size="sm" onClick={() => window.shopify.sidekick.launch({ message: prompt.trim() || "Help me design a page with VSN Builder." })}>Ask Shopify Sidekick</VsnButton> : <span>Sidekick is not available on this store yet.</span>}
      <div className="mt-1">Canvas generation below uses the VSN built-in AI{settings.keys?.anthropic?.app || settings.keys?.openai?.app || settings.keys?.gemini?.app ? "" : " (needs an app or shop API key)"}.</div>
    </div> : null}
    {current.api ? <div className="grid gap-2">
      <div className="vsn-ai-context"><b>Key:</b> {keyState?.shop ? "your key is saved" : keyState?.app ? "using the app key" : "not set"}</div>
      <VsnTextField label={`${current.label} API key`} type="password" autoComplete="off" value={apiKey} placeholder={keyState?.shop ? "•••• saved — paste to replace" : "Paste API key"} onInput={(event) => setApiKey(event.currentTarget.value)} />
      <label className="vsn-ai-label" htmlFor="vsn-ai-model">Model</label>
      <input id="vsn-ai-model" className="vsn-ai-file" list="vsn-ai-models" defaultValue={settings.models?.[current.api] || models[0] || ""} onBlur={(event) => save({ provider: current.id, model: event.currentTarget.value })} />
      <datalist id="vsn-ai-models">{models.map((model) => <option key={model} value={model} />)}</datalist>
      <div className="flex flex-wrap gap-2">
        <VsnButton size="sm" variant="primary" disabled={!apiKey.trim() || saver.state !== "idle"} onClick={() => { save({ provider: current.id, apiKey }); setApiKey(""); }}>Save key</VsnButton>
        <VsnButton size="sm" disabled={saver.state !== "idle"} onClick={() => save({ intent: "test" })}>Test connection</VsnButton>
        {keyState?.shop ? <VsnButton size="sm" tone="critical" onClick={() => save({ provider: current.id, clearKey: "1" })}>Remove key</VsnButton> : null}
      </div>
    </div> : null}
    {current.mcp ? <McpConnect label={current.label} id={current.id} url={loader.data?.mcpUrl} tokens={saver.data?.mcpTokens || loader.data?.mcpTokens || []} newToken={saver.data?.token} save={save} busy={saver.state !== "idle"} /> : null}
    {saver.data?.message ? <div className="vsn-ai-good">{saver.data.message}</div> : null}
    {saver.data?.error ? <div className="vsn-ai-error">{saver.data.error}</div> : null}
  </div>;
}

const SNIPPETS = {
  claude: (url, token) => `claude mcp add --transport http vsn-builder ${url} --header "Authorization: Bearer ${token}"`,
  cursor: (url, token) => JSON.stringify({ mcpServers: { "vsn-builder": { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2),
  gemini: (url, token) => JSON.stringify({ mcpServers: { "vsn-builder": { httpUrl: url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2),
  gpt: (url) => `ChatGPT → Settings → Connectors → Add custom connector → ${url} (Bearer token auth)`,
};

function McpConnect({ label, id, url, tokens, newToken, save, busy }) {
  const token = newToken || "<your-token>";
  return <details className="vsn-ai-context" open={Boolean(newToken)}>
    <summary>Connect {label} over MCP</summary>
    <p className="mt-1">{label} can read pages and edit drafts in VSN. Publishing stays manual in the editor.</p>
    <p>Server URL: <code>{url}</code></p>
    <VsnButton size="sm" disabled={busy} onClick={() => save({ intent: "mcp-create", label })}>Create access token</VsnButton>
    {newToken ? <p className="vsn-ai-good">Copy now, it is shown once: <code>{newToken}</code></p> : null}
    <pre className="mt-2 whitespace-pre-wrap break-all rounded bg-[#f6f6f7] p-2 text-[11px]">{(SNIPPETS[id] || SNIPPETS.cursor)(url, token)}</pre>
    {tokens.length ? <ul className="mt-2 grid gap-1">{tokens.map((row) => <li key={row.id} className="flex items-center justify-between gap-2"><span>{row.label} · {row.lastUsedAt ? `used ${new Date(row.lastUsedAt).toLocaleDateString()}` : "not used yet"}</span><VsnButton size="sm" tone="critical" onClick={() => save({ intent: "mcp-revoke", id: row.id })}>Revoke</VsnButton></li>)}</ul> : null}
  </details>;
}
