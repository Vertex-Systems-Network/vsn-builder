import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// VSN date / time / date-time pickers used everywhere instead of the browser's
// native inputs. Values keep the native formats: "YYYY-MM-DD", "HH:MM",
// "YYYY-MM-DDTHH:MM", so stored data and server parsing are unchanged.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const pad = (n) => String(n).padStart(2, "0");
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parseDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) } : null;
}
function parseTime(value) {
  const match = String(value || "").match(/(?:T|^)(\d{2}):(\d{2})/);
  return match ? { h: Number(match[1]), min: Number(match[2]) } : null;
}
const fmtDate = ({ y, m, d }) => `${y}-${pad(m + 1)}-${pad(d)}`;
const fmtTime = ({ h, min }) => `${pad(h)}:${pad(min)}`;
const human = (date, time) => [date ? `${MONTHS[date.m].slice(0, 3)} ${date.d}, ${date.y}` : "", time ? `${pad(time.h % 12 || 12)}:${pad(time.min)} ${time.h < 12 ? "AM" : "PM"}` : ""].filter(Boolean).join(" · ");

function event(value) { const target = { value }; return { target, currentTarget: target }; }

function usePopover() {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const place = () => { const box = triggerRef.current?.getBoundingClientRect(); if (box) setRect({ left: Math.min(box.left, window.innerWidth - 300), top: box.bottom + 4, above: window.innerHeight - box.bottom < 340 && box.top > 340, bottom: window.innerHeight - box.top + 4 }); };
  useIsoLayoutEffect(() => { if (open) place(); }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!triggerRef.current?.contains(e.target) && !popRef.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", key);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  return { open, setOpen, rect, triggerRef, popRef };
}

function Calendar({ value, onPick, min, max }) {
  const today = new Date();
  const [view, setView] = useState(() => value ? { y: value.y, m: value.m } : { y: today.getFullYear(), m: today.getMonth() });
  const days = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(view.y, view.m + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [view]);
  const shift = (delta) => setView(({ y, m }) => { const next = new Date(y, m + delta, 1); return { y: next.getFullYear(), m: next.getMonth() }; });
  const isDisabled = (d) => { const iso = fmtDate({ y: view.y, m: view.m, d }); return (min && iso < String(min).slice(0, 10)) || (max && iso > String(max).slice(0, 10)); };
  return <div className="vsn-cal">
    <div className="vsn-cal__head">
      <button type="button" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
      <strong>{MONTHS[view.m]} {view.y}</strong>
      <button type="button" aria-label="Next month" onClick={() => shift(1)}>›</button>
    </div>
    <div className="vsn-cal__grid">
      {WEEKDAYS.map((day) => <span key={day} className="vsn-cal__dow">{day}</span>)}
      {days.map((d, i) => d ? <button key={i} type="button" disabled={isDisabled(d)}
        className={`${value && value.y === view.y && value.m === view.m && value.d === d ? "is-selected" : ""}${today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === d ? " is-today" : ""}`}
        onClick={() => onPick({ y: view.y, m: view.m, d })}>{d}</button> : <span key={i} />)}
    </div>
    <div className="vsn-cal__foot"><button type="button" onClick={() => onPick({ y: today.getFullYear(), m: today.getMonth(), d: today.getDate() })}>Today</button></div>
  </div>;
}

function TimeFields({ value, onChange }) {
  const time = value || { h: 9, min: 0 };
  const hour12 = time.h % 12 || 12;
  const set = (patch) => onChange({ ...time, ...patch });
  return <div className="vsn-timefields">
    <select aria-label="Hour" value={hour12} onChange={(e) => set({ h: (Number(e.target.value) % 12) + (time.h >= 12 ? 12 : 0) })}>{Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{pad(h)}</option>)}</select>
    <span>:</span>
    <select aria-label="Minute" value={time.min - (time.min % 5)} onChange={(e) => set({ min: Number(e.target.value) })}>{Array.from({ length: 12 }, (_, i) => i * 5).map((m) => <option key={m} value={m}>{pad(m)}</option>)}</select>
    <div className="vsn-segmented" role="radiogroup" aria-label="AM or PM">
      <button type="button" role="radio" aria-checked={time.h < 12} className={time.h < 12 ? "is-active" : ""} onClick={() => time.h >= 12 && set({ h: time.h - 12 })}>AM</button>
      <button type="button" role="radio" aria-checked={time.h >= 12} className={time.h >= 12 ? "is-active" : ""} onClick={() => time.h < 12 && set({ h: time.h + 12 })}>PM</button>
    </div>
  </div>;
}

/** mode: "date" | "time" | "datetime" */
export default function VsnDateTimePicker({ mode = "date", value = "", onChange, onInput, disabled = false, placeholder, min, max, className = "", "aria-label": ariaLabel, id, name }) {
  const { open, setOpen, rect, triggerRef, popRef } = usePopover();
  const date = mode === "time" ? null : parseDate(value);
  const time = mode === "date" ? null : parseTime(value);
  const emit = (next) => { onChange?.(event(next)); onInput?.(event(next)); };
  const pickDate = (d) => { if (mode === "date") { emit(fmtDate(d)); setOpen(false); } else emit(`${fmtDate(d)}T${fmtTime(time || { h: 9, min: 0 })}`); };
  const pickTime = (t) => { if (mode === "time") emit(fmtTime(t)); else emit(`${fmtDate(date || (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() }; })())}T${fmtTime(t)}`); };
  const label = human(date, time) || placeholder || (mode === "time" ? "Select time" : mode === "datetime" ? "Select date & time" : "Select date");
  return <>
    <button ref={triggerRef} type="button" id={id} name={name} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel}
      className={`vsn-sselect vsn-dtp ${className}`.trim()} onClick={() => setOpen((s) => !s)}>
      <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">{mode === "time" ? <><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10 6v4l3 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></> : <><rect x="3" y="4.5" width="14" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M3 8.5h14M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>}</svg>
      <span className={`vsn-sselect__value${value ? "" : " is-placeholder"}`}>{label}</span>
      {value && !disabled ? <span role="button" tabIndex={0} aria-label="Clear" className="vsn-dtp__clear" onClick={(e) => { e.stopPropagation(); emit(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); emit(""); } }}>×</span> : null}
    </button>
    {open && rect && typeof document !== "undefined" ? createPortal(<div ref={popRef} className="vsn-sselect-pop vsn-dtp-pop" style={{ left: rect.left, ...(rect.above ? { bottom: rect.bottom } : { top: rect.top }) }}>
      {mode !== "time" ? <Calendar value={date} min={min} max={max} onPick={pickDate} /> : null}
      {mode !== "date" ? <TimeFields value={time} onChange={pickTime} /> : null}
      {mode !== "date" ? <div className="vsn-cal__foot"><button type="button" onClick={() => setOpen(false)}>Done</button></div> : null}
    </div>, document.body) : null}
  </>;
}
