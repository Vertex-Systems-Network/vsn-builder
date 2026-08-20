import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { getFeatureDecision } from "../services/entitlements.server.js";
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";

function clean(row, omit = []) { const copy = { ...row }; for (const key of omit) delete copy[key]; return copy; }
function serializeFont(row) { const copy = clean(row, ["shop"]); return { ...copy, fileDataBase64: Buffer.from(row.fileData || []).toString("base64"), fileData: undefined }; }
function reviveFont(row, shop) { const { fileDataBase64, fileData, ...rest } = row || {}; return { ...rest, shop, fileData: Buffer.from(String(fileDataBase64 || ""), "base64") }; }
function publicIntegration(row) { const copy = clean(row, ["shop", "secretJson"]); return { ...copy, secretJson: "{}", secretsOmitted: true }; }

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const entitlement = await getFeatureDecision(db, session.shop, "backups");
  const recent = await db.builderBackup.findMany({ where: { shop: session.shop }, orderBy: { createdAt: "desc" }, take: 20 });
  if (url.searchParams.get("download") === "1") {
    if (!entitlement.allowed) throw new Response(entitlement.message, { status: 403 });
    const [pages, revisions, library, rules, settings, localizationConfig, translations, customFonts, svgAssets, formConfigs, integrations, brandKits, marketplaceFavorites, marketplaceInstalls, motionPresets, graphqlSavedQueries, globalCode, globalCodeRevisions, wishlists, emailTemplates] = await Promise.all([
      db.builderPage.findMany({ where: { shop: session.shop } }),
      db.builderRevision.findMany({ where: { shop: session.shop } }),
      db.builderLibraryItem.findMany({ where: { shop: session.shop } }),
      db.builderTemplateRule.findMany({ where: { shop: session.shop } }),
      db.builderShopSetting.findUnique({ where: { shop: session.shop } }),
      db.builderLocalizationConfig.findUnique({ where: { shop: session.shop } }).catch(() => null),
      db.builderPageTranslation.findMany({ where: { shop: session.shop } }).catch(() => []),
      db.builderCustomFont.findMany({ where: { shop: session.shop } }).catch(() => []),
      db.builderSvgAsset.findMany({ where: { shop: session.shop } }).catch(() => []),
      db.builderFormConfig.findMany({ where: { shop: session.shop } }).catch(() => []),
      db.builderIntegration.findMany({ where: { shop: session.shop } }).catch(() => []),
      db.builderBrandKit.findMany({ where: { shop: session.shop } }).catch(() => []),
      db.builderMarketplaceFavorite.findMany({ where: { shop: session.shop } }).catch(() => []),
      db.builderMarketplaceInstall.findMany({ where: { shop: session.shop } }).catch(() => []),
      db.builderMotionPreset.findMany({ where: { shop: session.shop } }).catch(() => []),
      db.builderGraphqlSavedQuery.findMany({ where: { shop: session.shop, deletedAt: null } }).catch(() => []),
      db.builderGlobalCode.findMany({ where: { shop: session.shop } }).catch(() => []),
      db.builderGlobalCodeRevision.findMany({ where: { shop: session.shop } }).catch(() => []),
      db.builderWishlist.findMany({ where: { shop: session.shop } }).catch(() => []),
      db.builderEmailTemplate.findMany({ where: { shop: session.shop } }).catch(() => []),
    ]);
    const payload = {
      format: "vsn-builder-backup",
      version: 9,
      exportedAt: new Date().toISOString(),
      pages: pages.map((row) => clean(row, ["shop"])),
      revisions: revisions.map((row) => clean(row, ["shop"])),
      library: library.map((row) => clean(row, ["shop"])),
      rules: rules.map((row) => clean(row, ["shop"])),
      settings: settings ? clean(settings, ["shop"]) : null,
      localizationConfig: localizationConfig ? clean(localizationConfig, ["shop"]) : null,
      translations: translations.map((row) => clean(row, ["shop"])),
      assets: {
        customFonts: customFonts.map(serializeFont),
        svgAssets: svgAssets.map((row) => clean(row, ["shop"])),
      },
      forms: {
        configs: formConfigs.map((row) => clean(row, ["shop"])),
        integrations: integrations.map(publicIntegration),
        submissionsIncluded: false,
        integrationSecretsIncluded: false,
      },
      motion: { presets: motionPresets.map((row) => clean(row, ["shop"])) },
      commerce: { wishlists: wishlists.map((row) => clean(row, ["shop"])) },
      email: { templates: emailTemplates.map((row) => clean(row, ["shop"])) },
      developerStudio: {
        savedQueries: graphqlSavedQueries.map((row) => clean(row, ["shop"])),
        globalCode: globalCode.map((row) => clean(row, ["shop"])),
        globalCodeRevisions: globalCodeRevisions.map((row) => clean(row, ["shop"])),
        graphqlHistoryIncluded: false,
      },
      phase13: {
        brandKits: brandKits.map((row) => clean(row, ["shop"])),
        marketplaceFavorites: marketplaceFavorites.map((row) => clean(row, ["shop"])),
        marketplaceInstalls: marketplaceInstalls.map((row) => clean(row, ["shop"])),
      },
    };
    await db.builderBackup.create({ data: { shop: session.shop, label: `Manual backup ${new Date().toISOString()}`, statsJson: JSON.stringify({ pages: pages.length, library: library.length, translations: translations.length, customFonts: customFonts.length, svgAssets: svgAssets.length, formConfigs: formConfigs.length, integrations: integrations.length, brandKits: brandKits.length, marketplaceFavorites: marketplaceFavorites.length, marketplaceInstalls: marketplaceInstalls.length, motionPresets: motionPresets.length, graphqlSavedQueries: graphqlSavedQueries.length, globalCode: globalCode.length, wishlists: wishlists.length, emailTemplates: emailTemplates.length }) } });
    return new Response(JSON.stringify(payload, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="vsn-builder-backup-${Date.now()}.json"` } });
  }
  return { recent, entitlement };
}

export async function action({ request }) {
  assertTrustedMutationRequest(request);
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  if (String(form.get("intent")) !== "restore") return Response.json({ ok: false }, { status: 400 });
  const entitlement = await getFeatureDecision(db, session.shop, "backups");
  if (!entitlement.allowed) return Response.json({ ok:false, error:entitlement.message, code:entitlement.code, entitlement }, { status:403 });
  let payload;
  try { payload = JSON.parse(String(form.get("payload") || "{}")); }
  catch { return Response.json({ ok: false, error: "Invalid JSON backup." }, { status: 400 }); }
  if (payload.format !== "vsn-builder-backup" || !Array.isArray(payload.pages)) return Response.json({ ok: false, error: "Unsupported backup format." }, { status: 400 });
  await db.$transaction(async (tx) => {
    await tx.builderPageTranslation.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderLocalizationConfig.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderCustomFont.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderSvgAsset.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderFormConfig.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderIntegration.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderMarketplaceFavorite.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderMarketplaceInstall.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderBrandKit.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderMotionPreset.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderGraphqlHistory.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderGraphqlSavedQuery.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderGlobalCodeRevision.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderGlobalCode.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderWishlist.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderEmailTemplate.deleteMany({ where: { shop: session.shop } }).catch(() => {});
    await tx.builderTemplateRule.deleteMany({ where: { shop: session.shop } });
    await tx.builderRevision.deleteMany({ where: { shop: session.shop } });
    await tx.builderLibraryItem.deleteMany({ where: { shop: session.shop } });
    await tx.builderPage.deleteMany({ where: { shop: session.shop } });
    for (const row of payload.pages || []) await tx.builderPage.create({ data: { ...row, shop: session.shop } });
    for (const row of payload.revisions || []) await tx.builderRevision.create({ data: { ...row, shop: session.shop } });
    for (const row of payload.library || []) await tx.builderLibraryItem.create({ data: { ...row, shop: session.shop } });
    for (const row of payload.rules || []) await tx.builderTemplateRule.create({ data: { ...row, shop: session.shop } });
    if (payload.settings) await tx.builderShopSetting.upsert({ where: { shop: session.shop }, create: { ...payload.settings, shop: session.shop }, update: payload.settings });
    if (payload.localizationConfig) await tx.builderLocalizationConfig.create({ data: { ...payload.localizationConfig, shop: session.shop } });
    for (const row of payload.translations || []) await tx.builderPageTranslation.create({ data: { ...row, shop: session.shop } });
    for (const row of payload.assets?.customFonts || []) await tx.builderCustomFont.create({ data: reviveFont(row, session.shop) });
    for (const row of payload.assets?.svgAssets || []) await tx.builderSvgAsset.create({ data: { ...row, shop: session.shop } });
    for (const row of payload.forms?.configs || []) await tx.builderFormConfig.create({ data: { ...row, shop: session.shop } });
    for (const row of payload.forms?.integrations || []) { const { secretsOmitted, ...safe } = row || {}; await tx.builderIntegration.create({ data: { ...safe, shop: session.shop, secretJson: "{}" } }); }
    for (const row of payload.phase13?.brandKits || []) await tx.builderBrandKit.create({ data: { ...row, shop: session.shop } });
    for (const row of payload.motion?.presets || []) await tx.builderMotionPreset.create({ data: { ...row, shop: session.shop } });
    for (const row of payload.developerStudio?.savedQueries || []) await tx.builderGraphqlSavedQuery.create({ data: { ...row, shop: session.shop } });
    for (const row of payload.developerStudio?.globalCode || []) await tx.builderGlobalCode.create({ data: { ...row, shop: session.shop } });
    for (const row of payload.developerStudio?.globalCodeRevisions || []) await tx.builderGlobalCodeRevision.create({ data: { ...row, shop: session.shop } });
    for (const row of payload.commerce?.wishlists || []) await tx.builderWishlist.create({ data: { ...row, shop: session.shop } });
    for (const row of payload.email?.templates || []) await tx.builderEmailTemplate.create({ data: { ...row, shop: session.shop } });
    for (const row of payload.phase13?.marketplaceFavorites || []) await tx.builderMarketplaceFavorite.create({ data: { ...row, shop: session.shop } });
    for (const row of payload.phase13?.marketplaceInstalls || []) await tx.builderMarketplaceInstall.create({ data: { ...row, shop: session.shop } });
  });
  await db.builderBackup.create({ data: { shop: session.shop, label: "Restore completed", statsJson: JSON.stringify({ pages: payload.pages.length, translations: (payload.translations || []).length, customFonts: (payload.assets?.customFonts || []).length, svgAssets: (payload.assets?.svgAssets || []).length, formConfigs: (payload.forms?.configs || []).length, integrations: (payload.forms?.integrations || []).length, brandKits: (payload.phase13?.brandKits || []).length, marketplaceFavorites: (payload.phase13?.marketplaceFavorites || []).length, marketplaceInstalls: (payload.phase13?.marketplaceInstalls || []).length, motionPresets: (payload.motion?.presets || []).length, graphqlSavedQueries: (payload.developerStudio?.savedQueries || []).length, globalCode: (payload.developerStudio?.globalCode || []).length, wishlists: (payload.commerce?.wishlists || []).length, emailTemplates: (payload.email?.templates || []).length }) } });
  return Response.json({ ok: true, message: "Backup restored. Reload Pages." });
}

export default function Backups() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const restore = async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!confirm("Restore this backup? Current builder pages/library/localizations/assets/form configuration will be replaced. Integration secrets must be re-entered after restore.")) return;
    fetcher.submit({ intent: "restore", payload: await file.text() }, { method: "post" });
    event.currentTarget.value = "";
  };
  return <s-page heading="Backup & restore"><s-section><div className="space-y-4"><div className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Full builder backup</h2><p className="mt-1 text-sm text-[#666]">Exports pages, revisions, library, localization, managed fonts/SVGs, reusable Motion presets, Developer Studio saved queries/Global Code, form configs/integration endpoints, Brand Kits, Marketplace install state and shop settings. Submission data is excluded for privacy; integration secrets are never exported. Logged-in customer wishlist records and Email Builder templates are included so commerce and email design state can be restored.</p><div className="mt-3 flex gap-2"><s-button href={data.entitlement?.allowed?"/app/backups?download=1":"#"} variant="primary" disabled={!data.entitlement?.allowed}>Download backup</s-button><s-drop-zone label="Restore JSON" labelAccessibilityVisibility="exclusive" accessibilityLabel="Restore builder backup JSON" accept="application/json,.json" disabled={!data.entitlement?.allowed} onChange={restore} /></div>{!data.entitlement?.allowed?<div className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">{data.entitlement?.message}</div>:null}{fetcher.data?.message?<div className="mt-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">{fetcher.data.message}</div>:null}{fetcher.data?.error?<div className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{fetcher.data.error}</div>:null}</div><div className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Recent operations</h2><div className="mt-3 grid gap-2">{data.recent.map((item)=><div key={item.id} className="rounded-lg bg-[#fafafa] px-3 py-2 text-xs"><b>{item.label}</b> · {new Date(item.createdAt).toLocaleString()}</div>)}{!data.recent.length?<span className="text-sm text-[#777]">No backups recorded yet.</span>:null}</div></div></div></s-section></s-page>;
}
