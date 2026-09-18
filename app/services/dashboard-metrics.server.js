import { Prisma } from "@prisma/client";
import { OVERLAY_CAMPAIGN_TEMPLATE_TYPES, normalizeCampaignSettings, campaignScheduleState } from "../builder/campaignSystem.js";
import { getVisitorSummary } from "./visitor-analytics.server.js";

function readCampaignSettings(page) {
  try {
    const nodes = JSON.parse(page.contentJson || page.publishedJson || "[]");
    const props = Array.isArray(nodes) ? nodes.find((node) => node?.type === "template-settings")?.props || {} : {};
    return normalizeCampaignSettings(props, page.template);
  } catch {
    return normalizeCampaignSettings({}, page.template);
  }
}

export async function getCampaignDashboardSummary(db, shop) {
  const pages = await db.builderPage.findMany({
    where: { shop, deletedAt: null, template: { in: OVERLAY_CAMPAIGN_TEMPLATE_TYPES } },
    select: { id: true, title: true, template: true, status: true, contentJson: true, publishedJson: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 250,
  }).catch(() => []);
  const states = { active: 0, scheduled: 0, disabled: 0, expired: 0 };
  for (const page of pages) {
    const state = campaignScheduleState(readCampaignSettings(page));
    if (Object.hasOwn(states, state)) states[state] += 1;
  }
  return { total: pages.length, states, active: states.active, recent: pages.slice(0, 5).map((page) => ({ id: page.id, title: page.title, status: page.status, updatedAt: page.updatedAt.toISOString() })) };
}

export async function getLiveSystemMonitor(db, shop) {
  const started = Date.now();
  let databaseOk = true;
  try { await db.$queryRaw(Prisma.sql`SELECT 1`); } catch { databaseOk = false; }
  const databaseLatencyMs = Date.now() - started;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const ninetySecondsAgo = new Date(Date.now() - 90 * 1000);
  const [recentRequests, requestErrors, diagnosticErrors, activeEditors, lastRequest, visitors] = await Promise.all([
    db.builderRequestLog.count({ where: { shop, createdAt: { gte: fiveMinutesAgo } } }).catch(() => 0),
    db.builderRequestLog.count({ where: { shop, createdAt: { gte: fifteenMinutesAgo }, status: { gte: 500 } } }).catch(() => 0),
    db.builderDiagnosticEvent.count({ where: { shop, createdAt: { gte: fifteenMinutesAgo }, level: "error" } }).catch(() => 0),
    db.builderPresence.count({ where: { shop, lastSeenAt: { gte: ninetySecondsAgo } } }).catch(() => 0),
    db.builderRequestLog.findFirst({ where: { shop }, orderBy: { createdAt: "desc" }, select: { createdAt: true, route: true, status: true } }).catch(() => null),
    getVisitorSummary(db, shop).catch(() => ({ active5m: 0 })),
  ]);
  const healthy = databaseOk && requestErrors === 0 && diagnosticErrors === 0;
  return {
    status: healthy ? "healthy" : databaseOk ? "attention" : "down",
    database: { ok: databaseOk, latencyMs: databaseLatencyMs },
    recentRequests,
    requestErrors,
    diagnosticErrors,
    activeEditors,
    activeVisitors: Number(visitors.active5m || 0),
    lastRequest: lastRequest ? { ...lastRequest, createdAt: lastRequest.createdAt.toISOString() } : null,
    checkedAt: new Date().toISOString(),
  };
}

export async function getDashboardSecondaryMetrics(db, shop) {
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [savedLibrary, marketplaceInstalls, aiUsage, backups, healthWarnings, experiments] = await Promise.all([
    db.builderLibraryItem.count({ where: { shop, deletedAt: null, source: "local" } }).catch(() => 0),
    db.builderMarketplaceInstall.count({ where: { shop } }).catch(() => 0),
    db.builderAiUsage.count({ where: { shop, createdAt: { gte: monthStart } } }).catch(() => 0),
    db.builderBackup.count({ where: { shop } }).catch(() => 0),
    db.builderDiagnosticEvent.count({ where: { shop, level: "warning" } }).catch(() => 0),
    db.builderExperiment.groupBy({ by: ["status"], where: { shop }, _count: { _all: true } }).catch(() => []),
  ]);
  const experimentStates = Object.fromEntries(experiments.map((row) => [row.status, row._count?._all || 0]));
  return { savedLibrary, marketplaceInstalls, aiUsage, backups, healthWarnings, experimentStates };
}
