import { useRef, useState } from "react";
import { AnchoredOverlay } from "../editor/OverlayManager";
import { VsnColorPicker } from "../editor/color/ColorStudio.jsx";

// The editor's colour picker as a compact swatch field for any form.
export default function ColorField({ value = "#000000", onChange, onInput, disabled = false, "aria-label": ariaLabel }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const emit = (next) => { const target = { value: next }; onChange?.({ target, currentTarget: target }); onInput?.({ target, currentTarget: target }); };
  return <>
    <button ref={triggerRef} type="button" className="vsn-sselect vsn-colorfield" disabled={disabled} aria-label={ariaLabel} aria-expanded={open} onClick={() => setOpen((state) => !state)}>
      <span className="vsn-colorfield__swatch" style={{ background: value || "transparent" }} />
      <span className="vsn-sselect__value">{String(value || "").toUpperCase() || "Choose colour"}</span>
    </button>
    <AnchoredOverlay open={open} anchorRef={triggerRef} placement="bottom-start" width={290} maxWidth="calc(100vw - 20px)" className="vsn-color-popover" onRequestClose={() => setOpen(false)}>
      <VsnColorPicker value={value || "#000000"} onChange={emit} />
    </AnchoredOverlay>
  </>;
}
