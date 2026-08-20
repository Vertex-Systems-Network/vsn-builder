const SETTINGS_CACHE = new Map();
async function visitorAnalyticsEnabled(db, shop) {
  const cached=SETTINGS_CACHE.get(shop); const now=Date.now();
  if(cached && now-cached.at<30000) return cached.enabled;
  const row=await db.builderShopSetting.findUnique({where:{shop},select:{appSettingsJson:true}}).catch(()=>null);
  let enabled=true; try{const parsed=JSON.parse(String(row?.appSettingsJson||"{}"));enabled=parsed.visitorAnalytics!==false;}catch{}
  SETTINGS_CACHE.set(shop,{enabled,at:now}); return enabled;
}

function clean(value, max = 120) { return String(value || "").trim().slice(0, max); }

export async function trackStorefrontVisitor(db, { shop, visitorId, sessionId, country = "", path = "/" }) {
  const normalizedShop = clean(shop, 255);
  const visitor = clean(visitorId);
  const session = clean(sessionId) || visitor;
  if (!normalizedShop || !visitor || !session) return null;
  const countryCode = clean(country, 8).toUpperCase() || null;
  const pagePath = clean(path, 1000) || "/";
  const now = new Date();
  try {
    return await db.builderVisitorSession.upsert({
      where: { shop_sessionId: { shop: normalizedShop, sessionId: session } },
      create: { shop: normalizedShop, visitorId: visitor, sessionId: session, country: countryCode, lastPath: pagePath, firstSeenAt: now, lastSeenAt: now, pageViews: 1 },
      update: { visitorId: visitor, country: countryCode || undefined, lastPath: pagePath, lastSeenAt: now, pageViews: { increment: 1 } },
    });
  } catch (error) {
    console.warn("VSN visitor analytics tracking warning:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function trackStorefrontVisitorRequest(db, shop, context = {}, modes = {}) {
  if (modes.campaignMode || modes.loopQueryMode || modes.customJsMode || modes.loadMoreMode || !context.visitorId) return null;
  if (!(await visitorAnalyticsEnabled(db, shop))) return null;
  return trackStorefrontVisitor(db, { shop, visitorId: context.visitorId, sessionId: context.sessionId, country: context.country, path: context.path });
}

export async function getVisitorSummary(db, shop, { hours = 24 } = {}) {
  const since = new Date(Date.now() - Math.max(1, Number(hours) || 24) * 60 * 60 * 1000);
  const activeSince = new Date(Date.now() - 5 * 60 * 1000);
  const rows = await db.builderVisitorSession.findMany({
    where: { shop, lastSeenAt: { gte: since } },
    select: { country: true, pageViews: true, lastSeenAt: true },
    orderBy: { lastSeenAt: "desc" },
    take: 5000,
  }).catch(() => []);
  const countries = new Map();
  for (const row of rows) {
    const code = String(row.country || "unknown").toUpperCase();
    const current = countries.get(code) || { code, sessions: 0, pageViews: 0 };
    current.sessions += 1;
    current.pageViews += Number(row.pageViews || 0);
    countries.set(code, current);
  }
  const countryRows = [...countries.values()].sort((a, b) => b.sessions - a.sessions || b.pageViews - a.pageViews);
  return {
    sessions24h: rows.length,
    active5m: rows.filter((row) => row.lastSeenAt >= activeSince).length,
    pageViews24h: rows.reduce((sum, row) => sum + Number(row.pageViews || 0), 0),
    countries: countryRows,
    countryCount: countryRows.filter((row) => row.code !== "UNKNOWN").length,
  };
}
