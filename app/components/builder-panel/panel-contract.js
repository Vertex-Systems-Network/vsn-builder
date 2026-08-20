/**
 * Builder workspace panel contract.
 * UI panels must use resource routes for data/mutations and may not depend on document-route HTML.
 */
export const LAZY_PANEL_ROUTES = Object.freeze({
  marketplace:"/app/marketplace",
  "brand-kits":"/app/brand-kits",
  campaigns:"/app/campaigns",
  "email-builder":"/app/email-builder",
  experiments:"/app/experiments",
  "floating-elements":"/app/floating-elements",
  fonts:"/app/fonts",
  "svg-assets":"/app/svg-assets",
  animations:"/app/motion-library",
  "form-submissions":"/app/form-submissions",
  "form-settings":"/app/form-settings",
  "control-center":"/app/control-center",
  "developer-sdk":"/app/plugins",
  "widget-studio":"/app/widget-studio",
});

export function pendingEntityId(payload) {
  if (payload instanceof FormData) {
    return String(payload.get("catalogId") || payload.get("id") || payload.get("experimentId") || payload.get("pageId") || "");
  }
  return String(payload?.catalogId || payload?.id || payload?.experimentId || payload?.pageId || "");
}

export function pendingIntent(payload) {
  return String(payload instanceof FormData ? payload.get("intent") || "" : payload?.intent || "");
}
