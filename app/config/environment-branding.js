export const VSN_BUILDER_BRANDING = Object.freeze({
  development: { title: "VSN | Builder (Development)", badge: "Dev" },
  staging: { title: "VSN | Builder (Staging)", badge: "Staging" },
  production: { title: "VSN | Builder", badge: null },
});
export const VSN_BUILDER_DISPLAY_VERSION = "v1.0.0";
export function resolveBuilderBranding(value) {
  const key = String(value || "").trim().toLowerCase();
  return VSN_BUILDER_BRANDING[key] || VSN_BUILDER_BRANDING.development;
}
