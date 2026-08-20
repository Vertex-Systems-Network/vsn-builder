function collectNodeTypes(nodes, used) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node || typeof node !== 'object') continue;
    if (node.type) used.add(String(node.type));
    collectNodeTypes(node.children, used);
  }
}

export async function enrichWidgetSettingsWithUsage(db, shop, settings) {
  const base = settings || { widgets: [], totalCount: 0, activeCount: 0, disabledCount: 0, categoryCounts: {} };
  const pages = await db.builderPage.findMany({ where: { shop, deletedAt: null }, select: { contentJson: true, publishedJson: true } }).catch(() => []);
  const used = new Set();
  for (const page of pages) {
    for (const raw of [page.contentJson, page.publishedJson]) {
      if (!raw) continue;
      try { collectNodeTypes(JSON.parse(raw), used); } catch {}
    }
  }
  const widgets = (base.widgets || []).map((widget) => ({ ...widget, used: used.has(widget.id) }));
  const inactiveCount = widgets.filter((widget) => widget.enabled && !widget.used).length;
  const usedCount = widgets.filter((widget) => widget.used).length;
  return { ...base, widgets, inactiveCount, usedCount };
}
