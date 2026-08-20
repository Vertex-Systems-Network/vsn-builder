import { VsnButton, VsnTextField, VsnNumberField, VsnTextArea, VsnSelect, VsnOption, VsnCheckbox, VsnSearchField, VsnUrlField, VsnDateField, VsnSpinner, VsnUnitField } from "./EditorUi";
import ColorStudio, { gradientToCss } from "./color/ColorStudio";
import FontFamilyControl from "./fonts/FontFamilyControl";
import { useEffect, useMemo, useRef, useState } from "react";
import PolarisIcon from "../ui/PolarisIcon";
import { AnchoredOverlay, ModalPortal } from "./OverlayManager";
import { normalizeColorCapabilities, normalizeControlOptions, resolveColorMode } from "../../builder/controlSchema";
import EditorSuggestionMenu from "./EditorSuggestionMenu";

const fieldClass = "w-full rounded-lg border border-[#d9d9d9] bg-white px-2.5 py-2 text-xs text-[#202223] outline-none transition focus:border-[#95BF47] focus:ring-2 focus:ring-[#95BF47]/15";

const CSS_LENGTH_UNITS = [
  "px", "%", "em", "rem", "vw", "vh", "vmin", "vmax",
  "vi", "vb", "svw", "svh", "svi", "svb", "lvw", "lvh", "lvi", "lvb", "dvw", "dvh", "dvi", "dvb",
  "ch", "ex", "cap", "ic", "lh", "rlh",
  "cqw", "cqh", "cqi", "cqb", "cqmin", "cqmax",
  "cm", "mm", "Q", "in", "pt", "pc",
];
const CSS_LENGTH_KEYWORDS = new Set(["auto", "none", "normal", "fit-content", "min-content", "max-content", "content"]);
const CSS_LENGTH_UNIT_PATTERN = new RegExp(`^(-?(?:\\d+\\.?\\d*|\\.\\d+))(${CSS_LENGTH_UNITS.map((unit) => unit.replace("%", "\\%")).sort((a,b)=>b.length-a.length).join("|")})$`, "i");

function normalizeLengthUnit(unit, fallback = "px") {
  if (!unit) return fallback;
  const exact = CSS_LENGTH_UNITS.find((item) => item.toLowerCase() === String(unit).toLowerCase());
  return exact || String(unit);
}
function detectLengthUnit(value, fallback = "px") {
  if (value === null || value === undefined || value === "") return fallback;
  const text = String(value).trim();
  if (!text) return fallback;
  if (CSS_LENGTH_KEYWORDS.has(text)) return text;
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) return fallback;
  const match = text.match(CSS_LENGTH_UNIT_PATTERN);
  if (match) return normalizeLengthUnit(match[2], fallback);
  return "css";
}
function lengthInputValue(value, unit, fallback = "px") {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value).trim();
  if (!text) return "";
  if (unit === "css") return text;
  if (CSS_LENGTH_KEYWORDS.has(unit)) return "";
  const match = text.match(CSS_LENGTH_UNIT_PATTERN);
  if (match) return match[1];
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) return text;
  const numeric = Number.parseFloat(text);
  return Number.isFinite(numeric) ? String(numeric) : "";
}
function composeLengthValue(raw, unit, fallback = "px") {
  const normalizedUnit = unit || fallback;
  if (CSS_LENGTH_KEYWORDS.has(normalizedUnit)) return normalizedUnit;
  const text = String(raw ?? "").trim();
  if (!text) return "";
  if (normalizedUnit === "css") return text;
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) return `${text}${normalizeLengthUnit(normalizedUnit, fallback)}`;
  // If a complete CSS value was pasted, preserve it instead of corrupting it.
  if (CSS_LENGTH_KEYWORDS.has(text) || CSS_LENGTH_UNIT_PATTERN.test(text) || /^(?:calc|min|max|clamp|var)\(/i.test(text)) return text;
  return `${text}${normalizeLengthUnit(normalizedUnit, fallback)}`;
}

export function CssLengthControl({ label, value = "", onChange, defaultUnit = "px", keywords = [], placeholder = "0" }) {
  const allowedKeywords = keywords.filter((item) => CSS_LENGTH_KEYWORDS.has(item));
  const detected = detectLengthUnit(value, defaultUnit);
  const [unit, setUnit] = useState(detected);
  useEffect(() => {
    const next = detectLengthUnit(value, defaultUnit);
    if (next !== unit && (value === "" || CSS_LENGTH_KEYWORDS.has(next) || next === "css" || CSS_LENGTH_UNITS.includes(next))) setUnit(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, defaultUnit]);
  const keywordMode = CSS_LENGTH_KEYWORDS.has(unit);
  const changeUnit = (nextUnit) => {
    setUnit(nextUnit);
    if (CSS_LENGTH_KEYWORDS.has(nextUnit)) { onChange?.(nextUnit); return; }
    const current = lengthInputValue(value, unit, defaultUnit);
    if (current !== "") onChange?.(composeLengthValue(current, nextUnit, defaultUnit));
    else if (CSS_LENGTH_KEYWORDS.has(String(value || ""))) onChange?.("");
  };
  return <div className="vsn-css-length-control">
    {label ? <FieldLabel>{label}</FieldLabel> : null}
    <div className="vsn-css-length-row">
      <input
        type="text"
        inputMode={unit === "css" ? undefined : "decimal"}
        className="vsn-ui-input"
        value={keywordMode ? "" : lengthInputValue(value, unit, defaultUnit)}
        placeholder={keywordMode ? unit : placeholder}
        disabled={keywordMode}
        onInput={(event) => onChange?.(composeLengthValue(event.currentTarget.value, unit, defaultUnit))}
        aria-label={label || "CSS length"}
      />
      <select className="vsn-css-unit-select" value={unit} onChange={(event) => changeUnit(event.currentTarget.value)} aria-label={`${label || "Length"} unit`}>
        {CSS_LENGTH_UNITS.map((item) => <option key={item} value={item}>{item}</option>)}
        {allowedKeywords.length ? <optgroup label="Keywords">{allowedKeywords.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup> : null}
        <option value="css">CSS</option>
      </select>
    </div>
  </div>;
}

export function FieldLabel({ children, hint }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-[#4a4a4a]">{children}</span>
      {hint ? <span className="text-[10px] text-[#8c9196]">{hint}</span> : null}
    </div>
  );
}

export function TextControl({ label, value = "", onChange, placeholder = "" }) {
  return <VsnTextField label={label || "Text"} labelAccessibilityVisibility={label ? undefined : "exclusive"} value={value ?? ""} placeholder={placeholder} onInput={(event) => onChange?.(event.currentTarget.value || "")} />;
}

export function TextAreaControl({ label, value = "", onChange, placeholder = "", rows = 4 }) {
  return <VsnTextArea label={label || "Text"} labelAccessibilityVisibility={label ? undefined : "exclusive"} value={value ?? ""} placeholder={placeholder} rows={rows} onInput={(event) => onChange?.(event.currentTarget.value || "")} />;
}

export function NumberControl({ label, value = "", onChange, min, max, step = 1, unit = "", placeholder = "0" }) {
  if (unit) {
    return <VsnUnitField label={label || "Number"} value={String(value ?? "")} unit={unit} placeholder={placeholder} onInput={(event) => onChange?.(event.currentTarget.value ?? "")} />;
  }
  return <VsnNumberField label={label || "Number"} labelAccessibilityVisibility={label ? undefined : "exclusive"} value={String(value ?? "")} min={min} max={max} step={step} placeholder={placeholder} onInput={(event) => onChange?.(event.currentTarget.value ?? "")} />;
}

export function SliderControl({ label, value = 0, onChange, min = 0, max = 100, step = 1, suffix = "" }) {
  const number = Number.parseFloat(value);
  const safe = Number.isFinite(number) ? number : Number(min) || 0;
  return <div className="vsn-slider-control">{label ? <FieldLabel>{label}</FieldLabel> : null}<div className="vsn-slider-row"><input type="range" min={min} max={max} step={step} value={safe} onInput={(event) => onChange?.(event.currentTarget.value)} aria-label={label || "Value"}/><VsnUnitField value={String(safe)} unit={suffix || ""} onInput={(event) => onChange?.(event.currentTarget.value ?? "")} /></div></div>;
}

export function SelectControl({ label, value = "", onChange, options = [] }) {
  const normalized = normalizeControlOptions(options);
  return <VsnSelect label={label || "Select"} labelAccessibilityVisibility={label ? undefined : "exclusive"} value={value ?? ""} onChange={(event) => onChange?.(event.currentTarget.value || "")}>{normalized.map((option) => <VsnOption key={option.value} value={option.value}>{option.label}</VsnOption>)}</VsnSelect>;
}

export function MultiSelectControl({ label, value = [], onChange, options = [] }) {
  const normalized = normalizeControlOptions(options);
  const values = Array.isArray(value) ? value : [];
  const toggle = (itemValue, checked) => onChange?.(checked ? [...new Set([...values, itemValue])] : values.filter((item) => item !== itemValue));
  return (
    <div className="space-y-2">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      {normalized.map((option) => <VsnCheckbox key={option.value} checked={values.includes(option.value)} onChange={(event) => toggle(option.value, event.target.checked === true)}>{option.label}</VsnCheckbox>)}
    </div>
  );
}

export function CheckboxControl({ label, checked = false, onChange }) {
  return <VsnCheckbox checked={checked === true} onChange={(event) => onChange?.(event.target.checked === true)}>{label || "Enabled"}</VsnCheckbox>;
}

export function RadioControl({ label, value, onChange, options = [] }) {
  const normalized = normalizeControlOptions(options);
  return <VsnSelect label={label || "Select"} labelAccessibilityVisibility={label ? undefined : "exclusive"} value={value ?? ""} onChange={(event) => onChange?.(event.currentTarget.value || "")}>{normalized.map((option) => <VsnOption key={option.value} value={option.value}>{option.label}</VsnOption>)}</VsnSelect>;
}

export function ButtonSetControl({ label, value, onChange, options = [] }) {
  return (
    <div>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <div className="flex overflow-hidden rounded-lg border border-[#d9d9d9] bg-white">
        {normalizeControlOptions(options).map((item) => { const active = value === item.value; return <VsnButton type="button" variant="plain" size="sm" key={item.value} onClick={() => onChange?.(item.value)} className={`vsn-segment-button ${active ? "is-active" : ""}`}>{item.label}</VsnButton>; })}
      </div>
    </div>
  );
}

export function DimensionsControl({ label, values = {}, onChange, unit = "px" }) {
  const [linked, setLinked] = useState(false);
  const sides = ["top", "right", "bottom", "left"];
  const inferredUnit = useMemo(() => {
    for (const side of sides) {
      const value = values?.[side];
      if (value !== undefined && value !== null && value !== "") {
        const detected = detectLengthUnit(value, unit);
        return CSS_LENGTH_UNITS.includes(detected) ? detected : "css";
      }
    }
    return unit;
  }, [values?.top, values?.right, values?.bottom, values?.left, unit]);
  const [selectedUnit, setSelectedUnit] = useState(inferredUnit);
  useEffect(() => { setSelectedUnit(inferredUnit); }, [inferredUnit]);
  const change = (side, raw) => {
    const next = composeLengthValue(raw, selectedUnit, unit);
    if (linked) {
      onChange?.(Object.fromEntries(sides.map((key) => [key, next])));
    } else {
      onChange?.({ ...values, [side]: next });
    }
  };
  const changeUnit = (nextUnit) => {
    setSelectedUnit(nextUnit);
    const patch = { ...values };
    for (const side of sides) {
      const current = values?.[side];
      if (current === undefined || current === null || current === "") continue;
      const raw = lengthInputValue(current, detectLengthUnit(current, unit), unit);
      patch[side] = nextUnit === "css" ? String(current) : composeLengthValue(raw, nextUnit, unit);
    }
    onChange?.(patch);
  };
  return (
    <div className="vsn-dimensions-control">
      <div className="vsn-dimensions-head">
        <FieldLabel>{label}</FieldLabel>
        <div className="vsn-dimensions-actions">
          <select className="vsn-css-unit-select is-compact" value={selectedUnit} onChange={(event) => changeUnit(event.currentTarget.value)} aria-label={`${label} unit`}>
            {CSS_LENGTH_UNITS.map((item) => <option key={item} value={item}>{item}</option>)}
            <option value="css">CSS</option>
          </select>
          <VsnButton type="button" variant={linked ? "primary" : "tertiary"} size="sm" onClick={() => setLinked((v) => !v)} className="vsn-link-state">{linked ? "Linked" : "Unlinked"}</VsnButton>
        </div>
      </div>
      <div className="vsn-dimensions-grid">
        {sides.map((side) => <label key={side} className="vsn-dimension-cell">
          <span>{side[0].toUpperCase()}</span>
          <input
            type="text"
            inputMode={selectedUnit === "css" ? undefined : "decimal"}
            value={lengthInputValue(values?.[side] ?? "", selectedUnit, unit)}
            placeholder="0"
            onInput={(event) => change(side, event.currentTarget.value)}
            aria-label={`${label} ${side}`}
          />
        </label>)}
      </div>
      <div className="vsn-dimensions-unit-note">{selectedUnit === "css" ? "Custom CSS values allowed: auto, calc(), clamp(), var()…" : `Values are saved as ${selectedUnit}`}</div>
    </div>
  );
}



const COMMON_LENGTH_KEYWORDS = ["auto", "none", "fit-content", "min-content", "max-content"];
const BLEND_MODE_OPTIONS = [
  "normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn",
  "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity",
];
const CURSOR_OPTIONS = [
  { value: "", label: "Browser default" }, "auto", "default", "pointer", "text", "vertical-text", "move",
  "grab", "grabbing", "zoom-in", "zoom-out", "not-allowed", "wait", "progress", "help", "crosshair",
  "cell", "copy", "alias", "context-menu", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize",
  "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize",
  "nwse-resize", "none",
];

export function CssKeywordLengthControl({ keywords = COMMON_LENGTH_KEYWORDS, ...props }) {
  return <CssLengthControl {...props} keywords={keywords} />;
}

export function LinkedDimensionsControl(props) {
  return <DimensionsControl {...props} />;
}

export function BorderRadiusControl({ label = "Border radius", value = {}, onChange, defaultUnit = "px" }) {
  const current = typeof value === "string" || typeof value === "number" ? { all: String(value) } : (value || {});
  const individual = current.mode ? current.mode === "individual" : ["topLeft", "topRight", "bottomRight", "bottomLeft"].some((key) => current[key] !== undefined && current[key] !== "");
  const patch = (next) => onChange?.({ ...current, ...next });
  return <div className="vsn-structured-control">
    <ButtonSetControl label={label} value={individual ? "individual" : "all"} onChange={(mode) => patch({ mode })} options={[{value:"all",label:"Linked"},{value:"individual",label:"Per corner"}]} />
    {individual ? <div className="grid grid-cols-2 gap-2">
      <CssLengthControl label="Top left" value={current.topLeft ?? current.all ?? ""} defaultUnit={defaultUnit} onChange={(topLeft)=>patch({topLeft,mode:"individual"})}/>
      <CssLengthControl label="Top right" value={current.topRight ?? current.all ?? ""} defaultUnit={defaultUnit} onChange={(topRight)=>patch({topRight,mode:"individual"})}/>
      <CssLengthControl label="Bottom right" value={current.bottomRight ?? current.all ?? ""} defaultUnit={defaultUnit} onChange={(bottomRight)=>patch({bottomRight,mode:"individual"})}/>
      <CssLengthControl label="Bottom left" value={current.bottomLeft ?? current.all ?? ""} defaultUnit={defaultUnit} onChange={(bottomLeft)=>patch({bottomLeft,mode:"individual"})}/>
    </div> : <CssLengthControl label="Radius" value={current.all ?? ""} defaultUnit={defaultUnit} onChange={(all)=>patch({all,mode:"all"})}/>} 
  </div>;
}

export function AspectRatioControl({ label = "Aspect ratio", value = "", onChange }) {
  const presets = [
    { value: "", label: "Auto / default" },
    { value: "1 / 1", label: "Square · 1:1" },
    { value: "4 / 3", label: "Landscape · 4:3" },
    { value: "3 / 2", label: "Photo · 3:2" },
    { value: "16 / 9", label: "Widescreen · 16:9" },
    { value: "9 / 16", label: "Portrait · 9:16" },
    { value: "21 / 9", label: "Ultra wide · 21:9" },
  ];
  const isPreset = presets.some((item) => item.value === value);
  const [customMode, setCustomMode] = useState(!isPreset && value !== "");
  useEffect(() => { if (isPreset) setCustomMode(false); }, [isPreset, value]);
  return <div className="vsn-structured-control">
    <SelectControl label={label} value={customMode || !isPreset ? "__custom" : value} onChange={(next)=>{
      if (next === "__custom") { setCustomMode(true); return; }
      setCustomMode(false); onChange?.(next);
    }} options={[...presets,{value:"__custom",label:"Custom"}]} />
    {customMode || !isPreset ? <TextControl label="Custom ratio" value={value} placeholder="5 / 4 or 1.618" onChange={onChange}/> : null}
  </div>;
}

export function PositionControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  const positioned = (current.position || "static") !== "static";
  return <div className="vsn-structured-control space-y-2">
    <SelectControl label="Position" value={current.position || "static"} onChange={(position)=>patch({position})} options={[
      {value:"static",label:"Static"},{value:"relative",label:"Relative"},{value:"absolute",label:"Absolute"},
      {value:"fixed",label:"Fixed"},{value:"sticky",label:"Sticky"}
    ]}/>
    {positioned ? <div className="grid grid-cols-2 gap-2">
      {["top","right","bottom","left"].map((side)=><CssKeywordLengthControl key={side} label={side[0].toUpperCase()+side.slice(1)} value={current[side] || ""} defaultUnit="px" keywords={["auto"]} onChange={(next)=>patch({[side]:next})}/>) }
    </div> : null}
    <NumberControl label="Z-index" value={current.zIndex ?? ""} onChange={(zIndex)=>patch({zIndex})}/>
  </div>;
}

export function OverflowControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  const options = [{value:"",label:"Default"},"visible","hidden","clip","auto","scroll"];
  return <div className="vsn-structured-control">
    <div className="grid grid-cols-3 gap-2">
      <SelectControl label="Overflow" value={current.overflow || ""} onChange={(overflow)=>patch({overflow, overflowX:"", overflowY:""})} options={options}/>
      <SelectControl label="X axis" value={current.overflowX || ""} onChange={(overflowX)=>patch({overflowX})} options={[{value:"",label:"Use base"},...options.slice(1)]}/>
      <SelectControl label="Y axis" value={current.overflowY || ""} onChange={(overflowY)=>patch({overflowY})} options={[{value:"",label:"Use base"},...options.slice(1)]}/>
    </div>
  </div>;
}

export function FlexControl({ value = {}, onChange, showItem = true, showContainer = true }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  const item = [
    ["Grow", "flexGrow", "number"], ["Shrink", "flexShrink", "number"], ["Basis", "flexBasis", "length"], ["Order", "order", "number"],
  ];
  return <div className="vsn-structured-control space-y-3">
    {showItem ? <>
      <div className="vsn-control-subtitle">Flex item</div>
      <div className="grid grid-cols-2 gap-2">
        {item.map(([label,key,type]) => type === "length"
          ? <CssKeywordLengthControl key={key} label={label} value={current[key] ?? ""} defaultUnit="%" keywords={["auto","content","fit-content","min-content","max-content"]} onChange={(next)=>patch({[key]:next})}/>
          : <NumberControl key={key} label={label} value={current[key] ?? ""} step={key === "flexGrow" || key === "flexShrink" ? 0.1 : 1} onChange={(next)=>patch({[key]:next})}/>) }
        <SelectControl label="Align self" value={current.alignSelf || "auto"} onChange={(alignSelf)=>patch({alignSelf})} options={["auto","stretch","flex-start","center","flex-end","baseline","start","end"]}/>
      </div>
    </> : null}
    {showContainer ? <>
      <div className="vsn-control-subtitle">Flex container</div>
      <div className="grid grid-cols-2 gap-2">
        <SelectControl label="Direction" value={current.flexDirection || "row"} onChange={(flexDirection)=>patch({flexDirection})} options={["row","column","row-reverse","column-reverse"]}/>
        <SelectControl label="Wrap" value={current.flexWrap || "nowrap"} onChange={(flexWrap)=>patch({flexWrap})} options={["nowrap","wrap","wrap-reverse"]}/>
        <SelectControl label="Justify content" value={current.justifyContent || "flex-start"} onChange={(justifyContent)=>patch({justifyContent})} options={["normal","flex-start","center","flex-end","space-between","space-around","space-evenly","start","end"]}/>
        <SelectControl label="Align items" value={current.alignItems || "stretch"} onChange={(alignItems)=>patch({alignItems})} options={["normal","stretch","flex-start","center","flex-end","baseline","start","end"]}/>
        <SelectControl label="Align content" value={current.alignContent || "normal"} onChange={(alignContent)=>patch({alignContent})} options={["normal","stretch","flex-start","center","flex-end","space-between","space-around","space-evenly"]}/>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <CssLengthControl label="Gap" value={current.gap ?? ""} defaultUnit="px" onChange={(gap)=>patch({gap})}/>
        <CssLengthControl label="Row gap" value={current.rowGap ?? ""} defaultUnit="px" onChange={(rowGap)=>patch({rowGap})}/>
        <CssLengthControl label="Column gap" value={current.columnGap ?? ""} defaultUnit="px" onChange={(columnGap)=>patch({columnGap})}/>
      </div>
    </> : null}
  </div>;
}

export function GridLayoutControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  return <div className="vsn-structured-control space-y-3">
    <div className="vsn-control-subtitle">Grid tracks</div>
    <TextControl label="Columns" value={current.gridTemplateColumns || ""} placeholder="repeat(3, minmax(0, 1fr))" onChange={(gridTemplateColumns)=>patch({gridTemplateColumns})}/>
    <TextControl label="Rows" value={current.gridTemplateRows || ""} placeholder="auto / repeat(2, 1fr)" onChange={(gridTemplateRows)=>patch({gridTemplateRows})}/>
    <div className="grid grid-cols-2 gap-2">
      <SelectControl label="Auto flow" value={current.gridAutoFlow || "row"} onChange={(gridAutoFlow)=>patch({gridAutoFlow})} options={["row","column","row dense","column dense","dense"]}/>
      <TextControl label="Auto columns" value={current.gridAutoColumns || ""} placeholder="minmax(0, 1fr)" onChange={(gridAutoColumns)=>patch({gridAutoColumns})}/>
      <TextControl label="Auto rows" value={current.gridAutoRows || ""} placeholder="auto" onChange={(gridAutoRows)=>patch({gridAutoRows})}/>
      <SelectControl label="Justify items" value={current.justifyItems || "normal"} onChange={(justifyItems)=>patch({justifyItems})} options={["normal","stretch","start","center","end"]}/>
      <SelectControl label="Align items" value={current.alignItems || "normal"} onChange={(alignItems)=>patch({alignItems})} options={["normal","stretch","start","center","end","baseline"]}/>
      <SelectControl label="Justify content" value={current.justifyContent || "normal"} onChange={(justifyContent)=>patch({justifyContent})} options={["normal","start","center","end","space-between","space-around","space-evenly","stretch"]}/>
      <SelectControl label="Align content" value={current.alignContent || "normal"} onChange={(alignContent)=>patch({alignContent})} options={["normal","start","center","end","space-between","space-around","space-evenly","stretch"]}/>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <CssLengthControl label="Gap" value={current.gap ?? ""} defaultUnit="px" onChange={(gap)=>patch({gap})}/>
      <CssLengthControl label="Row gap" value={current.rowGap ?? ""} defaultUnit="px" onChange={(rowGap)=>patch({rowGap})}/>
      <CssLengthControl label="Column gap" value={current.columnGap ?? ""} defaultUnit="px" onChange={(columnGap)=>patch({columnGap})}/>
    </div>
  </div>;
}

export function ObjectControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  return <div className="vsn-structured-control space-y-2">
    <SelectControl label="Object fit" value={current.objectFit || "cover"} onChange={(objectFit)=>patch({objectFit})} options={["fill","contain","cover","none","scale-down"]}/>
    <TextControl label="Object position" value={current.objectPosition || "center center"} placeholder="center center / 50% 20%" onChange={(objectPosition)=>patch({objectPosition})}/>
  </div>;
}

export function TransformControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  const angle = (key, label) => <NumberControl label={label} value={String(current[key] ?? "").replace(/deg$/i,"")} unit="deg" onChange={(next)=>patch({[key]: next === "" ? "" : `${next}deg`})}/>;
  return <div className="vsn-structured-control space-y-3">
    <div className="grid grid-cols-2 gap-2">
      <CssLengthControl label="Translate X" value={current.translateX ?? ""} defaultUnit="px" onChange={(translateX)=>patch({translateX})}/>
      <CssLengthControl label="Translate Y" value={current.translateY ?? ""} defaultUnit="px" onChange={(translateY)=>patch({translateY})}/>
      <CssLengthControl label="Translate Z" value={current.translateZ ?? ""} defaultUnit="px" onChange={(translateZ)=>patch({translateZ})}/>
      <CssKeywordLengthControl label="Perspective" value={current.perspective ?? ""} defaultUnit="px" keywords={["none"]} onChange={(perspective)=>patch({perspective})}/>
    </div>
    <div className="grid grid-cols-3 gap-2">{angle("rotateX","Rotate X")}{angle("rotateY","Rotate Y")}{angle("rotateZ","Rotate Z")}</div>
    <div className="grid grid-cols-2 gap-2">
      <NumberControl label="Scale X" value={current.scaleX ?? ""} step={0.05} onChange={(scaleX)=>patch({scaleX})}/>
      <NumberControl label="Scale Y" value={current.scaleY ?? ""} step={0.05} onChange={(scaleY)=>patch({scaleY})}/>
      {angle("skewX","Skew X")}{angle("skewY","Skew Y")}
    </div>
    <div className="grid grid-cols-2 gap-2">
      <TextControl label="Transform origin" value={current.origin || ""} placeholder="50% 50%" onChange={(origin)=>patch({origin})}/>
      <TextControl label="Perspective origin" value={current.perspectiveOrigin || ""} placeholder="50% 50%" onChange={(perspectiveOrigin)=>patch({perspectiveOrigin})}/>
    </div>
  </div>;
}

function splitCssList(value) {
  const out = []; let depth = 0; let current = "";
  for (const char of String(value || "")) {
    if (char === "(") depth += 1;
    if (char === ")" && depth > 0) depth -= 1;
    if (char === "," && depth === 0) { if (current.trim()) out.push(current.trim()); current = ""; continue; }
    current += char;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function normalizeTransitionRows(value) {
  if (Array.isArray(value)) return value.length ? value : [{ property:"all", duration:"200ms", timingFunction:"ease", delay:"0ms" }];
  if (typeof value === "string" && value.trim()) {
    return splitCssList(value).map((chunk) => {
      const text = chunk.trim();
      const match = text.match(/^([^\s]+)\s+([^\s]+)\s+(.+?)(?:\s+([^\s]+))?$/);
      return match ? { property:match[1], duration:match[2], timingFunction:match[3], delay:match[4] || "0ms" } : { property:"all", duration:"200ms", timingFunction:"ease", delay:"0ms" };
    });
  }
  if (value && typeof value === "object") return [{ property:value.property || "all", duration:value.duration || "200ms", timingFunction:value.timingFunction || value.timing || "ease", delay:value.delay || "0ms" }];
  return [{ property:"all", duration:"200ms", timingFunction:"ease", delay:"0ms" }];
}

export function TransitionControl({ value, onChange }) {
  const rows = normalizeTransitionRows(value);
  const commit = (nextRows) => onChange?.(nextRows.length === 1 ? nextRows[0] : nextRows);
  const patchRow = (index, next) => commit(rows.map((row, i) => i === index ? { ...row, ...next, raw: undefined } : row));
  return <div className="vsn-structured-control space-y-2">
    {rows.map((row,index)=><div key={index} className="vsn-repeat-control-row">
      <div className="grid grid-cols-2 gap-2">
        <TextControl label="Property" value={row.property || "all"} placeholder="all / transform / opacity" onChange={(property)=>patchRow(index,{property})}/>
        <SelectControl label="Timing" value={row.timingFunction || "ease"} onChange={(timingFunction)=>patchRow(index,{timingFunction})} options={["linear","ease","ease-in","ease-out","ease-in-out","step-start","step-end"]}/>
        <TextControl label="Duration" value={row.duration || "200ms"} placeholder="200ms / .2s" onChange={(duration)=>patchRow(index,{duration})}/>
        <TextControl label="Delay" value={row.delay || "0ms"} placeholder="0ms" onChange={(delay)=>patchRow(index,{delay})}/>
      </div>
      <div className="vsn-repeat-control-actions">
        <TextControl label="Custom easing" value={String(row.timingFunction || "").startsWith("cubic-bezier") || String(row.timingFunction || "").startsWith("steps(") ? row.timingFunction : ""} placeholder="cubic-bezier(.2,.8,.2,1)" onChange={(timingFunction)=>patchRow(index,{timingFunction:timingFunction || "ease"})}/>
        {rows.length > 1 ? <VsnButton type="button" variant="icon" size="sm" tone="critical" title="Remove transition" onClick={()=>commit(rows.filter((_,i)=>i!==index))}><PolarisIcon type="delete" size={14}/></VsnButton> : null}
      </div>
    </div>)}
    <VsnButton type="button" variant="tertiary" size="sm" className="vsn-inline-add" onClick={()=>commit([...rows,{property:"all",duration:"200ms",timingFunction:"ease",delay:"0ms"}])}><PolarisIcon type="plus" size={13}/>Add transition</VsnButton>
  </div>;
}

export function OutlineControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  return <div className="vsn-structured-control space-y-2">
    <div className="grid grid-cols-2 gap-2">
      <CssLengthControl label="Outline width" value={current.width ?? ""} defaultUnit="px" onChange={(width)=>patch({width})}/>
      <SelectControl label="Outline style" value={current.style || "none"} onChange={(style)=>patch({style})} options={["none","solid","dashed","dotted","double","groove","ridge","inset","outset"]}/>
    </div>
    <ColorGradientControl solidOnly label="Outline color" value={{type:"color",color:current.color || "#95BF47"}} onChange={(next)=>patch({color:next.color})}/>
    <CssLengthControl label="Outline offset" value={current.offset ?? ""} defaultUnit="px" onChange={(offset)=>patch({offset})}/>
  </div>;
}

export function BlendModeControl({ label = "Blend mode", value = "normal", onChange }) {
  return <SelectControl label={label} value={value || "normal"} onChange={onChange} options={BLEND_MODE_OPTIONS}/>;
}

export function BackdropFilterControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  const sliders = [
    ["Blur","blur",0,80,"px"],["Brightness","brightness",0,300,"%"],["Saturate","saturate",0,300,"%"],
    ["Contrast","contrast",0,300,"%"],["Hue rotate","hueRotate",0,360,"°"],["Grayscale","grayscale",0,100,"%"],["Sepia","sepia",0,100,"%"],
  ];
  return <div className="vsn-structured-control grid grid-cols-2 gap-2">
    {sliders.map(([label,key,min,max,suffix])=><SliderControl key={key} label={label} value={current[key] ?? (key === "brightness" || key === "saturate" || key === "contrast" ? 100 : 0)} min={min} max={max} suffix={suffix} onChange={(next)=>patch({[key]:Number(next)})}/>) }
  </div>;
}

export function TextDecorationControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  return <div className="vsn-structured-control space-y-2">
    <div className="grid grid-cols-2 gap-2">
      <SelectControl label="Decoration" value={current.textDecorationLine || "none"} onChange={(textDecorationLine)=>patch({textDecorationLine})} options={["none","underline","overline","line-through","underline overline"]}/>
      <SelectControl label="Style" value={current.textDecorationStyle || "solid"} onChange={(textDecorationStyle)=>patch({textDecorationStyle})} options={["solid","double","dotted","dashed","wavy"]}/>
    </div>
    <ColorGradientControl solidOnly label="Decoration color" value={{type:"color",color:current.textDecorationColor || "#1a1a1a"}} onChange={(next)=>patch({textDecorationColor:next.color})}/>
    <div className="grid grid-cols-2 gap-2">
      <TextControl label="Thickness" value={current.textDecorationThickness || "auto"} placeholder="auto / from-font / 2px" onChange={(textDecorationThickness)=>patch({textDecorationThickness})}/>
      <TextControl label="Underline offset" value={current.textUnderlineOffset || "auto"} placeholder="auto / 2px / .1em" onChange={(textUnderlineOffset)=>patch({textUnderlineOffset})}/>
    </div>
  </div>;
}

export function TextFlowControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  return <div className="vsn-structured-control grid grid-cols-2 gap-2">
    <SelectControl label="White space" value={current.whiteSpace || "normal"} onChange={(whiteSpace)=>patch({whiteSpace})} options={["normal","nowrap","pre","pre-wrap","pre-line","break-spaces"]}/>
    <SelectControl label="Word break" value={current.wordBreak || "normal"} onChange={(wordBreak)=>patch({wordBreak})} options={["normal","break-all","keep-all","break-word"]}/>
    <SelectControl label="Overflow wrap" value={current.overflowWrap || "normal"} onChange={(overflowWrap)=>patch({overflowWrap})} options={["normal","break-word","anywhere"]}/>
    <SelectControl label="Hyphens" value={current.hyphens || "manual"} onChange={(hyphens)=>patch({hyphens})} options={["none","manual","auto"]}/>
  </div>;
}

export function TextOverflowControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  return <div className="vsn-structured-control grid grid-cols-2 gap-2">
    <SelectControl label="Text overflow" value={current.textOverflow || "clip"} onChange={(textOverflow)=>patch({textOverflow})} options={["clip","ellipsis"]}/>
    <NumberControl label="Line clamp" value={current.lineClamp ?? ""} min={1} max={20} onChange={(lineClamp)=>patch({lineClamp:lineClamp === "" ? "" : Number(lineClamp)})}/>
    <CssLengthControl label="Text indent" value={current.textIndent ?? ""} defaultUnit="px" onChange={(textIndent)=>patch({textIndent})}/>
  </div>;
}

export function CursorControl({ label = "Cursor", value = "", onChange }) {
  return <SelectControl label={label} value={value || ""} onChange={onChange} options={CURSOR_OPTIONS}/>;
}

export function ColorGradientControl({
  label,
  value = {},
  onChange,
  solidOnly = false,
  gradientOnly = false,
  capabilities,
  toggleable = false,
  enabled,
  onEnabledChange,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const colorCapabilities = normalizeColorCapabilities(capabilities, { solidOnly, gradientOnly });
  const type = resolveColorMode(value, colorCapabilities);
  const isEnabled = enabled ?? value?.enabled !== false;
  const normalizedValue = type === "gradient" ? { ...value, type: "gradient" } : { ...value, type: "color" };
  useEffect(() => { if (!isEnabled && open) setOpen(false); }, [isEnabled, open]);
  const setEnabled = (nextEnabled) => {
    onEnabledChange?.(nextEnabled);
    if (!onEnabledChange) onChange?.({ ...value, enabled: nextEnabled });
  };
  const preview = isEnabled ? gradientToCss(normalizedValue) : "transparent";
  const display = !isEnabled ? "Off" : type === "gradient" ? `${value?.gradientType === "radial" ? "Radial" : "Linear"} Gradient` : String(value?.color || "#ffffff").toUpperCase();
  return (
    <div className={`vsn-control-block vsn-color-control ${!isEnabled ? "is-disabled" : ""}`}>
      {label ? <div className="flex items-center justify-between gap-2"><FieldLabel>{label}</FieldLabel>{toggleable ? <VsnCheckbox checked={isEnabled} onChange={(event) => setEnabled(event.currentTarget.checked)}>On</VsnCheckbox> : null}</div> : toggleable ? <VsnCheckbox checked={isEnabled} onChange={(event) => setEnabled(event.currentTarget.checked)}>Enable color</VsnCheckbox> : null}
      <button ref={triggerRef} type="button" className="vsn-color-trigger" disabled={!isEnabled} onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <span className="vsn-color-trigger-swatch" style={{ background: preview }} />
        <span>{display}</span>
        <PolarisIcon type="chevron-down" size={14} />
      </button>
      <AnchoredOverlay open={open && isEnabled} anchorRef={triggerRef} placement="bottom-start" width={300} maxWidth="calc(100vw - 20px)" className="vsn-color-popover" onRequestClose={() => setOpen(false)}>
        <ColorStudio value={normalizedValue} onChange={(next) => onChange?.({ ...next, ...(toggleable ? { enabled: true } : {}) })} solidOnly={solidOnly} gradientOnly={gradientOnly} capabilities={colorCapabilities} />
      </AnchoredOverlay>
    </div>
  );
}

export function TypographyControl({ value = {}, onChange }) {
  const patch = (key, next) => onChange?.({ ...value, [key]: next });
  return (
    <div className="space-y-3">
      <FontFamilyControl label="Font family" value={value.fontFamily || "Inter, system-ui, sans-serif"} fontWeight={value.fontWeight} fontStyle={value.fontStyle} onChange={(v) => patch("fontFamily", v)} />
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Size" value={value.fontSize ?? ""} defaultUnit="px" onChange={(fontSize) => patch("fontSize", fontSize)} /><SelectControl label="Weight" value={String(value.fontWeight || "400")} onChange={(v) => patch("fontWeight", v)} options={["100","200","300","400","500","600","700","800","900"]} /></div>
      <div className="grid grid-cols-2 gap-2"><TextControl label="Line height" value={String(value.lineHeight ?? "")} onChange={(lineHeight) => patch("lineHeight", lineHeight)} placeholder="1.5 / 1.5em / 24px" /><SelectControl label="Font style" value={value.fontStyle || "normal"} onChange={(fontStyle) => patch("fontStyle", fontStyle)} options={["normal","italic","oblique"]} /></div>
      <div className="grid grid-cols-2 gap-2"><CssKeywordLengthControl label="Letter space" value={value.letterSpacing ?? ""} defaultUnit="px" keywords={["normal"]} onChange={(letterSpacing) => patch("letterSpacing", letterSpacing)} /><CssKeywordLengthControl label="Word space" value={value.wordSpacing ?? ""} defaultUnit="px" keywords={["normal"]} onChange={(wordSpacing) => patch("wordSpacing", wordSpacing)} /></div>
      <SelectControl label="Transform" value={value.textTransform || "none"} onChange={(v) => patch("textTransform", v)} options={["none","uppercase","lowercase","capitalize"]} />
      <ButtonSetControl label="Alignment" value={value.textAlign || "left"} onChange={(v) => patch("textAlign", v)} options={[{value:"left",label:"Left"},{value:"center",label:"Center"},{value:"right",label:"Right"},{value:"justify",label:"Justify"}]} />
      <ColorGradientControl solidOnly label="Text color" value={{ type: "color", color: value.color || "#1a1a1a", opacity: value.opacity ?? 1 }} onChange={(next) => onChange?.({ ...value, color: next.color, opacity: next.opacity ?? value.opacity ?? 1 })} />
      <PopoverToggleControl label="Text decoration" icon="edit" onReset={() => onChange?.({ ...value, textDecorationLine: "none", textDecorationStyle: "solid", textDecorationColor: "", textDecorationThickness: "", textUnderlineOffset: "" })}>
        <TextDecorationControl value={value} onChange={(next) => onChange?.({ ...value, ...next })} />
      </PopoverToggleControl>
      <PopoverToggleControl label="Text flow" icon="note">
        <TextFlowControl value={value} onChange={(next) => onChange?.({ ...value, ...next })} />
      </PopoverToggleControl>
      <PopoverToggleControl label="Overflow & clamp" icon="filter">
        <TextOverflowControl value={value} onChange={(next) => onChange?.({ ...value, ...next })} />
      </PopoverToggleControl>
    </div>
  );
}

export function DateControl({ label, value = "", onChange }) { return <VsnDateField label={label || "Date"} labelAccessibilityVisibility={label ? undefined : "exclusive"} value={value || ""} onInput={(event) => onChange?.(event.currentTarget.value || "")} />; }
export function DateTimeControl({ label, value = "", onChange }) { return <VsnTextField type="datetime-local" label={label || "Date & time"} labelAccessibilityVisibility={label ? undefined : "exclusive"} value={value || ""} onInput={(event) => onChange?.(event.currentTarget.value || "")} />; }
export function TimeControl({ label, value = "", onChange }) { return <VsnTextField type="time" label={label || "Time"} labelAccessibilityVisibility={label ? undefined : "exclusive"} value={value || ""} onInput={(event) => onChange?.(event.currentTarget.value || "")} />; }

const CSS_COMPLETIONS = [
  "align-content", "align-items", "align-self", "animation", "animation-delay", "animation-duration", "animation-fill-mode",
  "appearance", "aspect-ratio", "backdrop-filter", "background", "background-color", "background-image", "background-position",
  "background-repeat", "background-size", "border", "border-bottom", "border-color", "border-radius", "border-style", "border-width",
  "break-after", "break-before", "break-inside", "caret-color", "clip-path", "column-count", "column-fill", "column-rule-color", "column-rule-style", "column-rule-width", "column-width", "contain", "contain-intrinsic-size", "content-visibility",
  "bottom", "box-shadow", "box-sizing", "color", "column-gap", "cursor", "display", "filter", "flex", "flex-basis", "flex-direction",
  "flex-grow", "flex-shrink", "flex-wrap", "font-family", "font-size", "font-style", "font-weight", "gap", "grid-auto-flow",
  "grid-template-columns", "grid-template-rows", "height", "inset", "justify-content", "justify-items", "left", "letter-spacing",
  "line-height", "margin", "margin-bottom", "margin-left", "margin-right", "margin-top", "max-height", "max-width", "min-height",
  "min-width", "object-fit", "object-position", "opacity", "order", "outline", "overflow", "overflow-x", "overflow-y", "padding",
  "padding-bottom", "padding-left", "padding-right", "padding-top", "pointer-events", "position", "right", "row-gap", "text-align",
  "text-decoration", "text-decoration-line", "text-decoration-style", "text-decoration-color", "text-decoration-thickness", "text-underline-offset", "text-overflow", "text-transform", "text-indent", "top", "transform", "transform-origin", "transition", "transition-delay",
  "transition-duration", "transition-property", "user-select", "vertical-align", "visibility", "white-space", "word-break", "overflow-wrap", "hyphens", "width", "word-spacing", "z-index",
  "accent-color", "direction", "writing-mode", "resize", "touch-action", "will-change", "scroll-behavior", "scroll-snap-align", "scroll-snap-stop", "scroll-snap-type", "scrollbar-gutter", "overscroll-behavior", "overscroll-behavior-x", "overscroll-behavior-y"
];

const CSS_VALUE_COMPLETIONS = {
  display: ["block", "inline", "inline-block", "flex", "inline-flex", "grid", "inline-grid", "none"],
  position: ["relative", "absolute", "fixed", "sticky", "static"],
  "align-items": ["stretch", "flex-start", "center", "flex-end", "baseline"],
  "align-self": ["auto", "stretch", "flex-start", "center", "flex-end", "baseline"],
  "justify-content": ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"],
  "flex-direction": ["row", "row-reverse", "column", "column-reverse"],
  "flex-wrap": ["nowrap", "wrap", "wrap-reverse"],
  overflow: ["visible", "hidden", "clip", "scroll", "auto"],
  "overflow-x": ["visible", "hidden", "clip", "scroll", "auto"],
  "overflow-y": ["visible", "hidden", "clip", "scroll", "auto"],
  "text-align": ["left", "center", "right", "justify"],
  "text-transform": ["none", "uppercase", "lowercase", "capitalize"],
  "text-decoration-line": ["none", "underline", "overline", "line-through", "underline overline"],
  "text-decoration-style": ["solid", "double", "dotted", "dashed", "wavy"],
  "text-overflow": ["clip", "ellipsis"],
  "word-break": ["normal", "break-all", "keep-all", "break-word"],
  "overflow-wrap": ["normal", "break-word", "anywhere"],
  hyphens: ["none", "manual", "auto"],
  "font-style": ["normal", "italic", "oblique"],
  "font-weight": ["100", "200", "300", "400", "500", "600", "700", "800", "900", "normal", "bold"],
  "object-fit": ["fill", "contain", "cover", "none", "scale-down"],
  "background-size": ["auto", "cover", "contain", "100% 100%"],
  "background-repeat": ["repeat", "repeat-x", "repeat-y", "no-repeat"],
  cursor: ["auto", "default", "pointer", "grab", "grabbing", "text", "move", "not-allowed"],
  visibility: ["visible", "hidden", "collapse"],
  "pointer-events": ["auto", "none"],
  "white-space": ["normal", "nowrap", "pre", "pre-wrap", "pre-line"],
  "box-sizing": ["border-box", "content-box"],
  direction: ["ltr", "rtl"],
  "writing-mode": ["horizontal-tb", "vertical-rl", "vertical-lr"],
  contain: ["none", "strict", "content", "size", "inline-size", "layout", "style", "paint"],
  "content-visibility": ["visible", "auto", "hidden"],
  resize: ["none", "both", "horizontal", "vertical", "block", "inline"],
  "touch-action": ["auto", "none", "pan-x", "pan-y", "manipulation", "pinch-zoom"],
  "break-before": ["auto", "avoid", "page", "column", "left", "right"],
  "break-after": ["auto", "avoid", "page", "column", "left", "right"],
  "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"],
  "column-fill": ["auto", "balance", "balance-all"],
  "scroll-behavior": ["auto", "smooth"],
  "scroll-snap-stop": ["normal", "always"],
  "scrollbar-gutter": ["auto", "stable", "stable both-edges"],
  "overscroll-behavior": ["auto", "contain", "none"],
  "overscroll-behavior-x": ["auto", "contain", "none"],
  "overscroll-behavior-y": ["auto", "contain", "none"]
};

function cssSuggestionContext(text, cursor) {
  const source = String(text || "");
  const safeCursor = Math.max(0, Math.min(source.length, Number(cursor ?? source.length)));
  const before = source.slice(0, safeCursor);
  const lineStart = before.lastIndexOf("\n") + 1;
  const line = before.slice(lineStart);
  const declarationBoundary = Math.max(line.lastIndexOf(";"), line.lastIndexOf("{"));
  const segmentOffset = lineStart + declarationBoundary + 1;
  const segment = before.slice(segmentOffset);
  const colonIndex = segment.indexOf(":");

  if (colonIndex >= 0) {
    const property = segment.slice(0, colonIndex).trim().toLowerCase();
    const valueStartBase = segmentOffset + colonIndex + 1;
    const valueBefore = source.slice(valueStartBase, safeCursor);
    const tokenMatch = valueBefore.match(/[a-zA-Z-]+$/);
    const token = tokenMatch?.[0] || "";
    const start = safeCursor - token.length;
    const choices = CSS_VALUE_COMPLETIONS[property] || [];
    const items = choices.filter((item) => !token || item.toLowerCase().startsWith(token.toLowerCase())).slice(0, 10);
    return { kind: "value", property, token, start, end: safeCursor, items };
  }

  const tokenMatch = segment.match(/[-a-zA-Z]+$/);
  const token = tokenMatch?.[0] || "";
  const start = safeCursor - token.length;
  const items = token
    ? CSS_COMPLETIONS.filter((item) => item.startsWith(token.toLowerCase()) && item !== token.toLowerCase()).slice(0, 10)
    : [];
  return { kind: "property", property: "", token, start, end: safeCursor, items };
}

function replaceEditorRange({ value, start, end, insert, onChange, inputRef, cursorOffset = 0 }) {
  const source = String(value || "");
  const next = `${source.slice(0, start)}${insert}${source.slice(end)}`;
  const nextCursor = start + insert.length + cursorOffset;
  onChange?.(next);
  requestAnimationFrame(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(nextCursor, nextCursor);
  });
  return next;
}

export function CustomCssControl({ label = "Custom CSS", value = "", onChange, placeholder = "selector {\n  color: red;\n}" }) {
  const inputRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const contextRef = useRef(null);

  const refreshSuggestions = (text = value, cursor) => {
    const textarea = inputRef.current;
    const position = cursor ?? textarea?.selectionStart ?? String(text || "").length;
    const context = cssSuggestionContext(text, position);
    contextRef.current = context;
    setSuggestions(context.items.map((item) => ({ label: item, value: item, kind: context.kind, meta: context.kind === "property" ? "CSS property" : context.property })));
    setActiveSuggestion(0);
  };

  const applySuggestion = (item) => {
    const textarea = inputRef.current;
    const source = textarea?.value ?? String(value || "");
    const cursor = textarea?.selectionStart ?? source.length;
    const context = cssSuggestionContext(source, cursor);
    const insert = context.kind === "property" ? `${item.value}: ` : item.value;
    replaceEditorRange({ value: source, start: context.start, end: context.end, insert, onChange, inputRef });
    setSuggestions([]);
  };

  const insertIndent = () => {
    const textarea = inputRef.current;
    const source = textarea?.value ?? String(value || "");
    const start = textarea?.selectionStart ?? source.length;
    const end = textarea?.selectionEnd ?? start;
    replaceEditorRange({ value: source, start, end, insert: "  ", onChange, inputRef });
    setSuggestions([]);
  };

  const onKeyDown = (event) => {
    if (suggestions.length && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "ArrowDown") setActiveSuggestion((v) => (v + 1) % suggestions.length);
      if (event.key === "ArrowUp") setActiveSuggestion((v) => (v - 1 + suggestions.length) % suggestions.length);
      if (event.key === "Enter") applySuggestion(suggestions[activeSuggestion]);
      return;
    }
    if (event.key === "Escape" && suggestions.length) {
      event.preventDefault();
      setSuggestions([]);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      if (suggestions.length) applySuggestion(suggestions[activeSuggestion]);
      else insertIndent();
    }
  };

  return (
    <div className="vsn-code-editor-shell">
      <VsnTextArea
        inputRef={inputRef}
        label={label}
        value={value || ""}
        placeholder={placeholder}
        rows={10}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="vsn-code-editor"
        onInput={(event) => { const next = event.currentTarget.value || ""; onChange?.(next); refreshSuggestions(next, event.currentTarget.selectionStart); }}
        onClick={(event) => refreshSuggestions(event.currentTarget.value, event.currentTarget.selectionStart)}
        onKeyUp={(event) => { if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) refreshSuggestions(event.currentTarget.value, event.currentTarget.selectionStart); }}
        onKeyDown={onKeyDown}
      />
      <EditorSuggestionMenu suggestions={suggestions} activeSuggestion={activeSuggestion} onPick={applySuggestion} anchorRef={inputRef} onClose={()=>setSuggestions([])} />
      <p className="vsn-code-editor-help">Use <kbd>Tab</kbd> for indentation or to accept the highlighted suggestion. Type a CSS property inside a rule to see autocomplete. Use <code>selector</code> to target the current element.</p>
    </div>
  );
}

const JS_COMPLETIONS = [
  { label: "element", insert: "element", meta: "Current element" },
  { label: "element.querySelector", insert: "element.querySelector('')", meta: "Find child" },
  { label: "element.querySelectorAll", insert: "element.querySelectorAll('')", meta: "Find children" },
  { label: "element.addEventListener", insert: "element.addEventListener('', () => {\n  \n})", meta: "Event listener" },
  { label: "element.classList.add", insert: "element.classList.add('')", meta: "Add class" },
  { label: "element.classList.remove", insert: "element.classList.remove('')", meta: "Remove class" },
  { label: "element.classList.toggle", insert: "element.classList.toggle('')", meta: "Toggle class" },
  { label: "element.style", insert: "element.style.", meta: "Inline style" },
  { label: "document.querySelector", insert: "document.querySelector('')", meta: "Document query" },
  { label: "document.querySelectorAll", insert: "document.querySelectorAll('')", meta: "Document query all" },
  { label: "window", insert: "window", meta: "Browser window" },
  { label: "fetch", insert: "fetch('')", meta: "Fetch request" },
  { label: "console.log", insert: "console.log()", meta: "Console" },
  { label: "setTimeout", insert: "setTimeout(() => {\n  \n}, 0)", meta: "Timer" },
  { label: "setInterval", insert: "setInterval(() => {\n  \n}, 1000)", meta: "Interval" },
  { label: "return cleanup", insert: "return () => {\n  \n};", meta: "Editor cleanup" }
];

function jsSuggestionContext(text, cursor) {
  const source = String(text || "");
  const safeCursor = Math.max(0, Math.min(source.length, Number(cursor ?? source.length)));
  const before = source.slice(0, safeCursor);
  const tokenMatch = before.match(/[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*$/);
  const token = tokenMatch?.[0] || "";
  const start = safeCursor - token.length;
  const items = token.length >= 1
    ? JS_COMPLETIONS.filter((item) => item.label.toLowerCase().startsWith(token.toLowerCase()) && item.label.toLowerCase() !== token.toLowerCase()).slice(0, 10)
    : [];
  return { token, start, end: safeCursor, items };
}

export function CustomJsControl({ label = "Custom JavaScript", value = "", onChange }) {
  const inputRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  const refreshSuggestions = (text = value, cursor) => {
    const textarea = inputRef.current;
    const context = jsSuggestionContext(text, cursor ?? textarea?.selectionStart ?? String(text || "").length);
    setSuggestions(context.items);
    setActiveSuggestion(0);
  };

  const applySuggestion = (item) => {
    const textarea = inputRef.current;
    const source = textarea?.value ?? String(value || "");
    const cursor = textarea?.selectionStart ?? source.length;
    const context = jsSuggestionContext(source, cursor);
    const insert = item.insert || item.label;
    replaceEditorRange({ value: source, start: context.start, end: context.end, insert, onChange, inputRef });
    setSuggestions([]);
  };

  const insertIndent = () => {
    const textarea = inputRef.current;
    const source = textarea?.value ?? String(value || "");
    const start = textarea?.selectionStart ?? source.length;
    const end = textarea?.selectionEnd ?? start;
    replaceEditorRange({ value: source, start, end, insert: "  ", onChange, inputRef });
    setSuggestions([]);
  };

  const onKeyDown = (event) => {
    if (suggestions.length && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "ArrowDown") setActiveSuggestion((v) => (v + 1) % suggestions.length);
      if (event.key === "ArrowUp") setActiveSuggestion((v) => (v - 1 + suggestions.length) % suggestions.length);
      if (event.key === "Enter") applySuggestion(suggestions[activeSuggestion]);
      return;
    }
    if (event.key === "Escape" && suggestions.length) {
      event.preventDefault();
      setSuggestions([]);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      if (suggestions.length) applySuggestion(suggestions[activeSuggestion]);
      else insertIndent();
    }
  };

  return (
    <div className="vsn-code-editor-shell">
      <VsnTextArea
        inputRef={inputRef}
        label={label}
        value={value || ""}
        placeholder={"element.classList.add('is-ready');\n\n// `element` is the current widget root."}
        rows={10}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="vsn-code-editor vsn-js-editor"
        onInput={(event) => { const next = event.currentTarget.value || ""; onChange?.(next); refreshSuggestions(next, event.currentTarget.selectionStart); }}
        onClick={(event) => refreshSuggestions(event.currentTarget.value, event.currentTarget.selectionStart)}
        onKeyUp={(event) => { if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) refreshSuggestions(event.currentTarget.value, event.currentTarget.selectionStart); }}
        onKeyDown={onKeyDown}
      />
      <EditorSuggestionMenu suggestions={suggestions} activeSuggestion={activeSuggestion} onPick={applySuggestion} anchorRef={inputRef} onClose={()=>setSuggestions([])} />
      <p className="vsn-code-editor-help"><strong>element</strong> is scoped to the current widget. JavaScript runs in Canvas/Preview and on the published storefront. For listeners/timers, return a cleanup function while editing to avoid duplicates.</p>
    </div>
  );
}

export function SwitcherControl({ label, checked = false, onChange, description = "" }) {
  return (
    <VsnButton
      type="button"
      role="switch"
      aria-checked={!!checked}
      onClick={() => onChange?.(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#e3e3e3] bg-white px-3 py-2 text-left"
    >
      <span><span className="block text-xs font-medium text-[#303030]">{label}</span>{description ? <span className="mt-0.5 block text-[10px] text-[#8c9196]">{description}</span> : null}</span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-[#95BF47]" : "bg-[#b5b5b5]"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </VsnButton>
  );
}

export function PopoverToggleControl({ label, icon = "edit", children, onReset, buttonTitle = "Edit" }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <div ref={anchorRef} className="flex items-center gap-1">
          {onReset ? <VsnButton type="button" variant="icon" size="sm" title="Reset" accessibilityLabel="Reset" onClick={onReset}><PolarisIcon type="reset" size={15} /></VsnButton> : null}
          <VsnButton type="button" variant="icon" size="sm" title={buttonTitle} accessibilityLabel={buttonTitle} aria-expanded={open} onClick={() => setOpen((v) => !v)} className={open ? "is-active" : ""}><PolarisIcon type={icon} size={15} /></VsnButton>
        </div>
      </div>
      <AnchoredOverlay open={open} anchorRef={anchorRef} placement="bottom-end" width={300} maxWidth="calc(100vw - 20px)" className="vsn-control-popover" onRequestClose={() => setOpen(false)}>
        {children}
      </AnchoredOverlay>
    </div>
  );
}

export function ChooseControl({ label, value, onChange, options = [] }) {
  return (
    <div>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <div className="inline-flex overflow-hidden rounded-lg border border-[#d9d9d9] bg-white">
        {normalizeControlOptions(options).map((item) => {
          const active = value === item.value;
          return <VsnButton type="button" variant="plain" size="sm" key={item.value} title={item.label} accessibilityLabel={item.polarisIcon ? item.label : undefined} onClick={() => onChange?.(item.value)} className={`vsn-choice-button ${active ? "is-active" : ""}`}>{item.polarisIcon ? <PolarisIcon type={item.polarisIcon} size={15} /> : item.label}</VsnButton>;
        })}
      </div>
    </div>
  );
}

function normalizePickedFileIds(rawIds = []) {
  if (!Array.isArray(rawIds)) return [];
  return rawIds
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return item.id || item.value || "";
      return "";
    })
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

const VSN_MEDIA_CACHE_KEY = "vsn:shopify-media-cache:v1";

function readShopifyMediaCache() {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage?.getItem(VSN_MEDIA_CACHE_KEY) || "{}";
    const parsed = JSON.parse(raw);
    return new Map(Object.entries(parsed || {}).filter(([, item]) => item && typeof item === "object"));
  } catch {
    return new Map();
  }
}

function shopifyMediaIdentityKeys(value = "") {
  const raw = String(value || "").trim();
  const numeric = raw.match(/(?:\/|^)(\d+)(?:\?.*)?$/)?.[1] || (/^\d+$/.test(raw) ? raw : "");
  return [raw, numeric].filter(Boolean);
}

function writeShopifyMediaCache(files = []) {
  if (typeof window === "undefined") return;
  try {
    const cache = readShopifyMediaCache();
    for (const file of Array.isArray(files) ? files : []) {
      if (!file?.id || !(file?.url || file?.previewUrl)) continue;
      const aliases = new Set([
        ...shopifyMediaIdentityKeys(file.id),
        ...shopifyMediaIdentityKeys(file.requestedId),
      ]);
      for (const alias of aliases) cache.set(alias, file);
    }
    const compact = Object.fromEntries(Array.from(cache.entries()).slice(-600));
    window.localStorage?.setItem(VSN_MEDIA_CACHE_KEY, JSON.stringify(compact));
  } catch {
    // Cache is an optimization only; media resolution must still work without it.
  }
}

function resolveCachedOrReturnedFile(id, files = [], cache = new Map()) {
  for (const key of shopifyMediaIdentityKeys(id)) {
    const cached = cache.get(key);
    if (cached) return cached;
  }
  for (const file of files) {
    const aliases = new Set([
      ...shopifyMediaIdentityKeys(file?.id),
      ...shopifyMediaIdentityKeys(file?.requestedId),
    ]);
    if (shopifyMediaIdentityKeys(id).some((key) => aliases.has(key))) return file;
  }
  return null;
}

async function resolveShopifyFiles(ids = [], { mediaTypes = [] } = {}) {
  const normalizedIds = normalizePickedFileIds(ids);
  if (!normalizedIds.length) return [];

  let lastData = {};

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch("/app/editor-media", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ ids: normalizedIds, mediaTypes, attempt }),
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const body = await response.text().catch(() => "");
      throw new Error(
        response.status === 401 || response.status === 403
          ? "The Shopify admin session could not authorize the media resolver. Refresh/reopen the embedded app and approve any requested permissions."
          : `The VSN media resolver did not return JSON (HTTP ${response.status}). Restart the development server after updating the app, then refresh Shopify Admin.${body ? ` Response: ${body.slice(0, 120)}` : ""}`
      );
    }
    const data = await response.json().catch(() => ({}));
    lastData = data;

    if (!response.ok && data?.permissionError) {
      throw new Error(data?.error || "The current Shopify session cannot read Files. VSN accepts read_files, read_themes, or read_images; re-authorize the app and try again.");
    }

    const files = Array.isArray(data?.files) ? data.files : [];
    writeShopifyMediaCache(files);
    const currentCache = readShopifyMediaCache();
    const ordered = normalizedIds.map((id) => resolveCachedOrReturnedFile(id, files, currentCache)).filter(Boolean);
    if (ordered.length === normalizedIds.length || data?.retryable !== true) {
      if (ordered.length) return ordered;
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || `Could not resolve selected Shopify media (${response.status}).`);
      }
      break;
    }

    await new Promise((resolve) => globalThis.setTimeout(resolve, [180, 450, 900, 1500][attempt] || 900));
  }

  const finalCache = readShopifyMediaCache();
  const finalCached = normalizedIds.map((id) => resolveCachedOrReturnedFile(id, [], finalCache)).filter(Boolean);
  if (finalCached.length === normalizedIds.length) return finalCached;

  throw new Error(
    lastData?.error ||
    (lastData?.permissionError
      ? "The current Shopify session cannot read Files. VSN accepts read_files, read_themes, or read_images; re-authorize the app and try again."
      : "Shopify returned the selected file IDs, but no usable file URL was available yet. Check System Health → Shopify & Permissions for the live Files API test; if access passes, wait for the selected file to finish processing in Shopify Files and retry."),
  );
}

export async function openShopifyFilePicker({ multiSelect = false, mediaTypes = ["MediaImage"], selectedFiles = [] } = {}) {
  if (typeof window === "undefined" || !window.shopify?.intents?.invoke) {
    throw new Error("Shopify file picker is only available inside Shopify Admin.");
  }

  const activity = await window.shopify.intents.invoke("pick:shopify/File", {
    data: {
      mediaTypes,
      multiSelect,
      selectedFiles: normalizePickedFileIds(selectedFiles),
    },
  });

  const response = await activity.complete;

  if (response?.code === "closed") return [];
  if (response?.code === "error") {
    throw new Error(response?.message || "Shopify media picker failed.");
  }
  if (response?.code !== "ok") return [];

  const ids = normalizePickedFileIds(response?.data?.ids || []);
  if (!ids.length) {
    throw new Error("Shopify returned no selected file IDs.");
  }

  const files = await resolveShopifyFiles(ids, { mediaTypes });
  if (!files.length) {
    throw new Error(
      "Shopify returned a selection but VSN could not resolve a usable file URL. Open System Health → Shopify & Permissions: if Files access fails, re-authorize the app; if it passes, wait until the file status is Ready in Shopify Files and try again.",
    );
  }
  return files;
}

function MediaThumb({ item, onRemove }) {
  return (
    <div className="group relative overflow-hidden rounded-md border border-[#e3e3e3] bg-[#f1f2f3]">
      {item?.url ? <img src={item.url} alt={item.alt || ""} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#8c9196]"><PolarisIcon type="image" size="base" /></div>}
      {onRemove ? <VsnButton type="button" variant="icon" size="sm" tone="critical" title="Remove" accessibilityLabel="Remove" onClick={onRemove} className="vsn-overlay-icon-button"><PolarisIcon type="delete" size={15} /></VsnButton> : null}
    </div>
  );
}

export function GalleryControl({ label = "Gallery", value = [], onChange, max = 12 }) {
  const externalItems = Array.isArray(value) ? value : [];
  const [items, setItems] = useState(externalItems);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(Array.isArray(value) ? value : []);
  }, [value]);

  const commitItems = (nextItems) => {
    const safeItems = Array.isArray(nextItems) ? nextItems.slice(0, max) : [];
    setItems(safeItems);
    onChange?.(safeItems);
  };

  const choose = async ({ append = false } = {}) => {
    setBusy(true);
    setError("");
    try {
      const files = await openShopifyFilePicker({
        multiSelect: true,
        mediaTypes: ["MediaImage"],
        selectedFiles: append ? [] : items.map((item) => item?.id).filter(Boolean),
      });
      if (files.length) {
        if (append) {
          const byId = new Map(items.map((item) => [item?.id || item?.url, item]));
          for (const file of files) byId.set(file?.id || file?.url, file);
          commitItems([...byId.values()]);
        } else {
          commitItems(files);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open Shopify Media.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <FieldLabel hint={`${items.length}/${max}`}>{label}</FieldLabel>
      <div className="overflow-hidden rounded-lg border border-[#d9d9d9] bg-white">
        <VsnButton type="button" onClick={() => choose({ append: false })} disabled={busy} className="flex w-full items-center justify-between border-b border-[#e3e3e3] px-3 py-2 text-left text-xs font-medium hover:bg-[#f6f6f7] disabled:opacity-60">
          <span>{items.length ? `${items.length} Images Selected` : "No Images Selected"}</span>
          <span className="text-[#6d7175]">{busy ? "Opening…" : "Shopify Media"}</span>
        </VsnButton>
        <div className="flex min-h-20 flex-wrap gap-2 p-2.5">
          {items.map((item, index) => (
            <div key={item?.id || `${item?.url || "media"}-${index}`} className="h-14 w-14">
              <MediaThumb
                item={item}
                onRemove={() => commitItems(items.filter((_, i) => i !== index))}
              />
            </div>
          ))}
          {items.length < max ? (
            <VsnButton type="button" title="Add images" onClick={() => choose({ append: true })} disabled={busy} className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-[#c9cccf] bg-[#f6f6f7] text-[#426b84] hover:border-[#95BF47] hover:bg-[#eaf7f2]">
              <PolarisIcon type="plus" size="base" />
            </VsnButton>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-1 text-[10px] leading-4 text-red-600">{error}</p> : null}
    </div>
  );
}

export function RepeaterControl({ label = "Items", value = [], onChange, createItem = () => ({ label: "New item", value: "" }), renderItem }) {
  const items = Array.isArray(value) ? value : [];
  const update = (index, next) => onChange?.(items.map((item, i) => i === index ? next : item));
  const remove = (index) => onChange?.(items.filter((_, i) => i !== index));
  const duplicate = (index) => onChange?.([...items.slice(0, index + 1), { ...items[index] }, ...items.slice(index + 1)]);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="space-y-2">
        {items.map((item, index) => <div key={item.id || index} className="rounded-lg border border-[#d9d9d9] bg-white"><div className="flex items-center justify-between border-b border-[#e3e3e3] px-2.5 py-2"><span className="text-xs font-medium">{item.label || `Item #${index + 1}`}</span><div><VsnButton type="button" title="Duplicate" onClick={() => duplicate(index)} className="vsn-icon-button h-7 w-7"><PolarisIcon type="clipboard" size="small" /></VsnButton><VsnButton type="button" title="Remove" onClick={() => remove(index)} className="vsn-icon-button h-7 w-7 hover:text-red-600"><PolarisIcon type="delete" size="small" /></VsnButton></div></div><div className="space-y-2 p-2.5">{renderItem ? renderItem(item, index, (next) => update(index, next)) : <TextControl label="Value" value={item.value || ""} onChange={(next) => update(index, { ...item, value: next })} />}</div></div>)}
        <VsnButton type="button" variant="tertiary" size="sm" onClick={() => onChange?.([...items, createItem(items.length)])} className="vsn-inline-add"><PolarisIcon type="plus" size={15} /> Add item</VsnButton>
      </div>
    </div>
  );
}




function sanitizeInlineSvg(value = "") {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, "")
    .replace(/javascript:/gi, "");
}

const ICON_LIBRARY = [
  { value: "star", label: "Star", glyph: "★", polarisType: "star", fa: "fa-solid fa-star" },
  { value: "heart", label: "Heart", glyph: "♥", polarisType: "star", fa: "fa-solid fa-heart" },
  { value: "check", label: "Check", glyph: "✓", polarisType: "check", fa: "fa-solid fa-check" },
  { value: "plus", label: "Plus", glyph: "+", polarisType: "plus", fa: "fa-solid fa-plus" },
  { value: "arrow-right", label: "Arrow Right", glyph: "→", polarisType: "arrow-right", fa: "fa-solid fa-arrow-right" },
  { value: "cart", label: "Cart", glyph: "🛒", polarisType: "cart", fa: "fa-solid fa-cart-shopping" },
  { value: "user", label: "User", glyph: "●", polarisType: "profile", fa: "fa-solid fa-user" },
  { value: "search", label: "Search", glyph: "⌕", polarisType: "search", fa: "fa-solid fa-magnifying-glass" },
  { value: "info", label: "Info", glyph: "ⓘ", polarisType: "info", fa: "fa-solid fa-circle-info" },
  { value: "warning", label: "Warning", glyph: "⚠", polarisType: "info", fa: "fa-solid fa-triangle-exclamation" },
];

export function MediaControl({ label = "Choose Image", value = {}, onChange, accept = "image/*", mediaTypes = ["MediaImage"] }) {
  const externalCurrent = typeof value === "string" ? { url: value } : (value || {});
  const [current, setCurrent] = useState(externalCurrent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCurrent(typeof value === "string" ? { url: value } : (value || {}));
  }, [value]);

  const commit = (next) => {
    const safe = next && typeof next === "object" ? next : {};
    setCurrent(safe);
    onChange?.(safe);
  };

  const choose = async () => {
    setBusy(true);
    setError("");
    try {
      const files = await openShopifyFilePicker({
        multiSelect: false,
        mediaTypes,
        selectedFiles: current?.id ? [current.id] : [],
      });
      if (files[0]) commit({ ...files[0], source: "shopify" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open Shopify Media.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="overflow-hidden rounded-lg border border-[#d9d9d9] bg-white">
        <div className="relative flex min-h-28 items-center justify-center bg-[#eef1f3] p-2">
          {current?.url ? (
            current?.type === "video" || current?.mediaType === "Video" || String(current?.mimeType || "").startsWith("video/") ? (
              <video src={current.url} poster={current.previewUrl && current.previewUrl !== current.url ? current.previewUrl : undefined} muted playsInline controls={false} className="max-h-44 w-full object-contain" onError={() => setError("The selected Shopify video could not be previewed.")} />
            ) : (
              <img
                src={current.previewUrl || current.url}
                alt={current.alt || ""}
                className="max-h-44 w-full object-contain"
                onError={() => setError("The selected Shopify media URL could not be previewed.")}
              />
            )
          ) : (
            <div className="text-center text-xs text-[#8c9196]">
              <div className="flex justify-center"><PolarisIcon type={mediaTypes.includes("Video") ? "film" : "image"} size="large" /></div>
              <div className="mt-1">No media selected</div>
            </div>
          )}
          {current?.url ? (
            <VsnButton type="button" title="Unselect media" onClick={() => commit({})} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md bg-white/95 text-[#5c5f62] shadow hover:text-red-600">
              <PolarisIcon type="delete" size="small" />
            </VsnButton>
          ) : null}
        </div>
        <div className="border-t border-[#e3e3e3]">
          <VsnButton type="button" onClick={choose} disabled={busy} className="w-full px-3 py-2 text-[11px] font-medium hover:bg-[#f6f6f7] disabled:opacity-60">{busy ? "Opening…" : "Choose from Shopify Files"}</VsnButton>
        </div>
      </div>
      {error ? <p className="text-[10px] leading-4 text-red-600">{error}</p> : null}
    </div>
  );
}

export function ImageDimensionsControl({ label = "Image Dimensions", value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <p className="text-[10px] italic leading-4 text-[#6d7175]">Shopify CDN images can be rendered at a requested width/height while the original media remains unchanged.</p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <NumberControl label="Width" value={current.width ?? ""} min={1} max={6000} onChange={(v) => patch({ width: v })} />
        <span className="pb-2 text-xs text-[#6d7175]">×</span>
        <NumberControl label="Height" value={current.height ?? ""} min={1} max={6000} onChange={(v) => patch({ height: v })} />
      </div>
      <SelectControl label="Unit" value={current.unit || "px"} onChange={(v) => patch({ unit: v })} options={["px", "%", "vw", "vh", "auto"]} />
      <ObjectControl value={{ objectFit: current.fit || "cover", objectPosition: current.position || "center center" }} onChange={(next) => patch({ fit: next.objectFit, position: next.objectPosition })} />
      <SwitcherControl label="Lazy load" checked={current.lazy !== false} onChange={(v) => patch({ lazy: v })} />
    </div>
  );
}

const EXTENDED_ICON_LIBRARIES = {
  "Font Awesome": [
    { name: "star", label: "Star", glyph: "★", polarisType: "star" }, { name: "heart", label: "Heart", glyph: "♥", polarisType: "heart" },
    { name: "check", label: "Check", glyph: "✓", polarisType: "check" }, { name: "plus", label: "Plus", glyph: "+", polarisType: "plus" },
    { name: "cart", label: "Cart", glyph: "🛒", polarisType: "cart" }, { name: "user", label: "User", glyph: "●", polarisType: "profile" },
    { name: "search", label: "Search", glyph: "⌕", polarisType: "search" }, { name: "info", label: "Info", glyph: "i", polarisType: "info" },
  ],
  "Line Icons": [
    { name: "arrow-right", label: "Arrow right", glyph: "→", polarisType: "arrow-right" }, { name: "menu", label: "Menu", glyph: "☰", polarisType: "menu" },
    { name: "calendar", label: "Calendar", glyph: "□", polarisType: "calendar" }, { name: "mail", label: "Mail", glyph: "✉", polarisType: "email" },
    { name: "location", label: "Location", glyph: "⌖", polarisType: "geolocation" }, { name: "clock", label: "Clock", glyph: "◷", polarisType: "clock" },
  ],
  Polaris: [
    { name: "settings", label: "Settings", glyph: "⚙", polarisType: "settings" }, { name: "image", label: "Image", glyph: "▧", polarisType: "image" },
    { name: "filter", label: "Filter", glyph: "▽", polarisType: "filter" }, { name: "delete", label: "Delete", glyph: "×", polarisType: "delete" },
    { name: "edit", label: "Edit", glyph: "✎", polarisType: "edit" }, { name: "copy", label: "Copy", glyph: "□", polarisType: "clipboard" },
  ],
};

function IconLibraryDialog({ open, onClose, onSelect, libraries = EXTENDED_ICON_LIBRARIES }) {
  const names = Object.keys(libraries);
  const [library, setLibrary] = useState(names[0] || "Font Awesome");
  const [query, setQuery] = useState("");
  if (!open) return null;
  const items = (libraries[library] || []).filter((item) => `${item.label} ${item.name}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <ModalPortal><div className="vsn-editor-modal-backdrop flex items-center justify-center bg-black/35 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="flex h-[min(620px,85vh)] w-[min(820px,92vw)] overflow-hidden rounded-xl bg-white shadow-2xl">
        <aside className="w-44 shrink-0 border-r border-[#e3e3e3] bg-[#f6f6f7] p-2">
          <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#6d7175]">Libraries</div>
          {names.map((name) => <VsnButton key={name} type="button" onClick={() => setLibrary(name)} className={`mb-1 block w-full rounded-md px-2 py-2 text-left text-xs ${library === name ? "bg-white font-semibold text-[#6AAB1F] shadow-sm" : "text-[#4a4a4a] hover:bg-white"}`}>{name}</VsnButton>)}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-[#e3e3e3] p-3"><div className="flex-1"><VsnSearchField label="Search icons" labelAccessibilityVisibility="exclusive" value={query} placeholder="Search icons" onInput={(event) => setQuery(event.currentTarget.value || "")} /></div><VsnButton type="button" variant="icon" size="sm" accessibilityLabel="Close" title="Close" onClick={onClose}><PolarisIcon type="x" size={15} /></VsnButton></div>
          <div className="grid flex-1 grid-cols-5 content-start gap-2 overflow-auto p-3 sm:grid-cols-6 md:grid-cols-7">
            {items.map((item) => <VsnButton key={`${library}-${item.name}`} type="button" title={item.label} onClick={() => onSelect?.({ source: "library", library, name: item.name, label: item.label, polarisType: item.polarisType, glyph: item.glyph })} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-[#e3e3e3] bg-white text-[#303030] transition hover:border-[#95BF47] hover:bg-[#eaf7f2] hover:text-[#6AAB1F]"><PolarisIcon type={item.polarisType || "star"} size="base" /><span className="max-w-full truncate px-1 text-[9px]">{item.label}</span></VsnButton>)}
            {!items.length ? <div className="col-span-full py-12 text-center text-xs text-[#8c9196]">No icons found.</div> : null}
          </div>
        </div>
      </div>
    </div></ModalPortal>
  );
}


async function readSvgApiResponse(response, label="SVG service") {
  const contentType=response.headers.get("content-type")||"";
  if(!contentType.includes("application/json")){
    const text=await response.text().catch(()=>"");
    throw new Error(response.status===401||response.status===403
      ? `The Shopify admin session could not authorize the ${label}. Refresh/reopen the embedded app and try again.`
      : `The ${label} did not return JSON (HTTP ${response.status}). Restart the development server and refresh Shopify Admin.${text?` Response: ${text.slice(0,120)}`:""}`);
  }
  return response.json().catch(()=>({}));
}

function SvgLibraryDialog({ open, onClose, onSelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [shopifyResult, vsnResult] = await Promise.allSettled([
        fetch("/app/editor-media?mode=svg-library", { credentials:"include", headers:{Accept:"application/json"} }),
        fetch("/app/builder-panel/svg-assets?mode=picker", { credentials:"include", headers:{Accept:"application/json"} }),
      ]);
      let shopifyResponse=null, vsnResponse=null, shopifyData={}, vsnData={};
      let shopifyError="", vsnError="";
      if(shopifyResult.status==="fulfilled"){
        shopifyResponse=shopifyResult.value;
        try{shopifyData=await readSvgApiResponse(shopifyResponse,"Shopify Files SVG service");}
        catch(e){shopifyError=e instanceof Error?e.message:"Could not load Shopify SVG files.";}
      }else shopifyError=shopifyResult.reason instanceof Error?shopifyResult.reason.message:"Could not reach Shopify SVG files.";
      if(vsnResult.status==="fulfilled"){
        vsnResponse=vsnResult.value;
        try{vsnData=await readSvgApiResponse(vsnResponse,"VSN SVG library");}
        catch(e){vsnError=e instanceof Error?e.message:"Could not load the VSN SVG library.";}
      }else vsnError=vsnResult.reason instanceof Error?vsnResult.reason.message:"Could not reach the VSN SVG library.";
      const remoteFiles = shopifyResponse?.ok && shopifyData?.ok !== false ? (Array.isArray(shopifyData?.files) ? shopifyData.files : []) : [];
      writeShopifyMediaCache(remoteFiles);
      const cachedFiles = Array.from(readShopifyMediaCache().values()).filter((file) => file?.mediaType === "GenericFile" && (file?.mimeType === "image/svg+xml" || /\.svg(?:\?|$)/i.test(file?.url || "") || /\.svg$/i.test(file?.fileName || "")));
      const vsnFiles = vsnResponse?.ok && vsnData?.ok !== false && Array.isArray(vsnData?.files) ? vsnData.files : [];
      const normalizedVsn = vsnFiles.map(file=>({...file,url:file.editorUrl||file.url,source:"vsn-svg"}));
      const byId = new Map([...cachedFiles, ...remoteFiles, ...normalizedVsn].map((file) => [file.id || file.url, file]));
      setItems(Array.from(byId.values()));
      const notices=[shopifyError || (!shopifyResponse?.ok?shopifyData?.error:"") , vsnError || (!vsnResponse?.ok?vsnData?.error:"")].filter(Boolean);
      if(!byId.size && notices.length) throw new Error(notices.join(" "));
      if(vsnError || (vsnResponse && !vsnResponse.ok)) setError(`VSN SVG Library: ${vsnError || vsnData?.error || "Could not load managed SVGs."}`);
      else if(shopifyError || (shopifyResponse && !shopifyResponse.ok)) setError(`Shopify Files are temporarily unavailable, but your managed VSN SVGs are still available. ${shopifyError || shopifyData?.error || ""}`.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load SVG library.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;
    const handleRegistryChange = () => load();
    window.addEventListener("vsn:svg-registry-changed", handleRegistryChange);
    return () => window.removeEventListener("vsn:svg-registry-changed", handleRegistryChange);
  }, [open]);

  if (!open) return null;

  const visible = items.filter((item) =>
    `${item?.fileName || ""} ${item?.alt || ""}`.toLowerCase().includes(query.toLowerCase()),
  );

  const uploadNew = async () => {
    const input=document.createElement("input");input.type="file";input.accept="image/svg+xml,.svg";input.onchange=async()=>{const file=input.files?.[0];if(!file)return;setUploading(true);setError("");try{const body=new FormData();body.set("intent","upload");body.set("name",file.name.replace(/\.svg$/i,""));body.set("file",file);const response=await fetch("/app/builder-panel/svg-assets",{method:"POST",credentials:"include",body,headers:{Accept:"application/json"}});const data=await readSvgApiResponse(response,"VSN SVG library");if(!response.ok||!data.ok)throw new Error(data.error||"Could not upload SVG.");onSelect?.({...data.asset,url:data.asset?.editorUrl||data.asset?.url,source:"vsn-svg"});onClose?.()}catch(e){setError(e instanceof Error?e.message:"Could not upload SVG.");await load()}finally{setUploading(false)}};input.click();
  };
  const chooseShopify = async () => {
    setUploading(true);setError("");try{const files=await openShopifyFilePicker({multiSelect:false,mediaTypes:["GenericFile"]});const file=files[0];if(!file)return;const isSvg=file.mimeType==="image/svg+xml"||/\.svg(?:\?|$)/i.test(file.url||"")||/\.svg$/i.test(file.fileName||"");if(!isSvg)throw new Error("Please choose an SVG file.");const body=new FormData();body.set("intent","import-url");body.set("url",file.url||file.previewUrl||"");body.set("fileName",file.fileName||"shopify.svg");body.set("name",String(file.fileName||"Shopify SVG").replace(/\.svg$/i,""));const response=await fetch("/app/builder-panel/svg-assets",{method:"POST",credentials:"include",body,headers:{Accept:"application/json"}});const data=await readSvgApiResponse(response,"VSN SVG library");if(!response.ok||!data.ok)throw new Error(data.error||"Could not import Shopify SVG.");onSelect?.({...data.asset,url:data.asset?.editorUrl||data.asset?.url,source:"vsn-svg"});onClose?.()}catch(e){setError(e instanceof Error?e.message:"Could not choose SVG.");await load()}finally{setUploading(false)}
  };

  return (
    <ModalPortal><div className="vsn-editor-modal-backdrop flex items-center justify-center bg-black/35 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="flex h-[min(640px,88vh)] w-[min(860px,94vw)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[#e3e3e3] p-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#202223]">VSN SVG Library</div>
            <div className="text-[10px] text-[#8c9196]">Managed VSN SVG assets plus Shopify Files. Shopify selections are imported into VSN automatically.</div>
          </div>
          <VsnButton type="button" onClick={uploadNew} disabled={uploading} className="rounded-lg bg-[#303030] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1f1f1f] disabled:opacity-60">
            {uploading ? "Uploading…" : "Upload SVG"}
          </VsnButton>
          <VsnButton type="button" onClick={chooseShopify} disabled={uploading}>Shopify Files</VsnButton>
          <VsnButton type="button" variant="icon" size="sm" onClick={load} disabled={loading} accessibilityLabel="Refresh" title="Refresh"><PolarisIcon type="reset" size={15} /></VsnButton>
          <VsnButton type="button" variant="icon" size="sm" onClick={onClose} accessibilityLabel="Close" title="Close"><PolarisIcon type="x" size={15} /></VsnButton>
        </div>
        <div className="border-b border-[#e3e3e3] p-3">
          <VsnSearchField label="Search SVG files" labelAccessibilityVisibility="exclusive" value={query} placeholder="Search SVG files" onInput={(event) => setQuery(event.currentTarget.value || "")} />
        </div>
        <div className="flex-1 overflow-auto p-3">
          {error ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-4 text-red-700">{error}</div> : null}
          {loading ? <div className="py-16 text-center text-xs text-[#8c9196]">Loading SVG files…</div> : null}
          {!loading && visible.length ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {visible.map((item) => (
                <VsnButton key={item.id} type="button" title={item.fileName || "SVG"} onClick={() => { onSelect?.(item); onClose?.(); }} className="group overflow-hidden rounded-lg border border-[#e3e3e3] bg-white text-left transition hover:border-[#95BF47] hover:shadow-sm">
                  <div className="flex aspect-square items-center justify-center bg-[#f6f6f7] p-3">
                    {(item.editorUrl || item.url) ? <img src={item.editorUrl || item.url} alt={item.alt || ""} className="max-h-full max-w-full object-contain" /> : <PolarisIcon type="image" size="large" />}
                  </div>
                  <div className="truncate border-t border-[#e3e3e3] px-2 py-1.5 text-[10px] text-[#4a4a4a]">{item.name || item.fileName || "SVG file"}{item.source === "vsn-svg" ? " · VSN" : " · Shopify"}</div>
                </VsnButton>
              ))}
            </div>
          ) : null}
          {!loading && !visible.length && !error ? (
            <div className="flex min-h-52 flex-col items-center justify-center text-center">
              <PolarisIcon type="image" size="large" />
              <div className="mt-2 text-xs font-medium text-[#4a4a4a]">No SVG files found</div>
              <div className="mt-1 max-w-sm text-[10px] leading-4 text-[#8c9196]">Upload an SVG into VSN or import one from Shopify Files.</div>
              <VsnButton type="button" onClick={uploadNew} className="mt-3 rounded-lg bg-[#303030] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1f1f1f]">Choose / Upload SVG</VsnButton>
            </div>
          ) : null}
        </div>
      </div>
    </div></ModalPortal>
  );
}

export function IconControl({ label = "Icon", value = {}, onChange, iconLibraries = EXTENDED_ICON_LIBRARIES }) {
  const current = value || {};
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [svgLibraryOpen, setSvgLibraryOpen] = useState(false);
  const [error, setError] = useState("");
  const patch = (next) => onChange?.({ ...current, ...next });
  const selectSvgFile = (file) => {
    if (!file) return;
    onChange?.({
      ...current,
      source: "svg-file",
      fileId: file.id,
      url: file.storefrontUrl || file.url || file.previewUrl || "",
      editorUrl: file.editorUrl || file.url || file.previewUrl || "",
      fileName: file.fileName || "icon.svg",
      mimeType: file.mimeType || "image/svg+xml",
    });
    setError("");
  };
  const preview = current.source === "svg-file" && (current.editorUrl || current.url)
    ? <img src={current.editorUrl || current.url} alt="" className="h-10 w-10 object-contain" />
    : <PolarisIcon type={current.polarisType || "star"} size="large" />;
  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="overflow-hidden rounded-lg border border-[#d9d9d9] bg-white">
        <div className="relative flex h-24 items-center justify-center bg-[#292c2f] text-white">{preview}{current.source ? <VsnButton type="button" title="Clear icon" onClick={() => onChange?.({})} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded bg-white/10 hover:bg-white/20"><PolarisIcon type="x" size="small" /></VsnButton> : null}</div>
        <div className="grid grid-cols-2 border-t border-[#e3e3e3]"><VsnButton type="button" onClick={() => setLibraryOpen(true)} className="border-r border-[#e3e3e3] px-2 py-2 text-[11px] font-medium hover:bg-[#eaf7f2]">Icon Library</VsnButton><VsnButton type="button" onClick={() => setSvgLibraryOpen(true)} className="px-2 py-2 text-[11px] font-medium hover:bg-[#f6f6f7]">SVG Library</VsnButton></div>
      </div>
      {current.source === "library" ? <div className="rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-3 py-2 text-[11px] text-[#4a4a4a]">{current.library || "Library"} · {current.label || current.name || "Selected icon"}</div> : null}
      {current.source === "svg-file" ? <div className="rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-3 py-2 text-[11px] text-[#4a4a4a]">SVG asset · {current.fileName || "icon.svg"}</div> : null}
      <div className="grid grid-cols-2 gap-2"><NumberControl label="Size" value={current.size ?? 20} min={6} max={200} unit="px" onChange={(v) => patch({ size: Number(v || 20) })} /><TextControl label="Color" value={current.color || "currentColor"} onChange={(v) => patch({ color: v })} placeholder="currentColor" /></div>
      {error ? <p className="text-[10px] leading-4 text-red-600">{error}</p> : null}
      <IconLibraryDialog open={libraryOpen} libraries={iconLibraries} onClose={() => setLibraryOpen(false)} onSelect={(icon) => { onChange?.({ ...current, ...icon }); setLibraryOpen(false); }} />
      <SvgLibraryDialog open={svgLibraryOpen} onClose={() => setSvgLibraryOpen(false)} onSelect={selectSvgFile} />
    </div>
  );
}

export function TextShadowControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  return <PopoverToggleControl label="Text Shadow" icon="note" onReset={() => onChange?.({})}><div className="space-y-2"><SwitcherControl label="Enable" checked={current.enabled === true} onChange={(v) => patch({ enabled: v })} /><div className="grid grid-cols-2 gap-2"><NumberControl label="X" value={current.x ?? 0} unit="px" onChange={(v) => patch({ x: Number(v || 0) })} /><NumberControl label="Y" value={current.y ?? 2} unit="px" onChange={(v) => patch({ y: Number(v || 0) })} /><NumberControl label="Blur" value={current.blur ?? 4} min={0} unit="px" onChange={(v) => patch({ blur: Number(v || 0) })} /><TextControl label="Color" value={current.color || "rgba(0,0,0,.3)"} onChange={(v) => patch({ color: v })} /></div></div></PopoverToggleControl>;
}

export function BoxShadowControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  return <PopoverToggleControl label="Box Shadow" icon="grid" onReset={() => onChange?.({})}><div className="space-y-2"><SwitcherControl label="Enable" checked={current.enabled === true} onChange={(v) => patch({ enabled: v })} /><div className="grid grid-cols-2 gap-2"><NumberControl label="X" value={current.x ?? 0} unit="px" onChange={(v) => patch({ x: Number(v || 0) })} /><NumberControl label="Y" value={current.y ?? 8} unit="px" onChange={(v) => patch({ y: Number(v || 0) })} /><NumberControl label="Blur" value={current.blur ?? 24} min={0} unit="px" onChange={(v) => patch({ blur: Number(v || 0) })} /><NumberControl label="Spread" value={current.spread ?? 0} unit="px" onChange={(v) => patch({ spread: Number(v || 0) })} /></div><TextControl label="Color" value={current.color || "rgba(0,0,0,.15)"} onChange={(v) => patch({ color: v })} /><SwitcherControl label="Inset" checked={current.inset === true} onChange={(v) => patch({ inset: v })} /></div></PopoverToggleControl>;
}

export function AlertControl({ tone = "info", children }) {
  const tones = { info: "border-blue-400 bg-blue-50 text-blue-900", success: "border-emerald-400 bg-emerald-50 text-emerald-900", warning: "border-amber-400 bg-amber-50 text-amber-900", critical: "border-red-400 bg-red-50 text-red-900" };
  const iconType = tone === "success" ? "check-circle" : tone === "critical" ? "x" : "info";
  return <div className={`flex gap-2 rounded-r-lg border-l-4 px-3 py-2 text-[11px] leading-4 ${tones[tone] || tones.info}`}><PolarisIcon type={iconType} size="small" /><div>{children}</div></div>;
}

export function NoticeControl({ title = "Notice Heading", children, tone = "warning", icon = "info", onDismiss }) {
  const tones = { info: "border-blue-400", success: "border-emerald-400", warning: "border-amber-400", critical: "border-red-400" };
  return <div className={`rounded-lg border bg-white p-3 text-[#303030] shadow-sm ${tones[tone] || tones.warning}`}><div className="flex gap-2"><span className="text-base"><PolarisIcon type={icon} size="small" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><strong className="text-xs">{title}</strong>{onDismiss ? <VsnButton type="button" variant="icon" size="sm" onClick={onDismiss} accessibilityLabel="Dismiss" title="Dismiss"><PolarisIcon type="x" size={14} /></VsnButton> : null}</div><div className="mt-1 text-[11px] leading-4 text-[#6d7175]">{children}</div></div></div></div>;
}

export function TextStrokeControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  return <PopoverToggleControl label="Text Stroke" icon="note" onReset={() => onChange?.({})}><div className="space-y-2"><SwitcherControl label="Enable" checked={current.enabled === true} onChange={(v) => patch({ enabled: v })} /><NumberControl label="Width" value={current.width ?? 1} min={0} max={20} step={0.5} unit="px" onChange={(v) => patch({ width: Number(v || 0) })} /><TextControl label="Color" value={current.color || "#000000"} onChange={(v) => patch({ color: v })} /></div></PopoverToggleControl>;
}

export function BorderControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });
  const individual = current.mode === "individual" || !!(current.widths || current.styles || current.colors);
  const widths = current.widths || {};
  const styles = current.styles || {};
  const colors = current.colors || {};
  const radii = current.radii || {};
  const patchSide = (bucket, side, nextValue) => patch({ [bucket]: { ...(current[bucket] || {}), [side]: nextValue }, mode: "individual" });
  return <PopoverToggleControl label="Border Control" icon="grid" onReset={() => onChange?.({})}>
    <div className="space-y-3">
      <ButtonSetControl label="Border mode" value={individual ? "individual" : "all"} onChange={(mode) => patch({ mode, widths: mode === "all" ? undefined : widths, styles: mode === "all" ? undefined : styles, colors: mode === "all" ? undefined : colors })} options={[{value:"all",label:"All sides"},{value:"individual",label:"Per side"}]} />
      {!individual ? <>
        <div className="grid grid-cols-2 gap-2">
          <CssLengthControl label="Width" value={current.width ?? ""} defaultUnit="px" onChange={(width) => patch({ width })} />
          <SelectControl label="Style" value={current.style || "solid"} onChange={(style) => patch({ style })} options={["none","solid","dashed","dotted","double","groove","ridge","inset","outset"]} />
        </div>
        <ColorGradientControl solidOnly label="Color" value={{ type: "color", color: current.color || "#e3e3e3" }} onChange={(next) => patch({ color: next.color })} />
      </> : <div className="space-y-3">
        {["top","right","bottom","left"].map((side) => <div key={side} className="rounded-lg border border-[#ececec] p-2">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#6d7175]">{side}</div>
          <div className="grid grid-cols-2 gap-2">
            <CssLengthControl label="Width" value={widths[side] ?? current.width ?? ""} defaultUnit="px" onChange={(next) => patchSide("widths", side, next)} />
            <SelectControl label="Style" value={styles[side] || current.style || "solid"} onChange={(next) => patchSide("styles", side, next)} options={["none","solid","dashed","dotted","double","groove","ridge","inset","outset"]} />
          </div>
          <ColorGradientControl solidOnly label="Color" value={{ type: "color", color: colors[side] || current.color || "#e3e3e3" }} onChange={(next) => patchSide("colors", side, next.color)} />
        </div>)}
      </div>}

      <BorderRadiusControl
        value={{
          mode: current.radiusMode === "individual" || Object.keys(radii).length ? "individual" : "all",
          all: current.radius || "",
          topLeft: radii.topLeft, topRight: radii.topRight, bottomRight: radii.bottomRight, bottomLeft: radii.bottomLeft,
        }}
        onChange={(next) => patch({
          radiusMode: next.mode,
          radius: next.all,
          radii: next.mode === "individual" ? { topLeft: next.topLeft, topRight: next.topRight, bottomRight: next.bottomRight, bottomLeft: next.bottomLeft } : undefined,
        })}
      />
      <div className="vsn-control-subsection">
        <div className="vsn-control-subtitle">Outline</div>
        <OutlineControl value={current.outline || {}} onChange={(outline) => patch({ outline })} />
      </div>
    </div>
  </PopoverToggleControl>;
}

export function BackgroundControl({ value = {}, onChange }) {
  const current = value || {};
  const enabled = current.enabled !== false;
  const type = current.type || "color";
  const patch = (next) => onChange?.({ ...current, ...next });
  return <PopoverToggleControl label="Background Control" icon="image" onReset={() => onChange?.({ enabled: true, type: "color", color: "transparent" })}>
    <div className="space-y-3">
      <SwitcherControl label="Enable background" checked={enabled} onChange={(nextEnabled) => patch({ enabled: nextEnabled })} description="Turn the background off without deleting its saved values." />
      {enabled ? <>
        <ButtonSetControl value={type} onChange={(v) => patch({ type: v })} options={[{value:"color",label:"Solid"},{value:"gradient",label:"Gradient"},{value:"media",label:"Media"}]} />
        {type === "color" ? <ColorGradientControl solidOnly label="Color" value={{type:"color",color:current.color||"#ffffff"}} onChange={(v)=>patch({color:v.color})}/> : null}
        {type === "gradient" ? <ColorGradientControl gradientOnly label="Gradient" value={{type:"gradient",gradientType:current.gradientType||"linear",stops:current.stops,from:current.from||"#ffffff",to:current.to||"#000000",angle:current.angle??135}} onChange={(v)=>patch(v)}/> : null}
        {type === "media" ? <MediaControl label="Background media" value={current.media || {}} onChange={(media)=>patch({media})}/> : null}
        <div className="grid grid-cols-2 gap-2"><SelectControl label="Size" value={current.size || "cover"} onChange={(v)=>patch({size:v})} options={["cover","contain","auto","100% 100%"]}/><SelectControl label="Repeat" value={current.repeat || "no-repeat"} onChange={(v)=>patch({repeat:v})} options={["no-repeat","repeat","repeat-x","repeat-y"]}/></div>
        <TextControl label="Position" value={current.position || "center center"} onChange={(v)=>patch({position:v})}/>
        <SelectControl label="Attachment" value={current.attachment || "scroll"} onChange={(v)=>patch({attachment:v})} options={["scroll","fixed","local"]}/>
      </> : null}
    </div>
  </PopoverToggleControl>;
}

export function ExitAnimationControl({ label = "Exit Animation", value = "default", onChange }) {
  return <SelectControl label={label} value={value || "default"} onChange={onChange} options={[{value:"default",label:"Default"},{value:"none",label:"None"},{value:"fade-out",label:"Fade Out"},{value:"slide-up-out",label:"Slide Up Out"},{value:"slide-down-out",label:"Slide Down Out"},{value:"zoom-out",label:"Zoom Out"}]} />;
}

export function HoverAnimationControl({ label = "Hover Animation", value = "none", onChange }) {
  return <SelectControl label={label} value={value || "none"} onChange={onChange} options={[{value:"none",label:"None"},{value:"lift",label:"Lift"},{value:"scale",label:"Scale"},{value:"shrink",label:"Shrink"},{value:"fade",label:"Fade"},{value:"rotate",label:"Rotate"}]} />;
}

export function UrlControl({ label = "Link", value = {}, onChange }) {
  const current = typeof value === "string" ? { url: value } : (value || {});
  const [advanced, setAdvanced] = useState(false);
  const patch = (next) => onChange?.({ ...current, ...next });
  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-end gap-1"><div className="min-w-0 flex-1"><VsnUrlField label="URL" labelAccessibilityVisibility="exclusive" value={current.url || ""} placeholder="Paste URL or type" onInput={(event) => patch({ url: event.currentTarget.value || "" })} /></div><VsnButton type="button" title="Link settings" aria-expanded={advanced} onClick={() => setAdvanced((v) => !v)} className={`flex w-10 items-center justify-center rounded-r-lg border border-l-0 border-[#d9d9d9] ${advanced ? "bg-[#eaf7f2] text-[#6AAB1F]" : "bg-[#f6f6f7] text-[#6d7175]"}`}><PolarisIcon type="settings" size="small" /></VsnButton></div>
      {advanced ? <div className="space-y-2 rounded-lg border border-[#e3e3e3] bg-[#fafafa] p-2"><SwitcherControl label="Open in new window" checked={current.newWindow === true} onChange={(checked) => patch({ newWindow: checked })} /><SwitcherControl label="Add nofollow" checked={current.nofollow === true} onChange={(checked) => patch({ nofollow: checked })} /><TextControl label="Custom Attributes" value={current.customAttributes || ""} placeholder="key|value, aria-label|Example" onChange={(next) => patch({ customAttributes: next })} /></div> : null}
    </div>
  );
}
