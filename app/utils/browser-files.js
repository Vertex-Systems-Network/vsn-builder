/** Browser-only helpers for safe downloads and user-selected file error reporting. */
export function downloadJson(payload, filename) {
  if (typeof document === "undefined") return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function safeFileName(value) {
  return String(value || "template")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "template";
}

export function reportFilePickerError(message) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("vsn:file-picker-error", {
    detail: { message: String(message || "The selected file could not be processed.") },
  }));
}
