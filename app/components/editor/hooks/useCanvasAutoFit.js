import { useCallback, useEffect, useState } from "react";

// Canvas zoom with auto-fit as the default: the page scales to the visible canvas
// (ResizeObserver + window resize) until the merchant zooms manually; switching
// device, Fit or Ctrl+0 re-enable it.
export default function useCanvasAutoFit({ deviceMode, previewWidth, disabled = false, layoutKey = "" }) {
  const [canvasZoom, setCanvasZoomState] = useState(1);
  const [autoFit, setAutoFit] = useState(true);
  const setCanvasZoom = useCallback((value) => { setAutoFit(false); setCanvasZoomState(value); }, []);
  useEffect(() => { setAutoFit(true); }, [deviceMode]);
  useEffect(() => {
    if (!autoFit || disabled || typeof window === "undefined") return undefined;
    const surface = document.querySelector(".vsn-canvas-pan-surface");
    const fit = () => {
      const available = (surface?.clientWidth || window.innerWidth) - 48;
      const next = Math.max(.25, Math.min(1, Number((Math.max(240, available) / Math.max(240, Number(previewWidth) || 1440)).toFixed(3))));
      setCanvasZoomState((value) => (Math.abs(value - next) < .002 ? value : next));
    };
    fit();
    const observer = typeof ResizeObserver !== "undefined" && surface ? new ResizeObserver(fit) : null;
    observer?.observe(surface);
    window.addEventListener("resize", fit);
    return () => { observer?.disconnect(); window.removeEventListener("resize", fit); };
  }, [autoFit, disabled, previewWidth, layoutKey]);
  return { canvasZoom, setCanvasZoom, setAutoFit };
}
