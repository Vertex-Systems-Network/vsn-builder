import { useCallback, useEffect, useRef, useState } from "react";
import { getFreshShopifyIdToken } from "../../utils/authenticated-app-fetch.js";

export default function AppSessionGuard() {
  const [status, setStatus] = useState("ok");
  const [detail, setDetail] = useState("");
  const checking = useRef(false);

  const validate = useCallback(async () => {
    if (checking.current || typeof document === "undefined" || document.visibilityState === "hidden" || navigator.onLine === false) return;
    checking.current = true;
    try {
      const token = await getFreshShopifyIdToken();
      if (globalThis?.shopify?.idToken && !token) throw new Error("Shopify did not return a session token.");
      setStatus("ok");
      setDetail("");
    } catch (error) {
      setStatus("reauth-required");
      setDetail(error instanceof Error ? error.message : "The Shopify session could not be refreshed.");
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    const onStatus = (event) => {
      const next = event?.detail?.status;
      if (next === "ok") {
        setStatus("ok");
        setDetail("");
      } else if (next === "reauth-required") {
        setStatus("reauth-required");
        setDetail(String(event?.detail?.detail || "The Shopify session needs to be refreshed."));
      }
    };
    const onVisibility = () => { if (document.visibilityState === "visible") validate(); };
    const onPageShow = () => validate();
    window.addEventListener("vsn:session-status", onStatus);
    window.addEventListener("online", validate);
    window.addEventListener("focus", validate);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    validate();
    const timer = window.setInterval(validate, 60000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("vsn:session-status", onStatus);
      window.removeEventListener("online", validate);
      window.removeEventListener("focus", validate);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [validate]);

  if (status !== "reauth-required") return null;
  return (
    <div className="vsn-session-guard" role="status">
      <div>
        <strong>Shopify session needs attention</strong>
        <span>{detail || "VSN could not refresh the embedded-app session."}</span>
      </div>
      <button type="button" onClick={validate}>Retry session</button>
      <button type="button" className="primary" onClick={() => window.location.reload()}>Reconnect</button>
    </div>
  );
}
