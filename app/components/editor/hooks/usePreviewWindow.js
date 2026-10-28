import { useEffect, useRef } from "react";

// Standalone /preview tab: opens outside the Shopify admin shell and receives the
// live (unsaved) editor state over same-origin postMessage, re-sent on every change.
export default function usePreviewWindow(payload, deps = []) {
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
  return () => { windowRef.current = window.open("/preview", "vsn-preview"); };
}
