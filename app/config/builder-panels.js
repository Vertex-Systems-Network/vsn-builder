export const BUILDER_PANEL_ROUTES = Object.freeze({
  library: "/app/library",
  marketplace: "/app/marketplace",
  "brand-kits": "/app/brand-kits",
  campaigns: "/app/campaigns",
  "email-builder": "/app/email-builder",
  experiments: "/app/experiments",
  "floating-elements": "/app/floating-elements",
  fonts: "/app/fonts",
  "svg-assets": "/app/svg-assets",
  animations: "/app/motion-library",
  "form-submissions": "/app/form-submissions",
  "form-settings": "/app/form-settings",
  onboarding: "/app/onboarding",
  backups: "/app/backups",
  plans: "/app/plans",
  "role-manager": "/app/role-manager",
  "control-center": "/app/control-center",
  "developer-sdk": "/app/plugins",
  "widget-studio": "/app/widget-studio",
});

export const BUILDER_PANEL_IDS = new Set(["pages", ...Object.keys(BUILDER_PANEL_ROUTES)]);
