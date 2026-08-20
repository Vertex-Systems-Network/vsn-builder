import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, Settings2, UploadCloud, X, AlertTriangle, RotateCcw } from "lucide-react";
import Button from "./Button";

export function VsnPage({ title, subtitle = "", actions = null, children, compact = false, profile = "workspace" }) {
  return <div className="vsn-workspace-page" data-vsn-ui-profile={profile}>
    <div className="vsn-workspace-page-head">
      <div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
      {actions ? <div className="vsn-workspace-page-actions">{actions}</div> : null}
    </div>
    <div className={compact ? "vsn-workspace-content is-compact" : "vsn-workspace-content"}>{children}</div>
  </div>;
}

export function VsnCard({ title, subtitle = "", actions = null, children, className = "" }) {
  return <section className={`vsn-workspace-card ${className}`}>
    {(title || subtitle || actions) ? <div className="vsn-workspace-card-head">
      <div>{title ? <h2>{title}</h2> : null}{subtitle ? <p>{subtitle}</p> : null}</div>
      {actions ? <div className="vsn-workspace-card-actions">{actions}</div> : null}
    </div> : null}
    <div className="vsn-workspace-card-body">{children}</div>
  </section>;
}

export function VsnButton(props) { return <Button {...props} />; }

export function VsnIconButton({ label, children, active = false, danger = false, className = "", ...props }) {
  return <button type="button" title={label} aria-label={label} className={`vsn-tool-icon-button ${active ? "is-active" : ""} ${danger ? "is-danger" : ""} ${className}`} {...props}>{children}</button>;
}

export function VsnInput({ label = "", hideLabel = false, icon = null, className = "", ...props }) {
  return <label className={`vsn-tool-field ${className}`}>
    {label && !hideLabel ? <span>{label}</span> : null}
    <div className={`vsn-tool-input-wrap ${icon ? "has-icon" : ""}`}>{icon ? <span className="vsn-tool-leading-icon">{icon}</span> : null}<input aria-label={hideLabel ? label : undefined} className="vsn-tool-input" {...props}/></div>
  </label>;
}

export function VsnSearchInput(props) { return <VsnInput icon={<Search size={15}/>} {...props}/>; }

export function VsnSelect({ label = "", hideLabel = false, children, className = "", ...props }) {
  return <label className={`vsn-tool-field ${className}`}>{label && !hideLabel ? <span>{label}</span> : null}<select aria-label={hideLabel ? label : undefined} className="vsn-tool-select" {...props}>{children}</select></label>;
}

export function VsnTextarea({ label = "", hideLabel = false, className = "", ...props }) {
  return <label className={`vsn-tool-field ${className}`}>{label && !hideLabel ? <span>{label}</span> : null}<textarea aria-label={hideLabel ? label : undefined} className="vsn-tool-textarea" {...props}/></label>;
}

export function VsnCheckbox({ label, checked, onChange, disabled = false }) {
  return <label className={`vsn-tool-checkbox ${disabled ? "is-disabled" : ""}`}><input type="checkbox" checked={checked} onChange={onChange} disabled={disabled}/><span className="vsn-tool-checkbox-box"/><span>{label}</span></label>;
}

export function VsnTabs({ items, value, onChange, ariaLabel = "Section navigation" }) {
  return <div className="vsn-tool-tabs" role="tablist" aria-label={ariaLabel}>{items.map((item)=><button key={item.value} type="button" role="tab" aria-selected={value===item.value} className={value===item.value?"active":""} onClick={()=>onChange(item.value)}>{item.label}{item.count != null ? <span>{item.count}</span> : null}</button>)}</div>;
}

export function VsnNotice({ tone = "success", children, dismissible = true, onDismiss = null }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => { setVisible(true); }, [children, tone]);
  if (!visible) return null;
  const dismiss = () => { setVisible(false); onDismiss?.(); };
  return <div className={`vsn-tool-notice tone-${tone}`} role={tone === "critical" ? "alert" : "status"}>
    <div className="vsn-tool-notice-content">{children}</div>
    {dismissible ? <button type="button" className="vsn-tool-notice-dismiss" onClick={dismiss} aria-label="Dismiss message"><X size={15}/></button> : null}
  </div>;
}

export function VsnAnchoredPopover({ open, anchorRef, children, onClose, align = "end", minWidth = 190, maxWidth = 360, className = "", offset = 6 }) {
  const popupRef = useRef(null);
  const [position, setPosition] = useState({ left: 0, top: 0, width: minWidth, maxHeight: 320, ready: false });
  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;
    const update = () => {
      const anchor = anchorRef?.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const gap = 10;
      const desiredWidth = Math.min(maxWidth, Math.max(minWidth, rect.width));
      const roomBelow = window.innerHeight - rect.bottom - gap;
      const roomAbove = rect.top - gap;
      const estimatedHeight = Math.min(320, Math.max(150, Math.max(roomBelow, roomAbove)));
      const placeBelow = roomBelow >= 190 || roomBelow >= roomAbove;
      const top = placeBelow ? rect.bottom + offset : Math.max(gap, rect.top - estimatedHeight - offset);
      const rawLeft = align === "start" ? rect.left : rect.right - desiredWidth;
      const left = Math.max(gap, Math.min(rawLeft, window.innerWidth - desiredWidth - gap));
      setPosition({ left, top, width: desiredWidth, maxHeight: estimatedHeight, ready: true });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open, anchorRef, align, minWidth, maxWidth, offset]);
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const onPointer = (event) => {
      if (popupRef.current?.contains(event.target) || anchorRef?.current?.contains(event.target)) return;
      onClose?.();
    };
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer, true); document.removeEventListener("keydown", onKey); };
  }, [open, anchorRef, onClose]);
  if (!open || typeof document === "undefined") return null;
  const dark = document.documentElement?.dataset?.vsnTheme === "dark" || document.body?.classList?.contains("dark");
  return createPortal(<div ref={popupRef} className={`vsn-anchored-popover ${dark ? "is-dark" : ""} ${className}`} style={{ position:"fixed", left:position.left, top:position.top, width:position.width, maxHeight:position.maxHeight, visibility:position.ready?"visible":"hidden" }}>{children}</div>, document.body);
}

export function VsnFloatingSettingsButton({ open = false, onClick, label = "Settings", className = "" }) {
  return <button type="button" className={`vsn-floating-settings-button ${open ? "is-open" : ""} ${className}`} onClick={onClick} aria-expanded={open} aria-label={label}><Settings2 size={19}/><span className="vsn-ui-tooltip vsn-ui-tooltip--left" role="tooltip">{label}</span></button>;
}

export function VsnSettingsPopover({ open, title = "Settings", subtitle = "", children, footer = null, onClose, className = "", onReset = null, resetLabel = "Reset settings", resetDisabled = false }) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  const dark = document.documentElement?.dataset?.vsnTheme === "dark" || document.body?.classList?.contains("dark");
  const resolvedFooter = footer || (onReset ? <button type="button" className="vsn-settings-reset-action" onClick={onReset} disabled={resetDisabled}><RotateCcw size={14}/>{resetLabel}</button> : null);
  return createPortal(<section className={`vsn-settings-popover ${dark ? "is-dark" : ""} ${className}`} role="dialog" aria-label={title}>
    <div className="vsn-settings-popover-head"><div><strong>{title}</strong>{subtitle ? <small>{subtitle}</small> : null}</div><button type="button" onClick={onClose} aria-label={`Close ${title}`}><X size={17}/></button></div>
    <div className="vsn-settings-popover-body">{children}</div>
    {resolvedFooter ? <div className="vsn-settings-popover-foot is-single-action">{resolvedFooter}</div> : null}
  </section>, document.body);
}

export function VsnEmpty({ title = "Nothing here yet", description = "", action = null }) {
  return <div className="vsn-tool-empty"><div className="vsn-tool-empty-mark">VSN</div><strong>{title}</strong>{description ? <p>{description}</p> : null}{action}</div>;
}

export function VsnSpinner({ label = "Loading" }) {
  return <span className="vsn-tool-spinner" role="status"><Loader2 size={16}/><span>{label}</span></span>;
}

export function VsnFileButton({ children = "Choose file", accept, onChange, disabled = false, variant = "secondary", multiple = false }) {
  const handleChange = async (event) => {
    try { await onChange?.(event); } catch (error) {
      console.error("VSN file picker handler failed:", error);
      window.dispatchEvent(new CustomEvent("vsn:file-picker-error", { detail: { message: error instanceof Error ? error.message : "The selected file could not be processed." } }));
    }
  };
  return <label className={`vsn-file-button ${disabled ? "is-disabled" : ""}`} aria-disabled={disabled || undefined}><span className={`vsn-file-button-inner variant-${variant}`}><UploadCloud size={15}/>{children}</span><input type="file" accept={accept} onChange={handleChange} disabled={disabled} multiple={multiple}/></label>;
}

export function VsnModal({ open, title, subtitle = "", children, footer = null, onClose, size = "md", danger = false }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => closeRef.current?.focus?.(), 0);
    return () => { document.removeEventListener("keydown", onKey); window.clearTimeout(timer); previous?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="vsn-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose?.();}}>
    <section className={`vsn-modal vsn-modal--${size} ${danger?"is-danger":""}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="vsn-modal-head"><div>{danger?<span className="vsn-modal-danger-mark"><AlertTriangle size={17}/></span>:null}<div><h2>{title}</h2>{subtitle?<p>{subtitle}</p>:null}</div></div><button ref={closeRef} type="button" className="vsn-modal-close" onClick={onClose} aria-label="Close"><X size={18}/></button></header>
      <div className="vsn-modal-body">{children}</div>
      {footer?<footer className="vsn-modal-footer">{footer}</footer>:null}
    </section>
  </div>;
}

const HTML_SUGGESTIONS = [
  ["svg", "<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\">\n  \n</svg>"],
  ["path", "<path d=\"\" />"], ["circle", "<circle cx=\"12\" cy=\"12\" r=\"10\" />"],
  ["rect", "<rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"2\" />"],
  ["g", "<g>\n  \n</g>"], ["defs", "<defs>\n  \n</defs>"], ["linearGradient", "<linearGradient id=\"gradient\">\n  \n</linearGradient>"],
  ["fill", "fill=\"currentColor\""], ["stroke", "stroke=\"currentColor\""], ["viewBox", "viewBox=\"0 0 24 24\""],
  ["class", "class=\"\""], ["style", "style=\"\""],
];
const CSS_SUGGESTIONS = [
  ["fill", "fill: currentColor;"], ["stroke", "stroke: currentColor;"], ["opacity", "opacity: 1;"], ["transform", "transform: translate(0, 0);"],
  ["transform-origin", "transform-origin: center;"], ["transition", "transition: all .2s ease;"], ["color", "color: #111827;"],
];
const GRAPHQL_SUGGESTIONS = [
  ["query", "query QueryName {\n  shop {\n    name\n  }\n}"],
  ["mutation", "mutation MutationName {\n  \n}"],
  ["products", "products(first: 10) {\n  nodes { id title handle }\n}"],
  ["collections", "collections(first: 10) {\n  nodes { id title handle }\n}"],
  ["currentAppInstallation", "currentAppInstallation {\n  accessScopes { handle }\n}"],
  ["pageInfo", "pageInfo { hasNextPage endCursor }"],
];
const JSON_SUGGESTIONS = [["object", "{\n  \n}"], ["array", "[\n  \n]"]];
const JS_SUGGESTIONS = [
  ["DOMContentLoaded", "document.addEventListener('DOMContentLoaded', () => {\n  \n});"],
  ["querySelector", "document.querySelector('')"],
  ["querySelectorAll", "document.querySelectorAll('')"],
  ["event listener", "element.addEventListener('click', (event) => {\n  \n});"],
  ["fetch", "fetch('', { method: 'GET' }).then((response) => response.json())"],
];

function suggestionSource(language) {
  const normalized=String(language||'').toLowerCase();
  if(normalized === "css") return CSS_SUGGESTIONS;
  if(normalized === "graphql" || normalized === "gql") return GRAPHQL_SUGGESTIONS;
  if(normalized === "json") return JSON_SUGGESTIONS;
  if(normalized === "js" || normalized === "javascript") return JS_SUGGESTIONS;
  return HTML_SUGGESTIONS;
}


function VsnCodeSuggestionPortal({ open, anchorRef, children, onClose }) {
  const popupRef = useRef(null);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 320, maxHeight: 260, ready: false });
  const update = () => {
    if (!open || typeof window === "undefined" || !anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const viewportGap = 10;
    const availableBelow = window.innerHeight - rect.bottom - viewportGap;
    const availableAbove = rect.top - viewportGap;
    const maxHeight = Math.max(140, Math.min(320, Math.max(availableBelow, availableAbove)));
    const desiredTop = availableBelow >= 180 ? rect.bottom + 6 : Math.max(viewportGap, rect.top - Math.min(maxHeight, 260) - 6);
    setPosition({ left: Math.max(viewportGap, Math.min(rect.left, window.innerWidth - rect.width - viewportGap)), top: desiredTop, width: Math.max(260, Math.min(rect.width, window.innerWidth - viewportGap * 2)), maxHeight, ready: true });
  };
  useEffect(() => { if (!open) return undefined; update(); const handler = () => update(); window.addEventListener("resize", handler); window.addEventListener("scroll", handler, true); return () => { window.removeEventListener("resize", handler); window.removeEventListener("scroll", handler, true); }; }, [open]);
  useEffect(() => { if (!open || typeof document === "undefined") return undefined; const outside = (event) => { if (popupRef.current?.contains(event.target) || anchorRef?.current?.contains(event.target)) return; onClose?.(); }; document.addEventListener("pointerdown", outside, true); return () => document.removeEventListener("pointerdown", outside, true); }, [open, anchorRef, onClose]);
  if (!open || typeof document === "undefined") return null;
  const dark = Boolean(document.querySelector(".dashboard-root.dark"));
  return createPortal(<div ref={popupRef} className={`vsn-code-suggestions vsn-code-suggestions--portal ${dark ? "is-dark" : ""}`} style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight, visibility: position.ready ? "visible" : "hidden" }}>{children}</div>, document.body);
}
export function VsnCodeEditor({ label = "Code", value = "", onChange, language = "html", rows = 18, help = "Ctrl/Cmd + Space opens suggestions.", readOnly = false }) {
  const inputRef = useRef(null);
  const shellRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [filter, setFilter] = useState("");
  const suggestions = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const source = suggestionSource(language);
    return (query ? source.filter(([label, insert]) => `${label} ${insert}`.toLowerCase().includes(query)) : source).slice(0, 10);
  }, [filter, language]);

  const openSuggestions = () => { if (readOnly) return; setFilter(""); setActive(0); setOpen(true); };
  const insertSuggestion = (insert) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    const next = `${value.slice(0,start)}${insert}${value.slice(end)}`;
    onChange?.(next);
    setOpen(false);
    requestAnimationFrame(() => { input.focus(); const cursor = start + insert.length; input.setSelectionRange(cursor, cursor); });
  };
  const onKeyDown = (event) => {
    if (readOnly) return;
    if ((event.ctrlKey || event.metaKey) && event.code === "Space") { event.preventDefault(); openSuggestions(); return; }
    if (open && event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
    if (open && event.key === "ArrowDown") { event.preventDefault(); setActive((active+1)%Math.max(1,suggestions.length)); return; }
    if (open && event.key === "ArrowUp") { event.preventDefault(); setActive((active-1+Math.max(1,suggestions.length))%Math.max(1,suggestions.length)); return; }
    if (open && event.key === "Enter" && suggestions[active]) { event.preventDefault(); insertSuggestion(suggestions[active][1]); }
  };
  return <label className="vsn-code-editor-field">
    <span className="vsn-code-editor-label"><b>{label}</b><small>{language.toUpperCase()} · {help}</small></span>
    <div ref={shellRef} className="vsn-code-editor-shell">
      <div className="vsn-code-editor-toolbar"><span>{language.toUpperCase()}</span>{readOnly?<span>Read only</span>:<button type="button" onClick={openSuggestions}>Suggestions</button>}</div>
      <textarea ref={inputRef} rows={rows} spellCheck={false} value={value} readOnly={readOnly} onChange={(event)=>{onChange?.(event.target.value); if(open)setFilter(event.target.value.slice(Math.max(0,(event.target.selectionStart||0)-24),event.target.selectionStart||0).split(/[\s<>{}=;:"']/).pop()||"");}} onKeyDown={onKeyDown}/>
      <VsnCodeSuggestionPortal open={open} anchorRef={shellRef} onClose={()=>setOpen(false)}><div role="listbox">{suggestions.map(([name,insert],index)=><button type="button" key={`${name}-${insert}`} className={active===index?"is-active":""} onMouseDown={(event)=>event.preventDefault()} onClick={()=>insertSuggestion(insert)}><strong>{name}</strong><code>{insert}</code></button>)}{!suggestions.length?<div className="vsn-code-suggestions-empty">No matching suggestions</div>:null}</div></VsnCodeSuggestionPortal>
    </div>
  </label>;
}
