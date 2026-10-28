import { Outlet, redirect, useLoaderData, useLocation, useNavigate, useRouteError } from "react-router";
import { startTransition, useEffect, useMemo, useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { getBuilderRole, getRoleActionAccess, getRoleSystemAccess, isBuilderOwner } from "../utils/builder-permissions.js";
import { getBuilderRoleAccess } from "../utils/builder-permissions.server.js";
import { handleDashboardAction } from "../services/dashboard-actions.server.js";
import { VsnConfirmProvider } from "../components/ui/VsnConfirmProvider";
import Sidebar from "../components/dashboard/Sidebar";
import TopNav from "../components/dashboard/TopNav";
import AppSessionGuard from "../components/ui/AppSessionGuard";
import AppRuntimeBoundary from "../components/ui/AppRuntimeBoundary";
import AppCommandPalette from "../components/dashboard/AppCommandPalette";
import { getWidgetDefinitions } from "../services/widget-settings.server.js";
import { getPlan } from "../utils/plan.server.js";
import { syncShopifySubscription } from "../services/shopify-subscription.server.js";
import { getServerFeatureFlags } from "../services/feature-flags.server.js";
import { getLocalMarketplaceCatalogCount } from "../services/marketplace.server.js";
import { builtinMotionPresets } from "../services/motion-library.server.js";
import { themeEmbedActivationUrl } from "../services/theme-embed-status.server.js";
import { VSN_BASELINE } from "../config/baseline.js";
import { resolveBuilderBranding, VSN_BUILDER_DISPLAY_VERSION } from "../config/environment-branding.js";
import { normalizeUiColorScheme, normalizeUiHex, resolveUiTheme } from "../config/ui-theme.js";
import { applyVsnSecurityHeaders } from "../utils/request-security.server.js";
import { hasVerifiedBuilderPlan, isPlanlessBillingLocation } from "../utils/billing-route-gate.js";
import { logCurrentStagingRouteError } from "../services/worker-route-error-diagnostics.server.js";

const NAV_TARGETS = Object.freeze({
  home: "/app",
  dashboard: "/app",
  pages: "/app/pages",
  library: "/app/pages?panel=library",
  marketplace: "/app/pages?panel=marketplace",
  "brand-kits": "/app/pages?panel=brand-kits",
  campaigns: "/app/pages?panel=campaigns",
  "email-builder": "/app/pages?panel=email-builder",
  experiments: "/app/pages?panel=experiments",
  "floating-elements": "/app/pages?panel=floating-elements",
  fonts: "/app/pages?panel=fonts",
  "svg-assets": "/app/pages?panel=svg-assets",
  "stock-images": "/app/stock-images",
  "stock-videos": "/app/stock-videos",
  "stock-audio": "/app/stock-audio",
  animations: "/app/pages?panel=animations",
  "form-submissions": "/app/pages?panel=form-submissions",
  "form-settings": "/app/pages?panel=form-settings",
  "developer-studio": "/app/developer-studio",
  "developer-sdk": "/app/pages?panel=developer-sdk",
  "platform-intelligence": "/app/platform-intelligence",
  "widget-studio": "/app/pages?panel=widget-studio",
  onboarding: "/app/setup",
  backups: "/app/pages?panel=backups",
  "role-manager": "/app/pages?panel=role-manager",
  "control-center": "/app/pages?panel=control-center",
  widgets: "/app?view=widgets",
  localization: "/app?view=localization",
  documentation: "/app?view=documentation",
  pricing: "/app?view=pricing",
  settings: "/app?view=settings",
  license: "/app?view=pricing",
  support: "/app?view=support",
  changelog: "/app?view=changelog",
  notifications: "/app?view=notifications",
  about: "/app?view=about",
  profile: "/app?view=profile",
});

// Shopify Admin can issue overlapping embedded loader requests while the app
// shell is mounting and while merchants move between views. Share the sidebar
// counts for a short window so each request does not fan out into the same 14
// database queries. This is presentation data; entitlement checks still read
// the authoritative subscription and entitlement state on every request.
const SHELL_COUNTS_CACHE_TTL_MS = 15_000;
const shellCountsCache = new Map();

function activeNavigationId(location) {
  const params = new URLSearchParams(location.search || "");
  if (location.pathname.startsWith("/app/pages")) return params.get("panel") || "pages";
  if (location.pathname === "/app" || location.pathname === "/app/") {
    const view = params.get("view") || "home";
    return view === "license" ? "pricing" : view;
  }
  const path = location.pathname;
  const direct = Object.entries(NAV_TARGETS).find(([, target]) => target.split("?")[0] === path);
  return direct?.[0] || "home";
}

function loadShellOwner(session) {
  const associated = session?.onlineAccessInfo?.associated_user || session?.onlineAccessInfo?.associatedUser || null;
  return {
    firstName: associated?.first_name || associated?.firstName || "",
    lastName: associated?.last_name || associated?.lastName || "",
    name: [associated?.first_name || associated?.firstName, associated?.last_name || associated?.lastName].filter(Boolean).join(" "),
    email: associated?.email || associated?.contact_email || associated?.contactEmail || session?.email || "",
    avatar: null,
    shopName: "",
  };
}

async function loadShellCounts(session, hasPaidPlan) {
  if (!hasPaidPlan) return Array(14).fill(0);

  const now = Date.now();
  for (const [shop, entry] of shellCountsCache) {
    if (entry.expiresAt <= now) shellCountsCache.delete(shop);
  }

  const cached = shellCountsCache.get(session.shop);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = Promise.all([
    db.builderNotification.count({ where: { shop: session.shop, readAt: null, dismissedAt: null } }).catch(() => 0),
    db.builderPage.count({ where: { shop: session.shop, deletedAt: null, template: { notIn: ["popup", "modal", "drawer", "flyout", "announcement-overlay", "floating-element"] } } }).catch(() => 0),
    db.builderLibraryItem.count({ where: { shop: session.shop, deletedAt: null, source: "local" } }).catch(() => 0),
    db.builderBrandKit.count({ where: { shop: session.shop, deletedAt: null } }).catch(() => 0),
    db.builderMotionPreset.count({ where: { shop: session.shop, deletedAt: null } }).catch(() => 0),
    db.builderCustomFont.count({ where: { shop: session.shop, deletedAt: null } }).catch(() => 0),
    db.builderSvgAsset.count({ where: { shop: session.shop, deletedAt: null } }).catch(() => 0),
    db.builderLibraryItem.count({ where: { shop: session.shop, kind: "stock-image", deletedAt: null } }).catch(() => 0),
    db.builderLibraryItem.count({ where: { shop: session.shop, kind: "stock-video", deletedAt: null } }).catch(() => 0),
    db.builderLibraryItem.count({ where: { shop: session.shop, kind: "stock-audio", deletedAt: null } }).catch(() => 0),
    db.builderPage.count({ where: { shop: session.shop, deletedAt: null, template: { in: ["popup", "modal", "drawer", "flyout", "announcement-overlay"] } } }).catch(() => 0),
    db.builderEmailTemplate.count({ where: { shop: session.shop, deletedAt: null } }).catch(() => 0),
    db.builderPage.count({ where: { shop: session.shop, deletedAt: null, template: "floating-element" } }).catch(() => 0),
    db.builderExperiment.count({ where: { shop: session.shop } }).catch(() => 0),
  ]);
  const entry = { expiresAt: now + SHELL_COUNTS_CACHE_TTL_MS, promise };
  shellCountsCache.set(session.shop, entry);
  promise.catch(() => {
    if (shellCountsCache.get(session.shop) === entry) shellCountsCache.delete(session.shop);
  });
  return promise;
}

async function loadApp({ request }) {
  const { admin, session } = await authenticate.admin(request);
  await syncShopifySubscription({ db, admin, shop:session.shop }).catch(() => null);
  const plan = await getPlan(db, session.shop).catch(() => null);
  const hasPaidPlan = hasVerifiedBuilderPlan(plan);
  const currentUrl = new URL(request.url);
  if (!hasPaidPlan && !isPlanlessBillingLocation(currentUrl)) {
    throw redirect("/app?view=pricing");
  }
  const builderRole = getBuilderRole(session);
  const roleAccess = await getBuilderRoleAccess(db, session.shop);
  const builderAccess = builderRole === "admin" || roleAccess[builderRole] === true;
  const systemAccess = getRoleSystemAccess(roleAccess, builderRole);
  const actionAccess = getRoleActionAccess(roleAccess, builderRole);
  const shellCounts = await loadShellCounts(session, hasPaidPlan);
  const [notificationCount, pageCount, libraryCount, brandKitCount, motionCount, fontCount, svgCount, stockImageCount, stockVideoCount, stockAudioCount, campaignCount, emailTemplateCount, floatingCount, experimentCount] = shellCounts;
  const ownerInfo = loadShellOwner(session);
  const themeEmbed = { status:"unknown", active:null, editorUrl:themeEmbedActivationUrl({shop:session.shop,apiKey:process.env.SHOPIFY_API_KEY||""}) };
  const featureFlags = getServerFeatureFlags();
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    brand: resolveBuilderBranding(process.env.APP_ENV),
    displayVersion: VSN_BUILDER_DISPLAY_VERSION,
    isOwner: isBuilderOwner(session),
    builderAccess,
    builderRole,
    systemAccess,
    actionAccess,
    ownerInfo,
    notificationCount,
    planName: plan?.name || "No active subscription",
    hasPaidPlan,
    widgetCount: getWidgetDefinitions().length,
    navigationCounts: {
      pages: pageCount,
      library: libraryCount,
      marketplace: getLocalMarketplaceCatalogCount(),
      brandKits: brandKitCount,
      widgets: getWidgetDefinitions().length,
      campaigns: campaignCount,
      emailTemplates: emailTemplateCount,
      experiments: experimentCount,
      floatingElements: floatingCount,
      fonts: fontCount,
      svgAssets: svgCount,
      stockImages: stockImageCount,
      stockVideos: stockVideoCount,
      stockAudio: stockAudioCount,
      animations: builtinMotionPresets().length + motionCount,
    },
    localizationEnabled: featureFlags.localizationMarketsV1 === true,
    themeEmbed,
  };
}

export const loader = async (args) => {
  try {
    return await loadApp(args);
  } catch (error) {
    logCurrentStagingRouteError("app", error);
    throw error;
  }
};

export const action = handleDashboardAction;

export function shouldRevalidate({ formMethod, currentUrl, nextUrl, defaultShouldRevalidate }) {
  // Re-run the entitlement gate when merchants navigate; otherwise client-side
  // transitions could keep the shell's previous paid-plan decision indefinitely.
  if (!formMethod && currentUrl?.pathname?.startsWith("/app") && nextUrl?.pathname?.startsWith("/app")) {
    return currentUrl.pathname !== nextUrl.pathname || currentUrl.search !== nextUrl.search;
  }
  return defaultShouldRevalidate;
}

export default function App() {
  const { apiKey, brand, displayVersion, builderAccess, builderRole, systemAccess, actionAccess, isOwner, ownerInfo, notificationCount, planName, hasPaidPlan, widgetCount, navigationCounts, localizationEnabled, themeEmbed } = useLoaderData();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const focusedBuilder = location.pathname.startsWith("/app/builder/") && params.get("appWindow") === "1";
  const embeddedPanel = params.get("embeddedPanel") === "1";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [themePreference, setThemePreferenceState] = useState("system");
  const [systemDark, setSystemDark] = useState(false);
  const [colorSchemePreference, setColorSchemePreferenceState] = useState("vsn");
  const [customAccent, setCustomAccentState] = useState("#625BA8");
  useEffect(() => {
    let savedTheme="system",savedScheme="vsn",savedAccent="#625BA8";
    try {
      const theme = localStorage.getItem("vsn:appearance");
      if (["light","dark","system"].includes(theme)) savedTheme=theme;
      savedScheme=normalizeUiColorScheme(localStorage.getItem("vsn:color-scheme")||"vsn");
      savedAccent=normalizeUiHex(localStorage.getItem("vsn:custom-accent")||"#625BA8");
    } catch { /* best-effort */ }
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    startTransition(()=>{
      setThemePreferenceState(savedTheme);
      setColorSchemePreferenceState(savedScheme);
      setCustomAccentState(savedAccent);
      setSystemDark(Boolean(media?.matches));
    });
    const update = () => startTransition(()=>setSystemDark(Boolean(media?.matches)));
    const syncAppearance = (event) => {
      const next = event?.detail?.preference;
      if (["light", "dark", "system"].includes(next)) startTransition(()=>setThemePreferenceState(next));
    };
    const syncColor = (event) => {
      const scheme=normalizeUiColorScheme(event?.detail?.scheme||"vsn");
      const accent=normalizeUiHex(event?.detail?.customAccent||"#625BA8");
      startTransition(()=>{setColorSchemePreferenceState(scheme);setCustomAccentState(accent);});
    };
    media?.addEventListener?.("change", update);
    window.addEventListener("vsn:appearance-change", syncAppearance);
    window.addEventListener("vsn:color-scheme-change", syncColor);
    return () => { media?.removeEventListener?.("change", update); window.removeEventListener("vsn:appearance-change", syncAppearance); window.removeEventListener("vsn:color-scheme-change", syncColor); };
  }, []);
  const darkMode = themePreference === "dark" || (themePreference === "system" && systemDark);
  const resolvedUiTheme=useMemo(()=>resolveUiTheme(colorSchemePreference,customAccent),[colorSchemePreference,customAccent]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root=document.documentElement;
    root.dataset.vsnTheme = darkMode ? "dark" : "light";
    root.dataset.vsnColorScheme=resolvedUiTheme.id;
    root.style.setProperty("--vsn-green",resolvedUiTheme.accent);
    root.style.setProperty("--vsn-green-dark",resolvedUiTheme.accentDark);
    root.style.setProperty("--vsn-accent-soft",resolvedUiTheme.accentSoft);
    root.style.setProperty("--vsn-accent-rgb",resolvedUiTheme.accentRgb);
    root.style.setProperty("--vsn-accent-foreground",resolvedUiTheme.accentForeground);
  }, [darkMode,resolvedUiTheme]);
  const setThemePreference = (value) => {
    const next = ["light","dark","system"].includes(value) ? value : "system";
    setThemePreferenceState(next);
    try { localStorage.setItem("vsn:appearance", next); } catch { /* best-effort */ }
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("vsn:appearance-change", { detail: { preference: next } }));
  };
  const setColorSchemePreference=(value)=>{const next=normalizeUiColorScheme(value);setColorSchemePreferenceState(next);try{localStorage.setItem("vsn:color-scheme",next);}catch{ /* best-effort */ }if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("vsn:color-scheme-change",{detail:{scheme:next,customAccent}}));};
  const setCustomAccent=(value)=>{const next=normalizeUiHex(value,customAccent);setCustomAccentState(next);try{localStorage.setItem("vsn:custom-accent",next);localStorage.setItem("vsn:color-scheme","custom");}catch{ /* best-effort */ }setColorSchemePreferenceState("custom");if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("vsn:color-scheme-change",{detail:{scheme:"custom",customAccent:next}}));};
  const [searchQuery, setSearchQuery] = useState("");

  const activePage = activeNavigationId(location);
  useEffect(() => {
    if (focusedBuilder || embeddedPanel) return undefined;

    const main = document.querySelector(".dashboard-root > div > main");
    if (!main) return undefined;

    const normalizePageWidths = () => {
      main.querySelectorAll("s-page").forEach((page) => {
        if (page.getAttribute("inlineSize") !== "large") page.setAttribute("inlineSize", "large");
        page.dataset.vsnPageWidth = "template";
      });
    };

    normalizePageWidths();
    const observer = new MutationObserver(normalizePageWidths);
    observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [focusedBuilder, embeddedPanel, location.pathname, location.search]);
  const shellWidgetSettings = useMemo(() => ({ settings: { totalCount: widgetCount } }), [widgetCount]);
  const fullName = [ownerInfo?.firstName, ownerInfo?.lastName].filter(Boolean).join(" ") || ownerInfo?.name || "Store owner";

  const navigateApp = (id, query = null) => {
    const normalizedId = id === "builder" ? "pages" : id === "growth" ? "campaigns" : id === "dashboard" ? "home" : id === "license" ? "pricing" : id;
    const target = NAV_TARGETS[normalizedId] || NAV_TARGETS.home;
    const next = new URL(target, "https://vsn.local");
    for (const [key, value] of Object.entries(query || {})) {
      if (value == null || value === "") next.searchParams.delete(key);
      else next.searchParams.set(key, String(value));
    }
    setSearchQuery("");
    navigate(`${next.pathname}${next.search}`);
  };

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const entries = [
      ["home", "Dashboard", "Overview, live health and recent activity"], ["pages", "Templates", "Create and manage templates"],
      ["library", "Saved Library", "Merchant-saved pages, sections and components"], ["marketplace", "Marketplace", "VSN supplied templates and sections"],
      ["brand-kits", "Brand Kits", "Reusable brand colors and typography"], ["campaigns", "Campaigns", "Popups and campaign targeting"],
      ["experiments", "CRO Experiments", "A/B and multivariate experiments"], ["floating-elements", "Floating Elements", "Sticky and floating storefront experiences"],
      ["fonts", "Custom Fonts", "Uploaded font management"], ["svg-assets", "SVG Library", "Managed SVG assets"], ["stock-images", "Stock Images", "Unsplash, Pexels, Pixabay, Shutterstock and Getty/iStock search"], ["stock-videos", "Stock Videos", "Pexels, Pixabay, Shutterstock and Getty/iStock video search"], ["stock-audio", "Stock Audio", "Freesound and Shutterstock audio search"], ["animations", "Motion Library", "Reusable animations and timelines"],
      ["form-submissions", "Submissions", "Form submissions"], ["form-settings", "Form Settings", "Forms, integrations and automation"],
      ["widgets", "Widgets", "Enable and manage builder widgets"], ["widget-studio", "Widget Studio", "Template Lab, custom widgets and SDK 2.0"], ["localization", "Localization", "Languages, translations and Shopify Markets"],
      ["developer-studio", "Developer Studio", "GraphQL Studio and revisioned Global CSS/JS"], ["developer-sdk", "Plugin SDK", "Developer extension tools"], ["platform-intelligence", "Platform Intelligence", "Dependency graph, Design Tokens 2.0 and platform inspection"], ["onboarding", "Setup", "VSN Builder setup and onboarding"],
      ["backups", "Backups", "Backup and restore"], ["role-manager", "Roles & Permissions", "Manage Builder access"],
      ["control-center", "System Health", "Diagnostics, engines and permissions"], ["documentation", "Documentation", "User documentation"],
      ["pricing", "Plans & License", "Subscription, billing and license status"], ["settings", "Settings", "Application preferences"],
["support", "Support", "Support tickets and help"],
      ["changelog", "Changelog", "Release history"], ["notifications", "Notifications", "VSN Builder notifications"], ["about", "About", "VSN Builder information"],
    ].map(([page, label, description]) => ({ id: `nav:${page}`, page, label, description }));
    return entries.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(query)).slice(0, 18);
  }, [searchQuery]);

  const provider = (content) => <AppProvider embedded apiKey={apiKey}><VsnConfirmProvider>{content}</VsnConfirmProvider></AppProvider>;
  if (focusedBuilder || embeddedPanel) return provider(<><AppSessionGuard/><Outlet /></>);

  const background = darkMode ? "#0F1117" : "#FAFAFA";
  return provider(
    <div className={darkMode ? "dashboard-root dark" : "dashboard-root"} style={{ display: "flex", minHeight: "100vh", background }}>
      <Sidebar
        ownerImage={ownerInfo?.avatar || null}
        fullName={fullName}
        widgetsFeatcher={shellWidgetSettings}
        activePage={activePage}
        onNavigate={navigateApp}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
        darkMode={darkMode}
        notificationCount={notificationCount}
        planName={planName}
        hasPaidPlan={hasPaidPlan}
        localizationEnabled={localizationEnabled}
        builderAccess={builderAccess}
        isOwner={isOwner || builderRole === "admin"}
        navigationCounts={navigationCounts}
        systemAccess={systemAccess}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: "100vh", overflow: "hidden" }}>
        <TopNav
          brand={brand}
          displayVersion={displayVersion}
          ownerImage={ownerInfo?.avatar || null}
          userName={fullName}
          darkMode={darkMode}
          onToggleDark={() => setThemePreference(darkMode ? "light" : "dark")}
          onNavigate={navigateApp}
          notifCount={notificationCount}
          themeEmbed={themeEmbed}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchResults={searchResults}
          onSearchSelect={(result) => result?.page && navigateApp(result.page)}
          isOwner={isOwner}
        />
        <AppSessionGuard />
        {hasPaidPlan ? <AppCommandPalette onNavigate={navigateApp} darkMode={darkMode} onToggleDark={() => setThemePreference(darkMode ? "light" : "dark")} systemAccess={systemAccess} /> : null}
        <main style={{ flex: 1, minHeight: 0, overflow: "auto", background }}>
          <AppRuntimeBoundary release={VSN_BASELINE.version}><Outlet context={{ darkMode, themePreference, setThemePreference, colorSchemePreference, customAccent, setColorSchemePreference, setCustomAccent, navigateApp, activePage, systemAccess, actionAccess, isOwner }} /></AppRuntimeBoundary>
        </main>
      </div>
    </div>,
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => applyVsnSecurityHeaders(boundary.headers(headersArgs));
