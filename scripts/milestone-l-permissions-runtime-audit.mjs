import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const checks=[];
function check(label, condition, detail='') { checks.push({label,pass:Boolean(condition),detail}); }
function has(file, needle){return read(file).includes(needle);}

const pkg=JSON.parse(read('package.json'));
const baseline=JSON.parse(read('BASELINE.json'));
const perms=read('app/utils/builder-permissions.js');
const server=read('app/utils/builder-permissions.server.js');
const pages=read('app/routes/app.pages.jsx');
const builder=read('app/routes/app.builder.$id.jsx');
const market=read('app/routes/app.marketplace.jsx');
const dev=read('app/routes/app.developer-studio.jsx');
const plugins=read('app/routes/app.plugins.jsx');
const plans=read('app/routes/app.plans.jsx');
const role=read('app/routes/app.role-manager.jsx');
const home=read('app/components/dashboard/pages/Home.jsx');
const app=read('app/routes/app.jsx');
const index=read('app/routes/app._index.jsx');
const rootRoute=read('app/root.jsx');
const sessionGuard=read('app/components/ui/AppSessionGuard.jsx');
const editor=read('app/components/editor/PageEditor.jsx');
const heartbeat=read('app/components/editor/hooks/useCollaborationHeartbeat.js');

const versionAtLeast=(value,min)=>{const a=String(value||'0').split('.').map(Number),b=String(min).split('.').map(Number);for(let i=0;i<3;i++){if((a[i]||0)>(b[i]||0))return true;if((a[i]||0)<(b[i]||0))return false;}return true;};
check('Package preserves Milestone L baseline version', versionAtLeast(pkg.version,'2.5.68'), pkg.version);
check('Baseline preserves Milestone L', versionAtLeast(baseline.version,'2.5.68') && (['L','M','N','O'].includes(baseline.milestone)||/^(P\.|Q\.)/.test(String(baseline.milestone||''))) && ['complete','in-progress'].includes(baseline.status));
check('Runtime baseline preserves Milestone L contracts', (/milestone: "(?:P|Q)\./.test(read('app/config/baseline.js')) || /milestone: "[LMNO]"/.test(read('app/config/baseline.js'))) && has('app/config/baseline.js','rolePermissions: 3') && has('app/config/baseline.js','sessionRuntime: 1'));
check('Resource/action definitions exist', perms.includes('BUILDER_RESOURCE_DEFINITIONS'));
for(const token of ['key:"pages"','key:"marketplace"','key:"graphql"','key:"globalCode"','key:"plugins"','key:"billing"']) check(`Resource contract ${token}`, perms.includes(token));
for(const token of ['run_mutations','read_queries','manage','publish','restore','install']) check(`Action contract ${token}`, perms.includes(`key:"${token}"`));
check('Developer systems require explicit non-owner grant', perms.includes('developerStudio", label:"Developer Studio", group:"Developer", defaultEnabled:false') && perms.includes('developerSdk", label:"Plugin SDK", group:"Developer", defaultEnabled:false'));
check('Owner role remains guaranteed full access', perms.includes('if(role==="admin")return true') && role.includes('requireOwner(session)'));
check('Server action authorization helper exists', server.includes('export async function canAccessBuilderAction'));
check('Server denial helper exists', server.includes('export async function requireBuilderAction'));
check('Role Manager can toggle resource actions', role.includes('intent==="toggle-action"') && role.includes('BUILDER_RESOURCE_DEFINITIONS'));
check('Role Manager persists action matrix', role.includes('roleAccessJson:JSON.stringify(next)') && role.includes('next.actions[role][resourceKey][actionKey]=enabled'));
check('Pages route enforces view permission', pages.includes('canAccessBuilderAction(db, session, "pages", "view")'));
check('Pages route enforces create/edit/publish/delete/restore/import', ['create','edit','publish','delete','restore','import'].every((key)=>pages.includes(`"pages", "${key}"`)));
check('Editor route enforces view/edit/publish/delete', builder.includes('canAccessBuilderAction(db, session, "pages", "view")') && builder.includes('canAccessBuilderAction(db, session, "pages", "edit")') && builder.includes('canAccessBuilderAction(db, session, "pages", "delete")') && builder.includes('intent === "publish" ? "publish" : "edit"') && builder.includes('canAccessBuilderAction(db, session, "pages", resourceAction)'));
check('Pages UI uses action permissions', pages.includes('canCreate={permissions.create === true}') && pages.includes('canRestore={permissions.restore === true}') && pages.includes('canSetDefault={permissions.publish === true}'));
check('Editor UI combines VSN and collaboration permissions', editor.includes('pagePermissions.publish === true') && editor.includes('pagePermissions.edit === true') && editor.includes('pagePermissions.delete === true'));
check('Marketplace server actions are granular', ['browse','favorite','install','rollback'].every((key)=>market.includes(`"marketplace","${key}"`)));
check('GraphQL query/mutation actions are independently authorized', dev.includes('operation.type==="mutation"?"run_mutations":"run_queries"') && dev.includes('"graphql","save_queries"'));
check('Global Code edit/publish/delete actions are independently authorized', ['"globalCode","edit"','"globalCode",required'].every((needle)=>dev.includes(needle)));
check('Developer Studio UI receives action permissions', dev.includes('permissions={data.permissions.graphql}') && dev.includes('permissions={data.permissions.globalCode}'));
check('Plugin SDK has server-enforced view/configure permissions', plugins.includes('"plugins","view"') && plugins.includes('"plugins","configure"'));
check('Plans route separates billing view/manage', plans.includes('"billing","view"') && plans.includes('"billing","manage"') && plans.includes('canManage:'));
check('Dashboard billing controls consume manage permission', has('app/components/dashboard/DashboardApp.jsx','shell.actionAccess?.billing?.manage === true') && has('app/components/dashboard/pages/Pricing.jsx','Billing management restricted'));
check('Home list render has stable map key', home.includes('visibleIds.map((id)=><Fragment key={id}>'));
check('Restricted accountOwner GraphQL field removed from shell loaders', !app.includes('accountOwner {') && !index.includes('accountOwner {'));
check('Dashboard live polling uses authenticated fresh-token fetch', home.includes("authenticatedAppFetch('/app/dashboard-live'") && home.includes('document.visibilityState === \'hidden\''));
check('Editor passive heartbeat uses authenticated fresh-token fetch', editor.includes('useCollaborationHeartbeat') && heartbeat.includes('authenticatedAppFetch(`${window.location.pathname}${window.location.search}`') && heartbeat.includes('document.visibilityState !== "visible"') && heartbeat.includes('navigator.onLine === false'));
check('App shell has session recovery guard', app.includes('<AppSessionGuard />') && app.includes('provider(<><AppSessionGuard/><Outlet /></>)'));
check('Session guard proactively refreshes visible embedded sessions', sessionGuard.includes('validate();') && sessionGuard.includes('setInterval(validate, 60000)') && sessionGuard.includes('window.addEventListener("focus", validate)'));
check('Root has runtime recovery boundary', rootRoute.includes('<AppRuntimeBoundary><Outlet /></AppRuntimeBoundary>'));
check('Permission docs updated', has('docs/engineering/permissions.md','Milestone L'));

try {
  const mod=await import(pathToFileURL(path.join(root,'app/utils/builder-permissions.js')).href+`?audit=${Date.now()}`);
  const access=mod.normalizeBuilderRoleAccess({admin:true,editor:true,collaborator:true,viewer:false});
  check('Default staff can edit but not publish pages', mod.hasBuilderAction(access,'editor','pages','edit')===true && mod.hasBuilderAction(access,'editor','pages','publish')===false);
  check('Default staff cannot enter Developer Studio', mod.getRoleSystemAccess(access,'editor').developerStudio===false);
  check('Owner can run GraphQL mutations', mod.hasBuilderAction(access,'admin','graphql','run_mutations')===true);
} catch(error) {
  check('Permission contracts execute as ESM', false, error instanceof Error?error.message:String(error));
}

const failed=checks.filter((row)=>!row.pass);
for(const row of checks) console.log(`${row.pass?'PASS':'FAIL'} | ${row.label}${row.detail?` | ${row.detail}`:''}`);
console.log(`\nMilestone L audit: ${checks.length-failed.length}/${checks.length} passed`);
if(failed.length) process.exitCode=1;
