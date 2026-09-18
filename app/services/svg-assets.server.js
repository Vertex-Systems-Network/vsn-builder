const MAX_SVG_BYTES = 512 * 1024;
const EMPTY_SAFE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>';

function stripDangerousMarkup(svg) {
  let value = String(svg || "").replace(/^\uFEFF/, "").trim();
  if (!/^<svg[\s>]/i.test(value) || !/<\/svg>\s*$/i.test(value)) throw new Error("The file must contain a complete <svg> document.");
  if (Buffer.byteLength(value, "utf8") > MAX_SVG_BYTES) throw new Error("SVG files must be 512 KB or smaller.");

  value = value
    .replace(/<\?(?:xml|[^?]+)\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<(?:iframe|object|embed|foreignObject|audio|video)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed|foreignObject|audio|video)>/gi, "")
    .replace(/<(?:script|style|iframe|object|embed|foreignObject|audio|video)\b[^>]*\/?\s*>/gi, "")
    .replace(/\s+on[a-z0-9:_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(?:href|xlink:href|src)\s*=\s*(["'])(?!\s*#)[\s\S]*?\1/gi, "")
    .replace(/\s+(?:href|xlink:href|src)\s*=\s*(?!["'])[^\s>]+/gi, "")
    .replace(/\s+style\s*=\s*(["'])[^"']*(?:url\s*\(|expression\s*\(|javascript\s*:|data\s*:\s*text\/html)[\s\S]*?\1/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:\s*text\/html/gi, "")
    .replace(/url\s*\(\s*(["']?)\s*(?:javascript\s*:|data\s*:\s*text\/html)[^)]*\1\s*\)/gi, "none");

  if (/\son[a-z0-9:_-]+\s*=|<\s*(?:script|iframe|object|embed|foreignObject|style)\b|javascript\s*:|data\s*:\s*text\/html/i.test(value)) {
    throw new Error("SVG contains executable or embedded document content that VSN cannot store safely.");
  }
  return value;
}

export function sanitizeSvg(svg) { return stripDangerousMarkup(svg); }
export function safeSvgName(value, fallback = "Custom SVG") { return String(value || fallback).trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, 120) || fallback; }
export function safeSvgFileName(value, fallback = "custom.svg") { let name = String(value || fallback).trim().replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 140) || fallback; if (!name.toLowerCase().endsWith(".svg")) name += ".svg"; return name; }
export function serializeSvgAsset(row) {
  let svgText = EMPTY_SAFE_SVG;
  try { svgText = sanitizeSvg(row?.svgText || ""); } catch {}
  return { ...row, svgText, editorUrl: `/app/svg-assets/${row.id}`, storefrontUrl: `/apps/vsn-builder/svg/${row.id}`, source: "vsn-svg" };
}
