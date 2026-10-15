// CI-only bundled React Router factory compatibility probe. Intentionally
// loading a one-route synthetic ServerBuild fixture. This does NOT implement
// the real Builder Cloudflare Vite build, Shopify Auth or merchant sessions.
import { createRequestHandler } from "react-router";
import { createIsolatedReactRouterGateway } from "../app/services/worker-react-router-request-gate.js";

const TEST_BUILD=()=>import("./edge-react-router-ci-build.js").then(m=>m.default); // Only one synthetic loader
export default createIsolatedReactRouterGateway({
  makeRequestHandler:createRequestHandler,
  loadServerBuild:TEST_BUILD,
  mode:"production",
});
