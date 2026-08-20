import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FALLBACK_GOOGLE_FONTS, SYSTEM_FONTS } from "../../../data/font-catalog";
import {
  buildGoogleFontHref,
  mergeFontUsage,
  primaryFontFamily,
  SYSTEM_FONT_FAMILIES,
} from "../../../utils/font-runtime";

const FontRegistryContext = createContext(null);
const slug = (value = "") => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");


async function readFontApiResponse(response) {
  const contentType=response.headers.get("content-type")||"";
  if(!contentType.includes("application/json")){
    const text=await response.text().catch(()=>"");
    throw new Error(response.status===401||response.status===403
      ? "The Shopify admin session could not authorize the custom-font service. Refresh/reopen the embedded app and try again."
      : `The custom-font service did not return JSON (HTTP ${response.status}). Restart the development server and refresh Shopify Admin.${text?` Response: ${text.slice(0,120)}`:""}`);
  }
  return response.json().catch(()=>({}));
}

function fontFormat(mimeType = "") {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("woff2")) return "woff2";
  if (mime.includes("woff")) return "woff";
  if (mime.includes("otf") || mime.includes("opentype")) return "opentype";
  return "truetype";
}

export function FontRegistryProvider({ initialCatalog, children }) {
  const [catalog, setCatalog] = useState(() => ({
    custom: initialCatalog?.custom || [],
    google: initialCatalog?.google?.length ? initialCatalog.google : FALLBACK_GOOGLE_FONTS,
    system: initialCatalog?.system?.length ? initialCatalog.system : SYSTEM_FONTS,
  }));
  const [loading, setLoading] = useState(false);
  const googleUsageRef = useRef(new Map());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/app/builder-panel/fonts?mode=catalog", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const data = await readFontApiResponse(response);
      if (response.ok && data?.ok) {
        setCatalog({
          custom: data.custom || [],
          google: data.google || FALLBACK_GOOGLE_FONTS,
          system: data.system || SYSTEM_FONTS,
        });
      }
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const ensureFontLoaded = useCallback((fontValue, options = {}) => {
    if (typeof document === "undefined") return;
    const family = primaryFontFamily(fontValue);
    if (!family || family.toLowerCase() === "inherit") return;

    const customFonts = catalog.custom.filter(
      (font) => String(font.family || "").toLowerCase() === family.toLowerCase(),
    );
    if (customFonts.length) {
      customFonts.forEach((custom) => {
        const id = `vsn-custom-font-${slug(custom.family)}-${custom.weight}-${custom.style}`;
        if (document.getElementById(id)) return;
        const style = document.createElement("style");
        style.id = id;
        style.dataset.vsnRuntimeFont = "custom";
        style.textContent = `@font-face{font-family:${JSON.stringify(custom.family)};src:url(${JSON.stringify(custom.editorUrl || `/app/fonts/${custom.id}`)}) format('${fontFormat(custom.mimeType)}');font-style:${custom.style || "normal"};font-weight:${custom.weight || 400};font-display:swap;}`;
        document.head.appendChild(style);
      });
      return;
    }

    if (SYSTEM_FONT_FAMILIES.has(family.toLowerCase())) return;
    const google = catalog.google.find(
      (font) => String(font.family || "").toLowerCase() === family.toLowerCase(),
    );
    if (!google) return;

    mergeFontUsage(googleUsageRef.current, family, options);
    const usage = googleUsageRef.current.get(family.toLowerCase());
    const href = buildGoogleFontHref(new Map([[family.toLowerCase(), usage]]), catalog.google);
    if (!href) return;

    const id = `vsn-google-font-${slug(family)}`;
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.dataset.vsnRuntimeFont = "google";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  }, [catalog]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleRegistryChange = () => refresh().catch(() => {});
    window.addEventListener("vsn:font-registry-changed", handleRegistryChange);
    return () => window.removeEventListener("vsn:font-registry-changed", handleRegistryChange);
  }, [refresh]);

  const uploadCustomFont = useCallback(async ({ family, weight = 400, style = "normal", file }) => {
    const form = new FormData();
    form.set("intent", "upload");
    form.set("family", family);
    form.set("weight", String(weight));
    form.set("style", style);
    form.set("file", file);
    const response = await fetch("/app/builder-panel/fonts", {
      method: "POST",
      credentials: "include",
      body: form,
      headers: { Accept: "application/json" },
    });
    const data = await readFontApiResponse(response);
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Custom font upload failed.");
    await refresh();
    return data.font;
  }, [refresh]);

  const deleteCustomFont = useCallback(async (id) => {
    const form = new FormData();
    form.set("intent", "delete");
    form.set("id", id);
    const response = await fetch("/app/builder-panel/fonts", {
      method: "POST",
      credentials: "include",
      body: form,
      headers: { Accept: "application/json" },
    });
    const data = await readFontApiResponse(response);
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Custom font delete failed.");
    await refresh();
  }, [refresh]);

  const contextValue = useMemo(() => ({
    catalog,
    loading,
    refresh,
    ensureFontLoaded,
    uploadCustomFont,
    deleteCustomFont,
  }), [catalog, loading, refresh, ensureFontLoaded, uploadCustomFont, deleteCustomFont]);

  return <FontRegistryContext.Provider value={contextValue}>{children}</FontRegistryContext.Provider>;
}

export function useFontRegistry() {
  return useContext(FontRegistryContext) || {
    catalog: { custom: [], google: FALLBACK_GOOGLE_FONTS, system: SYSTEM_FONTS },
    loading: false,
    refresh: async () => {},
    ensureFontLoaded: () => {},
    uploadCustomFont: async () => {},
    deleteCustomFont: async () => {},
  };
}
