import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const workerDbBoundary = fileURLToPath(new URL("./workers/full-merchant-ci-db-boundary.js", import.meta.url));
const workerShopifyBoundary = fileURLToPath(new URL("./workers/full-merchant-ci-shopify-boundary.js", import.meta.url));
const workerHealthBoundary = fileURLToPath(new URL("./workers/full-merchant-ci-database-health.js", import.meta.url));
const workerLocationBoundary = fileURLToPath(new URL("./workers/full-merchant-ci-database-location.js", import.meta.url));
// This rewrite applies solely inside the app/ route dependency graph on the
// CI-only Cloudflare Vite build. The Node/SQLite Local build is untouched.
function isolateNodeServerBootstrapsForWorkerd() {
  return {
    name: "vsn-t020-native-worker-compat-ci-only",
    enforce: "pre",
    resolveId(id, importer) {
      if (!importer || !importer.replaceAll("\\", "/").includes("/app/")) return null;
      const normalized = id.replaceAll("\\", "/");
      if (normalized.endsWith("/database-health.server.js")) return workerHealthBoundary;
      if (normalized.endsWith("/database-location.server.js")) return workerLocationBoundary;
      const match = /(?:^|\/)(db|shopify)\.server(?:\.js)?$/.exec(normalized);
      if (!match) return null;
      return match[1] === "db" ? workerDbBoundary : workerShopifyBoundary;
    },
    load(id) {
      // Catch tsconfig-expanded, absolute and virtual route imports that
      // bypass resolveId; do not initialize Node SQLite or Node Shopify.
      const normalized = id.split("?")[0].replaceAll("\\", "/");
      if (normalized.endsWith("/app/db.server.js")) {
        return `export * from ${JSON.stringify(workerDbBoundary)}; export { default } from ${JSON.stringify(workerDbBoundary)};`;
      }
      if (normalized.endsWith("/app/shopify.server.js")) {
        return `export * from ${JSON.stringify(workerShopifyBoundary)}; export { default } from ${JSON.stringify(workerShopifyBoundary)};`;
      }
      if (normalized.endsWith("/app/services/database-health.server.js")) {
        return `export * from ${JSON.stringify(workerHealthBoundary)};`;
      }
      if (normalized.endsWith("/app/utils/database-location.server.js")) {
        return `export * from ${JSON.stringify(workerLocationBoundary)};`;
      }
      return null;
    },
  };
}
import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Full, real app/ route graph, not the T020 synthetic fixture.
// This config is NEVER selected by npm run build or the hosted Worker.
// Cloudflare's SSR environment is used instead of the Node-targeted output.
export default defineConfig({
  plugins: [
    isolateNodeServerBootstrapsForWorkerd(),
    cloudflare({
      configPath: "./wrangler.full-merchant-vite-ci.jsonc",
      viteEnvironment: { name: "ssr" },
    }),
    reactRouter(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  // React Router v7 finalizer reads the server Vite manifest under
  // <buildDirectory>/server/.vite, whereas the CF SSR environment defaults
  // to <buildDirectory>/ssr. Explicitly align the real output paths.
  environments: {
    ssr: {
      build: { outDir: "dist/server" },
    },
  },
  build: { assetsInlineLimit: 0 },
});
