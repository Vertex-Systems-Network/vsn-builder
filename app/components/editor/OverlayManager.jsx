import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { calculateAnchoredOverlayPosition, calculatePointOverlayPosition, DEFAULT_OVERLAY_OFFSET, DEFAULT_OVERLAY_PADDING } from "../../builder/overlayPositioning";

const ROOT_ID = "vsn-editor-overlay-root";
const useBrowserLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const DEFAULT_PADDING = DEFAULT_OVERLAY_PADDING;
const DEFAULT_OFFSET = DEFAULT_OVERLAY_OFFSET;

function canUseDom() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function ensureOverlayRoot() {
  if (!canUseDom()) return null;
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("data-vsn-editor-overlay-root", "true");
    document.body.appendChild(root);
  }
  return root;
}

export function OverlayPortal({ children }) {
  const [host, setHost] = useState(() => canUseDom() ? ensureOverlayRoot() : null);
  useBrowserLayoutEffect(() => {
    const nextHost = ensureOverlayRoot();
    if (nextHost && nextHost !== host) setHost(nextHost);
  }, [host]);
  return host ? createPortal(children, host) : null;
}

export function AnchoredOverlay({
  open = true,
  anchorRef,
  children,
  placement = "bottom-start",
  offset = DEFAULT_OFFSET,
  viewportPadding = DEFAULT_PADDING,
  width,
  minWidth,
  maxWidth,
  matchAnchorWidth = false,
  className = "",
  style,
  role,
  layer = "popover",
  onRequestClose,
}) {
  const overlayRef = useRef(null);
  const [position, setPosition] = useState({ left: 0, top: 0, maxHeight: 0, maxWidth: 0, placement, ready: false, anchorWidth: 0 });

  const update = useCallback(() => {
    if (!open || !canUseDom()) return;
    const anchor = anchorRef?.current;
    const overlayNode = overlayRef.current;
    if (!anchor || !overlayNode) return;
    const anchorRect = anchor.getBoundingClientRect();
    const overlayRect = overlayNode.getBoundingClientRect();
    const calculated = calculateAnchoredOverlayPosition({
      anchor: anchorRect,
      overlay: { width: overlayRect.width, height: overlayRect.height },
      placement,
      offset,
      padding: viewportPadding,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    setPosition({ ...calculated, ready: true, anchorWidth: anchorRect.width });
  }, [anchorRef, offset, open, placement, viewportPadding]);

  const setOverlayNode = useCallback((node) => {
    overlayRef.current = node;
    if (node && open && canUseDom()) requestAnimationFrame(update);
  }, [open, update]);

  useBrowserLayoutEffect(() => {
    if (!open || !canUseDom()) return undefined;
    let frame = requestAnimationFrame(update);
    const onViewportChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onViewportChange) : null;
    if (anchorRef?.current) resizeObserver?.observe(anchorRef.current);
    if (overlayRef.current) resizeObserver?.observe(overlayRef.current);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      resizeObserver?.disconnect();
    };
  }, [anchorRef, open, update]);

  useEffect(() => {
    if (!open || !onRequestClose || !canUseDom()) return undefined;
    const onPointerDown = (event) => {
      const overlayNode = overlayRef.current;
      const anchorNode = anchorRef?.current;
      if (overlayNode?.contains(event.target) || anchorNode?.contains(event.target)) return;
      onRequestClose();
    };
    const onKeyDown = (event) => { if (event.key === "Escape") onRequestClose(); };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorRef, onRequestClose, open]);

  if (!open) return null;

  const resolvedWidth = matchAnchorWidth && position.anchorWidth ? position.anchorWidth : width;
  return (
    <OverlayPortal>
      <div
        ref={setOverlayNode}
        role={role}
        data-vsn-overlay-layer={layer}
        data-placement={position.placement}
        className={`vsn-anchored-overlay ${className}`.trim()}
        style={{
          position: "fixed",
          left: position.left,
          top: position.top,
          width: resolvedWidth,
          minWidth,
          maxWidth: maxWidth || position.maxWidth || undefined,
          maxHeight: position.maxHeight || undefined,
          visibility: position.ready ? "visible" : "hidden",
          ...style,
        }}
      >
        {children}
      </div>
    </OverlayPortal>
  );
}

export function PointOverlay({ point, children, className = "", style, role, layer = "menu", viewportPadding = DEFAULT_PADDING, onRequestClose }) {
  const overlayRef = useRef(null);
  const [position, setPosition] = useState({ left: 0, top: 0, maxHeight: 0, maxWidth: 0, ready: false });

  const update = useCallback(() => {
    if (!canUseDom() || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const calculated = calculatePointOverlayPosition({ point, overlay: { width: rect.width, height: rect.height }, padding: viewportPadding, viewport: { width: window.innerWidth, height: window.innerHeight } });
    setPosition({ ...calculated, ready: true });
  }, [point, viewportPadding]);

  const setOverlayNode = useCallback((node) => {
    overlayRef.current = node;
    if (node && canUseDom()) requestAnimationFrame(update);
  }, [update]);

  useBrowserLayoutEffect(() => {
    if (!canUseDom()) return undefined;
    let frame = requestAnimationFrame(update);
    const change = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    window.addEventListener("resize", change);
    window.addEventListener("scroll", change, true);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(change) : null;
    if (overlayRef.current) resizeObserver?.observe(overlayRef.current);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", change);
      window.removeEventListener("scroll", change, true);
      resizeObserver?.disconnect();
    };
  }, [update]);

  useEffect(() => {
    if (!onRequestClose || !canUseDom()) return undefined;
    const outside = (event) => { if (!overlayRef.current?.contains(event.target)) onRequestClose(); };
    const key = (event) => { if (event.key === "Escape") onRequestClose(); };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", key); };
  }, [onRequestClose]);

  return (
    <OverlayPortal>
      <div ref={setOverlayNode} role={role} data-vsn-overlay-layer={layer} className={`vsn-point-overlay ${className}`.trim()} style={{ position: "fixed", left: position.left, top: position.top, maxHeight: position.maxHeight || undefined, maxWidth: position.maxWidth || undefined, visibility: position.ready ? "visible" : "hidden", ...style }}>
        {children}
      </div>
    </OverlayPortal>
  );
}

export function ModalPortal({ children, className = "", layer = "modal" }) {
  return <OverlayPortal><div data-vsn-overlay-layer={layer} className={`vsn-modal-portal ${className}`.trim()}>{children}</div></OverlayPortal>;
}
