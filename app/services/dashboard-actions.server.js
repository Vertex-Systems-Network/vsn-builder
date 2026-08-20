import db from "../db.server.js";
import { authenticate } from "../shopify.server";
import { builderActor, getBuilderRole, isBuilderOwner } from "../utils/builder-permissions.js";
import { canAccessBuilderAction } from "../utils/builder-permissions.server.js";
import { saveWidgetSettings } from "./widget-settings.server";
import { enrichWidgetSettingsWithUsage } from "./widget-usage.server.js";
import { serializeNotification } from "./dashboard-notifications.server.js";
import { rebuildThemeAssets } from "./theme-assets.server.js";
import { syncDefaultLibrary } from "./library-presets.server.js";
import { saveDashboardPreferences } from "./dashboard-preferences.server.js";
import { saveEnterpriseSettings } from "./enterprise-hardening.server.js";
import { saveAppSettings } from "./app-settings.server.js";
import { assertTrustedMutationRequest, safeClientErrorMessage } from "../utils/request-security.server.js";
import { syncShopifySubscription } from "./shopify-subscription.server.js";
import { saveStockProviderSettings, testStockProviderCredential } from "./stock-image-integrations.server.js";
import { loadStockApiUsageSummary } from "./stock-api-usage.server.js";
import { saveGoogleMapsSettings } from "./google-platform.server.js";

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

function ticketCode() {
  return `VSN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function handleDashboardAction({ request }) {
  assertTrustedMutationRequest(request);
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const actor = builderActor(session);
  const role = getBuilderRole(session);

  try {
    if (intent === "app-uninstall") {
      if (!isBuilderOwner(session)) return Response.json({ success:false, intent, error:"Only the Shopify store owner can uninstall VSN Builder from this workspace." }, { status:403 });
      await db.builderAuditLog.create({ data:{ shop:session.shop, actor, role, action:"app.uninstall.requested", details:JSON.stringify({ source:String(formData.get("source") || "app") }) } }).catch(()=>null);
      const response = await admin.graphql(`#graphql
        mutation VsnAppUninstall {
          appUninstall {
            app { id }
            userErrors { field message code }
          }
        }
      `);
      const result = await response.json();
      if (result.errors?.length) return Response.json({ success:false, intent, error:result.errors.map((row)=>row.message).filter(Boolean).join(" ") || "Shopify could not uninstall the app." }, { status:409 });
      const payload = result.data?.appUninstall || {};
      if (payload.userErrors?.length) return Response.json({ success:false, intent, error:payload.userErrors.map((row)=>row.message).filter(Boolean).join(" ") || "Shopify could not uninstall the app." }, { status:409 });
      const storeHandle = String(session.shop || "").replace(/\.myshopify\.com$/i, "");
      return Response.json({ success:true, intent, redirectUrl:storeHandle ? `https://admin.shopify.com/store/${storeHandle}` : "https://admin.shopify.com", message:"VSN Builder was uninstalled from this store." });
    }

    if (intent === "billing-refresh") {
      if (!(await canAccessBuilderAction(db, session, "billing", "view"))) return Response.json({ success:false, error:"Your VSN role cannot view billing status." }, { status:403 });
      const result = await syncShopifySubscription({ db, admin, shop:session.shop, force:true });
      if (!result.ok) return Response.json({ success:false, intent, error:result.error || result.issues?.join(" ") || "Shopify subscription verification failed." }, { status:409 });
      await db.builderAuditLog.create({ data:{ shop:session.shop, actor, role, action:"billing.subscription.verified", details:JSON.stringify({ verified:Boolean(result.verified), skipped:Boolean(result.skipped), reason:result.reason||null }) } });
      const message = result.skipped && result.reason === "developer-mode" ? "Developer Mode uses local plan simulation; Shopify verification was skipped." : result.skipped && result.reason === "fresh-cache" ? "Shopify subscription is already verified and current." : "Shopify subscription status verified.";
      return Response.json({ success:true, intent, verified:Boolean(result.verified), skipped:Boolean(result.skipped), reason:result.reason||null, message });
    }

    if (intent === "sync-library-defaults") {
      const stats = await syncDefaultLibrary(db, session.shop, actor);
      await db.builderAuditLog.create({ data: { shop: session.shop, actor, role, action: "library.defaults.synced", details: JSON.stringify(stats) } });
      return Response.json({ success: true, intent, stats, message: stats.message || "VSN Marketplace starters are synchronized." });
    }

    if (intent === "rebuild-theme-assets") {
      const result = await rebuildThemeAssets({ admin, session, db });
      await db.builderAuditLog.create({ data: { shop: session.shop, actor, role, action: "theme.assets.rebuilt", details: JSON.stringify({ success: result.success, pageCount: result.pageCount, files: result.files || [], error: result.error || null }) } });
      return Response.json({ success: Boolean(result.success), intent, assetBuild: result, error: result.success ? null : (result.error || "Could not rebuild frontend assets.") }, { status: result.success ? 200 : 409 });
    }

    if (intent === "save-app-settings") {
      let app = {}, enterprise = {}, stock = {}, maps = {};
      try { app = JSON.parse(String(formData.get("app") || "{}")); } catch { return Response.json({ success:false, error:"Application settings are invalid." }, { status:400 }); }
      try { enterprise = JSON.parse(String(formData.get("enterprise") || "{}")); } catch { return Response.json({ success:false, error:"Storefront settings are invalid." }, { status:400 }); }
      try { stock = JSON.parse(String(formData.get("stock") || "{}")); } catch { return Response.json({ success:false, error:"Stock media integration settings are invalid." }, { status:400 }); }
      try { maps = JSON.parse(String(formData.get("maps") || "{}")); } catch { return Response.json({ success:false, error:"Google Maps settings are invalid." }, { status:400 }); }
      const [savedApp, savedEnterprise, savedStock, savedMaps] = await Promise.all([saveAppSettings(session.shop, app), saveEnterpriseSettings(session.shop, enterprise), saveStockProviderSettings(db, session.shop, stock), saveGoogleMapsSettings(db, session.shop, maps)]);
      await db.builderAuditLog.create({ data:{ shop:session.shop, actor, role, action:"settings.updated", details:JSON.stringify({ visitorAnalytics:savedApp.visitorAnalytics, safeMode:savedEnterprise.safeMode, stockProviders:Object.fromEntries(Object.entries(savedStock).map(([key,value])=>[key,{enabled:value.enabled,configured:value.configured}])) }) } });
      return Response.json({ success:true, intent, settings:{ app:savedApp, enterprise:savedEnterprise, stockImages:savedStock, googleMaps:savedMaps }, message:"Settings saved." });
    }

    if (intent === "test-stock-provider") {
      const provider = String(formData.get("provider") || "");
      const result = await testStockProviderCredential(db, session.shop, provider);
      const stockUsage = await loadStockApiUsageSummary(db, session.shop).catch(() => null);
      return Response.json({ success:result.ok, intent, ...result, stockUsage }, { status:result.ok ? 200 : 409 });
    }

    if (intent === "save-dashboard-layout") {
      let payload = {};
      try { payload = JSON.parse(String(formData.get("preferences") || "{}")); }
      catch { return Response.json({ success: false, error: "Dashboard layout data is invalid." }, { status: 400 }); }
      const preferences = await saveDashboardPreferences(db, session.shop, payload);
      await db.builderAuditLog.create({ data: { shop: session.shop, actor, role, action: "dashboard.layout.updated", details: JSON.stringify({ visible: preferences.visible.length }) } });
      return Response.json({ success: true, intent, preferences });
    }

    if (intent === "save-widgets") {
      const widgets = JSON.parse(String(formData.get("widgets") || "[]"));
      const savedSettings = await saveWidgetSettings(admin, widgets);
      const settings = await enrichWidgetSettingsWithUsage(db, session.shop, savedSettings);
      await db.builderAuditLog.create({ data: { shop: session.shop, actor, role, action: "widgets.updated", details: JSON.stringify({ activeCount: settings.activeCount, inactiveCount: settings.inactiveCount || 0 }) } });
      return Response.json({ success: true, settings });
    }

    if (intent === "notification-read") {
      const id = String(formData.get("id") || "");
      await db.builderNotification.updateMany({ where: { id, shop: session.shop, dismissedAt: null }, data: { readAt: new Date() } });
      return Response.json({ success: true, intent, id });
    }
    if (intent === "notification-read-all") {
      await db.builderNotification.updateMany({ where: { shop: session.shop, dismissedAt: null, readAt: null }, data: { readAt: new Date() } });
      return Response.json({ success: true, intent });
    }
    if (intent === "notification-dismiss") {
      const id = String(formData.get("id") || "");
      await db.builderNotification.updateMany({ where: { id, shop: session.shop }, data: { dismissedAt: new Date(), readAt: new Date() } });
      return Response.json({ success: true, intent, id });
    }

    if (intent === "support-create") {
      const subject = String(formData.get("subject") || "").trim().slice(0, 160);
      const body = String(formData.get("body") || "").trim().slice(0, 12000);
      const category = ["general", "bug", "billing", "feature", "technical"].includes(String(formData.get("category"))) ? String(formData.get("category")) : "general";
      const priority = ["low", "normal", "high", "urgent"].includes(String(formData.get("priority"))) ? String(formData.get("priority")) : "normal";
      if (subject.length < 3 || body.length < 5) return Response.json({ success: false, error: "Add a subject and a detailed message." }, { status: 400 });
      const result = await db.$transaction(async (tx) => {
        const created = await tx.builderSupportTicket.create({ data: { shop: session.shop, ticketCode: ticketCode(), subject, category, priority, createdBy: actor } });
        await tx.builderSupportMessage.create({ data: { shop: session.shop, ticketId: created.id, authorType: "merchant", authorName: actor, body } });
        await tx.builderAuditLog.create({ data: { shop: session.shop, actor, role, action: "support.ticket.created", details: JSON.stringify({ ticketCode: created.ticketCode, subject }) } });
        const notification = await tx.builderNotification.create({ data: { shop: session.shop, type: "support", title: `Support ticket ${created.ticketCode} submitted`, message: "Your ticket is now tracked in the Support Center. Replies and status changes will stay attached to this ticket.", href: "/app?view=support", sourceKey: `support:${created.id}:created` } });
        const ticket = await tx.builderSupportTicket.findUnique({ where: { id: created.id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
        return { ticket, notification };
      });
      return Response.json({ success: true, intent, ticket: serializeTicket(result.ticket), notification: serializeNotification(result.notification) });
    }

    if (intent === "support-reply") {
      const id = String(formData.get("id") || "");
      const body = String(formData.get("body") || "").trim().slice(0, 12000);
      if (!body) return Response.json({ success: false, error: "Reply cannot be empty." }, { status: 400 });
      const existing = await db.builderSupportTicket.findFirst({ where: { id, shop: session.shop } });
      if (!existing) return Response.json({ success: false, error: "Ticket not found." }, { status: 404 });
      const ticket = await db.$transaction(async (tx) => {
        await tx.builderSupportMessage.create({ data: { shop: session.shop, ticketId: id, authorType: "merchant", authorName: actor, body } });
        await tx.builderSupportTicket.update({ where: { id }, data: { status: existing.status === "closed" ? "open" : existing.status } });
        await tx.builderAuditLog.create({ data: { shop: session.shop, actor, role, action: "support.ticket.replied", details: JSON.stringify({ ticketCode: existing.ticketCode }) } });
        return tx.builderSupportTicket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
      });
      return Response.json({ success: true, intent, ticket: serializeTicket(ticket) });
    }

    if (intent === "support-status") {
      const id = String(formData.get("id") || "");
      const status = String(formData.get("status")) === "closed" ? "closed" : "open";
      const existing = await db.builderSupportTicket.findFirst({ where: { id, shop: session.shop } });
      if (!existing) return Response.json({ success: false, error: "Ticket not found." }, { status: 404 });
      const ticket = await db.$transaction(async (tx) => {
        const updated = await tx.builderSupportTicket.update({ where: { id }, data: { status, closedAt: status === "closed" ? new Date() : null }, include: { messages: { orderBy: { createdAt: "asc" } } } });
        await tx.builderAuditLog.create({ data: { shop: session.shop, actor, role, action: status === "closed" ? "support.ticket.closed" : "support.ticket.reopened", details: JSON.stringify({ ticketCode: existing.ticketCode }) } });
        return updated;
      });
      return Response.json({ success: true, intent, ticket: serializeTicket(ticket) });
    }

    return Response.json({ success: false, error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    console.error(`VSN dashboard action failed (${intent}):`, error);
    return Response.json({ success: false, error: safeClientErrorMessage(error, "Unable to complete the request.") }, { status: 500 });
  }
}
