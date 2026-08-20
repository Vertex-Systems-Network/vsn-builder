import assert from "node:assert/strict";
import fs from "node:fs";
import { trashTemplateThemeAssets, restoreTemplateThemeAssets } from "../app/services/theme-assets.server.js";

const read=(file)=>fs.readFileSync(file,"utf8");
const exists=(file)=>fs.existsSync(file);
const checks=[];
async function check(name,fn){try{await fn();checks.push([name,true]);console.log(`PASS  ${name}`)}catch(error){checks.push([name,false]);console.error(`FAIL  ${name}: ${error.message}`)}}

const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));
const dashboard=read("app/components/Dashboard.jsx");
const pages=read("app/routes/app.pages.jsx");
const toolkit=read("app/components/ui/VsnToolkit.jsx");
const dataKit=read("app/components/ui/VsnDataViewKit.jsx");
const themeAssets=read("app/services/theme-assets.server.js");
const pageSettings=read("app/components/editor/PageSettingsPanel.jsx");
const pageEditor=read("app/components/editor/PageEditor.jsx");
const sidebar=read("app/components/dashboard/Sidebar.jsx");
const home=read("app/components/dashboard/pages/Home.jsx");
const drawer=read("app/components/dashboard/widgets/DashboardWidgetDrawer.jsx");
const topNav=read("app/components/dashboard/TopNav.jsx");
const settings=read("app/components/dashboard/pages/Settings.jsx");
const dashboardActions=read("app/services/dashboard-actions.server.js");
const appRoute=read("app/routes/app.jsx");
const css=read("app/styles/dashboard.css");
const plans=read("app/config/commercialPlans.js");

await check("Version retains v2.5.99+ Q6.1 baseline",()=>{const parts=pkg.version.split(".").map(Number);assert.ok(parts[0]>2||(parts[0]===2&&(parts[1]>5||(parts[1]===5&&parts[2]>=99))))});
await check("Baseline remains on Q.6.1+ lineage",()=>assert.match(String(baseline.milestone||""),/^Q\.6(?:\.\d+)+$/));
await check("Q6.1 Developer Mode marker exists",()=>assert.equal(exists("MILESTONE_Q61_DEVELOPER_MODE.md"),true));
await check("Q6.1 report exists",()=>assert.equal(exists("VSN_MILESTONE_Q61_REUSABLE_DATA_VIEW_APP_SHELL_REPORT_v2.5.99.md"),true));
await check("Reusable Data View developer docs exist",()=>assert.equal(exists("docs/developer/reusable-data-view-kit.md"),true));
await check("Q6.1 audit is part of release QA",()=>assert.ok(pkg.scripts?.["qa:release"]?.includes("milestone-q61-reusable-data-view-app-shell-audit.mjs")));
await check("Q6.1 dedicated QA command exists",()=>assert.equal(pkg.scripts?.["qa:q61"],"node scripts/milestone-q61-reusable-data-view-app-shell-audit.mjs"));

await check("Theme Trash boundary normalizes non-array fallback files",()=>assert.ok(themeAssets.includes("const safeFallbackFiles = Array.isArray(fallbackFiles) ? fallbackFiles : []")));
await check("Theme Restore boundary normalizes non-array stale files",()=>assert.ok(themeAssets.includes("staleFiles = Array.isArray(staleFiles) ? staleFiles : []")));
await check("Pages JSON parser treats persisted null as fallback",()=>assert.ok(pages.includes("return parsed == null ? fallback : parsed")));
await check("Trash metadata follow-up cannot turn a completed Trash move into a hard failure",()=>assert.ok(pages.includes("Trash metadata could not be saved")&&pages.includes("warnings.push")));

await check("Null fallbackFiles no longer throws in theme Trash runtime",async()=>{
  const admin={graphql:async(query)=>{
    if(query.includes("VsnAssetManifest")) return {json:async()=>({data:{currentAppInstallation:{metafield:{value:JSON.stringify({architecture:"qa",schemaVersion:2,entries:[]})}}}})};
    if(query.includes("VsnAssetAppInstallation")) return {json:async()=>({data:{currentAppInstallation:{id:"gid://shopify/AppInstallation/1"}}})};
    if(query.includes("metafieldsSet")) return {json:async()=>({data:{metafieldsSet:{userErrors:[]}}})};
    throw new Error(`Unexpected QA GraphQL operation: ${query.slice(0,80)}`);
  }};
  const result=await trashTemplateThemeAssets({admin,session:{scope:""},pageId:"qa",fallbackFiles:null});
  assert.equal(result.success,true); assert.deepEqual(result.files,[]);
});
await check("Null staleFiles is accepted by draft Restore runtime",async()=>{
  const db={builderPage:{findFirst:async()=>({id:"qa",status:"draft",publishedJson:null})}};
  const result=await restoreTemplateThemeAssets({admin:{},session:{shop:"qa.myshopify.com",scope:""},db,pageId:"qa",staleFiles:null});
  assert.equal(result.success,true); assert.equal(result.skipped,true);
});

await check("Template image fallback contains icon only and no title initial",()=>{const start=dashboard.indexOf("function TemplateThumb");const end=dashboard.indexOf("function Modal",start);const block=dashboard.slice(start,end);assert.ok(block.includes("ImageIcon"));assert.doesNotMatch(block,/charAt|slice\(0,\s*1\)|page\.title\s*\[/)});
await check("Template list column is labeled Image",()=>assert.ok(dashboard.includes('key: "image", label: "Image"')));
await check("Template title column is labeled Title",()=>assert.ok(dashboard.includes('key: "name", label: "Title"')));
await check("Soft-delete row action is labeled Trash",()=>assert.ok(dashboard.includes('"Trash"')&&dashboard.includes('Trash: Trash2')));
await check("Bulk soft-delete action is labeled Trash",()=>assert.ok(dashboard.includes('{ key: "delete", label: "Trash"')));
await check("Permanent delete remains explicit Delete Forever",()=>assert.ok(dashboard.includes('"Delete Forever"')));

await check("Editor image control is merchant-facing Image",()=>assert.ok(pageSettings.includes('title="Image"')||pageSettings.includes('>Image<')));
await check("Editor can use current Shopify resource featured image",()=>assert.ok(pageSettings.includes("Use featured image")&&pageSettings.includes("resourceFeaturedImage")));
await check("PageEditor supplies Product featured image",()=>assert.ok(pageEditor.includes("previewProduct?.featuredImage?.url")));
await check("PageEditor supplies Collection image",()=>assert.ok(pageEditor.includes("previewCollection?.image?.url")));
await check("PageEditor supplies Article image",()=>assert.ok(pageEditor.includes("previewArticle?.image?.url")));

await check("Successful mutations trigger Templates DB refresh",()=>assert.ok(dashboard.includes("refreshSignal?.success")&&dashboard.includes("loadTable()")));
await check("DB refresh clears stale row menu",()=>assert.ok(dashboard.includes("setOpenMenu(null)")));
await check("DB refresh clears stale bulk menu",()=>assert.ok(dashboard.includes("setOpenBulkMenu(null)")));
await check("Shared VsnNotice has explicit dismiss button",()=>assert.ok(toolkit.includes("vsn-tool-notice-dismiss")&&toolkit.includes("Dismiss message")));
await check("Dashboard Toast already retains explicit close control",()=>{const toast=read("app/components/dashboard/Toast.jsx");assert.ok(toast.includes("onRemove(toast.id)")&&toast.includes("<X size={14}"))});

await check("Reusable Data View kit exists",()=>assert.equal(exists("app/components/ui/VsnDataViewKit.jsx"),true));
for(const key of ["list","grid","search","filters","statusFilters","dateFilter","seoFilter","templateFilter","authorFilter","bulkActions","sorting","pagination","settings","widgets","columnVisibility","pageSize","customPageSize","rowActions"]){
  await check(`Reusable Data View config supports ${key}`,()=>assert.ok(dataKit.includes(`${key}: true`)));
}
await check("Disabling filters disables individual filter controls",()=>assert.ok(dataKit.includes("if (resolved.filters === false)")&&dataKit.includes("resolved.statusFilters = false")));
await check("Disabling settings disables settings sections",()=>assert.ok(dataKit.includes("if (resolved.settings === false)")&&dataKit.includes("resolved.customPageSize = false")));
await check("Templates accepts reusable Data View options",()=>assert.ok(dashboard.includes("dataViewOptions = null")&&dashboard.includes("normalizeDataViewConfig(dataViewOptions")));
await check("Separate sort field selector exists",()=>assert.ok(dataKit.includes('aria-label="Sort field"')));
await check("Separate ASC/DESC selector exists",()=>assert.ok(dataKit.includes('aria-label="Sort direction"')&&dataKit.includes('<option value="asc">ASC</option><option value="desc">DESC</option>')));
await check("Custom records-per-page entry supports 1–100",()=>assert.ok(dashboard.includes('Custom records per page')&&dashboard.includes('min="1" max="100"')));

await check("Row action menu uses body portal",()=>assert.ok(dataKit.includes("VsnAnchoredPopover")&&toolkit.includes("createPortal")&&dataKit.includes("vsn-data-view-action-popover")));
await check("Bulk action menu also uses body portal",()=>assert.ok(dataKit.includes("VsnDataViewBulkMenu")&&dataKit.includes("vsn-data-view-bulk-popover")));
await check("Anchored popover chooses above/below from viewport room",()=>assert.ok(toolkit.includes("roomBelow")&&toolkit.includes("roomAbove")&&toolkit.includes("placeBelow")));
await check("Anchored popover repositions on nested scroll",()=>assert.ok(toolkit.includes('window.addEventListener("scroll", update, true)')));
await check("Portal popovers detect dark mode outside dashboard DOM tree",()=>assert.ok(toolkit.includes('dataset?.vsnTheme === "dark"')&&css.includes(".vsn-anchored-popover.is-dark")));

await check("Sidebar Pages menu is merchant-facing Templates",()=>assert.ok(sidebar.includes("id: 'pages', label: 'Templates'")));
await check("Dashboard primary Pages navigation is merchant-facing Templates",()=>assert.ok(home.includes('<PanelsTopLeft size={15}/> Templates</button>')));
await check("Command palette navigation is merchant-facing Templates",()=>assert.ok(read("app/components/dashboard/AppCommandPalette.jsx").includes("['pages','Templates'")));
await check("Duplicate VSN Builder sidebar brand text is removed",()=>assert.doesNotMatch(sidebar,/VSN Builder<\/|>VSN Builder</));
await check("VSN Builder brand appears immediately before search in topbar",()=>{assert.ok(topNav.indexOf("vsn-topbar-brand")>=0);assert.ok(topNav.indexOf("vsn-topbar-brand")<topNav.indexOf("vsn-pages-search")||topNav.indexOf("vsn-topbar-brand")<topNav.indexOf("Search VSN Builder"))});
await check("Profile dropdown has Profile with icon",()=>assert.ok(topNav.includes("<UserRound")&&topNav.includes("<strong>Profile</strong>")));
await check("Profile dropdown has pin guidance with icon",()=>assert.ok(topNav.includes("<Pin")&&topNav.includes("Pin app in Shopify")));
await check("Profile dropdown has Shopify sign-out guidance with icon",()=>assert.ok(topNav.includes("<LogOut")&&topNav.includes("Sign out of Shopify")));
await check("Custom profile dropdown contains no Manage App entry",()=>assert.doesNotMatch(topNav,/Manage App|Manage app/));

await check("Profile uninstall requires typed consent",()=>assert.ok(topNav.includes("requireText:'UNINSTALL'")&&topNav.includes("app-uninstall")));
await check("Settings uninstall requires typed consent",()=>assert.ok(settings.includes("requireText:'UNINSTALL'")&&settings.includes("vsn-settings-danger-card")));
await check("Settings uninstall uses danger action styling",()=>assert.ok(settings.includes("vsn-danger-action")&&settings.includes("Danger zone")));
await check("Server uninstall is owner-only",()=>assert.ok(dashboardActions.includes("if (!isBuilderOwner(session))")));
await check("Server uninstall uses Shopify appUninstall mutation",()=>assert.ok(dashboardActions.includes("mutation VsnAppUninstall")&&dashboardActions.includes("appUninstall")));
await check("Server uninstall redirects out to Shopify admin",()=>assert.ok(dashboardActions.includes("https://admin.shopify.com/store/")));
await check("VSN does not fake a host logout URL",()=>assert.doesNotMatch(topNav,/accounts\.shopify\.com\/logout|\/auth\/logout/));
await check("VSN does not fake a host pin mutation",()=>assert.doesNotMatch(topNav,/pinApp\(|appPin|setPinned/));

await check("Templates and Dashboard use same floating Settings button primitive",()=>assert.ok(dashboard.includes("VsnDataViewSettings")&&home.includes("VsnFloatingSettingsButton")));
await check("Dashboard settings uses same Settings popup primitive",()=>assert.ok(drawer.includes("VsnSettingsPopover")));
await check("Settings button can toggle itself closed",()=>assert.ok(dataKit.includes("onToggle?.(!open)")&&home.includes("setDrawerOpen((current)=>!current)")));
await check("Shared Settings popup has explicit close button",()=>assert.ok(toolkit.includes('aria-label={`Close ${title}`}')));

await check("Sidebar root permits collapse control overflow",()=>assert.ok(sidebar.includes("overflow: 'visible'")));
await check("Sidebar nav owns vertical scrolling without clipping collapse control",()=>assert.ok(sidebar.includes("minHeight: 0, overflowY: 'auto', overflowX: 'hidden'")));
await check("Dashboard Home no longer uses useLayoutEffect",()=>{const imports=home.slice(0,home.indexOf("\n",0)+1);assert.doesNotMatch(home,/useLayoutEffect/)});
await check("React Router v8 future flags were not enabled blindly",()=>{const config=["react-router.config.js","react-router.config.ts","vite.config.js","vite.config.ts"].filter(exists).map(read).join("\n");assert.doesNotMatch(config,/v8_middleware|v8_splitRouteModules|v8_viteEnvironmentApi|v8_passThroughRequests|v8_trailingSlashAwareDataRequests/)});

await check("No Q6.1 Prisma migration was added",()=>assert.equal(fs.readdirSync("prisma/migrations").some((name)=>/q61|reusable_data_view|app_shell_qa/i.test(name)),false));
await check("Exact Shopify Free handle remains free",()=>assert.ok(plans.includes('shopifyHandle: "free"')));
await check("Exact Shopify Silver key remains sliver",()=>assert.ok(plans.includes('shopifyHandle: "sliver"')));
await check("Exact Shopify Gold handle remains gold",()=>assert.ok(plans.includes('shopifyHandle: "gold"')));
await check("Exact Shopify Platinum key remains platenium",()=>assert.ok(plans.includes('shopifyHandle: "platenium"')));
await check("App route passes owner state to profile controls",()=>assert.ok(appRoute.includes("isOwner={isOwner}")));

const failed=checks.filter(([,ok])=>!ok);
console.log(`\nMilestone Q.6.1 Reusable Data View + App Shell audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
