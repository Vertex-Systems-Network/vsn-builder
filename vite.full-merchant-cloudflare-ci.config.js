import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Full, real app/ route graph, not the T020 synthetic fixture.
// This config is NEVER selected by npm run build or the hosted Worker.
// Cloudflare's SSR environment is used instead of the Node-targeted output.
export default defineConfig({
  plugins: [
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
