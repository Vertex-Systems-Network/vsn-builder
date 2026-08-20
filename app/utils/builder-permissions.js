/**
 * Shared VSN Builder permission contracts.
 *
 * IMPORTANT: this module must remain client-safe. Do not import Prisma, Shopify
 * server helpers, Node APIs, secrets, or any *.server module here. Route UI can
 * import these constants/helpers without leaking server-only code into Vite's
 * client graph.
 */
export const DEFAULT_BUILDER_ROLE_ACCESS = Object.freeze({ admin:true, editor:true, collaborator:true, viewer:false });

export const BUILDER_SYSTEM_DEFINITIONS = Object.freeze([
  { key:"dashboard", label:"Dashboard", group:"Overview" },
  { key:"pages", label:"Pages & visual editor", group:"Build" },
  { key:"library", label:"Saved Library", group:"Build" },
  { key:"marketplace", label:"Marketplace", group:"Build" },
  { key:"brandKits", label:"Brand Kits", group:"Build" },
  { key:"widgets", label:"Widgets", group:"Build" },
  { key:"widgetStudio", label:"Widget Studio", group:"Build" },
  { key:"campaigns", label:"Campaigns", group:"Growth" },
  { key:"emailBuilder", label:"Email Builder", group:"Growth" },
  { key:"experiments", label:"CRO Experiments", group:"Growth" },
  { key:"floatingElements", label:"Floating Elements", group:"Growth" },
  { key:"fonts", label:"Custom Fonts", group:"Assets" },
  { key:"svgAssets", label:"SVG Library", group:"Assets" },
  { key:"animations", label:"Motion Library", group:"Assets" },
  { key:"stockImages", label:"Stock Images", group:"Assets" },
  { key:"stockVideos", label:"Stock Videos", group:"Assets" },
  { key:"stockAudio", label:"Stock Audio", group:"Assets" },
  { key:"submissions", label:"Form Submissions", group:"Data & Forms" },
  { key:"formSettings", label:"Form Settings", group:"Data & Forms" },
  { key:"localization", label:"Languages & Markets", group:"Localization" },
  // Milestone L: developer systems are no longer hard owner-only. They remain
  // disabled for non-owner roles by default and must be explicitly granted.
  { key:"developerStudio", label:"Developer Studio", group:"Developer", defaultEnabled:false },
  { key:"developerSdk", label:"Plugin SDK", group:"Developer", defaultEnabled:false },
  { key:"platformIntelligence", label:"Platform Intelligence", group:"Developer", defaultEnabled:false },
  { key:"onboarding", label:"Setup", group:"System" },
  { key:"backups", label:"Backups", group:"System" },
  { key:"controlCenter", label:"System Health", group:"System" },
  { key:"roleManager", label:"Roles & Permissions", group:"System", ownerOnly:true },
  { key:"documentation", label:"Documentation", group:"Manage" },
  { key:"plans", label:"Plans & License", group:"Manage" },
  { key:"settings", label:"Settings", group:"Manage" },
  { key:"support", label:"Support", group:"Manage" },
  { key:"changelog", label:"Changelog", group:"Manage" },
  { key:"notifications", label:"Notifications", group:"Manage" },
  { key:"about", label:"About", group:"Manage" },
  { key:"profile", label:"Profile", group:"Account" },
]);

export const BUILDER_ROLE_DEFINITIONS = Object.freeze([
  { key:"admin", label:"Store owner", description:"The store owner always has full access and is the only role that can manage permissions.", locked:true },
  { key:"editor", label:"Staff", description:"Authenticated Shopify staff members who are not collaborators." },
  { key:"collaborator", label:"Collaborator", description:"Shopify collaborator accounts with access to this app." },
]);

export const BUILDER_RESOURCE_DEFINITIONS = Object.freeze([
  {
    key:"pages", label:"Pages", system:"pages", group:"Build",
    actions:[
      {key:"view",label:"View pages",defaults:["editor","collaborator","viewer"]},
      {key:"create",label:"Create pages",defaults:["editor","collaborator"]},
      {key:"edit",label:"Edit pages",defaults:["editor","collaborator"]},
      {key:"publish",label:"Publish / change defaults",defaults:[]},
      {key:"delete",label:"Move to Trash / permanently delete",defaults:[]},
      {key:"restore",label:"Restore from Trash",defaults:[]},
      {key:"import",label:"Import packages",defaults:["editor","collaborator"]},
    ],
  },
  {
    key:"marketplace", label:"Marketplace", system:"marketplace", group:"Build",
    actions:[
      {key:"browse",label:"Browse marketplace",defaults:["editor","collaborator","viewer"]},
      {key:"favorite",label:"Manage favorites",defaults:["editor","collaborator","viewer"]},
      {key:"install",label:"Install / update templates",defaults:["editor","collaborator"]},
      {key:"rollback",label:"Rollback installs",defaults:[]},
    ],
  },
  {
    key:"stockImages", label:"Stock Images", system:"stockImages", group:"Assets",
    actions:[
      {key:"view",label:"Search stock providers",defaults:["editor","collaborator","viewer"]},
      {key:"favorite",label:"Manage stock favorites",defaults:["editor","collaborator"]},
      {key:"import",label:"Import / update Shopify Files",defaults:["editor","collaborator"]},
      {key:"delete",label:"Delete imported Shopify files",defaults:[]},
    ],
  },
  {
    key:"stockVideos", label:"Stock Videos", system:"stockVideos", group:"Assets",
    actions:[
      {key:"view",label:"Search stock video providers",defaults:["editor","collaborator","viewer"]},
      {key:"favorite",label:"Manage video favorites",defaults:["editor","collaborator"]},
      {key:"import",label:"Import / update Shopify videos",defaults:["editor","collaborator"]},
      {key:"delete",label:"Delete imported Shopify videos",defaults:[]},
    ],
  },
  {
    key:"stockAudio", label:"Stock Audio", system:"stockAudio", group:"Assets",
    actions:[
      {key:"view",label:"Search stock audio providers",defaults:["editor","collaborator","viewer"]},
      {key:"favorite",label:"Manage audio favorites",defaults:["editor","collaborator"]},
      {key:"import",label:"Import / update Shopify audio files",defaults:["editor","collaborator"]},
      {key:"delete",label:"Delete imported Shopify audio files",defaults:[]},
    ],
  },
  {
    key:"graphql", label:"GraphQL Studio", system:"developerStudio", group:"Developer",
    actions:[
      {key:"read_queries",label:"View schema & saved queries",defaults:[]},
      {key:"run_queries",label:"Run read queries",defaults:[]},
      {key:"save_queries",label:"Save / manage queries",defaults:[]},
      {key:"run_mutations",label:"Run mutations",defaults:[]},
    ],
  },
  {
    key:"globalCode", label:"Global CSS / JS", system:"developerStudio", group:"Developer",
    actions:[
      {key:"view",label:"View code",defaults:[]},
      {key:"edit",label:"Create / edit code",defaults:[]},
      {key:"publish",label:"Enable / disable / rollback",defaults:[]},
      {key:"delete",label:"Trash / permanently delete",defaults:[]},
    ],
  },
  {
    key:"plugins", label:"Plugin SDK", system:"developerSdk", group:"Developer",
    actions:[
      {key:"view",label:"View SDK registry",defaults:[]},
      {key:"configure",label:"Validate / test plugins",defaults:[]},
      {key:"install",label:"Install extensions",defaults:[]},
    ],
  },
  {
    key:"platform", label:"Platform Intelligence", system:"platformIntelligence", group:"Developer",
    actions:[
      {key:"view",label:"View dependency and usage intelligence",defaults:["editor","collaborator","viewer"]},
      {key:"manage_tokens",label:"Manage Design Tokens 2.0",defaults:[]},
      {key:"run_qa",label:"Run visual regression and performance QA",defaults:[]},
      {key:"manage_extensions",label:"Evaluate extension permission manifests",defaults:[]},
      {key:"simulate_migrations",label:"Run release migration simulations",defaults:[]},
    ],
  },
  {
    key:"billing", label:"Billing", system:"plans", group:"Manage",
    actions:[
      {key:"view",label:"View plans & usage",defaults:["editor","collaborator","viewer"]},
      {key:"manage",label:"Open / manage Shopify billing",defaults:[]},
    ],
  },
]);

export const BUILDER_NAV_SYSTEM_MAP = Object.freeze({
  home:"dashboard", dashboard:"dashboard", pages:"pages", library:"library", marketplace:"marketplace", "brand-kits":"brandKits", widgets:"widgets", "widget-studio":"widgetStudio",
  campaigns:"campaigns", "email-builder":"emailBuilder", experiments:"experiments", "floating-elements":"floatingElements", fonts:"fonts", "svg-assets":"svgAssets", animations:"animations", "stock-images":"stockImages", "stock-videos":"stockVideos", "stock-audio":"stockAudio",
  "form-submissions":"submissions", "form-settings":"formSettings", localization:"localization", "developer-studio":"developerStudio", "developer-sdk":"developerSdk", "platform-intelligence":"platformIntelligence", onboarding:"onboarding",
  backups:"backups", "role-manager":"roleManager", "control-center":"controlCenter", documentation:"documentation", pricing:"plans", license:"plans", settings:"settings", support:"support",
  changelog:"changelog", notifications:"notifications", about:"about", profile:"profile",
});

export const BUILDER_PANEL_SYSTEM_MAP = Object.freeze({
  library:"library", marketplace:"marketplace", "brand-kits":"brandKits", campaigns:"campaigns", "email-builder":"emailBuilder", experiments:"experiments", "floating-elements":"floatingElements",
  fonts:"fonts", "svg-assets":"svgAssets", animations:"animations", "stock-images":"stockImages", "stock-videos":"stockVideos", "stock-audio":"stockAudio", "form-submissions":"submissions", "form-settings":"formSettings", onboarding:"onboarding",
  backups:"backups", plans:"plans", "role-manager":"roleManager", "control-center":"controlCenter", "developer-studio":"developerStudio", "developer-sdk":"developerSdk", "widget-studio":"widgetStudio",
});

function defaultSystems(role, roleEnabled=true) {
  return Object.fromEntries(BUILDER_SYSTEM_DEFINITIONS.map((system)=>[
    system.key,
    role === "admin" ? true : (roleEnabled && system.ownerOnly !== true && system.defaultEnabled !== false),
  ]));
}

function defaultResourceActions(role, roleEnabled, systems) {
  const actions = {};
  for (const resource of BUILDER_RESOURCE_DEFINITIONS) {
    const systemEnabled = resource.system ? systems?.[resource.system] !== false : true;
    actions[resource.key] = {};
    for (const action of resource.actions) {
      actions[resource.key][action.key] = role === "admin" ? true : Boolean(roleEnabled && systemEnabled && action.defaults.includes(role));
    }
  }
  return actions;
}

export function isBuilderOwner(session) {
  const user=session?.onlineAccessInfo?.associated_user||session?.onlineAccessInfo?.associatedUser||null;
  return user?.account_owner===true||user?.accountOwner===true||session?.accountOwner===true;
}

export function getBuilderRole(session) {
  if(isBuilderOwner(session))return "admin";
  if(session?.collaborator===true)return "collaborator";
  if(session?.shop&&session?.accessToken)return "editor";
  return "viewer";
}

export function normalizeBuilderRoleAccess(value) {
  const parsed=value&&typeof value==="object"?value:{};
  const access={admin:true,editor:parsed.editor!==false,collaborator:parsed.collaborator!==false,viewer:parsed.viewer===true,systems:{},actions:{}};
  for(const role of ["admin","editor","collaborator","viewer"]){
    const roleEnabled=role==="admin"?true:access[role]===true;
    const incoming=parsed.systems?.[role]&&typeof parsed.systems[role]==="object"?parsed.systems[role]:{};
    access.systems[role]=defaultSystems(role,roleEnabled);
    for(const system of BUILDER_SYSTEM_DEFINITIONS){
      if(role==="admin"){access.systems[role][system.key]=true;continue;}
      if(system.ownerOnly){access.systems[role][system.key]=false;continue;}
      if(Object.prototype.hasOwnProperty.call(incoming,system.key))access.systems[role][system.key]=incoming[system.key]===true;
      if(!roleEnabled)access.systems[role][system.key]=false;
    }

    const incomingActions=parsed.actions?.[role]&&typeof parsed.actions[role]==="object"?parsed.actions[role]:{};
    access.actions[role]=defaultResourceActions(role,roleEnabled,access.systems[role]);
    for(const resource of BUILDER_RESOURCE_DEFINITIONS){
      const resourceIncoming=incomingActions?.[resource.key]&&typeof incomingActions[resource.key]==="object"?incomingActions[resource.key]:{};
      const systemEnabled=resource.system?access.systems[role]?.[resource.system]!==false:true;
      for(const action of resource.actions){
        if(role==="admin"){access.actions[role][resource.key][action.key]=true;continue;}
        if(Object.prototype.hasOwnProperty.call(resourceIncoming,action.key))access.actions[role][resource.key][action.key]=resourceIncoming[action.key]===true;
        if(!roleEnabled||!systemEnabled)access.actions[role][resource.key][action.key]=false;
      }
    }
  }
  return access;
}

export function getRoleSystemAccess(access,role){
  const normalized=normalizeBuilderRoleAccess(access);
  return normalized.systems?.[role]||defaultSystems(role,normalized[role]===true);
}

export function getRoleActionAccess(access,role){
  const normalized=normalizeBuilderRoleAccess(access);
  return normalized.actions?.[role]||defaultResourceActions(role,normalized[role]===true,normalized.systems?.[role]);
}

export function hasBuilderAction(access,role,resourceKey,actionKey){
  if(role==="admin")return true;
  const normalized=normalizeBuilderRoleAccess(access);
  const resource=BUILDER_RESOURCE_DEFINITIONS.find((item)=>item.key===resourceKey);
  if(!resource||!resource.actions.some((item)=>item.key===actionKey))return false;
  if(normalized[role]!==true)return false;
  if(resource.system&&normalized.systems?.[role]?.[resource.system]===false)return false;
  return normalized.actions?.[role]?.[resourceKey]?.[actionKey]===true;
}

// Legacy coarse action helper remains for older routes while Milestone L moves
// sensitive resources to canAccessBuilderAction on the server.
export function canBuilder(role,action){
  const matrix={admin:new Set(["view","edit","save","publish","delete","import","settings","restore"]),editor:new Set(["view","edit","save","import"]),collaborator:new Set(["view","edit","save","import"]),viewer:new Set(["view"])};
  return matrix[role]?.has(action)===true;
}

export function builderActor(session){
  const user=session?.onlineAccessInfo?.associated_user||session?.onlineAccessInfo?.associatedUser||null;
  return user?.email||[user?.first_name||user?.firstName,user?.last_name||user?.lastName].filter(Boolean).join(" ")||session?.email||[session?.firstName,session?.lastName].filter(Boolean).join(" ")||String(user?.id||session?.userId||"Shopify user");
}
