import { useEffect, useRef } from "react";

// Standalone /preview tab: opens outside the Shopify admin shell and receives the
// live (unsaved) editor state over same-origin postMessage, re-sent on every change.
export default function usePreviewWindow(payload, deps = [], { shop = "", pageId = "", token = "" } = {}) {
  const windowRef = useRef(null);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const send = () => {
    const target = windowRef.current;
    if (!target || target.closed) return;
    try { target.postMessage({ type: "vsn:preview-payload", payload: JSON.parse(JSON.stringify(payloadRef.current)) }, window.location.origin); } catch (error) { console.warn("VSN preview sync failed:", error); }
  };
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== windowRef.current) return;
      if (event.data?.type === "vsn:preview-ready") send();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- send reads the latest payload from a ref
  useEffect(() => { send(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps -- caller passes the change keys
  // shop lets the Shopify SDK issue the document CSP on hosted Workers; page+token let
  // the tab load the saved draft itself when the admin iframe gives it no window.opener.
  return () => {
    const query = new URLSearchParams();
    if (shop) query.set("shop", shop);
    if (pageId && token) { query.set("page", pageId); query.set("token", token); }
    const url = `${window.location.origin}/preview${query.toString() ? `?${query}` : ""}`;
    windowRef.current = window.open(url, "_blank");
  };
}
