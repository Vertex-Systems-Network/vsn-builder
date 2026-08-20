import { useRef } from "react";
import { ChevronLeft, ChevronRight, Grid2X2, List, MoreVertical, SlidersHorizontal } from "lucide-react";
import { VsnAnchoredPopover, VsnFloatingSettingsButton, VsnSettingsPopover } from "./VsnToolkit";

export const VSN_DATA_VIEW_DEFAULT_CONFIG = Object.freeze({
  list: true,
  grid: true,
  search: true,
  filters: true,
  statusFilters: true,
  dateFilter: true,
  seoFilter: true,
  templateFilter: true,
  authorFilter: true,
  bulkActions: true,
  sorting: true,
  pagination: true,
  settings: true,
  widgets: true,
  columnVisibility: true,
  pageSize: true,
  customPageSize: true,
  rowActions: true,
});

export function normalizeDataViewConfig(config = {}) {
  const resolved = { ...VSN_DATA_VIEW_DEFAULT_CONFIG, ...(config || {}) };
  if (resolved.filters === false) {
    resolved.statusFilters = false;
    resolved.dateFilter = false;
    resolved.seoFilter = false;
    resolved.templateFilter = false;
    resolved.authorFilter = false;
  }
  if (resolved.settings === false) {
    resolved.widgets = false;
    resolved.columnVisibility = false;
    resolved.pageSize = false;
    resolved.customPageSize = false;
  }
  return resolved;
}

export function VsnDataViewToggle({ value = "list", onChange, config = VSN_DATA_VIEW_DEFAULT_CONFIG }) {
  const resolved = normalizeDataViewConfig(config);
  if (!resolved.list && !resolved.grid) return null;
  return <div className="vsn-view-switch" aria-label="View mode">
    {resolved.list ? <button type="button" className={value === "list" ? "active" : ""} onClick={() => onChange?.("list")} aria-label="List view"><List size={16}/></button> : null}
    {resolved.grid ? <button type="button" className={value === "grid" ? "active" : ""} onClick={() => onChange?.("grid")} aria-label="Grid view"><Grid2X2 size={16}/></button> : null}
  </div>;
}

export function VsnDataViewSortControls({ fields = [], field, direction = "desc", onFieldChange, onDirectionChange, disabled = false }) {
  return <div className="vsn-data-view-sort-controls">
    <select className="vsn-pages-select" value={field} disabled={disabled} onChange={(event) => onFieldChange?.(event.target.value)} aria-label="Sort field">
      {fields.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
    <select className="vsn-pages-select is-direction" value={direction} disabled={disabled} onChange={(event) => onDirectionChange?.(event.target.value)} aria-label="Sort direction">
      <option value="asc">ASC</option><option value="desc">DESC</option>
    </select>
  </div>;
}

export function VsnDataViewPagination({ page, totalPages, total, pageSize, disabled, onChange }) {
  const start = total ? ((page - 1) * pageSize) + 1 : 0;
  const end = Math.min(total, page * pageSize);
  return <div className="vsn-template-pagination" aria-label="Pagination">
    <span>{start}–{end} of {total}</span>
    <button type="button" disabled={disabled || page <= 1} onClick={() => onChange?.(page - 1)} aria-label="Previous page"><ChevronLeft size={15}/></button>
    <strong>{page} / {Math.max(1, totalPages)}</strong>
    <button type="button" disabled={disabled || page >= totalPages} onClick={() => onChange?.(page + 1)} aria-label="Next page"><ChevronRight size={15}/></button>
  </div>;
}


export function VsnDataViewBulkMenu({ open, onOpenChange, actions = [], disabled = false, busy = false, selectedCount = 0, label = "Bulk actions" }) {
  const anchorRef = useRef(null);
  return <div className="vsn-template-bulk-menu-wrap">
    <button ref={anchorRef} type="button" className="vsn-template-bulk-trigger" disabled={disabled || busy} onClick={() => onOpenChange?.(!open)} aria-expanded={open}><SlidersHorizontal size={14}/>{label}{selectedCount ? ` (${selectedCount})` : ""}</button>
    <VsnAnchoredPopover open={open && !disabled && !busy} anchorRef={anchorRef} onClose={() => onOpenChange?.(false)} align="start" minWidth={180} maxWidth={220} className="vsn-data-view-bulk-popover">
      <div className="vsn-template-bulk-menu vsn-template-bulk-menu--portal">{actions.map((action) => {
        const Icon = action.icon || SlidersHorizontal;
        return <button key={action.key || action.label} type="button" className={action.danger ? "danger" : ""} disabled={action.disabled} onClick={() => { onOpenChange?.(false); action.onClick?.(); }}><Icon size={14}/>{action.label}</button>;
      })}</div>
    </VsnAnchoredPopover>
  </div>;
}

export function VsnDataViewActionMenu({ open, onOpenChange, actions = [], busy = false, label = "More actions" }) {
  const anchorRef = useRef(null);
  return <div className="vsn-page-more">
    <button ref={anchorRef} className="vsn-page-icon-btn" type="button" onClick={() => onOpenChange?.(!open)} title={label} aria-label={label} aria-expanded={open}><MoreVertical size={16}/></button>
    <VsnAnchoredPopover open={open} anchorRef={anchorRef} onClose={() => onOpenChange?.(false)} minWidth={180} maxWidth={220} className="vsn-data-view-action-popover">
      <div className="vsn-page-menu vsn-page-menu--portal">{actions.map((action) => {
        const Icon = action.icon || MoreVertical;
        return <button key={action.key || action.label} type="button" className={action.danger ? "danger" : ""} disabled={busy || action.disabled} onClick={() => { onOpenChange?.(false); action.onClick?.(); }}><Icon size={14}/>{action.label}</button>;
      })}</div>
    </VsnAnchoredPopover>
  </div>;
}

export function VsnDataViewSettings({ open, onToggle, title = "View settings", subtitle = "Configure this screen", children, footer = null, buttonLabel = "View settings", onReset = null, resetLabel = "Reset settings", resetDisabled = false }) {
  return <>
    <VsnFloatingSettingsButton open={open} onClick={() => onToggle?.(!open)} label={buttonLabel}/>
    <VsnSettingsPopover open={open} onClose={() => onToggle?.(false)} title={title} subtitle={subtitle} footer={footer} onReset={onReset} resetLabel={resetLabel} resetDisabled={resetDisabled}>{children}</VsnSettingsPopover>
  </>;
}
