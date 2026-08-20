import { authenticate } from "../shopify.server.js";
import db from "../db.server.js";
import { getLiveSystemMonitor, getCampaignDashboardSummary } from "../services/dashboard-metrics.server.js";
import { getVisitorSummary } from "../services/visitor-analytics.server.js";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const [monitor, visitors, campaigns] = await Promise.all([
    getLiveSystemMonitor(db, session.shop),
    getVisitorSummary(db, session.shop),
    getCampaignDashboardSummary(db, session.shop),
  ]);
  return Response.json({ ok: true, monitor, visitors, campaigns });
}
