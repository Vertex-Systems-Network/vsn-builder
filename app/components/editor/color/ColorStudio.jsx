import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { VsnButton, VsnTextField } from "../EditorUi";
import { normalizeColorCapabilities, resolveColorMode } from "../../../builder/controlSchema";

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
function hexToRgb(hex) { let h = String(hex || "").trim().replace("#", ""); if (h.length === 3) h = h.split("").map((x) => x + x).join(""); if (!/^[0-9a-f]{6}$/i.test(h)) return { r: 0, g: 0, b: 0 }; return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }; }
function rgbToHex(r, g, b) { return `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("")}`; }
function rgbToHsv({ r, g, b }) { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; let h = 0; if (d) { if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return { h, s: max ? d / max * 100 : 0, v: max * 100 }; }
function hsvToRgb(h, s, v) { s /= 100; v /= 100; const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c; let q = [0, 0, 0]; if (h < 60) q = [c, x, 0]; else if (h < 120) q = [x, c, 0]; else if (h < 180) q = [0, c, x]; else if (h < 240) q = [0, x, c]; else if (h < 300) q = [x, 0, c]; else q = [c, 0, x]; return { r: (q[0] + m) * 255, g: (q[1] + m) * 255, b: (q[2] + m) * 255 }; }
function normalizeHex(value) { const rgb = hexToRgb(value); return rgbToHex(rgb.r, rgb.g, rgb.b); }
function stopCss(stop) { const a = clamp(Number(stop.opacity ?? 1), 0, 1); const { r, g, b } = hexToRgb(stop.color); return a < 1 ? `rgba(${r},${g},${b},${a})` : normalizeHex(stop.color); }
export function gradientToCss(value = {}) { if ((value?.type || "color") === "color") return value?.color || "#ffffff"; const stops = Array.isArray(value?.stops) && value.stops.length ? value.stops : [{ color: value?.from || "#ffffff", position: 0, opacity: 1 }, { color: value?.to || "#000000", position: 100, opacity: 1 }]; const body = stops.slice().sort((a, b) => a.position - b.position).map((s) => `${stopCss(s)} ${clamp(Number(s.position || 0), 0, 100)}%`).join(", "); return value.gradientType === "radial" ? `radial-gradient(circle at center, ${body})` : `linear-gradient(${Number(value.angle ?? 135)}deg, ${body})`; }

function ColorPlane({ color, onChange }) { const hsv = useMemo(() => rgbToHsv(hexToRgb(color)), [color]); const ref = useRef(null); const update = (event) => { const box = ref.current?.getBoundingClientRect(); if (!box) return; const p = event.touches?.[0] || event; const s = clamp((p.clientX - box.left) / box.width * 100, 0, 100); const v = clamp(100 - (p.clientY - box.top) / box.height * 100, 0, 100); const rgb = hsvToRgb(hsv.h, s, v); onChange(rgbToHex(rgb.r, rgb.g, rgb.b)); }; const start = (e) => { e.preventDefault(); update(e); const move = (x) => update(x); const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", end); }; return <><div ref={ref} className="vsn-color-plane" style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }} onPointerDown={start}><span className="vsn-color-plane-pointer" style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, background: color }} /></div><input className="vsn-hue-slider" type="range" min="0" max="360" value={Math.round(hsv.h)} onChange={(e) => { const rgb = hsvToRgb(Number(e.target.value), hsv.s, hsv.v); onChange(rgbToHex(rgb.r, rgb.g, rgb.b)); }} aria-label="Hue" /></>; }

export function VsnColorPicker({ value = "#000000", onChange, alpha = 1, onAlphaChange, compact = false }) { const color = normalizeHex(value); return <div className={`vsn-color-picker ${compact ? "is-compact" : ""}`}><ColorPlane color={color} onChange={onChange} /><div className="vsn-color-input-row"><span className="vsn-color-swatch" style={{ background: color }} /><VsnTextField label="HEX" value={color.toUpperCase()} onInput={(e) => { const v = e.currentTarget.value; if (/^#?[0-9a-f]{6}$/i.test(v)) onChange(normalizeHex(v)); }} /><label className="vsn-alpha-field"><span>Opacity</span><input type="number" min="0" max="100" value={Math.round(clamp(alpha, 0, 1) * 100)} onChange={(e) => onAlphaChange?.(clamp(Number(e.target.value) / 100, 0, 1))} /><b>%</b></label></div></div>; }

export default function ColorStudio({
  value = {},
  onChange,
  solidOnly = false,
  gradientOnly = false,
  capabilities,
}) {
  const colorCapabilities = normalizeColorCapabilities(capabilities, { solidOnly, gradientOnly });
  const type = resolveColorMode(value, colorCapabilities);
  const seedColor = value?.color || value?.from || "#ffffff";
  const stops = Array.isArray(value?.stops) && value.stops.length
    ? value.stops
    : [{ id: "a", color: value?.from || seedColor, position: 0, opacity: 1 }, { id: "b", color: value?.to || "#000000", position: 100, opacity: 1 }];
  const [selected, setSelected] = useState(0);
  useEffect(() => { if (selected >= stops.length) setSelected(Math.max(0, stops.length - 1)); }, [stops.length, selected]);

  const patch = (next) => onChange?.({ ...value, ...next });
  const setType = (nextType) => {
    if (nextType === "color" && !colorCapabilities.solid) return;
    if (nextType === "gradient" && !colorCapabilities.gradient) return;
    patch(nextType === "gradient"
      ? { type: "gradient", gradientType: value.gradientType || "linear", stops, from: stops[0]?.color, to: stops[stops.length - 1]?.color }
      : { type: "color", color: value.color || stops[0]?.color || "#ffffff" });
  };
  const updateStop = (index, next) => { const list = stops.map((s, i) => i === index ? { ...s, ...next } : s); patch({ type: "gradient", stops: list, from: list[0]?.color, to: list[list.length - 1]?.color }); };
  const addStop = () => { const list = [...stops, { id: `stop-${Date.now()}`, color: "#95bf47", position: 50, opacity: 1 }].sort((a, b) => a.position - b.position); patch({ type: "gradient", stops: list }); setSelected(list.findIndex((x) => x.id?.startsWith("stop-"))); };
  const removeStop = () => { if (stops.length <= 2) return; patch({ type: "gradient", stops: stops.filter((_, i) => i !== selected) }); setSelected(0); };
  const normalizedValue = type === "gradient" ? { ...value, type: "gradient", stops, from: stops[0]?.color, to: stops[stops.length - 1]?.color } : { ...value, type: "color" };
  const preview = gradientToCss(normalizedValue);
  const showModeTabs = colorCapabilities.solid && colorCapabilities.gradient;

  return <div className="vsn-color-studio">
    {showModeTabs ? <div className="vsn-color-type-tabs"><button className={type === "color" ? "active" : ""} onClick={() => setType("color")} type="button">Solid</button><button className={type === "gradient" ? "active" : ""} onClick={() => setType("gradient")} type="button">Gradient</button></div> : null}
    <div className="vsn-color-preview" style={{ background: preview }} />
    {type === "color"
      ? <VsnColorPicker value={value.color || seedColor} alpha={value.opacity ?? 1} onChange={(color) => patch({ type: "color", color })} onAlphaChange={(opacity) => patch({ type: "color", opacity })} />
      : <div className="vsn-gradient-editor"><div className="vsn-gradient-toolbar"><div className="vsn-color-type-tabs is-small"><button className={(value.gradientType || "linear") === "linear" ? "active" : ""} onClick={() => patch({ type: "gradient", gradientType: "linear", stops })} type="button">Linear</button><button className={value.gradientType === "radial" ? "active" : ""} onClick={() => patch({ type: "gradient", gradientType: "radial", stops })} type="button">Radial</button></div><div className="vsn-gradient-actions"><VsnButton variant="icon" size="sm" title="Add stop" onClick={addStop}><Plus size={15} /></VsnButton><VsnButton variant="icon" size="sm" tone="critical" title="Delete stop" disabled={stops.length <= 2} onClick={removeStop}><Trash2 size={15} /></VsnButton></div></div>{(value.gradientType || "linear") === "linear" ? <label className="vsn-gradient-angle"><span>Angle</span><input type="range" min="0" max="360" value={Number(value.angle ?? 135)} onChange={(e) => patch({ type: "gradient", angle: Number(e.target.value), stops })} /><b>{Number(value.angle ?? 135)}°</b></label> : null}<div className="vsn-gradient-track" style={{ background: gradientToCss({ ...value, type: "gradient", stops }) }}>{stops.map((stop, index) => <button key={stop.id || index} type="button" className={`vsn-gradient-stop ${selected === index ? "active" : ""}`} style={{ left: `${stop.position}%`, background: stop.color }} onClick={() => setSelected(index)} aria-label={`Gradient stop ${index + 1}`} />)}</div><label className="vsn-gradient-position"><span>Stop position</span><input type="range" min="0" max="100" value={stops[selected]?.position ?? 0} onChange={(e) => updateStop(selected, { position: Number(e.target.value) })} /><b>{stops[selected]?.position ?? 0}%</b></label><VsnColorPicker value={stops[selected]?.color || "#ffffff"} alpha={stops[selected]?.opacity ?? 1} onChange={(color) => updateStop(selected, { color })} onAlphaChange={(opacity) => updateStop(selected, { opacity })} /></div>}
  </div>;
}
