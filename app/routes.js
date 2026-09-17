import { route } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default [
  route("builder-proxy/*", "./routes/builder-proxy-secure.$.jsx"),
  ...(await flatRoutes({
    ignoredRouteFiles: ["builder-proxy.$.jsx", "builder-proxy-secure.$.jsx"],
  })),
];
