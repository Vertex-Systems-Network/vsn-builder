import { retireLegacyDefaultLibraryItems, serializeLibraryItem } from "./library-presets.server.js";
import { getMarketplaceCatalog } from "./marketplace.server.js";
import { getPlan } from "../utils/plan.server.js";
import { VSN_BASELINE } from "../config/baseline.js";

export async function loadMerchantLibrary(db, shop, { take = 500 } = {}) {
  await retireLegacyDefaultLibraryItems(db, shop);
  const rows = await db.builderLibraryItem.findMany({
    where: { shop, source: "local", deletedAt: null },
    orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
    take,
  });
  return rows.map(serializeLibraryItem);
}

export async function loadEditorTemplateBrowser(db, shop) {
  const [items, marketplace, plan] = await Promise.all([
    loadMerchantLibrary(db, shop),
    getMarketplaceCatalog({ db, shop, currentVersion: VSN_BASELINE.version }),
    getPlan(db, shop),
  ]);
  return {
    items,
    marketplace: {
      items: marketplace.items,
      counts: marketplace.counts,
      filters: marketplace.filters,
      remote: marketplace.remote,
      plan: { key: plan.key, name: plan.name, marketplacePro: plan.marketplacePro },
    },
  };
}
