import { useRef } from "react";

export default function PanelResizeHandle({ side = "left", value, onChange, min = 220, max = 768 }) {
  const valueRef = useRef(value);
  valueRef.current = value;

  const startResize = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startValue = Number(valueRef.current || 256);
    document.body.classList.add("vsn-resizing-panels");

    const onMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const raw = side === "left" ? startValue + delta : startValue - delta;
      onChange?.(Math.max(min, Math.min(max, Math.round(raw))));
    };
    const onUp = () => {
      document.body.classList.remove("vsn-resizing-panels");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${side} editor panel`}
      onPointerDown={startResize}
      className="vsn-panel-resizer relative z-20 w-1.5 shrink-0 cursor-col-resize bg-transparent transition hover:bg-[#95BF47]/20"
      title="Drag to resize panel"
    >
      <div className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-[#e3e3e3]" />
    </div>
  );
}
