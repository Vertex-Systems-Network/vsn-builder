import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLocation } from "react-router";
import {
  BarChart3, CalendarDays, Check, CheckSquare2, Clock3, Copy, Download, Edit3, ExternalLink,
  Eye, FilePenLine, FileText, Image as ImageIcon, MoreVertical, Plus, RefreshCw, RotateCcw,
  Search, Send, Trash2, Upload, UserRound, X,
} from "lucide-react";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import { VsnNotice } from "./ui/VsnToolkit";
import {
  normalizeDataViewConfig, VsnDataViewActionMenu, VsnDataViewBulkMenu, VsnDataViewPagination,
  VsnDataViewSettings, VsnDataViewSortControls, VsnDataViewToggle,
} from "./ui/VsnDataViewKit";

const FILTERS = ["All", "Published", "Draft", "Trash", "Scheduled"];
const DEFAULT_COLUMNS = ["select", "image", "name", "status", "template", "views", "updated", "created", "pages", "seo", "author"];
const DEFAULT_WIDGETS = ["total", "published", "draft", "scheduled", "views"];
const SETTINGS_KEY = "vsn:templates-screen-settings:v1";

const COLUMN_DEFS = [
  { key: "select", label: "Checkbox", sortable: false },
  { key: "image", label: "Image", sortable: false },
  { key: "name", label: "Title", sortable: false },
  { key: "status", label: "Status", sort: "status" },
  { key: "template", label: "Template", sort: "template" },
  { key: "views", label: "View", sort: "views" },
  { key: "updated", label: "Updated", sort: "updated" },
  { key: "created", label: "Created Date", sort: "created" },
  { key: "pages", label: "Pages", sort: "pages" },
  { key: "seo", label: "SEO Score", sort: "seo" },
  { key: "author", label: "Author", sort: "author" },
];

const ACTION_ICON = {
  "Visit Page": ExternalLink,
  Duplicate: Copy,
  Rename: Edit3,
  Export: Download,
  "Set as Default": Check,
  Trash: Trash2,
  Restore: RotateCcw,
  "Delete Forever": Trash2,
};

const BULK_ACTIONS = Object.freeze({
  trash: { key: "delete", label: "Trash", icon: Trash2, danger: true },
  draft: { key: "draft", label: "Draft", icon: FilePenLine },
  scheduled: { key: "scheduled", label: "Scheduled", icon: CalendarDays },
  publish: { key: "publish", label: "Publish", icon: Send },
  cancelSchedule: { key: "cancel-schedule", label: "Cancel schedule", icon: X },
  restore: { key: "restore", label: "Restore", icon: RotateCcw },
  hardDelete: { key: "hard-delete", label: "Delete Forever", icon: Trash2, danger: true },
});

function bulkActionsForFilter(filter) {
  if (filter === "Trash") return [BULK_ACTIONS.restore, BULK_ACTIONS.hardDelete];
  if (filter === "Published") return [BULK_ACTIONS.draft, BULK_ACTIONS.trash];
  if (filter === "Draft") return [BULK_ACTIONS.scheduled, BULK_ACTIONS.publish, BULK_ACTIONS.trash];
  if (filter === "Scheduled") return [BULK_ACTIONS.cancelSchedule, BULK_ACTIONS.trash, BULK_ACTIONS.draft, BULK_ACTIONS.publish];
  return [BULK_ACTIONS.draft, BULK_ACTIONS.scheduled, BULK_ACTIONS.publish, BULK_ACTIONS.trash];
}

function formatDate(iso, withTime = false) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, withTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatViews(number) {
  const value = Number(number || 0);
  if (!value) return "0";
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : String(value);
}

function templateLabel(value) {
  const raw = String(value || "page").trim();
  const known = {
    index: "Home page", page: "Page", collection: "Collection", product: "Product", search: "Search", blog: "Blog", article: "Article",
    header: "Header", footer: "Footer", section: "Section", cart: "Cart", "404": "404 page", password: "Password page",
    "customer-account": "Customer account", "customer-login": "Customer login", "customer-register": "Customer registration",
    "customer-order": "Customer order", "customer-addresses": "Customer addresses",
  };
  return known[raw] || raw.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizedRow(page = {}) {
  return {
    ...page,
    title: page.title || "Untitled template",
    handle: page.handle || "",
    status: page.deletedAt ? "trashed" : (page.status || "draft"),
    template: page.template || "page",
    views: Number(page.views || 0),
    seoScore: Number(page.seoScore ?? 100),
    pageCount: Math.max(0, Number(page.pageCount ?? 1)),
    createdBy: page.createdBy || "Store owner",
    templateImage: page.templateImage || "",
  };
}

function statusCount(stats, filter) {
  if (filter === "All") return Number(stats.total || 0);
  if (filter === "Trash") return Number(stats.trash || 0);
  return Number(stats[filter.toLowerCase()] || 0);
}

function TemplateThumb({ page, large = false }) {
  if (page.templateImage) {
    return <img className={large ? "vsn-template-thumb is-large" : "vsn-template-thumb"} src={page.templateImage} alt={`${page.title} template`} loading="lazy" />;
  }
  return <div className={large ? "vsn-template-thumb-fallback is-large" : "vsn-template-thumb-fallback"}><ImageIcon size={large ? 28 : 18} /></div>;
}

function Modal({ title, children, onClose, footer }) {
  return <div className="vsn-template-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose?.(); }}>
    <section className="vsn-template-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="vsn-template-modal-head"><strong>{title}</strong><button type="button" onClick={onClose} aria-label="Close"><X size={17} /></button></div>
      <div className="vsn-template-modal-body">{children}</div>
      {footer ? <div className="vsn-template-modal-foot">{footer}</div> : null}
    </section>
  </div>;
}

function ActionMenu({ page, busy, trashMode, canEdit, canDuplicate, canDelete, canRestore, canSetDefault, onAction, open, onToggle }) {
  const labels = trashMode
    ? ["Restore", "Delete Forever"]
    : ["Visit Page", "Duplicate", "Rename", "Export", ...(["collection", "product", "blog", "article"].includes(page.template) && !page.isDefault ? ["Set as Default"] : []), "Trash"];
  const actions = labels.map((label) => ({
    key: label,
    label,
    icon: ACTION_ICON[label] || MoreVertical,
    danger: ["Trash", "Delete Forever"].includes(label),
    disabled: (label === "Duplicate" && !canDuplicate)
      || (label === "Rename" && !canEdit)
      || (label === "Set as Default" && !canSetDefault)
      || (["Trash", "Delete Forever"].includes(label) && !canDelete)
      || (label === "Restore" && !canRestore),
    onClick: () => onAction(label, page),
  }));
  return <VsnDataViewActionMenu open={open} onOpenChange={onToggle} actions={actions} busy={busy} label={`Actions for ${page.title}`} />;
}
export default function Dashboard({
  pages = [], initialData = null, busy = false, error = "", notice = "", onEditPage, onNewPage, onImportTemplate,
  canCreate = true, canImport = true, canEdit = true, canDuplicate = true, canDelete = true, canRestore = true, canSetDefault = true,
  onPreviewPage, onVisitPage, onDuplicatePage, onRenamePage, onExportPage, onDeletePage, onRestorePage, onHardDeletePage, onSetDefault,
  onBulkAction, refreshSignal = null, dataViewOptions = null, savedViewSettings = null, onSaveViewSettings = null,
}) {
  const location = useLocation();
  const tableFetcher = useFetcher();
  const contentRef = useRef(null);
  const masterRef = useRef(null);
  const hydratedRef = useRef(false);
  const handledRefreshRef = useRef(null);
  const dataViewConfig = useMemo(() => normalizeDataViewConfig(dataViewOptions || {}), [dataViewOptions]);

  const fallbackData = useMemo(() => ({
    records: pages.map(normalizedRow), total: pages.length, page: 1, pageSize: 12, totalPages: Math.max(1, Math.ceil(pages.length / 12)),
    query: { search: "", filter: "all", template: "all", seoScore: null, author: "all", datePreset: "all", dateFrom: "", dateTo: "", sort: "updated", direction: "desc", page: 1, pageSize: 12 },
    stats: { total: pages.length, published: pages.filter((row) => row.status === "published").length, draft: pages.filter((row) => row.status === "draft").length, scheduled: pages.filter((row) => row.status === "scheduled").length, trash: 0, views: pages.reduce((sum, row) => sum + Number(row.views || 0), 0) },
    facets: { templates: [...new Set(pages.map((row) => row.template || "page"))], seoScores: [...new Set(pages.map((row) => Number(row.seoScore ?? 100)))], authors: [...new Set(pages.map((row) => row.createdBy || "Store owner"))] },
  }), [pages]);

  const [tableData, setTableData] = useState(initialData || fallbackData);
  const initialQuery = initialData?.query || fallbackData.query;
  const [search, setSearch] = useState(initialQuery.search || "");
  const [activeFilter, setActiveFilter] = useState((initialQuery.filter || "all").replace(/^./, (c) => c.toUpperCase()).replace("All", "All"));
  const [viewMode, setViewMode] = useState(() => ["list","grid"].includes(savedViewSettings?.viewMode) ? savedViewSettings.viewMode : "list");
  const [sortField, setSortField] = useState(initialQuery.sort || "updated");
  const [sortDirection, setSortDirection] = useState(initialQuery.direction || "desc");
  const [templateFilter, setTemplateFilter] = useState(initialQuery.template || "all");
  const [dateFilter, setDateFilter] = useState(initialQuery.datePreset || "all");
  const [dateFrom, setDateFrom] = useState(initialQuery.dateFrom || "");
  const [dateTo, setDateTo] = useState(initialQuery.dateTo || "");
  const [seoFilter, setSeoFilter] = useState(initialQuery.seoScore == null ? "all" : String(initialQuery.seoScore));
  const [authorFilter, setAuthorFilter] = useState(initialQuery.author || "all");
  const [currentPage, setCurrentPage] = useState(initialQuery.page || 1);
  const [pageSize, setPageSize] = useState(() => Number(savedViewSettings?.pageSize || initialQuery.pageSize || 12));
  const [openMenu, setOpenMenu] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => new Set(Array.isArray(savedViewSettings?.columns) ? savedViewSettings.columns : DEFAULT_COLUMNS));
  const [visibleWidgets, setVisibleWidgets] = useState(() => new Set(Array.isArray(savedViewSettings?.widgets) ? savedViewSettings.widgets : DEFAULT_WIDGETS));
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const [pendingDateFrom, setPendingDateFrom] = useState(dateFrom);
  const [pendingDateTo, setPendingDateTo] = useState(dateTo);
  const [confirmBulk, setConfirmBulk] = useState(null);
  const [openBulkMenu, setOpenBulkMenu] = useState(null);

  useEffect(() => {
    if (viewMode === "list" && !dataViewConfig.list && dataViewConfig.grid) setViewMode("grid");
    if (viewMode === "grid" && !dataViewConfig.grid && dataViewConfig.list) setViewMode("list");
  }, [viewMode, dataViewConfig.list, dataViewConfig.grid]);

  useEffect(() => {
    const next = initialData || fallbackData;
    setTableData(next);
    setCurrentPage(next.page || 1);
  }, [initialData, fallbackData]);

  useEffect(() => {
    if (savedViewSettings) { hydratedRef.current = true; return; }
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed?.columns)) setVisibleColumns(new Set(parsed.columns.filter((key) => DEFAULT_COLUMNS.includes(key))));
      if (Array.isArray(parsed?.widgets)) setVisibleWidgets(new Set(parsed.widgets.filter((key) => DEFAULT_WIDGETS.includes(key))));
      if (Number.isFinite(Number(parsed?.pageSize)) && Number(parsed.pageSize) >= 1 && Number(parsed.pageSize) <= 100) setPageSize(Math.floor(Number(parsed.pageSize)));
      if (["list", "grid"].includes(parsed?.viewMode)) setViewMode(parsed.viewMode);
    } catch {}
    hydratedRef.current = true;
  }, [savedViewSettings]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const settings = { columns: [...visibleColumns], widgets: [...visibleWidgets], pageSize, viewMode };
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
    const timer = window.setTimeout(() => onSaveViewSettings?.(settings), 350);
    return () => window.clearTimeout(timer);
  }, [visibleColumns, visibleWidgets, pageSize, viewMode, onSaveViewSettings]);

  const loadTable = useCallback((override = {}) => {
    const params = new URLSearchParams(location.search || "");
    params.delete("open"); params.delete("panel");
    params.set("mode", "table");
    params.set("q", override.search ?? search);
    params.set("status", override.filter ?? activeFilter.toLowerCase());
    params.set("template", override.template ?? templateFilter);
    params.set("seoScore", override.seoScore ?? seoFilter);
    params.set("author", override.author ?? authorFilter);
    params.set("date", override.datePreset ?? dateFilter);
    params.set("dateFrom", override.dateFrom ?? dateFrom);
    params.set("dateTo", override.dateTo ?? dateTo);
    params.set("sort", override.sort ?? sortField);
    params.set("direction", override.direction ?? sortDirection);
    params.set("page", String(override.page ?? currentPage));
    params.set("pageSize", String(override.pageSize ?? pageSize));
    tableFetcher.load(`${location.pathname}?${params.toString()}`);
  }, [location.pathname, location.search, search, activeFilter, templateFilter, seoFilter, authorFilter, dateFilter, dateFrom, dateTo, sortField, sortDirection, currentPage, pageSize]);

  useEffect(() => {
    if (!refreshSignal?.success || handledRefreshRef.current === refreshSignal) return;
    handledRefreshRef.current = refreshSignal;
    loadTable();
  }, [refreshSignal, loadTable]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadTable(), search ? 260 : 40);
    return () => window.clearTimeout(timer);
  }, [loadTable]);

  useEffect(() => {
    if (!tableFetcher.data?.records) return;
    setTableData(tableFetcher.data);
    setCurrentPage(Number(tableFetcher.data.page || 1));
    setSelectedIds(new Set());
    setOpenMenu(null);
    setOpenBulkMenu(null);
  }, [tableFetcher.data]);

  const records = useMemo(() => (tableData?.records || []).map(normalizedRow), [tableData]);
  const stats = tableData?.stats || fallbackData.stats;
  const facets = tableData?.facets || fallbackData.facets;
  const serverQuery = tableData?.query || {};
  const querySearch = String(serverQuery.search || "");
  const localSearchPending = search.trim().toLowerCase() !== querySearch.trim().toLowerCase();
  const nonSearchQueryPending = String(serverQuery.filter || "all") !== activeFilter.toLowerCase()
    || String(serverQuery.template || "all") !== templateFilter
    || String(serverQuery.seoScore == null ? "all" : serverQuery.seoScore) !== String(seoFilter)
    || String(serverQuery.author || "all") !== authorFilter
    || String(serverQuery.datePreset || "all") !== dateFilter
    || String(serverQuery.dateFrom || "") !== dateFrom
    || String(serverQuery.dateTo || "") !== dateTo
    || String(serverQuery.sort || "updated") !== sortField
    || String(serverQuery.direction || "desc") !== sortDirection
    || Number(serverQuery.page || 1) !== Number(currentPage)
    || Number(serverQuery.pageSize || 12) !== Number(pageSize);
  const immediateRows = useMemo(() => {
    if (!localSearchPending || !search.trim() || nonSearchQueryPending) return records;
    const q = search.trim().toLowerCase();
    return records.filter((row) => `${row.title} ${row.handle} ${row.createdBy}`.toLowerCase().includes(q));
  }, [records, search, localSearchPending, nonSearchQueryPending]);
  const displayRows = nonSearchQueryPending ? [] : (localSearchPending ? immediateRows : records);
  const dbLoading = tableFetcher.state !== "idle";
  const trashMode = activeFilter === "Trash";

  const currentIds = useMemo(() => displayRows.map((row) => row.id), [displayRows]);
  const selectedCurrent = currentIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = currentIds.length > 0 && selectedCurrent === currentIds.length;
  useEffect(() => { if (masterRef.current) masterRef.current.indeterminate = selectedCurrent > 0 && !allSelected; }, [selectedCurrent, allSelected]);

  const toggleSelect = (id) => setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleCurrentPage = () => setSelectedIds((prev) => { const next = new Set(prev); if (allSelected) currentIds.forEach((id) => next.delete(id)); else currentIds.forEach((id) => next.add(id)); return next; });

  const updateFilter = (setter, value) => { setter(value); setCurrentPage(1); setSelectedIds(new Set()); };
  const changePage = (page) => {
    setCurrentPage(page);
    setSelectedIds(new Set());
    window.requestAnimationFrame(() => contentRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  };

  const actionFor = (action, page) => {
    setOpenMenu(null);
    if (action === "Visit Page") onVisitPage?.(page);
    if (action === "Duplicate") onDuplicatePage?.(page);
    if (action === "Rename") { setRenameTarget(page); setRenameValue(page.title); }
    if (action === "Export") onExportPage?.(page);
    if (action === "Set as Default") onSetDefault?.(page);
    if (action === "Trash") onDeletePage?.(page);
    if (action === "Restore") onRestorePage?.(page);
    if (action === "Delete Forever") onHardDeletePage?.(page);
  };

  const submitRename = () => {
    const next = renameValue.trim();
    if (!renameTarget || !next || next === renameTarget.title) { setRenameTarget(null); return; }
    onRenamePage?.(renameTarget, next);
    setRenameTarget(null);
  };

  const runBulk = (action, extra = {}) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (action === "scheduled") { setScheduleOpen(true); return; }
    setConfirmBulk({ action, ids, ...extra });
  };

  const confirmBulkAction = () => {
    if (!confirmBulk) return;
    onBulkAction?.(confirmBulk.action, confirmBulk.ids, confirmBulk);
    setConfirmBulk(null);
    setSelectedIds(new Set());
  };

  const submitSchedule = () => {
    if (!scheduleDate || !scheduleTime || !selectedIds.size) return;
    const local = new Date(`${scheduleDate}T${scheduleTime}`);
    if (Number.isNaN(local.getTime()) || local.getTime() <= Date.now()) return;
    onBulkAction?.("scheduled", [...selectedIds], { scheduledAt: local.toISOString() });
    setScheduleOpen(false);
    setSelectedIds(new Set());
  };

  const changeDatePreset = (value) => {
    if (value === "custom") { setPendingDateFrom(dateFrom); setPendingDateTo(dateTo); setCustomDateOpen(true); return; }
    setDateFrom(""); setDateTo(""); updateFilter(setDateFilter, value);
  };

  const applyCustomDate = () => {
    if (pendingDateFrom && pendingDateTo && pendingDateFrom > pendingDateTo) return;
    setDateFrom(pendingDateFrom); setDateTo(pendingDateTo); setDateFilter("custom"); setCurrentPage(1); setCustomDateOpen(false);
  };

  const setColumn = (key, checked) => {
    const definition = COLUMN_DEFS.find((column) => column.key === key);
    setVisibleColumns((prev) => { const next = new Set(prev); if (checked) next.add(key); else next.delete(key); return next; });
    if (!checked && definition?.sort === sortField) { setSortField("updated"); setSortDirection("desc"); setCurrentPage(1); }
  };
  const setWidget = (key, checked) => setVisibleWidgets((prev) => { const next = new Set(prev); if (checked) next.add(key); else next.delete(key); return next; });
  const sortableColumns = COLUMN_DEFS.filter((column) => column.sort && visibleColumns.has(column.key));

  const widgetDefs = [
    { key: "total", label: "Total Templates", value: stats.total, icon: FileText },
    { key: "published", label: "Published", value: stats.published, icon: CheckSquare2, tone: "green" },
    { key: "draft", label: "Drafts", value: stats.draft, icon: FilePenLine },
    { key: "scheduled", label: "Scheduled", value: stats.scheduled, icon: Clock3 },
    { key: "views", label: "Total Views", value: formatViews(stats.views), icon: BarChart3, tone: "green" },
  ];

  const BulkDropdown = ({ bottom = false }) => {
    const menuKey = bottom ? "bottom" : "top";
    const disabled = !selectedIds.size || busy;
    const actions = bulkActionsForFilter(activeFilter).map(({ key, label, icon, danger }) => ({
      key, label, icon, danger,
      disabled: (["delete", "hard-delete"].includes(key) && !canDelete)
        || (key === "restore" && !canRestore)
        || (!["delete", "hard-delete", "restore"].includes(key) && !canSetDefault),
      onClick: () => runBulk(key),
    }));
    return <div className={`vsn-template-bulk ${bottom ? "is-bottom" : ""}`}>
      <VsnDataViewBulkMenu open={openBulkMenu === menuKey} onOpenChange={(nextOpen) => setOpenBulkMenu(nextOpen ? menuKey : null)} disabled={disabled} busy={busy} actions={actions} />
    </div>;
  };

  return <div className="vsn-pages-screen" ref={contentRef}>
    <div className="vsn-pages-inner">
      <div className="vsn-pages-head">
        <div><h1>Templates</h1><p>Build, search and manage Shopify templates from one workspace</p></div>
        <div className="vsn-pages-actions">
          <label className={`vsn-button vsn-button--secondary vsn-button--md ${!canImport ? "is-disabled" : ""}`} style={!canImport ? { opacity: .48, pointerEvents: "none" } : undefined}>
            <Upload size={15} /> Import JSON
            <input hidden type="file" accept="application/json,.json" disabled={!canImport || busy} onChange={(event) => { const file = event.target.files?.[0]; onImportTemplate?.(file); event.target.value = ""; }} />
          </label>
          <Button variant="primary" icon={<Plus size={15} />} onClick={onNewPage} disabled={!canCreate} loading={busy}>Create template</Button>
        </div>
      </div>

      {error ? <div style={{ marginBottom: 20 }}><VsnNotice tone="critical">{error}</VsnNotice></div> : null}
      {!error && notice ? <div style={{ marginBottom: 20 }}><VsnNotice>{notice}</VsnNotice></div> : null}

      <div className="vsn-pages-stats">{widgetDefs.filter((widget) => visibleWidgets.has(widget.key)).map(({ key, label, value, icon: Icon, tone }) => <div className="vsn-pages-stat" key={key}>
        <div className="vsn-pages-stat-top"><span className="vsn-pages-stat-label">{label}</span><div className="vsn-pages-stat-icon"><Icon size={20} /></div></div>
        <div className={`vsn-pages-stat-value ${tone || ""}`}>{value}</div>
      </div>)}</div>

      <section className="vsn-template-controls" aria-label="Templates controls">
        <div className="vsn-template-row is-primary">
          {dataViewConfig.statusFilters ? <div className="vsn-pages-filter-tabs">{FILTERS.map((filter) => <button key={filter} type="button" className={activeFilter === filter ? "active" : ""} onClick={() => updateFilter(setActiveFilter, filter)}>{filter}<span>{statusCount(stats, filter)}</span></button>)}</div> : <div />}
          <div className="vsn-template-primary-right">
            {dataViewConfig.search ? <div className="vsn-pages-search"><Search size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }} placeholder="Search templates…" />{dbLoading ? <RefreshCw className="vsn-template-spin" size={14} /> : null}</div> : null}
            <VsnDataViewToggle value={viewMode} onChange={setViewMode} config={dataViewConfig} />
          </div>
        </div>

        <div className="vsn-template-row is-secondary">
          {dataViewConfig.bulkActions ? <BulkDropdown /> : null}
          {dataViewConfig.dateFilter ? <select className="vsn-pages-select" value={dateFilter} onChange={(event) => changeDatePreset(event.target.value)} aria-label="Date filter"><option value="all">All dates</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="custom">Custom…</option></select> : null}
          {dataViewConfig.seoFilter ? <select className="vsn-pages-select" value={seoFilter} onChange={(event) => updateFilter(setSeoFilter, event.target.value)} aria-label="SEO Score filter"><option value="all">All SEO scores</option>{(facets.seoScores || []).map((score) => <option key={score} value={score}>SEO {score}</option>)}</select> : null}
          {dataViewConfig.sorting ? <VsnDataViewSortControls fields={sortableColumns.map((column) => ({ value: column.sort, label: column.label }))} field={sortField} direction={sortDirection} onFieldChange={(field) => { setSortField(field); setCurrentPage(1); }} onDirectionChange={(direction) => { setSortDirection(direction); setCurrentPage(1); }} /> : null}
          {dataViewConfig.templateFilter ? <select className="vsn-pages-select" value={templateFilter} onChange={(event) => updateFilter(setTemplateFilter, event.target.value)} aria-label="Template filter"><option value="all">All template types</option>{(facets.templates || []).map((type) => <option key={type} value={type}>{templateLabel(type)}</option>)}</select> : null}
          {dataViewConfig.authorFilter ? <select className="vsn-pages-select" value={authorFilter} onChange={(event) => updateFilter(setAuthorFilter, event.target.value)} aria-label="Author filter"><option value="all">All authors</option>{(facets.authors || []).map((author) => <option key={author} value={author}>{author}</option>)}</select> : null}
          <div className="vsn-template-row-spacer" />
          {dataViewConfig.pagination ? <VsnDataViewPagination page={currentPage} totalPages={Number(tableData.totalPages || 1)} total={Number(tableData.total || 0)} pageSize={pageSize} disabled={dbLoading} onChange={changePage} /> : null}
        </div>
      </section>

      {(nonSearchQueryPending || (localSearchPending && !immediateRows.length)) && dbLoading ? <div className="vsn-template-db-search"><RefreshCw className="vsn-template-spin" size={16} /> {localSearchPending ? "Searching database…" : "Loading templates…"}</div> : null}

      {dataViewConfig.list && viewMode === "list" ? <div className="vsn-pages-table-wrap"><table className="vsn-pages-table"><thead><tr>
        {visibleColumns.has("select") ? <th className="vsn-template-checkbox-col"><input ref={masterRef} type="checkbox" checked={allSelected} onChange={toggleCurrentPage} aria-label="Select all templates on this page" /></th> : null}
        {COLUMN_DEFS.filter((column) => column.key !== "select" && visibleColumns.has(column.key)).map((column) => <th key={column.key}>{column.label}</th>)}<th aria-label="Actions" />
      </tr></thead><tbody>{displayRows.map((page) => <tr key={page.id} className={selectedIds.has(page.id) ? "is-selected" : ""}>
        {visibleColumns.has("select") ? <td className="vsn-template-checkbox-col"><input type="checkbox" checked={selectedIds.has(page.id)} onChange={() => toggleSelect(page.id)} aria-label={`Select ${page.title}`} /></td> : null}
        {visibleColumns.has("image") ? <td><TemplateThumb page={page} /></td> : null}
        {visibleColumns.has("name") ? <td><div className="vsn-page-cell"><div>{trashMode ? <strong>{page.title}</strong> : <button type="button" className="vsn-page-title-button" disabled={!canEdit} onClick={() => onEditPage?.(page)}>{page.title}</button>}<small>/{page.handle}</small></div></div></td> : null}
        {visibleColumns.has("status") ? <td><Badge status={trashMode ? "trashed" : page.status} />{page.status === "scheduled" && page.scheduledAt ? <small className="vsn-template-cell-sub">{formatDate(page.scheduledAt, true)}</small> : null}</td> : null}
        {visibleColumns.has("template") ? <td>{templateLabel(page.template)}</td> : null}
        {visibleColumns.has("views") ? <td>{formatViews(page.views)}</td> : null}
        {visibleColumns.has("updated") ? <td>{formatDate(page.updatedAt)}</td> : null}
        {visibleColumns.has("created") ? <td>{formatDate(page.createdAt)}</td> : null}
        {visibleColumns.has("pages") ? <td>{page.pageCount}</td> : null}
        {visibleColumns.has("seo") ? <td><span className={`vsn-template-seo ${page.seoScore >= 80 ? "is-good" : page.seoScore >= 50 ? "is-mid" : "is-low"}`}>{page.seoScore}</span></td> : null}
        {visibleColumns.has("author") ? <td><span className="vsn-template-author"><UserRound size={13} />{page.createdBy}</span></td> : null}
        <td><div className="vsn-page-row-actions">{!trashMode ? <><button className="vsn-page-edit-btn" type="button" disabled={!canEdit} onClick={() => onEditPage?.(page)}><Edit3 size={14} />Edit</button><button className="vsn-page-icon-btn" type="button" onClick={() => onPreviewPage?.(page)} title="Preview"><Eye size={16} /></button></> : null}{dataViewConfig.rowActions ? <ActionMenu page={page} busy={busy} trashMode={trashMode} canEdit={canEdit} canDuplicate={canDuplicate} canDelete={canDelete} canRestore={canRestore} canSetDefault={canSetDefault} open={openMenu === page.id} onToggle={(nextOpen) => setOpenMenu(nextOpen ? page.id : null)} onAction={actionFor} /> : null}</div></td>
      </tr>)}</tbody></table>{!displayRows.length && !dbLoading ? <div className="vsn-pages-empty">{trashMode ? "Trash is empty." : "No templates match the current filters."}</div> : null}</div> : null}

      {dataViewConfig.grid && viewMode === "grid" ? <div className="vsn-pages-grid">{displayRows.map((page) => <article key={page.id} className={`vsn-page-grid-card ${selectedIds.has(page.id) ? "is-selected" : ""}`}>
        <div className="vsn-page-grid-select"><input type="checkbox" checked={selectedIds.has(page.id)} onChange={() => toggleSelect(page.id)} aria-label={`Select ${page.title}`} /></div>
        <div className="vsn-page-grid-menu">{dataViewConfig.rowActions ? <ActionMenu page={page} busy={busy} trashMode={trashMode} canEdit={canEdit} canDuplicate={canDuplicate} canDelete={canDelete} canRestore={canRestore} canSetDefault={canSetDefault} open={openMenu === page.id} onToggle={(nextOpen) => setOpenMenu(nextOpen ? page.id : null)} onAction={actionFor} /> : null}</div>
        <div className="vsn-page-grid-preview"><TemplateThumb page={page} large /></div>
        <div className="vsn-page-grid-body"><div className="vsn-page-grid-head">{trashMode ? <strong className="vsn-page-grid-title">{page.title}</strong> : <button className="vsn-page-grid-title vsn-page-grid-title-button" type="button" disabled={!canEdit} onClick={() => onEditPage?.(page)}>{page.title}</button>}<Badge status={trashMode ? "trashed" : page.status} /></div>
          <p className="vsn-page-grid-meta">{templateLabel(page.template)} · SEO {page.seoScore} · {formatViews(page.views)} views</p>
          <p className="vsn-page-grid-meta"><UserRound size={12} /> {page.createdBy} · Created {formatDate(page.createdAt)}</p>
          <p className="vsn-page-grid-meta">Updated {formatDate(page.updatedAt)} · Pages {page.pageCount}</p>
          <div className="vsn-page-grid-footer">{trashMode ? <><button className="vsn-button vsn-button--ghost vsn-button--xs" type="button" disabled={!canRestore || busy} onClick={() => onRestorePage?.(page)}><RotateCcw size={14} />Restore</button><button className="vsn-button vsn-button--danger vsn-button--xs" type="button" disabled={!canDelete || busy} onClick={() => onHardDeletePage?.(page)}><Trash2 size={14} />Delete forever</button></> : <><button className="vsn-button vsn-button--ghost vsn-button--xs" type="button" onClick={() => onPreviewPage?.(page)}><Eye size={14} />Preview</button><button className="vsn-button vsn-button--ghost vsn-button--xs" type="button" disabled={!canEdit} onClick={() => onEditPage?.(page)}><Edit3 size={14} />Edit</button></>}</div>
        </div>
      </article>)}{!displayRows.length && !dbLoading ? <div className="vsn-tool-empty"><strong>{trashMode ? "Trash is empty." : "No templates match the current filters."}</strong></div> : null}</div> : null}

      {(dataViewConfig.bulkActions || dataViewConfig.pagination) ? <div className="vsn-template-bottom-bar">{dataViewConfig.bulkActions ? <BulkDropdown bottom /> : null}<div className="vsn-template-row-spacer" />{dataViewConfig.pagination ? <VsnDataViewPagination page={currentPage} totalPages={Number(tableData.totalPages || 1)} total={Number(tableData.total || 0)} pageSize={pageSize} disabled={dbLoading} onChange={changePage} /> : null}</div> : null}
    </div>

    {dataViewConfig.settings ? <VsnDataViewSettings open={settingsOpen} onToggle={setSettingsOpen} title="Templates settings" subtitle="Widgets, columns, view and pagination" buttonLabel="Templates settings" resetLabel="Reset Templates settings" onReset={() => { setVisibleColumns(new Set(DEFAULT_COLUMNS)); setVisibleWidgets(new Set(DEFAULT_WIDGETS)); setPageSize(12); setViewMode(dataViewConfig.list ? "list" : "grid"); }}>
      <div className="vsn-template-settings-body">
        {dataViewConfig.widgets ? <section><h3>Widgets</h3>{widgetDefs.map((widget) => <label key={widget.key}><input type="checkbox" checked={visibleWidgets.has(widget.key)} onChange={(event) => setWidget(widget.key, event.target.checked)} />{widget.label}</label>)}</section> : null}
        {dataViewConfig.columnVisibility ? <section><h3>Table columns</h3>{COLUMN_DEFS.map((column) => <label key={column.key}><input type="checkbox" checked={visibleColumns.has(column.key)} onChange={(event) => setColumn(column.key, event.target.checked)} />{column.label}</label>)}</section> : null}
        {dataViewConfig.pageSize ? <section><h3>Pagination</h3><label className="is-stacked"><span>Records per page preset</span><select value={[12,24,36,48].includes(Number(pageSize)) ? String(pageSize) : "custom"} onChange={(event) => { const value = event.target.value; if (value !== "custom") { setPageSize(Number(value)); setCurrentPage(1); } }}><option value="12">12</option><option value="24">24</option><option value="36">36</option><option value="48">48</option>{dataViewConfig.customPageSize ? <option value="custom">Custom…</option> : null}</select></label>{dataViewConfig.customPageSize ? <label className="is-stacked"><span>Custom records per page</span><input type="number" min="1" max="100" value={pageSize} onChange={(event) => { const value = Math.max(1, Math.min(100, Math.floor(Number(event.target.value) || 12))); setPageSize(value); setCurrentPage(1); }} /></label> : null}<p>Default is 12. Records per page are sent to the database query for both List and Grid views.</p></section> : null}
      </div>
    </VsnDataViewSettings> : null}

    {renameTarget ? <Modal title="Rename template" onClose={() => setRenameTarget(null)} footer={<><button type="button" className="vsn-button vsn-button--secondary vsn-button--sm" onClick={() => setRenameTarget(null)}>Cancel</button><button type="button" className="vsn-button vsn-button--primary vsn-button--sm" disabled={!renameValue.trim() || busy} onClick={submitRename}>Save changes</button></>}><label className="vsn-template-field"><span>Current Name</span><input value={renameTarget.title} disabled /></label><label className="vsn-template-field"><span>New Name</span><input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitRename(); }} /></label></Modal> : null}

    {scheduleOpen ? <Modal title="Schedule selected templates" onClose={() => setScheduleOpen(false)} footer={<><button type="button" className="vsn-button vsn-button--secondary vsn-button--sm" onClick={() => setScheduleOpen(false)}>Cancel</button><button type="button" className="vsn-button vsn-button--primary vsn-button--sm" disabled={!scheduleDate || !scheduleTime || busy} onClick={submitSchedule}>Schedule {selectedIds.size}</button></>}><p className="vsn-template-modal-copy">Choose the future date and time that will be stored on all selected templates.</p><div className="vsn-template-field-grid"><label className="vsn-template-field"><span>Date</span><input type="date" value={scheduleDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setScheduleDate(event.target.value)} /></label><label className="vsn-template-field"><span>Time</span><input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} /></label></div></Modal> : null}

    {customDateOpen ? <Modal title="Custom date range" onClose={() => setCustomDateOpen(false)} footer={<><button type="button" className="vsn-button vsn-button--secondary vsn-button--sm" onClick={() => setCustomDateOpen(false)}>Cancel</button><button type="button" className="vsn-button vsn-button--primary vsn-button--sm" disabled={!!(pendingDateFrom && pendingDateTo && pendingDateFrom > pendingDateTo)} onClick={applyCustomDate}>Apply range</button></>}><div className="vsn-template-field-grid"><label className="vsn-template-field"><span>Start Date</span><input type="date" value={pendingDateFrom} onChange={(event) => setPendingDateFrom(event.target.value)} /></label><label className="vsn-template-field"><span>End Date</span><input type="date" value={pendingDateTo} onChange={(event) => setPendingDateTo(event.target.value)} /></label></div></Modal> : null}

    {confirmBulk ? <Modal title={`${confirmBulk.action === "delete" ? "Move to Trash" : confirmBulk.action === "publish" ? "Publish" : confirmBulk.action === "restore" ? "Restore" : confirmBulk.action === "hard-delete" ? "Delete Forever" : confirmBulk.action === "cancel-schedule" ? "Cancel schedule for" : "Move to Draft"} selected templates?`} onClose={() => setConfirmBulk(null)} footer={<><button type="button" className="vsn-button vsn-button--secondary vsn-button--sm" onClick={() => setConfirmBulk(null)}>Cancel</button><button type="button" className={`vsn-button ${["delete","hard-delete"].includes(confirmBulk.action) ? "vsn-button--danger" : "vsn-button--primary"} vsn-button--sm`} disabled={busy} onClick={confirmBulkAction}>{confirmBulk.action === "delete" ? "Move to Trash" : confirmBulk.action === "publish" ? "Publish" : confirmBulk.action === "restore" ? "Restore" : confirmBulk.action === "hard-delete" ? "Delete Forever" : confirmBulk.action === "cancel-schedule" ? "Cancel schedule" : "Move to Draft"}</button></>}><p className="vsn-template-modal-copy">This action will apply to {confirmBulk.ids.length} selected template{confirmBulk.ids.length === 1 ? "" : "s"}. Existing server permissions and publishing rules still apply.</p></Modal> : null}
  </div>;
}
