import { normalizeCampaignSettings } from "../builder/campaignSystem.js";

function parse(value, fallback) { try { const parsed = JSON.parse(String(value || "")); return parsed ?? fallback; } catch { return fallback; } }

// Writes campaign/floating settings into the page's template-settings node,
// creating it when missing, and returns the new contentJson.
export function applyCampaignSettings(contentJson, template, input = {}) {
  const nodes = parse(contentJson, []);
  const list = Array.isArray(nodes) ? nodes : [];
  const index = list.findIndex((node) => node?.type === "template-settings");
  const current = index >= 0 ? list[index]?.props || {} : {};
  const props = normalizeCampaignSettings({ ...current, ...input }, template);
  const node = index >= 0 ? { ...list[index], props } : { id: `campaign-settings-${Date.now()}`, type: "template-settings", label: "Campaign settings", props, styles: {}, children: [] };
  const next = index >= 0 ? list.map((item, i) => (i === index ? node : item)) : [node, ...list];
  return JSON.stringify(next);
}

export function settingsFromForm(form) {
  const value = parse(form.get("settings"), null);
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

// Shared "update-settings" intent for Campaigns and Floating Elements.
export async function updateCampaignSettings(db, shop, { id, title, settings, templates }) {
  const row = await db.builderPage.findFirst({ where: { id, shop, deletedAt: null, template: { in: templates } } });
  if (!row) return Response.json({ ok: false, error: "Not found." }, { status: 404 });
  const data = { contentJson: applyCampaignSettings(row.contentJson, row.template, settings || {}) };
  const cleanTitle = String(title || "").trim().slice(0, 140);
  if (cleanTitle) data.title = cleanTitle;
  await db.builderPage.update({ where: { id: row.id }, data });
  return Response.json({ ok: true, intent: "update-settings", id: row.id, message: "Settings saved." });
}
