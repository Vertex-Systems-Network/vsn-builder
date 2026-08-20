const ACTION_META = {
  "template.saved": ["Saved page", "save"],
  "template.published": ["Published page", "publish"],
  "template.imported": ["Imported page", "import"],
  "revision.restored": ["Restored revision", "restore"],
  "design_tokens.updated": ["Updated design tokens", "settings"],
  "maintenance.cleanup": ["Ran maintenance cleanup", "maintenance"],
  "widgets.updated": ["Updated widget availability", "widgets"],
  "support.ticket.created": ["Created support ticket", "support"],
  "support.ticket.replied": ["Replied to support ticket", "support"],
  "support.ticket.closed": ["Closed support ticket", "support"],
  "support.ticket.reopened": ["Reopened support ticket", "support"],
};

export async function loadDashboardActivity(db, shop, take = 8) {
  const rows = await db.builderAuditLog.findMany({
    where: { shop, action: { not: "template.autosaved" } },
    orderBy: { createdAt: "desc" },
    take: Math.max(take * 2, 20),
  });
  const pageIds = [...new Set(rows.map((row) => row.pageId).filter(Boolean))];
  const pages = pageIds.length ? await db.builderPage.findMany({ where: { shop, id: { in: pageIds } }, select: { id: true, title: true } }) : [];
  const pageMap = new Map(pages.map((page) => [page.id, page.title]));
  return rows.slice(0, take).map((row) => {
    const [label, kind] = ACTION_META[row.action] || [row.action.replaceAll(".", " "), "system"];
    let details = row.details || "";
    try {
      const parsed = JSON.parse(details);
      if (parsed && typeof parsed === "object") details = parsed.message || parsed.title || "";
    } catch {}
    return {
      id: row.id,
      action: row.action,
      kind,
      label,
      pageTitle: row.pageId ? pageMap.get(row.pageId) || null : null,
      actor: row.actor || "VSN",
      details: details || null,
      createdAt: row.createdAt.toISOString(),
    };
  });
}
