import { VSN_RELEASES } from "../data/releases.js";

function dateString(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function serializeNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    href: row.href || null,
    sourceKey: row.sourceKey || null,
    readAt: dateString(row.readAt),
    createdAt: dateString(row.createdAt),
  };
}

async function ensureOne(db, shop, input) {
  const sourceKey = String(input.sourceKey || "").trim();
  if (!sourceKey) return null;
  return db.builderNotification.upsert({
    where: { shop_sourceKey: { shop, sourceKey } },
    create: { shop, ...input, sourceKey },
    update: {},
  });
}

export async function ensureDashboardNotifications(db, shop, plan, diagnosticErrors = 0) {
  const latest = VSN_RELEASES[0];
  const tasks = [
    ensureOne(db, shop, {
      sourceKey: "system:welcome",
      type: "system",
      title: "VSN Builder is ready",
      message: "Your builder workspace is connected. You can manage pages, widgets, templates and store settings from one app.",
      href: "/app",
    }),
    latest ? ensureOne(db, shop, {
      sourceKey: `release:${latest.version}`,
      type: "update",
      title: `VSN Builder v${latest.version} is available`,
      message: latest.summary,
      href: "/app?view=changelog",
    }) : null,
    ensureOne(db, shop, {
      sourceKey: `plan:${plan?.key || "unknown"}:${plan?.subscription?.status || "active"}`,
      type: "billing",
      title: `${plan?.name || "Current"} plan active`,
      message: plan?.subscription?.trialEndsAt
        ? `Your ${plan.name} plan is active. Trial ends ${new Date(plan.subscription.trialEndsAt).toLocaleDateString("en-US")}.`
        : `Your ${plan?.name || "current"} plan is active for this store.`,
      href: "/app?view=license",
    }),
  ].filter(Boolean);

  if (diagnosticErrors > 0) {
    tasks.push(ensureOne(db, shop, {
      sourceKey: `diagnostics:${diagnosticErrors}`,
      type: "security",
      title: "Builder diagnostics need attention",
      message: `${diagnosticErrors} diagnostic error${diagnosticErrors === 1 ? "" : "s"} are currently recorded for this store.`,
      href: "/app/pages",
    }));
  }
  await Promise.all(tasks);
}

export async function listDashboardNotifications(db, shop, take = 60) {
  const rows = await db.builderNotification.findMany({
    where: { shop, dismissedAt: null },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(serializeNotification);
}
