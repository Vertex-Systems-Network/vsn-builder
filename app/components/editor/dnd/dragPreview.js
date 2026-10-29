// Compact drag ghost shared by sidebar widgets, canvas nodes and the navigator.
// The browser default ghost for a large canvas section is a full-size bitmap,
// which is unreadable and can make Chrome abandon the drag on big sections.
export function attachDragPreview(event, label) {
  if (typeof document === "undefined" || !event?.dataTransfer?.setDragImage) return;
  document.querySelectorAll("[data-vsn-drag-preview]").forEach((node) => node.remove());
  const preview = document.createElement("div");
  preview.dataset.vsnDragPreview = "true";
  preview.textContent = label || "Widget";
  Object.assign(preview.style, { position: "fixed", left: "-10000px", top: "-10000px", zIndex: "99999", padding: "8px 12px", borderRadius: "8px", background: "#1A1F36", color: "#fff", font: "600 12px Inter, system-ui, sans-serif", boxShadow: "0 8px 24px rgba(0,0,0,.22)" });
  document.body.appendChild(preview);
  event.dataTransfer.setDragImage(preview, 18, 14);
  setTimeout(() => preview.remove(), 0);
}

// getData() is empty during dragover (protected mode), so read the type list.
// A node move must answer "move": "copy" against effectAllowed "move" makes the
// browser refuse the drop, which silently cancelled every canvas reorder.
export function dragDropEffect(event) {
  const types = Array.from(event?.dataTransfer?.types || []).map((type) => String(type).toLowerCase());
  return types.includes("vsnnodeid") ? "move" : "copy";
}

// The dragged widget type is exposed as a data *type* so dragover can read it.
export function markDragType(event, type) {
  try { event?.dataTransfer?.setData(`application/x-vsn-type-${String(type || "").toLowerCase()}`, "1"); } catch { /* best-effort */ }
}

// Sections are page-level blocks: dropping one "inside" another nests a full
// section in a section, so such drops resolve to before/after instead.
export function draggingSection(event) {
  return Array.from(event?.dataTransfer?.types || []).some((type) => String(type).toLowerCase() === "application/x-vsn-type-section");
}
