// React Router Cloudflare build only. Every route import resolves the real
// Neon Prisma client created for the active authenticated Worker request.
import { getWorkerRequestContext } from "./services/worker-request-context.server.js";

export const VSN_DATABASE_LOCATION=Object.freeze({
  provider:"postgresql",database:"neondb",source:"request-scoped Cloudflare binding",
});

const db=new Proxy(Object.freeze({}),{
  get(_target,key){
    if(key==="then")return undefined;
    if(key===Symbol.toStringTag)return "VSNRequestScopedNeonPrisma";
    const client=getWorkerRequestContext().database;
    const value=Reflect.get(client,key,client);
    return typeof value==="function"?value.bind(client):value;
  },
  set(){return false;},
  defineProperty(){return false;},
  deleteProperty(){return false;},
});

export default db;
