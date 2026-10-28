import { useEffect, useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import PreviewRenderer from "../components/editor/PreviewRenderer.jsx";
import db from "../db.server.js";
import { migrateBuilderContent } from "../builder/schemaMigrations.js";
import { previewSecret, verifyPreviewToken } from "../services/preview-token.server.js";

const parseContent = (value) => { try { const parsed = JSON.parse(String(value || "[]")); return Array.isArray(parsed) ? migrateBuilderContent(parsed) : []; } catch { return []; } };

// Fallback when the editor tab cannot reach this one (no window.opener inside the
// Shopify admin iframe): a signed, short-lived token loads the saved page draft.
export async function loader({ request, context }) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";
  const pageId = url.searchParams.get("page") || "";
  const token = url.searchParams.get("token") || "";
  if (!pageId || !token) return { initial: null };
  if (!(await verifyPreviewToken({ token, shop, pageId, secret: previewSecret(context) }))) return { initial: null, expired: true };
  const page = await db.builderPage.findFirst({ where: { id: pageId, shop, deletedAt: null } });
  if (!page) return { initial: null };
  const elements = parseContent(page.contentJson);
  const settings = elements.find((node) => node?.type === "template-settings")?.props || {};
  const globalNode = elements.find((node) => node?.type === "global-styles");
  const global = async (template, enabled, id) => {
    if (enabled === false || ["header", "footer"].includes(page.template)) return null;
    const row = await db.builderPage.findFirst({ where: { shop, deletedAt: null, template, ...(id ? { id } : { isDefault: true }) } });
    if (!row) return null;
    const content = parseContent(row.contentJson);
    return { content, globalStyles: content.find((node) => node?.type === "global-styles")?.props || {} };
  };
  const [header, footer] = await Promise.all([global("header", settings.headerEnabled, settings.headerId), global("footer", settings.footerEnabled, settings.footerId)]);
  return { initial: { title: page.title, elements, globalStyles: globalNode?.props || {}, header, footer } };
}

// Standalone full-page preview, outside the Shopify admin/App Bridge shell.
// It holds no data of its own: the editor that opened this tab posts the live
// (possibly unsaved) state via postMessage, from the same origin only.
export const meta = () => [{ title: "VSN Preview" }, { name: "robots", content: "noindex,nofollow" }];

export function headers() {
  return { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
}

const STRIP = new Set(["global-styles", "template-settings"]);
const visible = (nodes) => (Array.isArray(nodes) ? nodes : []).filter((item) => !STRIP.has(item?.type));

export default function StandalonePreview() {
  const data = useLoaderData() || {};
  const [payload, setPayload] = useState(data.initial || null);
  const [orphan, setOrphan] = useState(false);
  const [live, setLive] = useState(false);
  const revalidator = useRevalidator();
  useEffect(() => { if (data.initial && !live) setPayload(data.initial); }, [data.initial, live]);
  // Without a live opener, re-read the draft once after the editor's save lands.
  useEffect(() => {
    if (!data.initial) return undefined;
    const timer = window.setTimeout(() => { if (!live) revalidator.revalidate(); }, 2500);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- one delayed refresh per load

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== window.opener) return;
      if (event.data?.type === "vsn:preview-payload" && event.data.payload) { setLive(true); setPayload(event.data.payload); }
    };
    window.addEventListener("message", onMessage);
    if (window.opener && !window.opener.closed) window.opener.postMessage({ type: "vsn:preview-ready" }, window.location.origin);
    const timer = window.setTimeout(() => setOrphan((value) => value || !window.opener), 3000);
    return () => { window.removeEventListener("message", onMessage); window.clearTimeout(timer); };
  }, []);

  useEffect(() => { if (payload?.title) document.title = `${payload.title} · Preview`; }, [payload?.title]);

  if (!payload) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", color: "#616161" }}>
      {data.expired ? "This preview link has expired. Click Preview in the editor again." : orphan ? "Open the preview from the VSN editor to see your page." : "Loading preview…"}
    </div>;
  }

  const shared = { reusableSections: payload.reusableSections || [], componentDefinitions: payload.componentDefinitions || [], widgetTemplates: payload.widgetPlatform?.templates, customWidgetCss: payload.widgetPlatform?.customCss };
  const width = Number(payload.previewWidth) || 0;
  return <div style={{ minHeight: "100vh", background: width ? "#f1f1f1" : "#fff" }} dir={payload.direction || undefined}>
    <div style={{ margin: "0 auto", maxWidth: width ? `${width}px` : "none", background: "#fff", minHeight: "100vh" }}>
      {payload.header ? <div style={{ position: payload.header.sticky ? "sticky" : "relative", top: 0, zIndex: 50 }}>
        <PreviewRenderer {...shared} elements={visible(payload.header.content)} globalStyles={payload.header.globalStyles || {}} />
      </div> : null}
      <PreviewRenderer
        {...shared}
        elements={visible(payload.elements)}
        globalStyles={payload.globalStyles || {}}
        widgetPlatform={payload.widgetPlatform}
        previewCollection={payload.previewCollection}
        previewProduct={payload.previewProduct}
        previewBlog={payload.previewBlog}
        previewArticle={payload.previewArticle}
        previewSearch={payload.previewSearch}
      />
      {payload.footer ? <PreviewRenderer {...shared} elements={visible(payload.footer.content)} globalStyles={payload.footer.globalStyles || {}} /> : null}
    </div>
  </div>;
}
