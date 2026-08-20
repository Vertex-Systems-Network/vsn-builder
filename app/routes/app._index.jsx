import { useLoaderData } from "react-router";
import packageJson from "../../package.json";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import DashboardApp from "../components/dashboard/DashboardApp";
import { getWidgetDefinitions, loadWidgetSettings, summarizeWidgets } from "../services/widget-settings.server";
import { getPlanUsage, serializePlan } from "../utils/plan.server.js";
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

async function loadOwnerInfo(admin, session) {
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
  try {
    const response = await admin.graphql(`#graphql
      query GetStoreProfile {
        shop {
          name
          email
          contactEmail
          myshopifyDomain
          currencyCode
          ianaTimezone
          primaryDomain { url host }
        }
      }
    `);
    const result = await response.json();
    if (result.errors?.length) {
      console.warn("VSN store profile query warning:", result.errors.map((row)=>row.message).join("; "));
      return fallback;
    }
    const shop = result.data?.shop || {};
    return {
      ...fallback,
      email: fallback.email || shop.contactEmail || shop.email || "",
      shopName: shop.name || "",
      shopEmail: shop.contactEmail || shop.email || "",
      myshopifyDomain: shop.myshopifyDomain || session?.shop || "",
      primaryDomain: shop.primaryDomain || null,
      currencyCode: shop.currencyCode || "",
      ianaTimezone: shop.ianaTimezone || "",
      primaryLocale: "",
    };
  } catch (error) {
    console.warn("VSN owner query failed; using authenticated staff fallback:", error instanceof Error ? error.message : error);
    return fallback;
  }
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
  const planUsage = await getPlanUsage(db, session.shop, plan);
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
  const pricingReturn = readShopifyAppPricingReturn(request, session.shop);
  const syncResult = await syncShopifySubscription({ db, admin, shop: session.shop, force: Boolean(pricingReturn?.pendingVerification) }).catch((error)=>({ok:false,error:error instanceof Error?error.message:String(error)}));
  const [ownerInfo, rawWidgetSettings, dashboard] = await Promise.all([
    loadOwnerInfo(admin, session),
    loadWidgetSettings(admin).catch((error) => {
      console.error("VSN dashboard widget loader failed:", error);
      return summarizeWidgets(getWidgetDefinitions());
    }),
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
