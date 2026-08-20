import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { builderActor, getBuilderRole, canBuilder } from "../utils/builder-permissions.js";
import { canAccessBuilderEditor } from "../utils/builder-permissions.server.js";
import { retireLegacyDefaultLibraryItems, serializeLibraryItem } from "../services/library-presets.server";
import { extractLibraryImportItems, inspectLibraryImportPackage, libraryTransferItem, remapLibraryContent } from "../utils/library-transfer.js";
import { getFeatureDecision } from "../services/entitlements.server.js";

function safeJson(value, fallback = null) { try { return JSON.parse(String(value || "")); } catch { return fallback; } }

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  if (!(await canAccessBuilderEditor(db, session))) throw new Response("Your role does not have access to the visual editor.", { status: 403 });
  await retireLegacyDefaultLibraryItems(db, session.shop);
  const [items, trash] = await Promise.all([
    db.builderLibraryItem.findMany({ where: { shop: session.shop, source: "local", deletedAt: null }, orderBy: { updatedAt: "desc" } }),
    db.builderLibraryItem.findMany({ where: { shop: session.shop, source: "local", deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } }),
  ]);
  return { items: items.map(serializeLibraryItem), trash: trash.map(serializeLibraryItem) };
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  if (!(await canAccessBuilderEditor(db, session))) throw new Response("Your role does not have access to the visual editor.", { status: 403 });
  const role = getBuilderRole(session);
  if (!canBuilder(role, "edit")) return Response.json({ ok: false, error: "Your role cannot edit the library." }, { status: 403 });
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const id = String(form.get("id") || "");

  if (intent === "favorite") {
    const favorite = String(form.get("favorite") || "") === "true";
    const item = await db.builderLibraryItem.findFirst({ where: { id, shop: session.shop, source: "local", deletedAt: null } });
    if (!item) return Response.json({ ok: false, error: "Library item not found." }, { status: 404 });
    const updated = await db.builderLibraryItem.update({ where: { id }, data: { isFavorite: favorite } });
    return Response.json({ ok: true, intent, item: serializeLibraryItem(updated) });
  }
  if (intent === "delete") {
    await db.builderLibraryItem.updateMany({ where: { id, shop: session.shop, source: "local", deletedAt: null }, data: { deletedAt: new Date() } });
    return Response.json({ ok: true, intent, id });
  }
  if (intent === "restore") {
    await db.builderLibraryItem.updateMany({ where: { id, shop: session.shop, source: "local" }, data: { deletedAt: null } });
    return Response.json({ ok: true, intent, id });
  }
  if (intent === "hard-delete") {
    await db.builderLibraryItem.deleteMany({ where: { id, shop: session.shop, source: "local", deletedAt: { not: null } } });
    return Response.json({ ok: true, intent, id });
  }
  if (intent === "empty-trash") {
    const result = await db.builderLibraryItem.deleteMany({ where: { shop: session.shop, source: "local", deletedAt: { not: null } } });
    return Response.json({ ok: true, intent, count: result.count });
  }
  if (intent === "update") {
    const existing = await db.builderLibraryItem.findFirst({ where: { id, shop: session.shop, source: "local", deletedAt: null } });
    if (!existing) return Response.json({ ok: false, error: "Library item not found." }, { status: 404 });
    if (existing.syncMode === "global") { const entitlement=await getFeatureDecision(db,session.shop,"globalLibrary"); if(!entitlement.allowed)return Response.json({ok:false,error:entitlement.message,code:entitlement.code,entitlement},{status:403}); }
    const content = safeJson(form.get("content"), null);
    if (content == null) return Response.json({ ok: false, error: "Invalid library content." }, { status: 400 });
    const title = String(form.get("title") || existing.title).trim().slice(0, 120) || existing.title;
    const category = String(form.get("category") || existing.category).trim().slice(0, 80) || existing.category;
    const syncMode = form.get("syncMode") === "local" ? "local" : existing.syncMode;
    const item = await db.builderLibraryItem.update({ where: { id }, data: { title, category, syncMode, contentJson: JSON.stringify(content) } });
    return Response.json({ ok: true, intent, item: serializeLibraryItem(item) });
  }
  if (intent === "inspect-import") {
    const payload = safeJson(form.get("payload"), null);
    const existing = await db.builderLibraryItem.findMany({ where: { shop: session.shop, source: "local" }, select: { id:true, title:true, kind:true, sourceKey:true } });
    const inspection = inspectLibraryImportPackage(payload, existing);
    if (!inspection.resources) return Response.json({ ok:false, intent, error:"No valid VSN Saved Library resources were found in this file." }, { status:400 });
    return Response.json({ ok:true, intent, inspection: { ...inspection, items: undefined } });
  }
  if (intent === "import") {
    const payload = safeJson(form.get("payload"), null);
    const conflictPolicy = ["copy","skip","replace"].includes(String(form.get("conflictPolicy"))) ? String(form.get("conflictPolicy")) : "copy";
    const sourceItems = extractLibraryImportItems(payload).map(libraryTransferItem).filter(Boolean).slice(0, 200);
    if (!sourceItems.length) return Response.json({ ok: false, error: "No valid Saved Library resources were found in the import package." }, { status: 400 });
    if (sourceItems.some((item)=>item.syncMode === "global")) { const entitlement=await getFeatureDecision(db,session.shop,"globalLibrary"); if(!entitlement.allowed)return Response.json({ok:false,error:entitlement.message,code:entitlement.code,entitlement},{status:403}); }
    const supportedKinds = new Set(["widget","container","section","page","style","component"]);
    const invalid = sourceItems.find((source) => !supportedKinds.has(source.kind) || source.content == null);
    if (invalid) return Response.json({ ok:false, error:`${invalid.title || "A resource"} cannot be imported because its resource type is unsupported.` }, { status:400 });

    const result = await db.$transaction(async (tx) => {
      const idMap = {};
      const targets = [];
      let skipped = 0;
      for (let index = 0; index < sourceItems.length; index += 1) {
        const source = sourceItems[index];
        const importKey = `import:${source.transferKey}`.slice(0, 160);
        const existing = await tx.builderLibraryItem.findFirst({ where: { shop:session.shop, source:"local", sourceKey:importKey } });
        if (existing && conflictPolicy === "skip") { idMap[source.resourceId] = existing.id; skipped += 1; continue; }
        if (existing && conflictPolicy === "replace") { idMap[source.resourceId] = existing.id; targets.push({ source, id:existing.id, sourceKey:importKey, update:true }); continue; }
        const sourceKey = existing ? `${importKey}:copy:${Date.now()}:${index}`.slice(0,160) : importKey;
        const placeholder = await tx.builderLibraryItem.create({ data: {
          shop:session.shop,
          title:String(source.title || "Imported item").trim().slice(0,120) || "Imported item",
          kind:source.kind,
          category:String(source.category || "Imported").trim().slice(0,80) || "Imported",
          templateType:typeof source.templateType === "string" ? source.templateType.slice(0,80) : null,
          isFavorite:false,
          syncMode:source.syncMode === "global" ? "global" : "local",
          contentJson:"[]",
          thumbnail:typeof source.thumbnail === "string" ? source.thumbnail.slice(0,2048) : null,
          sourceKey,
          sourceVersion:Math.max(1,Number(source.sourceVersion || 1)),
          description:typeof source.description === "string" ? source.description.slice(0,600) : null,
          industry:typeof source.industry === "string" ? source.industry.slice(0,80) : null,
          style:typeof source.style === "string" ? source.style.slice(0,80) : null,
          planTier:typeof source.planTier === "string" ? source.planTier.slice(0,40) : null,
          colorTags:typeof source.colorTags === "string" ? source.colorTags : JSON.stringify(source.colorTags || []),
          layoutTags:typeof source.layoutTags === "string" ? source.layoutTags : JSON.stringify(source.layoutTags || []),
          qualityScore:Number.isFinite(Number(source.qualityScore)) ? Number(source.qualityScore) : null,
          compatibilityJson:typeof source.compatibilityJson === "string" ? source.compatibilityJson : JSON.stringify(source.compatibility || {}),
          screenshotJson:typeof source.screenshotJson === "string" ? source.screenshotJson : JSON.stringify(source.screenshot || {}),
          source:"local",
          createdBy:builderActor(session),
        }});
        idMap[source.resourceId] = placeholder.id;
        targets.push({ source, id:placeholder.id, sourceKey, update:false });
      }
      const imported = [];
      for (const target of targets) {
        const content = remapLibraryContent(target.source.content, idMap);
        const item = await tx.builderLibraryItem.update({ where:{ id:target.id }, data:{
          title:String(target.source.title || "Imported item").trim().slice(0,120) || "Imported item",
          kind:target.source.kind,
          category:String(target.source.category || "Imported").trim().slice(0,80) || "Imported",
          templateType:typeof target.source.templateType === "string" ? target.source.templateType.slice(0,80) : null,
          syncMode:target.source.syncMode === "global" ? "global" : "local",
          contentJson:JSON.stringify(content),
          thumbnail:typeof target.source.thumbnail === "string" ? target.source.thumbnail.slice(0,2048) : null,
          sourceKey:target.sourceKey,
          sourceVersion:Math.max(1,Number(target.source.sourceVersion || 1)),
          description:typeof target.source.description === "string" ? target.source.description.slice(0,600) : null,
          industry:typeof target.source.industry === "string" ? target.source.industry.slice(0,80) : null,
          style:typeof target.source.style === "string" ? target.source.style.slice(0,80) : null,
          planTier:typeof target.source.planTier === "string" ? target.source.planTier.slice(0,40) : null,
          colorTags:typeof target.source.colorTags === "string" ? target.source.colorTags : JSON.stringify(target.source.colorTags || []),
          layoutTags:typeof target.source.layoutTags === "string" ? target.source.layoutTags : JSON.stringify(target.source.layoutTags || []),
          qualityScore:Number.isFinite(Number(target.source.qualityScore)) ? Number(target.source.qualityScore) : null,
          compatibilityJson:typeof target.source.compatibilityJson === "string" ? target.source.compatibilityJson : JSON.stringify(target.source.compatibility || {}),
          screenshotJson:typeof target.source.screenshotJson === "string" ? target.source.screenshotJson : JSON.stringify(target.source.screenshot || {}),
          source:"local",
          deletedAt:null,
        }});
        imported.push(item);
      }
      return { imported, skipped };
    });
    const created = result.imported.map(serializeLibraryItem);
    return Response.json({ ok:true, intent, items:created, skipped:result.skipped, message:`Imported ${created.length} Saved Library resource(s)${result.skipped ? `; skipped ${result.skipped} existing resource(s)` : ""}. IDs and internal references were remapped safely.` });
  }
  if (intent === "save") {
    const title = String(form.get("title") || "Saved item").trim().slice(0, 120) || "Saved item";
    const kind = ["widget","container","section","page","style","component"].includes(String(form.get("kind"))) ? String(form.get("kind")) : "section";
    const category = String(form.get("category") || "General").trim().slice(0, 80) || "General";
    const syncMode = form.get("syncMode") === "global" ? "global" : "local";
    if (syncMode === "global") { const entitlement=await getFeatureDecision(db,session.shop,"globalLibrary"); if(!entitlement.allowed)return Response.json({ok:false,error:entitlement.message,code:entitlement.code,entitlement},{status:403}); }
    const content = safeJson(form.get("content"), null);
    if (content == null) return Response.json({ ok: false, error: "Invalid library content." }, { status: 400 });
    const templateType = kind === "page" ? String(form.get("templateType") || "page").trim().slice(0,80) || "page" : null;
    const item = await db.builderLibraryItem.create({ data: { shop: session.shop, title, kind, category, templateType, syncMode, contentJson: JSON.stringify(content), source: "local", createdBy: builderActor(session) } });
    return Response.json({ ok: true, intent, item: serializeLibraryItem(item) });
  }
  return Response.json({ ok: false, error: "Unsupported library action." }, { status: 400 });
}

export default function LibraryRoute() {
  const data = useLoaderData();
  return <s-page heading="Saved Library"><s-section><div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">My Library is managed in the Builder workspace</h2><p className="mt-2 text-sm text-[#666]">Saved Library contains merchant-owned resources only. VSN supplied starter/default templates are available separately in Marketplace.</p><p className="mt-3 text-sm"><b>{data.items?.length||0}</b> saved resources · <b>{data.trash?.length||0}</b> in Trash.</p><div className="mt-4 flex gap-2"><s-button href="/app/pages?panel=library" variant="primary">Open My Library</s-button><s-button href="/app/pages?panel=marketplace">Open Marketplace</s-button></div></div></s-section></s-page>;
}
