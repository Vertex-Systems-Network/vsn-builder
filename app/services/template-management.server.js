import { scanBuilderPage } from "../builder/healthScanner.js";

export const TEMPLATE_SCREEN_EXCLUDED_TYPES = Object.freeze([
  "popup", "modal", "drawer", "flyout", "announcement-overlay", "floating-element",
]);

const TEMPLATE_TABLE_SELECT = Object.freeze({
  id: true,
  title: true,
  handle: true,
  template: true,
  resourceId: true,
  resourceHandle: true,
  isDefault: true,
  status: true,
  workflowStatus: true,
  shopifyPageUrl: true,
  views: true,
  templateImage: true,
  seoScore: true,
  pageCount: true,
  createdBy: true,
  scheduledAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

const SORT_FIELDS = Object.freeze({
  "name": "title",
  "status": "status",
  "template": "template",
  "views": "views",
  "updated": "updatedAt",
  "created": "createdAt",
  "pages": "pageCount",
  "seo": "seoScore",
  "author": "createdBy",
});

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function parseDateBoundary(value, endOfDay = false) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function templateSettingsFromContent(content = []) {
  const node = (Array.isArray(content) ? content : []).find((item) => item?.type === "template-settings");
  return node?.props && typeof node.props === "object" ? node.props : {};
}

export async function syncTemplateAssignmentRule(db, { shop, page, content = [] }) {
  const assignment = templateSettingsFromContent(content);
  const conditions = {
    includePath: String(assignment.includePath || "").trim(),
    excludePath: String(assignment.excludePath || "").trim(),
    customerState: ["logged-in", "logged-out"].includes(assignment.customerState) ? assignment.customerState : "any",
  };
  await db.builderTemplateRule.upsert({
    where: { id: `rule_${page.id}` },
    create: { id: `rule_${page.id}`, shop, pageId: page.id, template: page.template, priority: Math.max(1, Number(assignment.assignmentPriority || 100)), enabled: true, conditionsJson: JSON.stringify(conditions) },
    update: { template: page.template, priority: Math.max(1, Number(assignment.assignmentPriority || 100)), enabled: true, conditionsJson: JSON.stringify(conditions) },
  });
}

export function parseTemplateContent(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value || "[]") : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function deriveTemplateMetadata({ page = {}, content = [] } = {}) {
  const safeContent = Array.isArray(content) ? content : parseTemplateContent(content);
  const settings = templateSettingsFromContent(safeContent);
  const report = scanBuilderPage({ page, elements: safeContent });
  return {
    templateImage: String(settings.templateImage || settings.ogImage || "").trim() || null,
    seoScore: Math.max(0, Math.min(100, Number(report?.score ?? 100))),
  };
}

export function serializeTemplateRow(page) {
  if (!page) return null;
  return {
    ...page,
    template: page.template || "page",
    title: page.title || "Untitled template",
    status: page.deletedAt ? "trashed" : (page.status || "draft"),
    views: Number(page.views || 0),
    seoScore: Number(page.seoScore ?? 100),
    pageCount: Math.max(0, Number(page.pageCount ?? 1)),
    createdBy: String(page.createdBy || "Store owner"),
    templateImage: String(page.templateImage || ""),
  };
}

export function templateTableQueryFromUrl(url) {
  const params = url instanceof URL ? url.searchParams : new URL(String(url), "https://vsn.local").searchParams;
  const filter = String(params.get("status") || "all").toLowerCase();
  const pageSize = clampInt(params.get("pageSize"), 1, 100, 12);
  const page = clampInt(params.get("page"), 1, 100000, 1);
  const sortField = String(params.get("sort") || "updated").toLowerCase();
  const sortDirection = String(params.get("direction") || "desc").toLowerCase() === "asc" ? "asc" : "desc";
  return {
    search: String(params.get("q") || "").trim().slice(0, 160),
    filter: ["all", "published", "draft", "scheduled", "trash"].includes(filter) ? filter : "all",
    template: String(params.get("template") || "all").trim(),
    seoScore: params.get("seoScore") === null || params.get("seoScore") === "" || params.get("seoScore") === "all" ? null : clampInt(params.get("seoScore"), 0, 100, null),
    author: String(params.get("author") || "all").trim(),
    datePreset: String(params.get("date") || "all").trim(),
    dateFrom: String(params.get("dateFrom") || "").trim(),
    dateTo: String(params.get("dateTo") || "").trim(),
    page,
    pageSize,
    sort: SORT_FIELDS[sortField] ? sortField : "updated",
    direction: sortDirection,
  };
}

function dateRange(query) {
  const now = new Date();
  if (query.datePreset === "today") {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    return { gte: start, lte: end };
  }
  if (["7d", "30d", "90d"].includes(query.datePreset)) {
    const days = Number.parseInt(query.datePreset, 10);
    return { gte: new Date(now.getTime() - days * 86400000), lte: now };
  }
  if (query.datePreset === "custom") {
    const gte = parseDateBoundary(query.dateFrom, false);
    const lte = parseDateBoundary(query.dateTo, true);
    return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
  }
  return null;
}

function buildWhere(shop, query) {
  const trash = query.filter === "trash";
  const where = {
    shop,
    template: { notIn: [...TEMPLATE_SCREEN_EXCLUDED_TYPES] },
    deletedAt: trash ? { not: null } : null,
  };
  if (!trash && ["published", "draft", "scheduled"].includes(query.filter)) where.status = query.filter;
  if (query.template && query.template !== "all") where.template = query.template;
  if (query.seoScore !== null) where.seoScore = query.seoScore;
  if (query.author && query.author !== "all") where.createdBy = query.author;
  const range = dateRange(query);
  if (range && Object.keys(range).length) where.createdAt = range;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search } },
      { handle: { contains: query.search } },
      { createdBy: { contains: query.search } },
    ];
  }
  return where;
}

function orderByFor(query) {
  const field = SORT_FIELDS[query.sort] || "updatedAt";
  return [{ [field]: query.direction }, { id: "asc" }];
}

export async function loadTemplateTableData(db, shop, url) {
  const query = templateTableQueryFromUrl(url);
  const where = buildWhere(shop, query);
  const skip = (query.page - 1) * query.pageSize;
  const activeBase = { shop, deletedAt: null, template: { notIn: [...TEMPLATE_SCREEN_EXCLUDED_TYPES] } };
  const trashBase = { shop, deletedAt: { not: null }, template: { notIn: [...TEMPLATE_SCREEN_EXCLUDED_TYPES] } };

  const [records, total, totalActive, published, draft, scheduled, trashCount, viewAgg] = await Promise.all([
    db.builderPage.findMany({ where, orderBy: orderByFor(query), skip, take: query.pageSize, select: TEMPLATE_TABLE_SELECT }),
    db.builderPage.count({ where }),
    db.builderPage.count({ where: activeBase }),
    db.builderPage.count({ where: { ...activeBase, status: "published" } }),
    db.builderPage.count({ where: { ...activeBase, status: "draft" } }),
    db.builderPage.count({ where: { ...activeBase, status: "scheduled" } }),
    db.builderPage.count({ where: trashBase }),
    db.builderPage.aggregate({ where: activeBase, _sum: { views: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const safePage = Math.min(query.page, totalPages);
  let safeRecords = records;
  if (safePage !== query.page && total > 0) {
    safeRecords = await db.builderPage.findMany({ where, orderBy: orderByFor(query), skip: (safePage - 1) * query.pageSize, take: query.pageSize, select: TEMPLATE_TABLE_SELECT });
  }

  const facetsSource = await db.builderPage.findMany({
    where: { shop, template: { notIn: [...TEMPLATE_SCREEN_EXCLUDED_TYPES] } },
    select: { template: true, seoScore: true, createdBy: true },
  });
  const templates = [...new Set(facetsSource.map((row) => row.template || "page"))].sort();
  const seoScores = [...new Set(facetsSource.map((row) => Number(row.seoScore ?? 100)))].sort((a, b) => b - a);
  const authors = [...new Set(facetsSource.map((row) => String(row.createdBy || "Store owner")))].sort((a, b) => a.localeCompare(b));

  return {
    records: safeRecords.map(serializeTemplateRow),
    total,
    page: safePage,
    pageSize: query.pageSize,
    totalPages,
    query: { ...query, page: safePage },
    stats: {
      total: totalActive,
      published,
      draft,
      scheduled,
      trash: trashCount,
      views: Number(viewAgg?._sum?.views || 0),
    },
    facets: { templates, seoScores, authors },
  };
}
