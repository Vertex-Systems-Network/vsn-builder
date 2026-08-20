import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { recordPaidOrderAttribution } from "../services/experiment-engine.server.js";

export const action = async ({ request }) => {
  const { payload, topic, shop } = await authenticate.webhook(request);
  try {
    const result = await recordPaidOrderAttribution({ db, shop, order: payload || {} });
    if (result.attributed > 0) {
      await db.builderAuditLog.create({ data: { shop, action: "experiment.order_attributed", details: JSON.stringify({ topic, orderId: payload?.admin_graphql_api_id || payload?.id || null, attributed: result.attributed }) } }).catch(() => null);
    }
  } catch (error) {
    console.error("VSN experiment paid-order attribution failed:", error);
  }
  return new Response(null, { status: 200 });
};
