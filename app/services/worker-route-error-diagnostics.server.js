import { getWorkerRequestContext } from "./worker-request-context.server.js";
import { logStagingRouteError } from "./worker-diagnostics.js";

// Route modules use this only in server loaders/actions. Missing Worker context
// is expected in local Node development and in client rendering.
export function logCurrentStagingRouteError(route,error){
  try{
    const context=getWorkerRequestContext();
    logStagingRouteError({APP_ENV:context.runtimeTier},route,error);
  }catch{/* the logger must not replace the original route failure */}
}
