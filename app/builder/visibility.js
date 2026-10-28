// Element visibility shared by the editor canvas, preview and storefront.
// meta.hidden hides everywhere; meta.hideOn hides per device using the same
// breakpoints as the storefront grids (mobile <=749, tablet 750-989, desktop >=990).
export const VISIBILITY_DEVICES = Object.freeze(["desktop", "tablet", "mobile"]);
const MEDIA = { desktop: "(min-width:990px)", tablet: "(min-width:750px) and (max-width:989px)", mobile: "(max-width:749px)" };

export function normalizeHideOn(meta = {}) {
  const source = meta?.hideOn && typeof meta.hideOn === "object" ? meta.hideOn : {};
  return Object.fromEntries(VISIBILITY_DEVICES.map((device) => [device, source[device] === true]));
}

export function isHiddenOnDevice(node, device = "desktop") {
  if (node?.meta?.hidden === true) return true;
  return normalizeHideOn(node?.meta)[device] === true;
}

export function hideOnCss(id, meta = {}) {
  const hideOn = normalizeHideOn(meta);
  const safeId = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) return "";
  return VISIBILITY_DEVICES.filter((device) => hideOn[device])
    .map((device) => `@media${MEDIA[device]}{[data-vsn-id="${safeId}"]{display:none!important}}`).join("");
}
