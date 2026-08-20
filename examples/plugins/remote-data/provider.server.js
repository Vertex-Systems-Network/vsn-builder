import { registerVsnPlugin } from "../../../app/sdk/index.js";
import { createExternalDataProvider } from "../../../app/sdk/server.js";
import manifest from "./manifest.json" with { type: "json" };

export function registerProvider() {
  return registerVsnPlugin({
    manifest,
    setup(api) {
      api.registerDataProvider(createExternalDataProvider({
        id: "catalog:items",
        label: "Acme Catalog",
        endpoint: "https://api.example.com/items",
        networkOrigins: ["https://api.example.com/"],
        mapResponse: (payload) => Array.isArray(payload?.items) ? payload.items : [],
      }));
    },
  });
}
