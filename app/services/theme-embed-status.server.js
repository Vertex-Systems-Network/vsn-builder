import { expandShopifyScopes } from "../utils/shopify-scopes.js";
const EMBED_HANDLE = "vsn-page-renderer";

// Shopify writes a /* ... */ banner at the top of config/settings_data.json,
// which JSON.parse rejects; strip block comments before parsing.
function parseSettingsData(raw) {
  const text = String(raw || "{}").replace(/^\uFEFF/, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
  try { return JSON.parse(text || "{}"); } catch { return null; }
}
export { parseSettingsData as parseThemeSettingsData, findEmbedBlock };

function findEmbedBlock(settings) {
  const blocks = settings?.current?.blocks;
  if (!blocks || typeof blocks !== "object") return null;
  return Object.values(blocks).find((block) => {
    const type = String(block?.type || "");
    return type.includes(`/blocks/${EMBED_HANDLE}/`) || type.endsWith(`/blocks/${EMBED_HANDLE}`);
  }) || null;
}

export function themeEmbedActivationUrl({ shop, apiKey, handle = EMBED_HANDLE } = {}) {
  if (!shop || !apiKey) return "";
  const url = new URL(`https://${shop}/admin/themes/current/editor`);
  url.searchParams.set("context", "apps");
  url.searchParams.set("activateAppId", `${apiKey}/${handle}`);
  return url.toString();
}

export async function inspectThemeEmbedStatus(admin, session, { apiKey = process.env.SHOPIFY_API_KEY || "" } = {}) {
  const shop = session?.shop || "";
  const editorUrl = themeEmbedActivationUrl({ shop, apiKey });
  const scopes = expandShopifyScopes(session?.scope);
  if (!scopes.has("read_themes")) return { status:"unknown", active:null, themeName:"", editorUrl, reason:"READ_THEMES_REQUIRED" };
  try {
    const themesResponse = await admin.graphql(`#graphql
      query VsnThemeEmbedTheme {
        themes(first: 25) { nodes { id name role } }
      }
    `);
    const themesPayload = await themesResponse.json();
    if (themesPayload.errors?.length) throw new Error(themesPayload.errors.map((row)=>row.message).join("; "));
    const themes = themesPayload.data?.themes?.nodes || [];
    const theme = themes.find((row)=>String(row.role||"").toUpperCase()==="MAIN") || null;
    if (!theme?.id) return { status:"unknown", active:null, themeName:"", editorUrl, reason:"MAIN_THEME_NOT_FOUND" };

    const filesResponse = await admin.graphql(`#graphql
      query VsnThemeEmbedSettings($themeId: ID!) {
        theme(id: $themeId) {
          id
          name
          files(filenames: ["config/settings_data.json"], first: 1) {
            nodes {
              filename
              body { ... on OnlineStoreThemeFileBodyText { content } }
            }
          }
        }
      }
    `, { variables: { themeId: theme.id } });
    const filesPayload = await filesResponse.json();
    if (filesPayload.errors?.length) throw new Error(filesPayload.errors.map((row)=>row.message).join("; "));
    const loadedTheme = filesPayload.data?.theme || theme;
    const raw = loadedTheme?.files?.nodes?.[0]?.body?.content || "";
    const settings = parseSettingsData(raw);
    if (!settings) return { status:"unknown", active:null, themeName:loadedTheme?.name||theme.name||"", editorUrl, reason:"SETTINGS_DATA_INVALID" };
    const block = findEmbedBlock(settings);
    const active = Boolean(block && block.disabled !== true);
    return { status:active?"active":"inactive", active, themeName:loadedTheme?.name||theme.name||"", editorUrl, reason:block?"EMBED_FOUND":"EMBED_NOT_FOUND" };
  } catch (error) {
    console.warn("VSN theme embed status warning:", error instanceof Error ? error.message : error);
    return { status:"unknown", active:null, themeName:"", editorUrl, reason:"THEME_STATUS_ERROR" };
  }
}
