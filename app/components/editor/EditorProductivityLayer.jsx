import { VsnButton, VsnTextField, VsnNumberField, VsnTextArea, VsnSelect, VsnOption, VsnCheckbox, VsnColorField, VsnSearchField, VsnUrlField, VsnDateField, VsnSpinner } from "./EditorUi";
import { useEffect, useMemo, useState } from "react";
import PolarisIcon from "../ui/PolarisIcon";
import { ModalPortal, PointOverlay } from "./OverlayManager";

const btn = "vsn-context-menu-item";

export default function EditorProductivityLayer({
  contextMenu,
  onCloseContext,
  selectedCount = 0,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onCopyStyles,
  onPasteStyles,
  onSaveLibrary,
  onUpdateSyncedLibrary,
  onCreateComponent,
  onMoveSelection,
  onSelectAll,
  onClearSelection,
  onOpenNavigator,
  onOpenPageSettings,
  onOpenRevisions,
  onOpenQA,
  onUndo,
  onRedo,
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen((v) => !v); setQuery(""); }
      if (event.key === "Escape") { setPaletteOpen(false); onCloseContext?.(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCloseContext]);

  const commands = useMemo(() => [
    ["Undo", "undo", onUndo], ["Redo", "redo", onRedo], ["Copy", "clipboard", onCopy], ["Paste", "clipboard", onPaste],
    ["Duplicate selection", "duplicate", onDuplicate], ["Copy styles", "paint-brush", onCopyStyles], ["Paste styles", "paint-brush", onPasteStyles],
    ["Save to Library", "categories", onSaveLibrary], ["Create Component", "grid", onCreateComponent], ["Update synced library item", "refresh", onUpdateSyncedLibrary], ["Move selected to top", "arrow-up", () => onMoveSelection?.("top")], ["Move selected to bottom", "arrow-down", () => onMoveSelection?.("bottom")],
    ["Select all root elements", "select", onSelectAll], ["Clear selection", "x", onClearSelection], ["Open Navigator", "list-bulleted", onOpenNavigator],
    ["Page Settings", "settings", onOpenPageSettings], ["Revisions", "clock", onOpenRevisions], ["Template QA", "check-circle", onOpenQA],
    ["Delete selection", "delete", onDelete],
  ].filter((item) => item[2]), [onUndo,onRedo,onCopy,onPaste,onDuplicate,onCopyStyles,onPasteStyles,onSaveLibrary,onCreateComponent,onUpdateSyncedLibrary,onMoveSelection,onSelectAll,onClearSelection,onOpenNavigator,onOpenPageSettings,onOpenRevisions,onOpenQA,onDelete]);
  const filtered = commands.filter(([label]) => !query || label.toLowerCase().includes(query.toLowerCase()));

  return <>
    {selectedCount > 1 ? <div className="absolute left-1/2 top-3 z-[65] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[#c9cccf] bg-white px-3 py-2 text-xs shadow-lg">
      <strong>{selectedCount} selected</strong><VsnButton variant="tertiary" size="sm" onClick={onCopyStyles}>Copy styles</VsnButton><VsnButton variant="tertiary" size="sm" onClick={()=>onMoveSelection?.("top")}>To top</VsnButton><VsnButton variant="tertiary" size="sm" onClick={()=>onMoveSelection?.("bottom")}>To bottom</VsnButton><VsnButton variant="tertiary" size="sm" tone="critical" onClick={onDelete}>Delete</VsnButton><VsnButton variant="icon" size="sm" onClick={onClearSelection}><PolarisIcon type="x" size="small"/></VsnButton>
    </div> : null}

    {contextMenu ? <PointOverlay point={contextMenu} className="vsn-editor-context-menu w-52 rounded-xl border border-[#d9d9d9] bg-white p-1.5 shadow-2xl" role="menu" onRequestClose={onCloseContext}>
      <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#8c9196]">Element actions</div>
      <VsnButton variant="plain" className={btn} onClick={()=>{onCopy?.();onCloseContext?.();}}><PolarisIcon type="clipboard" size="small"/>Copy</VsnButton>
      <VsnButton variant="plain" className={btn} onClick={()=>{onPaste?.();onCloseContext?.();}}><PolarisIcon type="clipboard" size="small"/>Paste</VsnButton>
      <VsnButton variant="plain" className={btn} onClick={()=>{onDuplicate?.();onCloseContext?.();}}><PolarisIcon type="duplicate" size="small"/>Duplicate</VsnButton>
      <div className="my-1 border-t border-[#eee]"/>
      <VsnButton variant="plain" className={btn} onClick={()=>{onCopyStyles?.();onCloseContext?.();}}><PolarisIcon type="paint-brush" size="small"/>Copy styles</VsnButton>
      <VsnButton variant="plain" className={btn} onClick={()=>{onPasteStyles?.();onCloseContext?.();}}><PolarisIcon type="paint-brush" size="small"/>Paste styles</VsnButton>
      <VsnButton variant="plain" className={btn} onClick={()=>{onSaveLibrary?.();onCloseContext?.();}}><PolarisIcon type="categories" size="small"/>Save to Library</VsnButton>
      {onCreateComponent ? <VsnButton variant="plain" className={btn} onClick={()=>{onCreateComponent?.();onCloseContext?.();}}><PolarisIcon type="grid" size="small"/>Create Component</VsnButton> : null}
      {onUpdateSyncedLibrary ? <VsnButton variant="plain" className={btn} onClick={()=>{onUpdateSyncedLibrary?.();onCloseContext?.();}}><PolarisIcon type="refresh" size="small"/>Update synced item</VsnButton> : null}
      <div className="my-1 border-t border-[#eee]"/>
      <VsnButton className={`${btn} text-[#b42318] hover:bg-red-50 hover:text-[#b42318]`} onClick={()=>{onDelete?.();onCloseContext?.();}}><PolarisIcon type="delete" size="small"/>Delete</VsnButton>
    </PointOverlay> : null}

    {paletteOpen ? <ModalPortal><div className="vsn-editor-modal-backdrop flex items-start justify-center bg-black/30 px-4 pt-[12vh]" onMouseDown={(e)=>{if(e.currentTarget===e.target)setPaletteOpen(false)}}>
      <div className="w-[620px] max-w-full overflow-hidden rounded-2xl border border-[#d9d9d9] bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[#eee] px-4"><PolarisIcon type="search"/><div className="min-w-0 flex-1 py-2"><VsnSearchField label="Command" labelAccessibilityVisibility="exclusive" value={query} placeholder="Type a command…" onInput={(event)=>setQuery(event.currentTarget.value || "")} /></div><kbd className="rounded border bg-[#f6f6f7] px-1.5 py-0.5 text-[10px]">Esc</kbd></div>
        <div className="max-h-[55vh] overflow-y-auto p-2">{filtered.map(([label,icon,run])=><VsnButton key={label} variant="plain" className={btn} onClick={()=>{run?.();setPaletteOpen(false)}}><PolarisIcon type={icon} size="small"/><span className="flex-1">{label}</span></VsnButton>)}{!filtered.length?<div className="p-8 text-center text-xs text-[#8c9196]">No commands found.</div>:null}</div>
        <div className="border-t border-[#eee] px-4 py-2 text-[10px] text-[#8c9196]">Command palette · Ctrl/Cmd + K</div>
      </div>
    </div></ModalPortal> : null}
  </>;
}
