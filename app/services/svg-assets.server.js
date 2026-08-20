const MAX_SVG_BYTES = 512 * 1024;
function stripDangerousMarkup(svg) {
  let value = String(svg || "").replace(/^\uFEFF/, "").trim();
  if (!/^<svg[\s>]/i.test(value) || !/<\/svg>\s*$/i.test(value)) throw new Error("The file must contain a complete <svg> document.");
  if (Buffer.byteLength(value, "utf8") > MAX_SVG_BYTES) throw new Error("SVG files must be 512 KB or smaller.");
  value = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<(?:iframe|object|embed|foreignObject)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed|foreignObject)>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(?:href|xlink:href)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, "")
    .replace(/url\(\s*['"]?javascript:[^)]+\)/gi, "");
  return value;
}
export function sanitizeSvg(svg) { return stripDangerousMarkup(svg); }
export function safeSvgName(value, fallback = "Custom SVG") { return String(value || fallback).trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, 120) || fallback; }
export function safeSvgFileName(value, fallback = "custom.svg") { let name = String(value || fallback).trim().replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 140) || fallback; if (!name.toLowerCase().endsWith(".svg")) name += ".svg"; return name; }
export function serializeSvgAsset(row) { return { ...row, editorUrl: `/app/svg-assets/${row.id}`, storefrontUrl: `/apps/vsn-builder/svg/${row.id}`, source: "vsn-svg" }; }
