import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),iframe,[contenteditable="true"],[tabindex]:not([tabindex="-1"])';

function focusables(container) {
  return Array.from(container?.querySelectorAll?.(FOCUSABLE) || []).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true" && (el.offsetParent !== null || el === document.activeElement));
}

/**
 * Accessible dialog behaviour: initial focus, Tab/Shift+Tab containment, Escape to close
 * and focus restoration to the previously focused element when the dialog closes.
 */
export function useFocusTrap(containerRef, active, { onEscape, initialFocusRef } = {}) {
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;
  useEffect(() => {
    if (!active) return undefined;
    const previous = typeof document !== "undefined" ? document.activeElement : null;
    const timer = window.setTimeout(() => {
      const container = containerRef.current;
      const target = initialFocusRef?.current || focusables(container)[0] || container;
      target?.focus?.();
    }, 0);
    const onKey = (event) => {
      if (event.key === "Escape") { escapeRef.current?.(event); return; }
      if (event.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;
      const items = focusables(container);
      if (!items.length) { event.preventDefault(); container.focus?.(); return; }
      const first = items[0]; const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !container.contains(current))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (current === last || !container.contains(current))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); window.clearTimeout(timer); previous?.focus?.(); };
  }, [active, containerRef, initialFocusRef]);
}
