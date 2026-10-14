// CI-only proof: imports the ACTUAL React Router Vite server bundle after
// running the isolated fixture build. Never used by hosted VSN Builder.
import { createRequestHandler } from "react-router";
import { createIsolatedReactRouterGateway } from "../app/services/worker-react-router-request-gate.js";
const build=()=>import("../tests/fixtures/t020-vite-build/build/server/index.js");
export default createIsolatedReactRouterGateway({
  makeRequestHandler:createRequestHandler,
  loadServerBuild:build,
  mode:"production",
});
