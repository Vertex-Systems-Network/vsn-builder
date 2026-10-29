import { CheckboxControl, ColorGradientControl, SelectControl, SliderControl, TextControl } from "./EditorControls";
import { SHAPE_DIVIDER_OPTIONS } from "../../builder/sectionDecorations.js";

// Background overlay, background video and top/bottom shape dividers.
const LAYOUT_TYPES = new Set(["section", "container", "columns", "banner", "global-section"]);
const SHAPES = [{ value: "", label: "None" }, ...SHAPE_DIVIDER_OPTIONS.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))];

function DividerControls({ label, value = {}, onChange }) {
  return <div className="space-y-2 rounded-lg border border-[#e3e3e3] p-2">
    <SelectControl label={label} value={value.shape || ""} onChange={(shape) => onChange({ ...value, shape })} options={SHAPES} />
    {value.shape ? <>
      <ColorGradientControl solidOnly label="Color" value={{ type: "color", color: value.color || "#ffffff" }} onChange={(next) => onChange({ ...value, color: next.color })} />
      <SliderControl label="Height" value={Number(value.height) || 80} min={10} max={400} suffix="px" onChange={(height) => onChange({ ...value, height })} />
      <CheckboxControl label="Flip horizontally" checked={value.flip === true} onChange={(flip) => onChange({ ...value, flip })} />
    </> : null}
  </div>;
}

export default function SectionDecorationsPanel({ element, styles, patchStyles, Panel }) {
  const background = styles.background || {};
  const overlay = background.overlay || {};
  const divider = styles.shapeDivider || {};
  const layoutType = LAYOUT_TYPES.has(element?.type);
  const active = overlay.enabled || background.video?.url || divider.top?.shape || divider.bottom?.shape;
  return <Panel title="Overlay, Video & Shapes" defaultOpen={false} badge={active ? "ACTIVE" : ""}>
    <CheckboxControl label="Background overlay" checked={overlay.enabled === true} onChange={(enabled) => patchStyles({ background: { ...background, overlay: { color: "#000000", opacity: 40, ...overlay, enabled } } })} />
    {overlay.enabled ? <div className="grid grid-cols-2 gap-2">
      <ColorGradientControl solidOnly label="Overlay color" value={{ type: "color", color: overlay.color || "#000000" }} onChange={(next) => patchStyles({ background: { ...background, overlay: { ...overlay, color: next.color } } })} />
      <SliderControl label="Overlay opacity" value={Number(overlay.opacity ?? 40)} min={0} max={100} suffix="%" onChange={(opacity) => patchStyles({ background: { ...background, overlay: { ...overlay, opacity } } })} />
    </div> : null}
    {layoutType ? <>
      <TextControl label="Background video (https .mp4 / .webm)" value={background.video?.url || ""} placeholder="https://cdn.shopify.com/videos/....mp4" onChange={(url) => patchStyles({ background: { ...background, video: { ...(background.video || {}), url } } })} />
      <DividerControls label="Top shape divider" value={divider.top} onChange={(top) => patchStyles({ shapeDivider: { ...divider, top } })} />
      <DividerControls label="Bottom shape divider" value={divider.bottom} onChange={(bottom) => patchStyles({ shapeDivider: { ...divider, bottom } })} />
    </> : null}
  </Panel>;
}
