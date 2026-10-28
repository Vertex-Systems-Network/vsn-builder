import { useEffect, useState } from "react";
import PreviewRenderer from "../components/editor/PreviewRenderer.jsx";

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
  const [payload, setPayload] = useState(null);
  const [orphan, setOrphan] = useState(false);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== window.opener) return;
      if (event.data?.type === "vsn:preview-payload" && event.data.payload) setPayload(event.data.payload);
    };
    window.addEventListener("message", onMessage);
    if (window.opener && !window.opener.closed) window.opener.postMessage({ type: "vsn:preview-ready" }, window.location.origin);
    const timer = window.setTimeout(() => setOrphan((value) => value || !window.opener), 3000);
    return () => { window.removeEventListener("message", onMessage); window.clearTimeout(timer); };
  }, []);

  useEffect(() => { if (payload?.title) document.title = `${payload.title} · Preview`; }, [payload?.title]);

  if (!payload) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", color: "#616161" }}>
      {orphan ? "Open the preview from the VSN editor to see your page." : "Loading preview…"}
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
