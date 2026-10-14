// CI-only bundled React Router factory compatibility probe. Intentionally
// lacking a valid production server build and therefore never handles a live
// merchant request. Its one synthetic smoke route fails closed until the
// complete Cloudflare Vite route graph and Shopify Auth context are ready.
import { createRequestHandler } from "react-router";
import { createIsolatedReactRouterGateway } from "../app/services/worker-react-router-request-gate.js";

const TEST_BUILD=()=>Promise.resolve(Object.freeze({})); // Not a merchant build.
export default createIsolatedReactRouterGateway({
  makeRequestHandler:createRequestHandler,
  loadServerBuild:TEST_BUILD,
  mode:"production",
});
