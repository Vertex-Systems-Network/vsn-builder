import { useEffect, useRef } from "react";
import { authenticatedAppFetch, readAppJson } from "../../../utils/authenticated-app-fetch.js";

/**
 * Keeps collaboration presence fresh without letting passive polling own the
 * editor lifecycle. Hidden/offline tabs pause completely and every request
 * receives a fresh Shopify session token.
 */
export default function useCollaborationHeartbeat({ enabled, isPreview, selectedId, fetcherState, onCollaboration }) {
  const fetcherStateRef = useRef(fetcherState);
  const onCollaborationRef = useRef(onCollaboration);

  useEffect(() => { fetcherStateRef.current = fetcherState; }, [fetcherState]);
  useEffect(() => { onCollaborationRef.current = onCollaboration; }, [onCollaboration]);

  useEffect(() => {
    if (!enabled || isPreview) return undefined;
    let stopped = false;
    let inFlight = false;
    let activeController = null;

    const beat = async () => {
      if (stopped || inFlight || document.visibilityState !== "visible" || navigator.onLine === false || fetcherStateRef.current !== "idle") return;
      inFlight = true;
      activeController = new AbortController();
      try {
        const body = new FormData();
        body.set("intent", "collab-heartbeat");
        body.set("selectedElementId", selectedId || "");
        const response = await authenticatedAppFetch(`${window.location.pathname}${window.location.search}`, { method: "POST", body, signal: activeController.signal, headers: { Accept: "application/json" } }, { timeoutMs: 8000 });
        const result = await readAppJson(response, "Collaboration presence could not be refreshed.");
        if (!stopped && result?.collaboration) onCollaborationRef.current?.(result.collaboration);
      } catch (error) {
        if (error?.name !== "AbortError" && error?.name !== "TimeoutError") console.warn("VSN collaboration heartbeat warning:", error instanceof Error ? error.message : error);
      } finally {
        inFlight = false;
        activeController = null;
      }
    };

    const onVisibility = () => { if (document.visibilityState === "visible") beat(); };
    beat();
    const timer = window.setInterval(beat, 30000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", beat);
    return () => {
      stopped = true;
      activeController?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", beat);
    };
  }, [enabled, isPreview, selectedId]);
}
