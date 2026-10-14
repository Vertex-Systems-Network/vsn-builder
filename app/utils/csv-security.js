// CSV fields may contain untrusted merchant/customer-provided content.
// Quoting alone does not stop Excel/Sheets formula interpretation.
export function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[\u0000-\u0020]*[=+\-@]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}
