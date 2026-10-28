import { useState } from "react";
import { VsnButton } from "./EditorUi";
import { CssLengthControl, FieldLabel } from "./EditorControls";

const BOX_SIDES = [["top", "T"], ["right", "R"], ["bottom", "B"], ["left", "L"]];

// Expands a CSS box shorthand ("8px", "8px 16px", "1px 2px 3px 4px") to four sides.
export function parseBoxShorthand(value) {
  const text = String(value ?? "").trim();
  if (!text) return { top: "", right: "", bottom: "", left: "", parseable: true };
  if (/[(),]/.test(text)) return { top: text, right: text, bottom: text, left: text, parseable: false };
  const parts = text.split(/\s+/);
  if (parts.length > 4) return { top: text, right: text, bottom: text, left: text, parseable: false };
  const [top, right = top, bottom = top, left = right] = parts;
  return { top, right, bottom, left, parseable: true };
}

export function composeBoxShorthand({ top = "", right = "", bottom = "", left = "" } = {}) {
  const sides = [top, right, bottom, left].map((value) => String(value ?? "").trim());
  if (sides.every((value) => !value)) return "";
  const filled = sides.map((value) => value || "0");
  if (filled.every((value) => value === filled[0])) return filled[0];
  return filled.join(" ");
}

// Elementor-style linked/unlinked editor for single-string box values
// (padding, margin, border width, radius). Stored value stays a CSS string,
// so existing single values keep working.
export function BoxShorthandControl({ label, value = "", onChange, defaultUnit = "px" }) {
  const box = parseBoxShorthand(value);
  const [linked, setLinked] = useState(() => box.top === box.right && box.top === box.bottom && box.top === box.left);
  if (!box.parseable) return <CssLengthControl label={label} value={value} defaultUnit={defaultUnit} onChange={onChange} />;
  const setSide = (side, next) => onChange?.(composeBoxShorthand({ ...box, [side]: next }));
  return <div className="vsn-box-shorthand-control" data-vsn-box-linked={linked ? "1" : "0"}>
    <div className="vsn-dimensions-head">
      <FieldLabel>{label}</FieldLabel>
      <VsnButton type="button" variant={linked ? "primary" : "tertiary"} size="sm" aria-pressed={linked} title={linked ? "Edit each side separately" : "Use one value for all sides"} onClick={() => setLinked((current) => !current)} className="vsn-link-state">{linked ? "Linked" : "Unlinked"}</VsnButton>
    </div>
    {linked
      ? <CssLengthControl label={`${label} (all sides)`} value={box.top} defaultUnit={defaultUnit} onChange={(next) => onChange?.(composeBoxShorthand({ top: next, right: next, bottom: next, left: next }))} />
      : <div className="grid grid-cols-2 gap-2">{BOX_SIDES.map(([side, short]) => <CssLengthControl key={side} label={`${short} · ${side}`} value={box[side]} defaultUnit={defaultUnit} onChange={(next) => setSide(side, next)} />)}</div>}
  </div>;
}
