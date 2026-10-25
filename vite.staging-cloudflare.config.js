// Real Cloudflare Worker build for the protected Staging deployment. The
// Node/SQLite app entry stays unchanged; only this Worker build substitutes
// the request-scoped Shopify/Neon modules proved by the T020 compatibility gate.
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

const root=fileURLToPath(new URL(".",import.meta.url));
const workerDb=fileURLToPath(new URL("./app/db.worker.server.js",import.meta.url));
const workerShopify=fileURLToPath(new URL("./app/shopify.worker.server.js",import.meta.url));
const workerHealth=fileURLToPath(new URL("./app/services/worker-database-health.server.js",import.meta.url));
const workerPrisma=fileURLToPath(new URL("./app/services/worker-prisma-namespace.server.js",import.meta.url));
const workerEntry=fileURLToPath(new URL("./app/entry.worker.js",import.meta.url));

function stagingWorkerRuntimeBoundaries(){
  return {
    name:"vsn-staging-worker-runtime-boundaries",
    enforce:"pre",
    resolveId(id,importer){
      if(!importer)return null;
      const origin=importer.replaceAll("\\","/");
      const app=origin.includes("/app/");
      const officialSdk=origin.includes("/node_modules/@shopify/")||
        origin.includes("/node_modules/@prisma/");
      if((id==="@prisma/client"||id==="@prisma/client/default")&&(app||officialSdk))
        return workerPrisma;
      return null;
    },
    load(id){
      const normalized=id.split("?")[0].replaceAll("\\","/");
      if(normalized.endsWith("/node_modules/@prisma/client/default.js")||
         normalized.endsWith("/node_modules/.prisma/client/default.js"))
        return `export * from ${JSON.stringify(workerPrisma)};`;
      if(normalized.endsWith("/app/db.server.js"))
        return `export * from ${JSON.stringify(workerDb)}; export {default} from ${JSON.stringify(workerDb)};`;
      if(normalized.endsWith("/app/shopify.server.js"))
        return `export * from ${JSON.stringify(workerShopify)}; export {default} from ${JSON.stringify(workerShopify)};`;
      if(normalized.endsWith("/app/services/database-health.server.js"))
        return `export * from ${JSON.stringify(workerHealth)};`;
      if(normalized.endsWith("/app/entry.server.jsx"))
        return `export {default,streamTimeout} from ${JSON.stringify(workerEntry)};`;
      return null;
    },
  };
}

export default defineConfig({
  plugins:[
    stagingWorkerRuntimeBoundaries(),
    cloudflare({configPath:"./wrangler.staging.jsonc",viteEnvironment:{name:"ssr"}}),
    reactRouter(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  environments:{ssr:{build:{outDir:"dist/server"}}},
  build:{assetsInlineLimit:0},
  root,
});
