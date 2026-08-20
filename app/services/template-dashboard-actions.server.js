import db from "../db.server.js";
import { canAccessBuilderAction } from "../utils/builder-permissions.server.js";
import { getBuilderRuntimeEntitlements } from "./builder-runtime-entitlements.server.js";
import { getBlockingPageLock } from "./collaboration.server.js";
import { createShopifyPage, deleteShopifyPage, getShopifyPage, setShopifyPagePublished, updateShopifyPage } from "./shopify-pages.server.js";
import { rebuildThemeAssets, restoreTemplateThemeAssets, trashTemplateThemeAssets } from "./theme-assets.server.js";
import { deriveTemplateMetadata, parseTemplateContent, syncTemplateAssignmentRule } from "./template-management.server.js";

function safeArray(value) {
  try { const parsed = JSON.parse(String(value || "[]")); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function selectedTemplateIds(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return [...new Set((Array.isArray(parsed) ? parsed : []).map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 100);
  } catch { return []; }
}

function storefrontPath(page) {
  if (page.template === "index") return "/";
  if (page.template === "collection") return page.isDefault ? "/collections/all" : (page.resourceHandle ? `/collections/${page.resourceHandle}` : null);
  if (page.template === "product") return !page.isDefault && page.resourceHandle ? `/products/${page.resourceHandle}` : null;
  if (page.template === "search") return "/search";
  if (page.template === "blog") return !page.isDefault && page.resourceHandle ? `/blogs/${page.resourceHandle}` : null;
  if (page.template === "article") return !page.isDefault && page.resourceHandle ? `/blogs/${page.resourceHandle}` : null;
  if (page.template === "cart") return "/cart";
  if (page.template === "password") return "/password";
  if (page.template === "customer-account") return "/account";
  if (page.template === "customer-login") return "/account/login";
  if (page.template === "customer-register") return "/account/register";
  if (page.template === "customer-addresses") return "/account/addresses";
  if (page.template === "customer-order") return "/account/orders";
  return null;
}

async function publishFromDashboard({ admin, session, page, actor, role }) {
  if (["collection", "product", "blog", "article"].includes(page.template) && !page.isDefault && !page.resourceHandle) {
    throw new Error(`"${page.title}" is a specific ${page.template} template without a Shopify resource assignment.`);
  }
  const content = parseTemplateContent(page.contentJson);
  const metadata = deriveTemplateMetadata({ page, content });
  let shopifyPageId = page.shopifyPageId || null;
  let shopifyPageUrl = storefrontPath(page);
  if ((page.template || "page") === "page") {
    let shopifyPage = shopifyPageId ? await getShopifyPage({ admin, shopifyPageId }) : null;
    shopifyPage = shopifyPage
      ? await updateShopifyPage({ admin, shopifyPageId: shopifyPage.id, builderPageId: page.id, title: page.title, handle: page.handle })
      : await createShopifyPage({ admin, builderPageId: page.id, title: page.title, handle: page.handle });
    shopifyPageId = shopifyPage.id;
    shopifyPageUrl = `/pages/${shopifyPage.handle}`;
  }
  const contentJson = JSON.stringify(content);
  const updated = await db.builderPage.update({
    where: { id: page.id },
    data: { publishedJson: contentJson, status: "published", workflowStatus: "published", shopifyPageId, shopifyPageUrl, publishedAt: new Date(), scheduledAt: null, templateImage: metadata.templateImage, seoScore: metadata.seoScore, version: { increment: 1 }, publishedVersion: { increment: 1 } },
  });
  await syncTemplateAssignmentRule(db, { shop: session.shop, page: updated, content });
  await db.$transaction([
    db.builderRevision.create({ data: { shop: session.shop, pageId: updated.id, title: updated.title, contentJson, kind: "publish", createdBy: actor } }),
    db.builderAuditLog.create({ data: { shop: session.shop, pageId: updated.id, actor, role, action: "template.bulk-published" } }),
  ]);
  return updated;
}

export async function handleBulkTemplateAction({ formData, admin, session, builderRole, builderActorName }) {
  const ids = selectedTemplateIds(formData.get("pageIds"));
  const bulkAction = String(formData.get("bulkAction") || "").trim().toLowerCase();
  if (!ids.length) return Response.json({ success: false, intent: "bulk", error: "Select at least one template." }, { status: 400 });
  if (!["delete", "draft", "scheduled", "publish", "cancel-schedule", "restore", "hard-delete"].includes(bulkAction)) return Response.json({ success: false, intent: "bulk", error: "Unsupported bulk action." }, { status: 400 });
  const requiredPermission = ["delete", "hard-delete"].includes(bulkAction) ? "delete" : bulkAction === "restore" ? "restore" : "publish";
  if (!(await canAccessBuilderAction(db, session, "pages", requiredPermission))) return Response.json({ success: false, intent: "bulk", error: `Your role cannot ${bulkAction} templates.` }, { status: 403 });
  const rows = await db.builderPage.findMany({ where: { shop: session.shop, id: { in: ids } } });
  if (!rows.length) return Response.json({ success: false, intent: "bulk", error: "No matching templates were found." }, { status: 404 });
  const activeRows = rows.filter((item) => !item.deletedAt);
  const trashedRows = rows.filter((item) => Boolean(item.deletedAt));
  const warnings = [];

  if (bulkAction === "restore") {
    let count = 0;
    for (const row of trashedRows) {
      const conflictWhere = row.isDefault
        ? { shop: session.shop, deletedAt: null, template: row.template, isDefault: true }
        : row.resourceId
          ? { shop: session.shop, deletedAt: null, template: row.template, isDefault: false, resourceId: row.resourceId }
          : row.resourceHandle
            ? { shop: session.shop, deletedAt: null, template: row.template, isDefault: false, resourceHandle: row.resourceHandle }
            : null;
      if (conflictWhere) {
        const conflict = await db.builderPage.findFirst({ where: { ...conflictWhere, id: { not: row.id } }, select: { title: true } });
        if (conflict) { warnings.push(`${row.title}: cannot restore while "${conflict.title}" uses the same assignment.`); continue; }
      }
      const staleFiles = safeArray(row.trashedAssetsJson);
      await db.builderPage.update({ where: { id: row.id }, data: { deletedAt: null } });
      if (row.shopifyPageId && row.status === "published") try { await setShopifyPagePublished({ admin, shopifyPageId: row.shopifyPageId, isPublished: true }); } catch (error) { warnings.push(`${row.title}: ${error instanceof Error ? error.message : "Shopify page could not be republished."}`); }
      const assetResult = await restoreTemplateThemeAssets({ admin, session, db, pageId: row.id, staleFiles });
      if (!assetResult.success && assetResult.error) warnings.push(`${row.title}: ${assetResult.error}`);
      if (assetResult.success) await db.builderPage.update({ where: { id: row.id }, data: { trashedAssetsJson: null } });
      await db.builderAuditLog.create({ data: { shop: session.shop, pageId: row.id, actor: builderActorName, role: builderRole, action: "template.restored", details: JSON.stringify({ bulk: true, generatedFiles: assetResult.files || [] }) } }).catch(() => {});
      count += 1;
    }
    return Response.json({ success: count > 0, intent: "bulk", bulkAction, count, warnings, message: count ? `${count} template${count === 1 ? "" : "s"} restored.` : "No selected templates could be restored.", error: count ? "" : "No selected templates could be restored." }, { status: count ? 200 : 422 });
  }

  if (bulkAction === "hard-delete") {
    let count = 0;
    for (const row of trashedRows) {
      const assetResult = await trashTemplateThemeAssets({ admin, session, pageId: row.id, fallbackFiles: safeArray(row.trashedAssetsJson) });
      if (!assetResult.success && assetResult.error) warnings.push(`${row.title}: ${assetResult.error}`);
      if (row.shopifyPageId) {
        try { await deleteShopifyPage({ admin, shopifyPageId: row.shopifyPageId }); }
        catch (error) { warnings.push(`${row.title}: ${error instanceof Error ? error.message : "Shopify page deletion failed."}`); continue; }
      }
      await db.$transaction([
        db.builderTemplateRule.deleteMany({ where: { shop: session.shop, pageId: row.id } }),
        db.builderRevision.deleteMany({ where: { shop: session.shop, pageId: row.id } }),
        db.builderPageTranslation.deleteMany({ where: { shop: session.shop, pageId: row.id } }),
        db.builderPage.delete({ where: { id: row.id } }),
      ]);
      count += 1;
    }
    return Response.json({ success: count > 0, intent: "bulk", bulkAction, count, warnings, message: count ? `${count} template${count === 1 ? "" : "s"} permanently deleted.` : "No selected templates could be permanently deleted.", error: count ? "" : "No selected templates could be permanently deleted." }, { status: count ? 200 : 422 });
  }

  if (bulkAction === "cancel-schedule") {
    const scheduledRows = activeRows.filter((row) => row.status === "scheduled");
    for (const row of scheduledRows) {
      await db.builderPage.update({ where: { id: row.id }, data: { status: "draft", workflowStatus: "draft", scheduledAt: null } });
      await db.builderAuditLog.create({ data: { shop: session.shop, pageId: row.id, actor: builderActorName, role: builderRole, action: "template.schedule-canceled" } }).catch(() => {});
    }
    const count = scheduledRows.length;
    return Response.json({ success: count > 0, intent: "bulk", bulkAction, count, warnings, message: count ? `${count} scheduled template${count === 1 ? "" : "s"} canceled and returned to Draft.` : "No scheduled templates were selected.", error: count ? "" : "No scheduled templates were selected." }, { status: count ? 200 : 422 });
  }

  if (bulkAction === "scheduled") {
    const scheduledAt = new Date(String(formData.get("scheduledAt") || ""));
    if (Number.isNaN(scheduledAt.getTime())) return Response.json({ success: false, intent: "bulk", error: "Choose a valid schedule date and time." }, { status: 400 });
    if (scheduledAt.getTime() <= Date.now()) return Response.json({ success: false, intent: "bulk", error: "Scheduled date/time must be in the future." }, { status: 400 });
    for (const row of activeRows) {
      if (row.shopifyPageId) try { await setShopifyPagePublished({ admin, shopifyPageId: row.shopifyPageId, isPublished: false }); } catch (error) { warnings.push(`${row.title}: ${error instanceof Error ? error.message : "Shopify page could not be hidden."}`); }
      await db.builderPage.update({ where: { id: row.id }, data: { status: "scheduled", workflowStatus: "draft", scheduledAt } });
      await db.builderAuditLog.create({ data: { shop: session.shop, pageId: row.id, actor: builderActorName, role: builderRole, action: "template.scheduled", details: JSON.stringify({ scheduledAt: scheduledAt.toISOString() }) } }).catch(() => {});
    }
    const count = activeRows.length;
    return Response.json({ success: true, intent: "bulk", bulkAction, count, warnings, message: `${count} template${count === 1 ? "" : "s"} scheduled.` });
  }

  if (bulkAction === "draft") {
    for (const row of activeRows) {
      if (row.shopifyPageId) try { await setShopifyPagePublished({ admin, shopifyPageId: row.shopifyPageId, isPublished: false }); } catch (error) { warnings.push(`${row.title}: ${error instanceof Error ? error.message : "Shopify page could not be hidden."}`); }
      await db.builderPage.update({ where: { id: row.id }, data: { status: "draft", workflowStatus: "draft", scheduledAt: null } });
      await db.builderAuditLog.create({ data: { shop: session.shop, pageId: row.id, actor: builderActorName, role: builderRole, action: "template.bulk-draft" } }).catch(() => {});
    }
    const count = activeRows.length;
    return Response.json({ success: true, intent: "bulk", bulkAction, count, warnings, message: `${count} template${count === 1 ? "" : "s"} moved to Draft.` });
  }

  if (bulkAction === "delete") {
    let count = 0;
    for (const row of activeRows) {
      if (row.shopifyPageId) try { await setShopifyPagePublished({ admin, shopifyPageId: row.shopifyPageId, isPublished: false }); } catch (error) { warnings.push(`${row.title}: ${error instanceof Error ? error.message : "Shopify page could not be hidden."}`); }
      await db.builderPage.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
      const assetResult = await trashTemplateThemeAssets({ admin, session, pageId: row.id, fallbackFiles: safeArray(row.trashedAssetsJson) });
      const files = Array.isArray(assetResult.files) ? assetResult.files : [];
      await db.builderPage.update({ where: { id: row.id }, data: { trashedAssetsJson: JSON.stringify(files) } });
      if (!assetResult.success && assetResult.error) warnings.push(`${row.title}: ${assetResult.error}`);
      await db.builderAuditLog.create({ data: { shop: session.shop, pageId: row.id, actor: builderActorName, role: builderRole, action: "template.trashed", details: JSON.stringify({ bulk: true, assets: files }) } }).catch(() => {});
      count += 1;
    }
    return Response.json({ success: true, intent: "bulk", bulkAction, count, warnings, message: `${count} template${count === 1 ? "" : "s"} moved to Trash.` });
  }

  const runtimeEntitlements = await getBuilderRuntimeEntitlements(db, session.shop);
  let count = 0;
  for (const row of activeRows) {
    try {
      if (runtimeEntitlements.collaborationEnabled) {
        const blockingLock = await getBlockingPageLock(db, { session, pageId: row.id });
        if (blockingLock) throw new Error(`Locked by ${blockingLock.ownerName}.`);
        if (!["approved", "published"].includes(row.workflowStatus || "draft")) throw new Error("Approve this template before publishing.");
      }
      await publishFromDashboard({ admin, session, page: row, actor: builderActorName, role: builderRole });
      count += 1;
    } catch (error) { warnings.push(`${row.title}: ${error instanceof Error ? error.message : "Publish failed."}`); }
  }
  if (count) {
    try { const result = await rebuildThemeAssets({ admin, session, db }); if (!result?.success && result?.error) warnings.push(`Theme assets: ${result.error}`); }
    catch (error) { warnings.push(`Theme assets: ${error instanceof Error ? error.message : "rebuild failed"}`); }
  }
  const success = count > 0;
  return Response.json({ success, intent: "bulk", bulkAction, count, warnings, message: success ? `${count} template${count === 1 ? "" : "s"} published.` : "No selected templates could be published.", error: success ? "" : "No selected templates could be published." }, { status: success ? 200 : 422 });
}
