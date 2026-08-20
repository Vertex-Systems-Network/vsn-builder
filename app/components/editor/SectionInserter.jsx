import { VsnButton, VsnSearchField, VsnSpinner } from "./EditorUi";
import { useEffect, useMemo, useRef, useState } from "react";
import PolarisIcon from "../ui/PolarisIcon";
import { ModalPortal } from "./OverlayManager";
import LibraryDesignPreview from "./LibraryDesignPreview";

function displayLabel(value) {
  return String(value || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bCta\b/g, "CTA").replace(/\bCro\b/g, "CRO");
}

function SidebarTab({ active, icon, children, onClick, count }) {
  return <button type="button" onClick={onClick} className={`vsn-library-filter-tab ${active ? "is-active" : ""}`}><PolarisIcon type={icon} size={15}/><span>{children}</span>{Number.isFinite(count) ? <b>{count}</b> : null}</button>;
}

function LibraryCard({ item, onInsert, onToggleFavorite }) {
  const isPage = item.kind === "page";
  return <article className="vsn-library-template-card">
    <div className="vsn-library-card-preview-wrap"><LibraryDesignPreview content={item.content} title={`${item.title} preview`} /></div>
    <div className="vsn-library-card-body">
      <div className="min-w-0"><strong title={item.title}>{item.title}</strong><span>My Library · {item.templateType ? displayLabel(item.templateType) : displayLabel(item.kind)}</span></div>
      <button type="button" className={`vsn-library-favorite ${item.isFavorite ? "is-active" : ""}`} onClick={(event)=>{event.stopPropagation();onToggleFavorite?.(item);}} aria-label={item.isFavorite ? "Remove from favorites" : "Add to favorites"}><PolarisIcon type="star" size={16}/></button>
    </div>
    <button type="button" className="vsn-library-insert-button" onClick={()=>onInsert?.(item)}>{isPage ? "Use template" : "Insert"}</button>
  </article>;
}

function MarketplaceCard({ item, plan, onUse, onInstall, onToggleFavorite, busy = false }) {
  const proLocked = item.planTier === "pro" && plan?.marketplacePro !== true;
  const needsUpdate = item.installed && Number(item.installedVersion || 0) < Number(item.version || 1);
  const ready = item.installed && !needsUpdate;
  const actionLabel = proLocked ? "Requires Pro" : ready ? (item.kind === "page" ? "Use template" : "Insert") : needsUpdate ? "Update" : "Install";
  return <article className="vsn-library-template-card vsn-marketplace-template-card">
    <div className="vsn-library-card-preview-wrap"><LibraryDesignPreview content={item.content} title={`${item.title} Marketplace preview`} /></div>
    <div className="vsn-library-card-body">
      <div className="min-w-0"><strong title={item.title}>{item.title}</strong><span>Marketplace · {item.templateType ? displayLabel(item.templateType) : displayLabel(item.kind)} · {item.planTier === "pro" ? "Pro" : "Free"}</span></div>
      <button type="button" className={`vsn-library-favorite ${item.isFavorite ? "is-active" : ""}`} onClick={(event)=>{event.stopPropagation();onToggleFavorite?.(item);}} aria-label={item.isFavorite ? "Remove Marketplace favorite" : "Add Marketplace favorite"}><PolarisIcon type="star" size={16}/></button>
    </div>
    <div className="vsn-library-marketplace-meta"><span>{displayLabel(item.category)}</span>{item.installed?<span className="is-installed">Installed</span>:null}{needsUpdate?<span>Update available</span>:null}</div>
    <button type="button" disabled={busy || proLocked} className="vsn-library-insert-button" onClick={()=>ready ? onUse?.(item) : onInstall?.(item)}>{busy ? "Working…" : actionLabel}</button>
  </article>;
}

export default function SectionInserter({
  reusableSections = [],
  libraryItems = [],
  marketplaceItems = [],
  marketplacePlan = null,
  marketplaceLoading = false,
  onInsertReusableSection,
  onInsertLibraryItem,
  onLibraryOpen,
  onToggleLibraryFavorite,
  onToggleMarketplaceFavorite,
  onInstallMarketplace,
  onOpenWidgets,
  openLibrarySignal = 0,
  pageTemplate = "page",
  libraryLoading = false,
  onOpenAI,
}) {
  const listTopRef=useRef(null);
  const scrollListTop=()=>requestAnimationFrame(()=>listTopRef.current?.scrollIntoView?.({behavior:"smooth",block:"start"}));
  const [panel, setPanel] = useState(null);
  const [sourceTab, setSourceTab] = useState("library");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [templateType, setTemplateType] = useState(pageTemplate || "page");
  const [page, setPage] = useState(1);
  const [marketView, setMarketView] = useState("all");
  const [marketKind, setMarketKind] = useState("all");
  const [marketCategory, setMarketCategory] = useState("all");
  const [marketPage, setMarketPage] = useState(1);
  const [installingCatalogId, setInstallingCatalogId] = useState("");
  const pageSize = 12;
  const lastSignal = useRef(0);
  const normalizedSearch = search.trim().toLowerCase();

  useEffect(() => { setTemplateType(pageTemplate || "page"); }, [pageTemplate]);
  useEffect(() => { if (!marketplaceLoading) setInstallingCatalogId(""); }, [marketplaceLoading]);
  useEffect(() => {
    if (!openLibrarySignal || lastSignal.current === openLibrarySignal) return;
    lastSignal.current = openLibrarySignal;
    setTemplateType(pageTemplate || "page");
    setFilter("all");
    setCategory("all");
    setSourceTab("library");
    setPanel("library");
  }, [openLibrarySignal, pageTemplate]);

  const usable = useMemo(() => (Array.isArray(libraryItems) ? libraryItems : []).filter((item)=>item.kind !== "style" && item.source !== "builtin" && item.source !== "remote"), [libraryItems]);
  const categories = useMemo(() => Array.from(new Set(usable.map((item)=>item.category).filter(Boolean))).sort(), [usable]);
  const pageTypes = useMemo(() => Array.from(new Set([...(usable||[]),...(marketplaceItems||[])].filter((item)=>item.kind==="page").map((item)=>item.templateType).filter(Boolean))).sort(), [usable, marketplaceItems]);
  const visibleLibrary = useMemo(() => usable.filter((item) => {
    if (templateType !== "all" && item.kind === "page" && item.templateType && item.templateType !== templateType) return false;
    if (filter === "favorites" && !item.isFavorite) return false;
    if (filter === "pages" && item.kind !== "page") return false;
    if (filter === "sections" && !["section","container"].includes(item.kind)) return false;
    if (filter === "components" && item.kind !== "component") return false;
    if (category !== "all" && item.category !== category) return false;
    if (normalizedSearch && !`${item.title} ${item.category} ${item.templateType || ""}`.toLowerCase().includes(normalizedSearch)) return false;
    return true;
  }), [usable, templateType, filter, category, normalizedSearch]);

  const marketCategories = useMemo(()=>Array.from(new Set((marketplaceItems||[]).map((item)=>item.category).filter(Boolean))).sort(),[marketplaceItems]);
  const visibleMarketplace = useMemo(() => (marketplaceItems || []).filter((item) => {
    if (marketView === "favorites" && !item.isFavorite) return false;
    if (marketView === "installed" && !item.installed) return false;
    if (marketKind !== "all" && item.kind !== marketKind) return false;
    if (marketCategory !== "all" && item.category !== marketCategory) return false;
    if (item.kind === "page" && templateType !== "all" && item.templateType && item.templateType !== templateType) return false;
    if (normalizedSearch && !`${item.title} ${item.category} ${item.description || ""} ${item.templateType || ""}`.toLowerCase().includes(normalizedSearch)) return false;
    return true;
  }), [marketplaceItems, marketView, marketKind, marketCategory, templateType, normalizedSearch]);

  useEffect(() => { setPage(1); setMarketPage(1); }, [panel, sourceTab, search, filter, category, templateType, marketView, marketKind, marketCategory]);
  const totalPages = Math.max(1, Math.ceil(visibleLibrary.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedLibrary = visibleLibrary.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const marketTotalPages = Math.max(1, Math.ceil(visibleMarketplace.length / pageSize));
  const marketCurrentPage = Math.min(marketPage, marketTotalPages);
  const pagedMarketplace = visibleMarketplace.slice((marketCurrentPage - 1) * pageSize, marketCurrentPage * pageSize);

  const counts = useMemo(() => ({
    all: usable.length,
    pages: usable.filter((item)=>item.kind==="page").length,
    favorites: usable.filter((item)=>item.isFavorite).length,
    sections: usable.filter((item)=>["section","container"].includes(item.kind)).length,
    components: usable.filter((item)=>item.kind==="component").length,
  }), [usable]);
  const marketCounts = useMemo(()=>({all:(marketplaceItems||[]).length,installed:(marketplaceItems||[]).filter((item)=>item.installed).length,favorites:(marketplaceItems||[]).filter((item)=>item.isFavorite).length}),[marketplaceItems]);

  const openLibrary = () => {
    setPanel("library");
    setSourceTab("library");
    setTemplateType(pageTemplate || "page");
    onLibraryOpen?.();
  };
  const useMarketplaceItem = (item) => {
    onInsertLibraryItem?.({ id:item.catalogId, title:item.title, kind:item.kind, templateType:item.templateType || (item.kind === "page" ? "page" : null), category:item.category, syncMode:"local", content:item.content, source:"marketplace" });
    setPanel(null);
  };

  return <div className="relative mt-5">
    <div className="vsn-add-section-dock">
      <div><strong>Add a new section</strong><span>Add widgets directly, open your Library, or generate with AI.</span></div>
      <div className="vsn-add-section-actions">
        <VsnButton type="button" variant="icon" accessibilityLabel="Open widgets" title="Open widgets" onClick={()=>onOpenWidgets?.()} className="vsn-add-section-action is-primary"><PolarisIcon type="plus" size={19}/></VsnButton>
        <VsnButton type="button" variant="icon" accessibilityLabel="Open template browser" title="Open template browser" onClick={openLibrary} className="vsn-add-section-action"><PolarisIcon type="folder" size={19}/></VsnButton>
        <VsnButton type="button" variant="icon" accessibilityLabel="Open AI Builder" title="Open AI Builder" onClick={()=>onOpenAI?.()} className="vsn-add-section-action"><PolarisIcon type="sparkles" size={19}/></VsnButton>
      </div>
    </div>

    {panel === "library" ? <ModalPortal><div className="vsn-editor-modal-backdrop vsn-library-modal-backdrop" onMouseDown={(event)=>{if(event.currentTarget===event.target)setPanel(null)}}>
      <div className="vsn-library-modal" onMouseDown={(event)=>event.stopPropagation()}>
        <header className="vsn-library-modal-header">
          <div><strong>Template Browser</strong><span>My Library and Marketplace are separate sources. Nothing is silently merged.</span></div>
          <VsnButton type="button" variant="icon" accessibilityLabel="Close template browser" title="Close template browser" onClick={()=>setPanel(null)}><PolarisIcon type="x"/></VsnButton>
        </header>
        <div className="vsn-library-source-tabs" role="tablist" aria-label="Template source">
          <button type="button" role="tab" aria-selected={sourceTab==="library"} className={sourceTab==="library"?"is-active":""} onClick={()=>setSourceTab("library")}><PolarisIcon type="save" size={15}/>My Library <b>{usable.length}</b></button>
          <button type="button" role="tab" aria-selected={sourceTab==="marketplace"} className={sourceTab==="marketplace"?"is-active":""} onClick={()=>setSourceTab("marketplace")}><PolarisIcon type="template" size={15}/>Marketplace <b>{marketCounts.all}</b></button>
        </div>
        <div className="vsn-library-modal-body">
          <aside className="vsn-library-sidebar">
            {sourceTab==="library"?<>
              <div className="vsn-library-sidebar-title">My Library</div>
              <SidebarTab active={filter==="all"} icon="grid" onClick={()=>setFilter("all")} count={counts.all}>All saved</SidebarTab>
              <SidebarTab active={filter==="pages"} icon="template" onClick={()=>setFilter("pages")} count={counts.pages}>Pages</SidebarTab>
              <SidebarTab active={filter==="favorites"} icon="star" onClick={()=>setFilter("favorites")} count={counts.favorites}>Favorites</SidebarTab>
              <SidebarTab active={filter==="sections"} icon="layers" onClick={()=>setFilter("sections")} count={counts.sections}>Sections</SidebarTab>
              <SidebarTab active={filter==="components"} icon="grid" onClick={()=>setFilter("components")} count={counts.components}>Components</SidebarTab>
              {categories.length?<><div className="vsn-library-sidebar-title mt-4">Categories</div><button type="button" className={`vsn-library-filter-tab ${category==="all"?"is-active":""}`} onClick={()=>setCategory("all")}><span>All categories</span></button>{categories.map((value)=><button type="button" key={value} className={`vsn-library-filter-tab ${category===value?"is-active":""}`} onClick={()=>setCategory(value)}><span>{displayLabel(value)}</span></button>)}</>:null}
            </>:<>
              <div className="vsn-library-sidebar-title">Marketplace</div>
              <SidebarTab active={marketView==="all"} icon="grid" onClick={()=>setMarketView("all")} count={marketCounts.all}>All supplied</SidebarTab>
              <SidebarTab active={marketView==="installed"} icon="check" onClick={()=>setMarketView("installed")} count={marketCounts.installed}>Installed</SidebarTab>
              <SidebarTab active={marketView==="favorites"} icon="star" onClick={()=>setMarketView("favorites")} count={marketCounts.favorites}>Favorites</SidebarTab>
              <div className="vsn-library-sidebar-title mt-4">Type</div>
              {[["all","All types"],["page","Pages"],["section","Sections"]].map(([value,label])=><button type="button" key={value} className={`vsn-library-filter-tab ${marketKind===value?"is-active":""}`} onClick={()=>setMarketKind(value)}><span>{label}</span></button>)}
              {marketCategories.length?<><div className="vsn-library-sidebar-title mt-4">Categories</div><button type="button" className={`vsn-library-filter-tab ${marketCategory==="all"?"is-active":""}`} onClick={()=>setMarketCategory("all")}><span>All categories</span></button>{marketCategories.slice(0,24).map((value)=><button type="button" key={value} className={`vsn-library-filter-tab ${marketCategory===value?"is-active":""}`} onClick={()=>setMarketCategory(value)}><span>{displayLabel(value)}</span></button>)}</>:null}
            </>}
            <div className="vsn-library-sidebar-title mt-4">Page type</div>
            <button type="button" className={`vsn-library-filter-tab ${templateType==="all"?"is-active":""}`} onClick={()=>setTemplateType("all")}><span>All page types</span></button>
            {pageTypes.map((value)=><button type="button" key={value} className={`vsn-library-filter-tab ${templateType===value?"is-active":""}`} onClick={()=>setTemplateType(value)}><span>{displayLabel(value)}</span></button>)}
          </aside>
          <main className="vsn-library-content">
            <div ref={listTopRef} className="vsn-library-toolbar"><VsnSearchField label="Search templates" labelAccessibilityVisibility="exclusive" value={search} onInput={(event)=>setSearch(event.currentTarget.value)} placeholder={sourceTab==="library"?"Search My Library…":"Search Marketplace…"}/><span>{sourceTab==="library"?visibleLibrary.length:visibleMarketplace.length} result{(sourceTab==="library"?visibleLibrary.length:visibleMarketplace.length)===1?"":"s"} · Page {sourceTab==="library"?currentPage:marketCurrentPage} of {sourceTab==="library"?totalPages:marketTotalPages}</span></div>
            <div className="vsn-library-scroll">
              {sourceTab==="library"?<>
                {libraryLoading?<div className="vsn-library-loading"><VsnSpinner accessibilityLabel="Loading My Library"/><span>Loading My Library…</span></div>:null}
                {!libraryLoading&&visibleLibrary.length?<div className="vsn-library-grid">{pagedLibrary.map((item)=><LibraryCard key={item.id} item={item} onToggleFavorite={onToggleLibraryFavorite} onInsert={(entry)=>{onInsertLibraryItem?.(entry);setPanel(null)}}/>)}</div>:null}
                {!libraryLoading&&!visibleLibrary.length?<div className="vsn-library-empty"><PolarisIcon type="save" size={24}/><strong>No saved resources match this view.</strong><span>Save a page, section or component from the editor. VSN starter templates are in Marketplace.</span></div>:null}
                {!libraryLoading&&visibleLibrary.length>pageSize?<div className="vsn-library-pagination"><button type="button" disabled={currentPage<=1} onClick={()=>{setPage((value)=>Math.max(1,value-1));scrollListTop();}}>Previous</button><span>Page {currentPage} of {totalPages}</span><button type="button" disabled={currentPage>=totalPages} onClick={()=>{setPage((value)=>Math.min(totalPages,value+1));scrollListTop();}}>Next</button></div>:null}
                {filter==="sections"&&reusableSections.length?<section className="mt-6"><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6d7175]">Global sections</h3><div className="vsn-library-grid">{reusableSections.map((section)=><article key={section.id} className="vsn-library-template-card"><div className="vsn-library-card-preview-wrap"><LibraryDesignPreview content={section.content||[]} title={`${section.title||"Saved section"} preview`}/></div><div className="vsn-library-card-body"><div><strong>{section.title||"Saved section"}</strong><span>Global section</span></div></div><button type="button" className="vsn-library-insert-button" onClick={()=>{onInsertReusableSection?.(section.id);setPanel(null)}}>Insert</button></article>)}</div></section>:null}
              </>:<>
                {marketplaceLoading&&!marketplaceItems.length?<div className="vsn-library-loading"><VsnSpinner accessibilityLabel="Loading Marketplace"/><span>Loading Marketplace…</span></div>:null}
                {visibleMarketplace.length?<div className="vsn-library-grid">{pagedMarketplace.map((item)=><MarketplaceCard key={item.catalogId} item={item} plan={marketplacePlan} busy={marketplaceLoading&&installingCatalogId===item.catalogId} onToggleFavorite={onToggleMarketplaceFavorite} onInstall={(entry)=>{setInstallingCatalogId(entry.catalogId);onInstallMarketplace?.(entry)}} onUse={useMarketplaceItem}/>)}</div>:null}
                {!marketplaceLoading&&!visibleMarketplace.length?<div className="vsn-library-empty"><PolarisIcon type="template" size={24}/><strong>No Marketplace templates match this view.</strong><span>Change the search, type, category or page-type filter.</span></div>:null}
                {visibleMarketplace.length>pageSize?<div className="vsn-library-pagination"><button type="button" disabled={marketCurrentPage<=1} onClick={()=>{setMarketPage((value)=>Math.max(1,value-1));scrollListTop();}}>Previous</button><span>Page {marketCurrentPage} of {marketTotalPages}</span><button type="button" disabled={marketCurrentPage>=marketTotalPages} onClick={()=>{setMarketPage((value)=>Math.min(marketTotalPages,value+1));scrollListTop();}}>Next</button></div>:null}
              </>}
            </div>
          </main>
        </div>
      </div>
    </div></ModalPortal>:null}
  </div>;
}
