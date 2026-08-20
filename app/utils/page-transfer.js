function safeParseJson(value, fallback = []) {
  try { const parsed = JSON.parse(String(value || "[]")); return Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; }
}

function collectGlobalSectionIds(nodes, target = new Set()) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (node?.type === "global-section" && node?.props?.sectionId) target.add(String(node.props.sectionId));
    collectGlobalSectionIds(node?.children, target);
  }
  return target;
}

export function makePagePackage(page, pages = [], builderVersion = "unknown") {
  const content = safeParseJson(page?.contentJson, []);
  const sectionIds = collectGlobalSectionIds(content);
  const sections = (pages || [])
    .filter((candidate) => candidate.template === "section" && sectionIds.has(String(candidate.id)))
    .map((candidate) => ({ id:candidate.id, title:candidate.title, handle:candidate.handle, template:"section", content:safeParseJson(candidate.contentJson, []) }));
  return {
    format: "vsn-page-package",
    version: 3,
    exportedAt: new Date().toISOString(),
    manifest: { sourceBuilderVersion:builderVersion, title:page.title, template:page.template || "page", dependencyCount:sections.length, importMode:"draft-copy" },
    resources: {
      page: { id:page.id, title:page.title, handle:page.handle, status:page.status, template:page.template || "page", isDefault:!!page.isDefault, resourceId:page.resourceId || null, resourceHandle:page.resourceHandle || null, content },
      sections,
    },
  };
}
