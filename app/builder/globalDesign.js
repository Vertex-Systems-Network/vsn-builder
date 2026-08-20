import { defaultResponsiveBreakpoints } from "./responsiveEngine.js";
export const GLOBAL_DESIGN_DEFAULTS = {
  primaryColor: "#008060", secondaryColor: "#6d7175", accentColor: "#008060",
  textColor: "#1a1a1a", backgroundColor: "#ffffff", surfaceColor: "#ffffff", mutedSurfaceColor: "#f6f6f7", borderColor: "#e3e3e3",
  fontFamily: "Inter, system-ui, sans-serif", headingFontFamily: "inherit", headingScale: 1.25,
  buttonBackground: "#1a1a1a", buttonTextColor: "#ffffff", buttonRadius: "8px",
  formBackground: "#ffffff", formTextColor: "#202223", formBorderColor: "#c9cccf", formRadius: "8px",
  radiusSm: "6px", radiusMd: "12px", radiusLg: "20px", spacingBase: 4,
  shadowSm: "0 1px 2px rgba(0,0,0,.08)", shadowMd: "0 8px 24px rgba(0,0,0,.12)", shadowLg: "0 20px 50px rgba(0,0,0,.16)",
  containerMaxWidth: "1200px", mobileBreakpoint: 749, tabletBreakpoint: 989, responsiveBreakpoints: defaultResponsiveBreakpoints(),
  lightboxEnabled: true, lightboxBackdrop: "#000000", lightboxBackdropOpacity: 0.86, lightboxMaxWidth: 96, lightboxMaxHeight: 92,
  lightboxShowClose: true, lightboxCloseOnBackdrop: true, lightboxCloseOnEscape: true, lightboxAnimation: "fade",
};

export function globalCssVariables(input = {}) {
  const g = { ...GLOBAL_DESIGN_DEFAULTS, ...(input || {}) };
  return {
    "--vsn-primary": g.primaryColor, "--vsn-secondary": g.secondaryColor, "--vsn-accent": g.accentColor,
    "--vsn-text": g.textColor, "--vsn-bg": g.backgroundColor, "--vsn-surface": g.surfaceColor, "--vsn-surface-muted": g.mutedSurfaceColor, "--vsn-border": g.borderColor,
    "--vsn-font-body": g.fontFamily, "--vsn-font-heading": g.headingFontFamily, "--vsn-heading-scale": String(g.headingScale || 1.25),
    "--vsn-button-bg": g.buttonBackground, "--vsn-button-color": g.buttonTextColor, "--vsn-button-radius": g.buttonRadius,
    "--vsn-form-bg": g.formBackground, "--vsn-form-color": g.formTextColor, "--vsn-form-border": g.formBorderColor, "--vsn-form-radius": g.formRadius,
    "--vsn-radius-sm": g.radiusSm, "--vsn-radius-md": g.radiusMd, "--vsn-radius-lg": g.radiusLg,
    "--vsn-space": `${Math.max(1, Number(g.spacingBase || 4))}px`, "--vsn-shadow-sm": g.shadowSm, "--vsn-shadow-md": g.shadowMd, "--vsn-shadow-lg": g.shadowLg,
    "--vsn-container-max": g.containerMaxWidth,
  };
}

export function mergeStylePreset(node, preset = {}) {
  if (!node || !preset) return node;
  const styles = preset.styles || preset;
  return { ...node, styles: deepMerge(node.styles || {}, styles || {}) };
}

function deepMerge(a, b) {
  const out = { ...(a || {}) };
  for (const [key, value] of Object.entries(b || {})) {
    out[key] = value && typeof value === "object" && !Array.isArray(value) ? deepMerge(out[key] || {}, value) : value;
  }
  return out;
}
