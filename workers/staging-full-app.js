// Cloudflare Vite entry for the complete Shopify Staging React Router app.
// This file is built and deployed only by the protected T021 Staging workflow.
import { createRequestHandler } from "react-router";
import { createWorkerShopifySdkContext } from "../app/services/shopify-worker-sdk-context.js";
import { createStagingFullAppRouterWorker } from "../app/services/worker-full-app-router-runtime.js";
import legacyWorker from "./app.js";

const loadServerBuild=()=>import("virtual:react-router/server-build");

export default createStagingFullAppRouterWorker({
  makeRequestHandler:createRequestHandler,
  loadServerBuild,
  createSdkContext:createWorkerShopifySdkContext,
  legacyWorker,
  mode:"production",
});
