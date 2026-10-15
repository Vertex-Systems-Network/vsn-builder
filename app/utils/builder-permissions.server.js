import {
  BUILDER_RESOURCE_DEFINITIONS,
  BUILDER_SYSTEM_DEFINITIONS,
  DEFAULT_BUILDER_ROLE_ACCESS,
  getBuilderRole,
  hasBuilderAction,
  normalizeBuilderRoleAccess,
} from "./builder-permissions.js";

/**
 * Server-only VSN Builder authorization.
 *
 * Keep persistence/API-dependent permission checks here. Shared constants and
 * pure role helpers live in builder-permissions.js so route UI never imports a
 * *.server module into the browser graph.
 */
// A missing shop policy uses the established default role contract. A policy
// which EXISTS but is corrupt must never silently grant those defaults to
// Shopify staff or collaborators. Only the store owner bypasses role checks.
const isPolicyRecord=value=>value!==null && typeof value==="object" &&
 !Array.isArray(value) && Object.getPrototypeOf(value)===Object.prototype;
function validateStoredRolePolicy(value) {
 if(!isPolicyRecord(value))throw new TypeError("Invalid persisted Builder role policy");
 for(const role of ["admin","editor","collaborator","viewer"]) {
  if(Object.hasOwn(value,role) && typeof value[role]!=="boolean")
   throw new TypeError("Invalid persisted Builder role policy");
 }
 for(const groupName of ["systems","actions"]) {
  if(!Object.hasOwn(value,groupName))continue;
  const group=value[groupName];
  if(!isPolicyRecord(group))
   throw new TypeError("Invalid persisted Builder role policy");
  for(const roleName of Object.keys(group)){
   if(!isPolicyRecord(group[roleName]))
    throw new TypeError("Invalid persisted Builder role policy");
   for(const key of Object.keys(group[roleName])){
    const entry=group[roleName][key];
    if(groupName==="systems") {
     if(typeof entry!=="boolean")
      throw new TypeError("Invalid persisted Builder role policy");
    } else {
     if(!isPolicyRecord(entry) ||
        Object.values(entry).some(flag=>typeof flag!=="boolean"))
      throw new TypeError("Invalid persisted Builder role policy");
    }
   }
  }
 }
 return value;
}

export async function getBuilderRoleAccess(db,shop){
  if(!db||!shop)return normalizeBuilderRoleAccess(DEFAULT_BUILDER_ROLE_ACCESS);
  const settings=await db.builderShopSetting.findUnique({where:{shop},select:{roleAccessJson:true}});
  if(settings?.roleAccessJson==null)return normalizeBuilderRoleAccess(DEFAULT_BUILDER_ROLE_ACCESS);
  // Do not downgrade invalid stored restrictions to permissive defaults.
  // Persisted shop policies are small control-plane documents, not a place
  // for unbounded JSON parsing on every authenticated merchant request.
  const raw=settings.roleAccessJson;
  if(typeof raw!=="string" || new TextEncoder().encode(raw).byteLength>65536)
    throw new TypeError("Invalid persisted Builder role policy");
  return normalizeBuilderRoleAccess(validateStoredRolePolicy(JSON.parse(raw)));
}

export async function canAccessBuilderEditor(db,session){return canAccessBuilderSystem(db,session,"pages");}

export async function canAccessBuilderSystem(db,session,systemKey){
  const role=getBuilderRole(session);
  if(role==="admin")return true;
  const definition=BUILDER_SYSTEM_DEFINITIONS.find((row)=>row.key===systemKey);
  if(!definition)return false;
  if(definition.ownerOnly)return false;
  const access=await getBuilderRoleAccess(db,session?.shop);
  return access[role]===true&&access.systems?.[role]?.[systemKey]===true;
}

export async function canAccessBuilderAction(db,session,resourceKey,actionKey){
  const role=getBuilderRole(session);
  if(role==="admin")return true;
  const resource=BUILDER_RESOURCE_DEFINITIONS.find((row)=>row.key===resourceKey);
  if(!resource||!resource.actions.some((row)=>row.key===actionKey))return false;
  const access=await getBuilderRoleAccess(db,session?.shop);
  return hasBuilderAction(access,role,resourceKey,actionKey);
}

export async function requireBuilderAction(db,session,resourceKey,actionKey,message="Your VSN role does not allow this action."){
  if(await canAccessBuilderAction(db,session,resourceKey,actionKey))return true;
  throw new Response(message,{status:403});
}
