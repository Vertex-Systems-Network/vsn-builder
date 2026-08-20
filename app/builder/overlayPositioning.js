export const DEFAULT_OVERLAY_PADDING = 10;
export const DEFAULT_OVERLAY_OFFSET = 8;

export function clampOverlayCoordinate(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function oppositePlacement(placement) {
  const [side, align = "center"] = String(placement || "bottom-start").split("-");
  const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" }[side] || "bottom";
  return `${opposite}-${align}`;
}

function placementCandidates(preferred) {
  return [...new Set([preferred, oppositePlacement(preferred), "bottom-start", "bottom-end", "top-start", "top-end", "right-start", "left-start"].filter(Boolean))];
}

function coordinatesForPlacement(anchor, overlay, placement, offset) {
  const [side, align = "center"] = String(placement || "bottom-start").split("-");
  let left = anchor.left;
  let top = anchor.bottom + offset;

  if (side === "top") top = anchor.top - overlay.height - offset;
  if (side === "left") left = anchor.left - overlay.width - offset;
  if (side === "right") left = anchor.right + offset;

  if (side === "top" || side === "bottom") {
    if (align === "end") left = anchor.right - overlay.width;
    else if (align === "center") left = anchor.left + (anchor.width - overlay.width) / 2;
  } else {
    if (align === "end") top = anchor.bottom - overlay.height;
    else if (align === "center") top = anchor.top + (anchor.height - overlay.height) / 2;
  }

  return { left, top };
}

function overflowScore(coords, overlay, viewport, padding) {
  const leftOverflow = Math.max(0, padding - coords.left);
  const topOverflow = Math.max(0, padding - coords.top);
  const rightOverflow = Math.max(0, coords.left + overlay.width + padding - viewport.width);
  const bottomOverflow = Math.max(0, coords.top + overlay.height + padding - viewport.height);
  return leftOverflow + topOverflow + rightOverflow + bottomOverflow;
}

export function calculateAnchoredOverlayPosition({ anchor, overlay, placement = "bottom-start", offset = DEFAULT_OVERLAY_OFFSET, padding = DEFAULT_OVERLAY_PADDING, viewport }) {
  const safeViewport = viewport || { width: 0, height: 0 };
  const candidates = placementCandidates(placement);
  let best = null;

  for (const candidate of candidates) {
    const coords = coordinatesForPlacement(anchor, overlay, candidate, offset);
    const score = overflowScore(coords, overlay, safeViewport, padding);
    if (!best || score < best.score) best = { ...coords, placement: candidate, score };
    if (score === 0) break;
  }

  const maxLeft = safeViewport.width - padding - overlay.width;
  const maxTop = safeViewport.height - padding - overlay.height;
  return {
    left: clampOverlayCoordinate(best?.left ?? padding, padding, maxLeft),
    top: clampOverlayCoordinate(best?.top ?? padding, padding, maxTop),
    maxHeight: Math.max(120, safeViewport.height - padding * 2),
    maxWidth: Math.max(180, safeViewport.width - padding * 2),
    placement: best?.placement || placement,
  };
}

export function calculatePointOverlayPosition({ point, overlay, padding = DEFAULT_OVERLAY_PADDING, viewport }) {
  const safeViewport = viewport || { width: 0, height: 0 };
  return {
    left: clampOverlayCoordinate(Number(point?.x) || 0, padding, safeViewport.width - padding - overlay.width),
    top: clampOverlayCoordinate(Number(point?.y) || 0, padding, safeViewport.height - padding - overlay.height),
    maxHeight: Math.max(120, safeViewport.height - padding * 2),
    maxWidth: Math.max(180, safeViewport.width - padding * 2),
  };
}
