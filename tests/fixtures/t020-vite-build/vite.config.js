import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";

// Deliberately tiny, independent test app. This is not the merchant build and
// does not import app/shopify.server.js, SQLite Prisma, billing or secrets.
export default defineConfig({
  plugins:[reactRouter()],
  build:{assetsInlineLimit:0},
});
