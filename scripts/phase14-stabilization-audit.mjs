import fs from "node:fs";
const read=(file)=>fs.readFileSync(file,"utf8");
let pass=0,fail=0;
const check=(name,ok)=>{if(ok){pass++;console.log(`PASS  ${name}`)}else{fail++;console.error(`FAIL  ${name}`)}};
const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));
const host=read("app/components/BuilderPanelHost.jsx");
const fonts=read("app/routes/app.fonts.jsx");
const fontContext=read("app/components/editor/fonts/FontRegistryContext.jsx");
const svgs=read("app/routes/app.svg-assets.jsx");
const editorControls=read("app/components/editor/EditorControls.jsx");
const toolkit=read("app/components/ui/VsnToolkit.jsx");
const marketplace=read("app/routes/app.marketplace.jsx");
const libraryPreview=read("app/components/editor/LibraryDesignPreview.jsx");
const preview=read("app/components/editor/PreviewRenderer.jsx"); const sdkView=fs.existsSync("app/components/editor/SdkWidgetView.jsx")?read("app/components/editor/SdkWidgetView.jsx"):preview;
const pages=read("app/routes/app.pages.jsx");
const dashboard=read("app/components/Dashboard.jsx");
const css=read("app/styles/dashboard.css");

check("Phase 14 stabilization is preserved on v2.5.51 or later",Number(pkg.version.split(".")[2]||0)>=51&&pkg.version===baseline.version&&Number(baseline.phase)>=14);

// 1-3: assets + loader/infinite-render chain.
check("Builder lazy loader uses a dedicated React Router fetcher",host.includes("const panelLoader = useFetcher()")&&host.includes("panelLoadRequestRef")&&host.includes("panelLoadSettledRef"));
check("Lazy panels use the JSON builder-panel resource route",host.includes("/app/builder-panel/${encodeURIComponent(activeView)}")&&!host.includes('fetch(`${route}?builderPanel=1&refresh=${refreshGeneration}`'));
check("Panel loader response is scoped to active panel generation",host.includes("loadedPanelGeneration")&&host.includes("refreshGeneration")&&host.includes("setPanelRefreshes"));
check("Action completion only runs on fetcher transition back to idle",host.includes("previousActionState")&&host.includes('if(previous==="idle"||action.state!=="idle")return'));
check("Unstable onEditPage callback is kept in a ref",host.includes("onEditPageRef")&&!host.includes("[action.state,action.data,onEditPage]"));
check("Lazy panel actions submit directly to panel route",host.includes("directActionRoute")&&host.includes('action: directActionRoute'));
check("Pages route skips full workspace revalidation for panel actions",pages.includes("BUILDER_PANEL_ACTION_PATHS")&&pages.includes("shouldRevalidate")&&pages.includes("return false"));
check("Font builder list loader avoids Google catalog network dependency",fonts.includes('if(mode==="catalog")')&&fonts.includes("serializedRows(session.shop,null)")&&fonts.includes("serializedRows(session.shop,{not:null})"));
check("Font upload validates file type and size in client",host.includes('Choose a WOFF2, WOFF, TTF, or OTF font file.')&&host.includes('8*1024*1024'));
check("SVG upload validates file type and size in client",host.includes('Choose an SVG file.')&&host.includes('512*1024'));
check("Async file picker handlers surface readable errors",toolkit.includes("const handleChange = async")&&toolkit.includes("await onChange?.(event)")&&toolkit.includes("vsn:file-picker-error"));
check("Successful font mutation refreshes editor typography registry",host.includes("vsn:font-registry-changed")&&fontContext.includes("vsn:font-registry-changed")&&fontContext.includes("handleRegistryChange"));
check("Successful SVG mutation refreshes an already-open SVG picker",host.includes("vsn:svg-registry-changed")&&editorControls.includes("vsn:svg-registry-changed"));
check("Font server keeps readable multipart/file validation",fonts.includes("upload could not be read")&&fonts.includes("Font uploaded."));
check("SVG server keeps readable multipart/file validation",svgs.includes("upload could not be read")&&svgs.includes("SVG added to the VSN library."));

// 4-5: marketplace favorite/pagination.
check("Marketplace favorite response includes item identity and saved state",marketplace.includes("catalogId,favorite")&&marketplace.includes("toggleMarketplaceFavorite"));
check("Marketplace tracks only the pending item action",host.includes("pendingAction")&&host.includes("itemBusy")&&host.includes('pendingAction?.id'));
check("Marketplace card buttons no longer share global loading state",!host.includes('loading={busy} disabled={!item.compatible')&&host.includes('loading={itemBusy("install",item.catalogId)}')&&host.includes('loading={itemBusy("rollback",item.catalogId)}'));
check("Marketplace favorite button cannot double-submit while saving",host.includes('disabled={busy} className={`vsn-marketplace-favorite'));
check("Marketplace has real fixed-size pagination",host.includes("const pageSize=24")&&host.includes("const totalPages")&&host.includes("currentPage*pageSize")&&host.includes(">Previous</")&&host.includes(">Next</"));
check("Marketplace filters reset pagination",host.includes("useEffect(()=>setPage(1),[q,kind,category,industry,style,layout,tier,color,view])"));

// 6: Saved Library preview isolation.
check("Library previews have a render error boundary",libraryPreview.includes("LibraryPreviewBoundary")&&libraryPreview.includes("getDerivedStateFromError")&&libraryPreview.includes("Preview unavailable"));
check("Library preview boundary resets when item title changes",libraryPreview.includes("<LibraryPreviewBoundary key={title}>") );
check("Library thumbnail renderer is static",libraryPreview.includes("staticPreview")&&preview.includes("staticPreview = false"));
check("Static previews do not execute Custom JS or interaction runtime",preview.includes("if (staticPreview) return undefined")&&preview.includes("staticPreview ? null : <CustomJsRuntime"));
check("Static previews suppress SDK mount lifecycle hooks",preview.includes("StaticPreviewContext")&&preview.includes("staticPreview={staticPreview}")&&sdkView.includes("if(staticPreview)return undefined"));
check("Saved Library pagination remains 12 per page",host.includes("const pageSize=12")&&host.includes("pageItems=items.slice"));

// 7: Pages edit in same app window.
check("Page title edit is a button, not target=_top navigation",dashboard.includes("vsn-page-title-button")&&!dashboard.includes('target="_top" onClick={(e)=>editClick'));
check("Page row Edit uses same editPage callback",dashboard.includes('onClick={() => onEditPage?.(page)}')&&dashboard.includes("vsn-page-edit-btn"));
check("Pages route owns a single s-app-window editor",pages.includes('id="vsn-builder-app-window"')&&pages.includes("frame.show?.()")&&pages.includes("setEditorWindowSrc(getEditPageUrl(page, options))"));
check("App-window editor buttons retain VSN styling",css.includes("v2.5.51 Phase 14 stabilization")&&css.includes(".vsn-page-title-button")&&css.includes(".vsn-page-grid-title-button"));

console.log(`\nPhase 14 stabilization audit: ${pass} PASS / ${fail} FAIL`);
if(fail)process.exit(1);
