import { Children, Fragment, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SEARCH_THRESHOLD = 7;
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function textOf(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf(node.props.children);
  return "";
}

// Flattens <option>/<optgroup> children (including fragments and arrays).
function readOptions(children, group = "") {
  const out = [];
  Children.toArray(children).forEach((child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) { out.push(...readOptions(child.props.children, group)); return; }
    if (child.type === "optgroup") { out.push(...readOptions(child.props.children, child.props.label || group)); return; }
    if (child.type === "option" || child.props?.value !== undefined) {
      const label = textOf(child.props.children) || String(child.props.value ?? "");
      out.push({ value: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled), group });
    }
  });
  return out;
}

/**
 * Drop-in replacement for <select>: same value/onChange contract
 * (onChange receives an event-like object with target/currentTarget.value),
 * plus a search box when the list is long. Renders its list in a portal so
 * panels with overflow never clip it.
 */
export default function SearchableSelect({ value, defaultValue, onChange, children, disabled = false, className = "", name, id, "aria-label": ariaLabel, placeholder = "Select…", triggerClassName = "" }) {
  const options = useMemo(() => readOptions(children), [children]);
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = String(value ?? inner ?? "");
  const selected = options.find((option) => option.value === current);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const searchable = options.length >= SEARCH_THRESHOLD;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((option) => `${option.label} ${option.group}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const place = () => { const box = triggerRef.current?.getBoundingClientRect(); if (box) setRect({ left: box.left, top: box.bottom + 4, width: box.width, above: window.innerHeight - box.bottom < 260 && box.top > 260, bottom: window.innerHeight - box.top + 4 }); };
  useIsoLayoutEffect(() => { if (open) place(); }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!triggerRef.current?.contains(event.target) && !listRef.current?.contains(event.target)) setOpen(false); };
    const reposition = () => place();
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    setActive(Math.max(0, filtered.findIndex((option) => option.value === current)));
    requestAnimationFrame(() => (searchable ? searchRef.current : listRef.current?.querySelector("button.is-selected, button"))?.focus?.());
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- set up once per open
  useEffect(() => { listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: "nearest" }); }, [active, open]);

  const choose = (option) => {
    if (!option || option.disabled) return;
    if (value === undefined) setInner(option.value);
    const target = { value: option.value, name };
    onChange?.({ target, currentTarget: target, preventDefault() {}, stopPropagation() {} });
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(filtered.length - 1, index + 1)); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(0, index - 1)); return; }
    if (event.key === "Enter") { event.preventDefault(); choose(filtered[active]); }
  };

  let lastGroup = null;
  return <>
    <button ref={triggerRef} type="button" id={id} name={name} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
      className={`vsn-sselect ${className} ${triggerClassName}`.trim()}
      onClick={() => setOpen((state) => !state)}
      onKeyDown={(event) => { if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); setOpen(true); } }}>
      <span className={`vsn-sselect__value${selected ? "" : " is-placeholder"}`}>{selected?.label ?? placeholder}</span>
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open && rect && typeof document !== "undefined" ? createPortal(
      <div ref={listRef} className="vsn-sselect-pop" role="presentation"
        style={{ left: rect.left, width: Math.max(rect.width, 200), ...(rect.above ? { bottom: rect.bottom } : { top: rect.top }) }}>
        {searchable ? <div className="vsn-sselect-pop__search"><svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} placeholder={`Search ${options.length} options`} aria-label="Search options" onKeyDown={onKeyDown} /></div> : null}
        <div className="vsn-sselect-pop__list" role="listbox">
          {filtered.map((option, index) => {
            const heading = option.group && option.group !== lastGroup ? option.group : null;
            lastGroup = option.group;
            return <Fragment key={`${option.group}-${option.value}-${index}`}>
              {heading ? <div className="vsn-sselect-pop__group">{heading}</div> : null}
              <button type="button" role="option" aria-selected={option.value === current} data-active={index === active} disabled={option.disabled}
                className={`${option.value === current ? "is-selected" : ""}${index === active ? " is-active" : ""}`}
                onMouseEnter={() => setActive(index)} onKeyDown={onKeyDown} onClick={() => choose(option)}>{option.label}</button>
            </Fragment>;
          })}
          {!filtered.length ? <div className="vsn-sselect-pop__empty">No match for “{query}”</div> : null}
        </div>
      </div>, document.body) : null}
  </>;
}
