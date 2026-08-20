import db from "../app/db.server.js";
import { cleanupBuilderData } from "../app/utils/cleanup.server.js";
const shops = await db.session.findMany({ distinct: ["shop"], select: { shop: true } });
for (const { shop } of shops) {
  const stats = await cleanupBuilderData(shop);
  console.log(shop, stats);
}
await db.$disconnect();
