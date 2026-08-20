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
export async function getBuilderRoleAccess(db,shop){
  if(!db||!shop)return normalizeBuilderRoleAccess(DEFAULT_BUILDER_ROLE_ACCESS);
  const settings=await db.builderShopSetting.findUnique({where:{shop},select:{roleAccessJson:true}});
  if(!settings?.roleAccessJson)return normalizeBuilderRoleAccess(DEFAULT_BUILDER_ROLE_ACCESS);
  try{return normalizeBuilderRoleAccess(JSON.parse(settings.roleAccessJson));}catch{return normalizeBuilderRoleAccess(DEFAULT_BUILDER_ROLE_ACCESS);}
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
