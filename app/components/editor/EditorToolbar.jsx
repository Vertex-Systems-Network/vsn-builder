import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import PolarisIcon from "../ui/PolarisIcon";
import { AnchoredOverlay } from "./OverlayManager";
import { normalizeResponsiveBreakpoints } from "../../builder/responsiveEngine.js";

function deviceModes(breakpoints = {}) {
  return normalizeResponsiveBreakpoints(breakpoints).map((bp) => ({
    mode: bp.id,
    icon: bp.id === "mobile" ? "mobile" : bp.id === "tablet" ? "tablet" : "desktop",
    label: `${bp.label} · ${bp.minWidth || 0}px${bp.maxWidth == null ? " and wider" : `–${bp.maxWidth}px`}`,
    previewWidth: bp.previewWidth,
  }));
}

function TipButton({ label, children, className = "", active = false, disabled = false, ...props }) {
  return (
    <button type="button" {...props} disabled={disabled} data-tooltip={label}
      className={`vsn-editor-icon-button ${active ? "is-active" : ""} ${className}`}
      aria-label={props["aria-label"] || label}>
      {children}
    </button>
  );
}

export default function EditorToolbar({
  pageName, pageTemplate, collections = [], products = [], previewCollectionHandle = "", onPreviewCollectionChange,
  previewProductHandle = "", onPreviewProductChange, previewMode, onPreviewChange, saving, saveResult, onSave, onPublish,
  onPreview, onUndo, onRedo, canUndo, canRedo, isSaved, onSaveTemplate, onDeletePage, onHelp,
  onQA, onRevisions, onCollaboration, onLocalization, onPageSettings, onHistory, revisionsCount = 0, responsiveBreakpoints = {}, previewWidth = 0, onPreviewWidthChange,
  zoom = 1, onZoomChange, onZoomFit,
  collaborationEnabled = false, localizationEnabled = false, localizationLabel = "Localization", activePresenceCount = 0, unresolvedComments = 0, workflowStatus = "draft", canPublish = true, canSave = true, canSaveTemplate = true, canDelete = true,
  darkMode = false, onToggleTheme,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const menuRef = useRef(null);
  const wasSaving = useRef(false);

  useEffect(() => {
    const key = (event) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  useEffect(() => {
    if (saving) wasSaving.current = true;
    if (!saving && wasSaving.current) { wasSaving.current = false; setPendingAction(""); }
  }, [saving]);
  useEffect(() => { if (saveResult?.error || saveResult?.conflict || saveResult?.success) setPendingAction(""); }, [saveResult]);

  const runAction = (name, action) => { if (saving) return; setPendingAction(name); setMenuOpen(false); action?.(); };
  const statusLabel = saving ? pendingAction === "publish" ? "Publishing…" : pendingAction === "save" ? "Saving…" : "Working…" : isSaved ? "Saved" : "Unsaved changes";
  const modes = deviceModes(responsiveBreakpoints);

  return (
    <header className="vsn-editor-topbar">
      <div className="vsn-editor-left-zone">
        <div className="vsn-editor-page-identity">
          <div className="vsn-editor-logo">VSN</div>
          <div className="vsn-editor-page-copy"><strong>{pageName || "Untitled page"}</strong><span className={isSaved ? "is-saved" : "is-unsaved"}>{pageTemplate || "page"}{collaborationEnabled ? ` · ${workflowStatus}` : ""} · {statusLabel}</span></div>
        </div>

        <div className="vsn-editor-toolbar-group vsn-editor-workflow-actions vsn-editor-workflow-actions--left" aria-label="Editor workflow">
          <TipButton label="Template QA" onClick={onQA}><PolarisIcon type="check-circle" size={17}/></TipButton>
          <TipButton label="Page settings" onClick={onPageSettings}><PolarisIcon type="settings" size={17}/></TipButton>
          <TipButton label="Editor history" onClick={onHistory}><PolarisIcon type="list" size={17}/></TipButton>
          <TipButton label={`Revisions · ${revisionsCount}`} onClick={onRevisions}><PolarisIcon type="clock" size={17}/></TipButton>
          {collaborationEnabled ? <TipButton label={`Collaboration · ${activePresenceCount} active · ${unresolvedComments} comments`} onClick={onCollaboration}><PolarisIcon type="profile" size={17}/></TipButton> : null}
          {localizationEnabled ? <TipButton label={localizationLabel} onClick={onLocalization}><PolarisIcon type="language" size={17}/></TipButton> : null}
        </div>
      </div>

      {pageTemplate === "collection" ? <label className="vsn-editor-inline-field"><span>Collection</span><span className="vsn-editor-inline-select"><select value={previewCollectionHandle} onChange={(e)=>onPreviewCollectionChange?.(e.target.value)}>{collections.length===0?<option value="">No collections</option>:collections.map(c=><option key={c.id} value={c.handle}>{c.title}</option>)}</select><PolarisIcon type="chevron-down" size={13}/></span></label> : null}
      {pageTemplate === "product" ? <label className="vsn-editor-inline-field"><span>Product</span><span className="vsn-editor-inline-select"><select value={previewProductHandle} onChange={(e)=>onPreviewProductChange?.(e.target.value)}>{products.length===0?<option value="">No products</option>:products.map(p=><option key={p.id} value={p.handle}>{p.title}</option>)}</select><PolarisIcon type="chevron-down" size={13}/></span></label> : null}

      <div className="vsn-editor-toolbar-spacer" />

      <div className="vsn-editor-device-switcher vsn-editor-device-switcher--center" aria-label="Responsive preview">
        {modes.map(({mode,icon,label})=><TipButton key={mode} label={label} active={previewMode===mode} onClick={()=>onPreviewChange(mode)}><PolarisIcon type={icon} size={17}/></TipButton>)}
        <label className="vsn-editor-width-control" data-tooltip="Custom canvas width"><input type="number" min="240" max="2560" value={previewWidth||""} onChange={(event)=>onPreviewWidthChange?.(Math.max(240,Math.min(2560,Number(event.currentTarget.value)||390)))} aria-label="Custom canvas width"/><span>px</span></label>
        <div className="vsn-editor-zoom-control" aria-label="Canvas zoom">
          <button type="button" aria-label="Zoom out" onClick={()=>onZoomChange?.(Math.max(.25,Number((zoom-.1).toFixed(2))))}>−</button>
          <button type="button" className="vsn-editor-zoom-value" aria-label="Reset zoom to 100%" onClick={()=>onZoomChange?.(1)}>{Math.round((zoom||1)*100)}%</button>
          <button type="button" aria-label="Zoom in" onClick={()=>onZoomChange?.(Math.min(2,Number((zoom+.1).toFixed(2))))}>+</button>
          <button type="button" className="vsn-editor-zoom-fit" aria-label="Fit canvas to available editor width" onClick={onZoomFit}>Fit</button>
        </div>
      </div>

      <div className="vsn-editor-toolbar-spacer" />

      <div className="vsn-editor-toolbar-group vsn-editor-preview-history-group vsn-editor-preview-history-group--right" aria-label="Preview and history actions">
        <button type="button" className="vsn-editor-text-button" onClick={onPreview} data-tooltip="Open page preview" aria-label="Open page preview"><PolarisIcon type="external" size={16}/><span>Preview</span></button>
        <TipButton label="Undo last editor change" disabled={!canUndo || saving} onClick={onUndo}><PolarisIcon type="undo" size={17}/></TipButton>
        <TipButton label="Redo last editor change" disabled={!canRedo || saving} onClick={onRedo}><PolarisIcon type="redo" size={17}/></TipButton>
      </div>

      <div className="vsn-publish-group" ref={menuRef}>
        <button type="button" className="vsn-editor-publish-button" disabled={saving || !canPublish} title={!canPublish && collaborationEnabled ? "Publisher role and Approved workflow status are required." : "Publish"} aria-busy={saving && pendingAction === "publish" || undefined} onClick={()=>runAction("publish", onPublish)}>
          {saving && pendingAction === "publish" ? <span className="vsn-inline-spinner"/> : <PolarisIcon type="upload" size={16}/>}<span>{saving && pendingAction === "publish" ? "Publishing…" : "Publish"}</span>
        </button>
        <button type="button" className="vsn-publish-chevron" disabled={saving} aria-label="More publish actions" data-tooltip="More publish actions" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}><PolarisIcon type="chevron-down" size={15}/></button>
        <AnchoredOverlay open={menuOpen} anchorRef={menuRef} placement="bottom-end" width={220} className="vsn-editor-action-menu" role="menu" layer="menu" onRequestClose={() => setMenuOpen(false)}>
          <button type="button" role="menuitem" disabled={saving || !canSave} onClick={()=>runAction("save", onSave)}><PolarisIcon type="save" size={16}/><span>Save Draft</span></button>
          <button type="button" role="menuitem" disabled={saving || !canSaveTemplate} onClick={()=>runAction("template", onSaveTemplate)}><PolarisIcon type="template" size={16}/><span>Save as Template</span></button>
          <div className="vsn-editor-action-separator" />
          <button type="button" role="menuitem" className="is-danger" disabled={saving || !canDelete} onClick={()=>runAction("delete", onDeletePage)}><PolarisIcon type="trash" size={16}/><span>Move to Trash</span></button>
        </AnchoredOverlay>
      </div>

      <TipButton label={darkMode ? "Use light editor theme" : "Use dark editor theme"} onClick={onToggleTheme}>{darkMode ? <Sun size={17}/> : <Moon size={17}/>}</TipButton>
      <TipButton label="Help & documentation" onClick={onHelp}><PolarisIcon type="help" size={18}/></TipButton>
    </header>
  );
}
