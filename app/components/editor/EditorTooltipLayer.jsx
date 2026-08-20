import { useEffect, useRef, useState } from "react";
import { OverlayPortal } from "./OverlayManager";

function resolveTarget(start) {
  if (!(start instanceof Element)) return null;
  return start.closest("[data-tooltip]");
}

function placementFor(rect) {
  if (rect.top < 72 && window.innerHeight - rect.bottom > 56) return "bottom";
  return "top";
}

export default function EditorTooltipLayer() {
  const [tip, setTip] = useState(null);
  const activeTargetRef = useRef(null);
  const showTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const activeTextRef = useRef("");
  const suppressUntilRef = useRef(0);

  useEffect(() => {
    const cancelShow = () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    };
    const cancelHide = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    };
    const hideNow = () => {
      cancelShow();
      cancelHide();
      activeTargetRef.current = null;
      activeTextRef.current = "";
      setTip(null);
    };
    const scheduleHide = (target) => {
      cancelHide();
      hideTimerRef.current = setTimeout(() => {
        if (activeTargetRef.current === target) hideNow();
      }, 90);
    };
    const show = (target, immediate = false) => {
      if (Date.now() < suppressUntilRef.current) return;
      const text = String(target?.getAttribute?.("data-tooltip") || "").trim();
      if (!text || target?.matches?.(":disabled")) {
        hideNow();
        return;
      }
      cancelHide();
      if (activeTargetRef.current === target && activeTextRef.current === text) return;
      activeTargetRef.current = target;
      cancelShow();
      const commit = () => {
        if (activeTargetRef.current !== target || !target.isConnected) return;
        const rect = target.getBoundingClientRect();
        const placement = placementFor(rect);
        const rawX = rect.left + rect.width / 2;
        const x = Math.max(32, Math.min(window.innerWidth - 32, rawX));
        const y = placement === "bottom" ? rect.bottom + 8 : rect.top - 8;
        activeTextRef.current = text;
        setTip({ text, x, y, placement });
      };
      if (immediate) commit();
      else showTimerRef.current = setTimeout(commit, 320);
    };

    const onPointerOver = (event) => {
      const target = resolveTarget(event.target);
      if (!target) return;
      const from = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (from && target.contains(from)) return;
      if (activeTargetRef.current === target) {
        cancelHide();
        return;
      }
      show(target);
    };
    const onPointerOut = (event) => {
      const target = resolveTarget(event.target);
      if (!target || activeTargetRef.current !== target) return;
      const next = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (next && target.contains(next)) return;
      scheduleHide(target);
    };
    const onPointerDown = () => {
      suppressUntilRef.current = Date.now() + 650;
      hideNow();
    };
    const onFocusIn = (event) => {
      const target = resolveTarget(event.target);
      if (target && target.matches?.(":focus-visible")) show(target, true);
    };
    const onFocusOut = (event) => {
      const target = resolveTarget(event.target);
      if (target && activeTargetRef.current === target) scheduleHide(target);
    };
    const onViewportChange = () => hideNow();

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      cancelShow();
      cancelHide();
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, []);

  if (!tip) return null;
  return <OverlayPortal><div className={`vsn-js-tooltip is-${tip.placement}`} role="tooltip" style={{ left: tip.x, top: tip.y, pointerEvents: "none" }}>{tip.text}</div></OverlayPortal>;
}
