import db from "../app/db.server.js";
const problems = [];
const pages = await db.builderPage.findMany({ orderBy: { updatedAt: "desc" } });
const byShopTemplate = new Map();
for (const page of pages) {
  if (page.isDefault) {
    const key = `${page.shop}:${page.template}`;
    const list = byShopTemplate.get(key) || []; list.push(page); byShopTemplate.set(key, list);
  }
  if (["collection","product","blog","article"].includes(page.template) && !page.isDefault && (!page.resourceHandle || !page.resourceId)) problems.push(`Incomplete assignment: ${page.shop} / ${page.title}`);
  try { if (page.contentJson) JSON.parse(page.contentJson); } catch { problems.push(`Invalid contentJson: ${page.shop} / ${page.title}`); }
}
for (const [key, list] of byShopTemplate) if (list.length > 1) problems.push(`Multiple defaults for ${key}: ${list.length}`);
const revisions = await db.builderRevision.findMany({ select: { id: true, shop: true, pageId: true } });
const pageIds = new Set(pages.map((p)=>p.id));
for (const rev of revisions) if (!pageIds.has(rev.pageId)) problems.push(`Orphan revision ${rev.id} (${rev.shop})`);
console.log(`Migration safety checked ${pages.length} templates and ${revisions.length} revisions.`);
if (problems.length) { console.error(problems.map((p)=>`- ${p}`).join("\n")); process.exitCode = 1; } else console.log("Migration safety PASS");
await db.$disconnect();
