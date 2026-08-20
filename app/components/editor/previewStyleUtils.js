export function getSize(value, fallback = "auto") {
  if (typeof value === "number") return `${value}px`;
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const number = value.desktop ?? value.value ?? value.tablet ?? value.mobile;
    if (number !== undefined) return `${number}${value.unit || "px"}`;
  }
  return fallback;
}

export function getSpacing(value, fallback = 0) {
  if (typeof value === "number") return `${value}px`;
  if (typeof value === "string") return value;
  const source = value?.desktop || value || {};
  const unit = source.unit || "px";
  return `${source.top ?? fallback}${unit} ${source.right ?? fallback}${unit} ${source.bottom ?? fallback}${unit} ${source.left ?? fallback}${unit}`;
}
