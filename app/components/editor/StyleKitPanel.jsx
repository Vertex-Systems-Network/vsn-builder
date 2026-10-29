import { useState } from "react";
import { VsnButton, VsnTextField } from "./EditorUi";
import { normalizeStyleKit, slugColorId, SYSTEM_COLORS, TYPOGRAPHY_PRESETS } from "../../builder/styleKit.js";
import SearchableSelect from "../ui/SearchableSelect.jsx";

const FIELDS = [["fontSize", "Size", "48px"], ["fontWeight", "Weight", "700"], ["lineHeight", "Line height", "1.2"], ["letterSpacing", "Letter spacing", "0px"]];

function Field({ label, value, placeholder, onChange }) {
  return <label className="vsn-kit-field"><span>{label}</span><VsnTextField label={label} labelAccessibilityVisibility="exclusive" value={value ?? ""} placeholder={placeholder} onInput={(event) => onChange(event.currentTarget.value)} /></label>;
}

// Elementor-style Site Settings: global colours, typography presets, buttons and images.
// Section and ColorInput come from the inspector so the kit matches the panel styling.
export default function StyleKitPanel({ globalStyles = {}, onChange, Section, ColorInput }) {
  const kit = normalizeStyleKit(globalStyles);
  const [openPreset, setOpenPreset] = useState("h1");
  const [newColor, setNewColor] = useState("");
  const setPreset = (key, patch) => onChange?.({ typographyPresets: { ...(globalStyles.typographyPresets || {}), [key]: { ...(globalStyles.typographyPresets?.[key] || {}), ...patch } } });
  const setColors = (customColors) => onChange?.({ customColors });
  const addColor = () => {
    const label = newColor.trim() || `Color ${kit.customColors.length + 1}`;
    let id = slugColorId(label); let n = 2;
    while (kit.customColors.some((row) => row.id === id) || SYSTEM_COLORS.some(([system]) => system === id)) id = `${slugColorId(label)}-${n++}`;
    setColors([...kit.customColors, { id, label, value: "#625BA8" }]);
    setNewColor("");
  };
  return <>
    <Section title="Global Colors">
      <p className="vsn-field-caption">Pick these from any colour control. Changing one here updates every element that uses it.</p>
      <div className="vsn-kit-color-list">
        {SYSTEM_COLORS.map(([id, label, key]) => <div key={id} className="vsn-kit-color-row"><span className="vsn-kit-color-name">{label}<small>System</small></span><ColorInput value={globalStyles[key] || ""} onChange={(value) => onChange?.({ [key]: value })} /></div>)}
        {kit.customColors.map((row, index) => <div key={row.id} className="vsn-kit-color-row">
          <VsnTextField label="Colour name" labelAccessibilityVisibility="exclusive" value={row.label} onInput={(event) => setColors(kit.customColors.map((item, i) => i === index ? { ...item, label: event.currentTarget.value } : item))} />
          <ColorInput value={row.value} onChange={(value) => setColors(kit.customColors.map((item, i) => i === index ? { ...item, value } : item))} />
          <VsnButton size="sm" variant="tertiary" onClick={() => setColors(kit.customColors.filter((_, i) => i !== index))} aria-label={`Remove ${row.label}`}>Remove</VsnButton>
        </div>)}
      </div>
      <div className="vsn-kit-add-row"><VsnTextField label="New colour name" labelAccessibilityVisibility="exclusive" placeholder="e.g. Brand gold" value={newColor} onInput={(event) => setNewColor(event.currentTarget.value)} /><VsnButton size="sm" onClick={addColor}>Add colour</VsnButton></div>
    </Section>
    <Section title="Typography Presets">
      <p className="vsn-field-caption">Defaults for headings, body text and buttons. A widget&apos;s own typography always wins.</p>
      <div className="vsn-kit-preset-tabs" role="tablist">{Object.entries(TYPOGRAPHY_PRESETS).map(([key, row]) => <button key={key} type="button" role="tab" aria-selected={openPreset === key} className={openPreset === key ? "is-active" : ""} onClick={() => setOpenPreset(key)}>{row.label}</button>)}</div>
      <div className="vsn-kit-preset-sample" style={{ fontSize: kit.typography[openPreset].fontSize, fontWeight: kit.typography[openPreset].fontWeight, lineHeight: kit.typography[openPreset].lineHeight, letterSpacing: kit.typography[openPreset].letterSpacing || undefined, textTransform: kit.typography[openPreset].textTransform || undefined }}>{TYPOGRAPHY_PRESETS[openPreset].label} sample</div>
      <div className="grid grid-cols-2 gap-2">{FIELDS.map(([field, label, placeholder]) => <Field key={field} label={label} placeholder={placeholder} value={globalStyles.typographyPresets?.[openPreset]?.[field] ?? kit.typography[openPreset][field]} onChange={(value) => setPreset(openPreset, { [field]: value })} />)}</div>
      <label className="vsn-kit-field"><span>Transform</span><SearchableSelect value={kit.typography[openPreset].textTransform || ""} onChange={(event) => setPreset(openPreset, { textTransform: event.currentTarget.value })}><option value="">None</option><option value="uppercase">Uppercase</option><option value="capitalize">Capitalize</option><option value="lowercase">Lowercase</option></SearchableSelect></label>
    </Section>
    <Section title="Button & Image Defaults">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Padding Y" placeholder="12px" value={globalStyles.buttonPaddingY ?? ""} onChange={(buttonPaddingY) => onChange?.({ buttonPaddingY })} />
        <Field label="Padding X" placeholder="22px" value={globalStyles.buttonPaddingX ?? ""} onChange={(buttonPaddingX) => onChange?.({ buttonPaddingX })} />
      </div>
      <div><span className="vsn-field-caption">Button hover background</span><ColorInput value={globalStyles.buttonHoverBackground || globalStyles.buttonBackground || "#1a1a1a"} onChange={(buttonHoverBackground) => onChange?.({ buttonHoverBackground })} /></div>
      <Field label="Image radius" placeholder="0px" value={globalStyles.imageRadius ?? ""} onChange={(imageRadius) => onChange?.({ imageRadius })} />
    </Section>
  </>;
}
