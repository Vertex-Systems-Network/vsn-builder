import { PopoverToggleControl, SliderControl, TextControl } from "./EditorControls";

/**
 * Stable CSS filter editor kept in its own module so route/module splitting can
 * never leave the inspector with an unresolved CssFilterControl reference.
 */
export default function FilterEffectsControl({ value = {}, onChange }) {
  const current = value || {};
  const patch = (next) => onChange?.({ ...current, ...next });

  return (
    <PopoverToggleControl label="CSS Filter" icon="filter" onReset={() => onChange?.({})}>
      <div className="space-y-2">
        <SliderControl label="Blur" value={current.blur ?? 0} min={0} max={40} suffix="px" onChange={(v) => patch({ blur: Number(v) })} />
        <SliderControl label="Brightness" value={current.brightness ?? 100} min={0} max={300} suffix="%" onChange={(v) => patch({ brightness: Number(v) })} />
        <SliderControl label="Contrast" value={current.contrast ?? 100} min={0} max={300} suffix="%" onChange={(v) => patch({ contrast: Number(v) })} />
        <SliderControl label="Saturate" value={current.saturate ?? 100} min={0} max={300} suffix="%" onChange={(v) => patch({ saturate: Number(v) })} />
        <SliderControl label="Hue rotate" value={current.hueRotate ?? 0} min={0} max={360} suffix="°" onChange={(v) => patch({ hueRotate: Number(v) })} />
        <SliderControl label="Grayscale" value={current.grayscale ?? 0} min={0} max={100} suffix="%" onChange={(v) => patch({ grayscale: Number(v) })} />
        <SliderControl label="Sepia" value={current.sepia ?? 0} min={0} max={100} suffix="%" onChange={(v) => patch({ sepia: Number(v) })} />
        <SliderControl label="Invert" value={current.invert ?? 0} min={0} max={100} suffix="%" onChange={(v) => patch({ invert: Number(v) })} />
        <SliderControl label="Filter opacity" value={current.opacity ?? 100} min={0} max={100} suffix="%" onChange={(v) => patch({ opacity: Number(v) })} />
        <TextControl label="Drop shadow" value={current.dropShadow || ""} placeholder="0 8px 20px rgba(0,0,0,.2)" onChange={(v) => patch({ dropShadow: v })} />
      </div>
    </PopoverToggleControl>
  );
}
