import fs from "node:fs";
const read=(p)=>fs.readFileSync(p,"utf8");
let pass=0,fail=0;
const check=(name,ok)=>{if(ok){pass++;console.log(`PASS  ${name}`)}else{fail++;console.error(`FAIL  ${name}`)}};
const appNav=read("app/routes/app.jsx");
const sidebar=read("app/components/AppSidebar.jsx");
const pages=read("app/routes/app.pages.jsx");
const host=read("app/components/BuilderPanelHost.jsx");
const toolkit=read("app/components/ui/VsnToolkit.jsx");
const dashCss=read("app/styles/dashboard.css");
const builderCss=read("app/styles/builder.css");
const fonts=read("app/routes/app.fonts.jsx");
const svgs=read("app/routes/app.svg-assets.jsx");
const tooltip=read("app/components/editor/EditorTooltipLayer.jsx");
const elements=read("app/components/editor/ElementsSidebar.jsx");
const inserter=read("app/components/editor/SectionInserter.jsx");
const permissions=read("app/utils/builder-permissions.js")+"\n"+read("app/utils/builder-permissions.server.js");
const shopify=read("app/shopify.server.js");
const control=read("app/routes/app.control-center.jsx");
const health=read("app/routes/app.health.jsx");
const library=read("app/routes/app.library.jsx");
const dashboard=read("app/components/Dashboard.jsx");
const dataViewKit=read("app/components/ui/VsnDataViewKit.jsx");
const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));

check("release preserves Phase 13 stabilization on v2.5.49 or later",Number(baseline.phase)>=13&&/^2\.5\.(?:49|[5-9]\d|\d{3,})$/.test(pkg.version)&&pkg.version===baseline.version);
check("Campaigns removed from Shopify app navigation",!appNav.includes('<s-link href="/app/campaigns"'));
check("Experiments removed from Shopify app navigation",!appNav.includes('<s-link href="/app/experiments"'));
check("Campaigns remain in Builder sidebar",sidebar.includes('id: "campaigns"')&&sidebar.includes('label: "Campaigns"'));
check("CRO Experiments remain in Builder sidebar",sidebar.includes('id: "experiments"')&&sidebar.includes('label: "CRO Experiments"'));
check("Campaign editor opens from same Builder workspace",host.includes('onEditPage?.(item)')&&host.includes('activeView === "campaigns"'));
check("Floating editor opens from same Builder workspace",host.includes('activeView === "floating-elements"')&&host.includes('onEditPage?.(item)'));
check("New campaign/floating item auto-opens in workspace editor",host.includes('["campaigns","floating-elements"].includes(panel)')&&host.includes('action.data?.pageId'));
check("Campaign/floating/popup templates are hidden from normal Pages",pages.includes("WORKSPACE_ONLY_TEMPLATES")&&pages.includes('"popup"')&&pages.includes('"floating-element"'));

check("Builder panel uploads submit multipart FormData",host.includes('encType: "multipart/form-data"'));
check("Font upload has readable multipart/parser error",fonts.includes("upload could not be read")&&fonts.includes("8 MB"));
check("SVG upload has readable multipart/parser error",svgs.includes("upload could not be read")&&svgs.includes("512 KB"));
check("File picker dispatches client-side readable error",toolkit.includes('vsn:file-picker-error'));
check("File input covers the visible upload control",dashCss.includes('.vsn-file-button input{position:absolute;inset:0;width:100%;height:100%'));

check("Builder panel action notices are screen-scoped",host.includes('actionPanelRef')&&host.includes('actionPanel === activeView')&&host.includes('setActionPanel(null)'));
check("Pages feedback clears when leaving Pages",pages.includes('pageFeedback')&&pages.includes('activeView !== "pages"'));
check("Phase 12 workspace spacing stabilization CSS exists",dashCss.includes('v2.5.49 Phase 13 stabilization')&&dashCss.includes('.vsn-form-stack{gap:18px}')&&dashCss.includes('.vsn-two-column-grid{gap:22px}'));

check("Human readable labels are used in Builder panels",(host.includes('function humanLabel')||host.includes('from \"../utils/display-format.js\"'))&&host.includes('{humanLabel(x)}'));
check("Pages template labels are human readable",dashboard.includes('function templateLabel')&&dashboard.includes('{templateLabel(page.template)}'));

check("Health is removed as a duplicate Builder sidebar screen",!sidebar.includes('id: "health"'));
check("Legacy Health route redirects to unified System Health",health.includes('/app/pages?panel=control-center'));
check("Unified health includes engines and widgets",control.includes('engines:{')&&control.includes('widgets:{total:'));
check("Unified health exposes owner/session state safely",control.includes('ownerDetected')&&control.includes('onlineStaffSession'));
check("Unified health UI uses dashboard metrics",host.includes('vsn-system-dashboard-grid')&&host.includes('Engines & Widgets'));
check("Health values are humanized",host.includes('humanValue')&&host.includes('vsn-system-kv'));

check("Builder Library renders real design preview",host.includes('LibraryDesignPreview content={x.content||[]}'));
check("Direct Library delegates previews to the canonical Builder workspace on Milestone H+",library.includes("My Library is managed in the Builder workspace")&&library.includes("/app/pages?panel=library"));
check("Builder Library has Favorites view/action",host.includes('label:"Favorites"')&&host.includes('vsn-library-favorite-action'));
check("Builder Library has pagination",host.includes('pageSize=12')&&host.includes('vsn-pagination'));
check("Direct Library delegates pagination to the canonical Builder workspace on Milestone H+",library.includes("Open My Library")&&library.includes("merchant-owned resources only"));
check("Editor Library popup has pagination",inserter.includes('pageSize = 12')&&inserter.includes('vsn-library-pagination'));
check("Editor Library popup retains favorite action",inserter.includes('onToggleLibraryFavorite')&&inserter.includes('Remove from favorites'));
check("Workspace shell uses one constrained scroll context",dashCss.includes('.vsn-builder-workspace-shell{height:100dvh')&&dashCss.includes('>main{height:100%;min-height:0;overflow:hidden}'));

check("Delete/Trash actions use danger styling in main Pages UI",
  dashboard.includes('danger: ["Trash", "Delete Forever"].includes(label)')
  && dataViewKit.includes('className={action.danger ? "danger" : ""}')
  && dashCss.includes('.vsn-page-menu button.danger')
  && dashCss.includes('.vsn-template-bulk-menu button.danger'));
check("Delete/Trash actions use danger styling in Builder panels",host.includes('variant="danger"')&&host.includes('Delete forever'));

check("Shopify admin authentication uses online user sessions",shopify.includes('useOnlineTokens: true'));
check("Owner detection reads Shopify associated user account_owner",permissions.includes('associated_user')&&permissions.includes('account_owner'));
check("Owner has admin/publish permissions",/if\s*\(isBuilderOwner\(session\)\)\s*return\s*["']admin["']/.test(permissions)&&permissions.includes('"publish"'));

check("Tooltip no longer uses full-screen ModalPortal",tooltip.includes('OverlayPortal')&&!tooltip.includes('ModalPortal'));
check("Tooltip content cannot capture pointer events",tooltip.includes('pointerEvents: "none"')&&builderCss.includes('.vsn-js-tooltip')&&builderCss.includes('pointer-events:none'));
check("Tooltip is suppressed during pointer activation",tooltip.includes('suppressUntilRef.current = Date.now() + 650'));
check("Widget cards no longer carry tooltip attributes",!elements.includes('className="vsn-home-widget-card" data-tooltip'));

console.log(`\nPhase 13 stabilization audit: ${pass} PASS / ${fail} FAIL`);
if(fail) process.exit(1);
