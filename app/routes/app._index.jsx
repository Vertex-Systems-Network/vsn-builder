import { redirect, useLoaderData } from "react-router";
import { setupIsPending } from "../utils/setup-state.js";
import packageJson from "../../package.json";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import DashboardApp from "../components/dashboard/DashboardApp";
import { getWidgetDefinitions, loadWidgetSettings, summarizeWidgets } from "../services/widget-settings.server";
import { getPlan, serializePlan } from "../utils/plan.server.js";
import { VSN_RELEASES } from "../data/releases.js";
import { ensureDashboardNotifications, listDashboardNotifications } from "../services/dashboard-notifications.server.js";
import { loadDashboardActivity } from "../services/dashboard-activity.server.js";
import { handleDashboardAction } from "../services/dashboard-actions.server.js";
import { getServerFeatureFlags } from "../services/feature-flags.server.js";
import { listLocalizationDashboard } from "../services/localization.server.js";
import { getBuilderRole } from "../utils/builder-permissions.js";
import { canAccessBuilderEditor } from "../utils/builder-permissions.server.js";
import { loadDashboardPreferences } from "../services/dashboard-preferences.server.js";
import { getCampaignDashboardSummary, getDashboardSecondaryMetrics, getLiveSystemMonitor } from "../services/dashboard-metrics.server.js";
import { getVisitorSummary } from "../services/visitor-analytics.server.js";
import { enrichWidgetSettingsWithUsage } from "../services/widget-usage.server.js";
import { getEnterpriseSettings } from "../services/enterprise-hardening.server.js";
import { loadAppSettings } from "../services/app-settings.server.js";
import { getShopifyAppPricingConfig, readShopifyAppPricingReturn } from "../services/shopify-app-pricing.server.js";
import { syncShopifySubscription, getShopifySubscriptionSyncPublicConfig } from "../services/shopify-subscription.server.js";
import { getEntitlementSnapshot, serializeEntitlementSnapshot } from "../services/entitlements.server.js";
import { loadStockProviderPublicSettings } from "../services/stock-image-integrations.server.js";
import { loadStockApiUsageSummary } from "../services/stock-api-usage.server.js";
import { loadGoogleMapsSettings } from "../services/google-platform.server.js";
import { canAccessBuilderAction } from "../utils/builder-permissions.server.js";

function loadOwnerInfo(session) {
  const associated = session?.onlineAccessInfo?.associated_user || session?.onlineAccessInfo?.associatedUser || null;
  const fallback = {
    firstName: associated?.first_name || associated?.firstName || "",
    lastName: associated?.last_name || associated?.lastName || "",
    name: [associated?.first_name || associated?.firstName, associated?.last_name || associated?.lastName].filter(Boolean).join(" "),
    email: associated?.email || session?.email || "",
    avatar: null,
    shopName: "", shopEmail: "", myshopifyDomain: session?.shop || "", primaryDomain: null,
    currencyCode: "", ianaTimezone: "", primaryLocale: "",
  };
  return fallback;
}

function serializeTicket(ticket) {
  return {
    id: ticket.id,
    ticketCode: ticket.ticketCode,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    createdBy: ticket.createdBy || null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    closedAt: ticket.closedAt?.toISOString() || null,
    messages: (ticket.messages || []).map((message) => ({
      id: message.id,
      authorType: message.authorType,
      authorName: message.authorName || null,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

function planUsageFromSnapshot(snapshot, plan) {
  const quotas = snapshot?.quotas || {};
  return {
    pages: { used: quotas.pages?.used || 0, limit: Number(plan.maxPages) },
    templates: { used: quotas.marketplaceInstalls?.used || 0, limit: Number(plan.templateQuota) },
    ai: { used: quotas.aiGenerations?.used || 0, limit: Number(plan.aiMonthly), resetAt: quotas.aiGenerations?.resetAt || null },
    experiments: { used: quotas.croExperiments?.used || 0, limit: Number(plan.croExperiments) },
    team: { used: quotas.collaborationSeats?.used || 1, limit: Number(plan.teamMembers), window: "assigned seats" },
  };
}

async function loadDashboardData(session, request, syncResult = null) {
  const entitlementSnapshot = await getEntitlementSnapshot(db, session.shop);
  const plan = entitlementSnapshot.plan;
  const shopifyPricing = getShopifyAppPricingConfig(session.shop);
  const pricingReturn = readShopifyAppPricingReturn(request, session.shop);
  const featureFlags = getServerFeatureFlags();
  const diagnosticErrors = await db.builderDiagnosticEvent.count({ where: { shop: session.shop, level: "error" } }).catch(() => 0);
  await ensureDashboardNotifications(db, session.shop, plan, diagnosticErrors);
  const [activities, notifications, tickets] = await Promise.all([
    loadDashboardActivity(db, session.shop, 8),
    listDashboardNotifications(db, session.shop, 80),
    db.builderSupportTicket.findMany({
      where: { shop: session.shop },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
    }),
  ]);
  let localization = null;
  if (featureFlags.localizationMarketsV1) {
    try { localization = await listLocalizationDashboard(db, { shop: session.shop }); }
    catch (error) { console.warn("VSN localization dashboard warning:", error instanceof Error ? error.message : error); }
  }
  const planUsage = planUsageFromSnapshot(entitlementSnapshot, plan);
  const PAGE_TEMPLATES = ["popup", "modal", "drawer", "flyout", "announcement-overlay", "floating-element", "header", "footer", "section"];
  const [pageCount, draftCount, publishedCount, recentPages, campaignCount, floatingCount, activeExperiments, unreadSubmissions, healthErrors, builderAccess] = await Promise.all([
    db.builderPage.count({ where: { shop: session.shop, deletedAt: null, template: { notIn: PAGE_TEMPLATES } } }),
    db.builderPage.count({ where: { shop: session.shop, deletedAt: null, status: "draft", template: { notIn: PAGE_TEMPLATES } } }),
    db.builderPage.count({ where: { shop: session.shop, deletedAt: null, status: "published", template: { notIn: PAGE_TEMPLATES } } }),
    db.builderPage.findMany({ where: { shop: session.shop, deletedAt: null, template: { notIn: PAGE_TEMPLATES } }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, title: true, template: true, status: true, updatedAt: true } }),
    db.builderPage.count({ where: { shop: session.shop, deletedAt: null, template: { in: ["popup", "modal", "drawer", "flyout", "announcement-overlay"] } } }),
    db.builderPage.count({ where: { shop: session.shop, deletedAt: null, template: "floating-element" } }),
    db.builderExperiment.count({ where: { shop: session.shop, status: { in: ["draft", "running", "paused"] } } }),
    db.builderFormSubmission.count({ where: { shop: session.shop, readAt: null, isSpam: false } }),
    db.builderDiagnosticEvent.count({ where: { shop: session.shop, level: "error" } }),
    canAccessBuilderEditor(db, session),
  ]);
  const [campaigns, visitors, liveMonitor, secondary, dashboardPreferences, enterpriseSettings, appSettings, stockImages, stockUsage, googleMaps] = await Promise.all([
    getCampaignDashboardSummary(db, session.shop),
    getVisitorSummary(db, session.shop),
    getLiveSystemMonitor(db, session.shop),
    getDashboardSecondaryMetrics(db, session.shop),
    loadDashboardPreferences(db, session.shop),
    getEnterpriseSettings(session.shop),
    loadAppSettings(session.shop),
    loadStockProviderPublicSettings(db, session.shop),
    loadStockApiUsageSummary(db, session.shop),
    loadGoogleMapsSettings(db, session.shop),
  ]);
  const workspaceSummary = {
    pages: { total: pageCount, draft: draftCount, published: publishedCount },
    recentPages: recentPages.map((page) => ({ ...page, updatedAt: page.updatedAt.toISOString() })),
    growth: { campaigns: campaignCount, floatingElements: floatingCount, activeExperiments, campaignStates: campaigns.states, activeCampaigns: campaigns.active, experiments: secondary.experimentStates },
    forms: { unreadSubmissions },
    health: { errors: healthErrors, warnings: secondary.healthWarnings },
    visitors,
    liveMonitor,
    library: { saved: secondary.savedLibrary },
    marketplace: { installs: secondary.marketplaceInstalls },
    ai: { monthlyUsage: secondary.aiUsage },
    backups: { total: secondary.backups },
  };
  return {
    featureFlags,
    localization,
    activities,
    notifications,
    unreadNotificationCount: notifications.filter((item) => !item.readAt).length,
    tickets: tickets.map(serializeTicket),
    plan: serializePlan(plan),
    planUsage,
    entitlements: serializeEntitlementSnapshot(entitlementSnapshot),
    builderAccess,
    builderRole: getBuilderRole(session),
    workspaceSummary,
    dashboardPreferences,
    settings: { enterprise: enterpriseSettings, app: appSettings, stockImages, stockUsage, googleMaps },
    billingUrl: shopifyPricing.pricingUrl,
    shopifyPricing,
    pricingReturn,
    subscriptionSync: { config: getShopifySubscriptionSyncPublicConfig(), result: syncResult ? { ok:syncResult.ok, verified:Boolean(syncResult.verified), skipped:Boolean(syncResult.skipped), reason:syncResult.reason||null, error:syncResult.error||null } : null },
    releases: VSN_RELEASES,
    appVersion: String(packageJson.version || VSN_RELEASES[0]?.version || "0.0.0"),
  };
}

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const view = new URL(request.url).searchParams.get("view") || "home";
  if (view === "home") {
    // First activation: walk the merchant through required setup before the dashboard.
    const setting = await db.builderShopSetting.findUnique({ where: { shop: session.shop }, select: { onboardingJson: true } }).catch(() => null);
    let onboarding = {}; try { onboarding = JSON.parse(setting?.onboardingJson || "{}") || {}; } catch { onboarding = {}; }
    if (setupIsPending(onboarding) && new URL(request.url).searchParams.get("setup") !== "later") throw redirect(`/app/setup${new URL(request.url).search}`);
  }
  const ownerInfo = loadOwnerInfo(session);
  const defaultWidgets = () => summarizeWidgets(getWidgetDefinitions());

  if (view === "pricing" || view === "license") {
    if (!(await canAccessBuilderAction(db, session, "billing", "view")))
      throw new Response("Your VSN role does not have permission to view Plans & License.", { status:403 });
    const pricingReturn = readShopifyAppPricingReturn(request, session.shop);
    const syncResult = await syncShopifySubscription({ db, admin, shop:session.shop, force: Boolean(pricingReturn?.pendingVerification) })
      .catch((error)=>({ok:false,error:error instanceof Error?error.message:String(error)}));
    // Pricing displays the current contract and verification state; it does not
    // need the dashboard's full feature matrix or five separate usage queries.
    const plan = await getPlan(db, session.shop);
    const pricing = getShopifyAppPricingConfig(session.shop);
    return {
      session,
      ownerInfo,
      widgetSettings:defaultWidgets(),
      dashboard:{
        plan:serializePlan(plan),
        entitlements:{source:plan.entitlementSource,verified:Boolean(plan.entitlementVerified),developerMode:Boolean(plan.developerMode)},
        billingUrl:pricing.pricingUrl,
        shopifyPricing:pricing,
        pricingReturn,
        subscriptionSync:{config:getShopifySubscriptionSyncPublicConfig(),result:syncResult?{ok:syncResult.ok,verified:Boolean(syncResult.verified),skipped:Boolean(syncResult.skipped),reason:syncResult.reason||null,error:syncResult.error||null}:null},
      },
    };
  }

  const pricingReturn = readShopifyAppPricingReturn(request, session.shop);
  const syncResult = pricingReturn?.pendingVerification
    ? await syncShopifySubscription({ db, admin, shop:session.shop, force:Boolean(pricingReturn?.pendingVerification) })
      .catch((error)=>({ok:false,error:error instanceof Error?error.message:String(error)}))
    : null;
  const [rawWidgetSettings, dashboard] = await Promise.all([
    view === "widgets" ? loadWidgetSettings(admin).catch((error) => {
      console.error("VSN dashboard widget loader failed:", error);
      return summarizeWidgets(getWidgetDefinitions());
    }) : Promise.resolve(defaultWidgets()),
    loadDashboardData(session, request, syncResult),
  ]);
  const widgetSettings = await enrichWidgetSettingsWithUsage(db, session.shop, rawWidgetSettings);
  dashboard.workspaceSummary.widgets = {
    total: widgetSettings.totalCount || 0,
    active: widgetSettings.activeCount || 0,
    disabled: widgetSettings.disabledCount || 0,
    inactive: widgetSettings.inactiveCount || 0,
    used: widgetSettings.usedCount || 0,
  };
  return { session, ownerInfo, widgetSettings, dashboard };
}

export const action = handleDashboardAction;

export default function AppIndex() {
  const data = useLoaderData();
  return <DashboardApp session={data.session} ownerInfo={data.ownerInfo} widgetSettings={data.widgetSettings} dashboard={data.dashboard} />;
}
