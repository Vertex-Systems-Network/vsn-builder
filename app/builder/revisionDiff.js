const STYLE_HINTS = ["style", "styles", "responsive", "font", "color", "background", "border", "shadow", "spacing", "padding", "margin", "width", "height", "gap", "align", "justify", "radius", "opacity", "transform", "animation", "interaction"];

function flatten(nodes, out = new Map()) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node?.id) continue;
    out.set(node.id, node);
    flatten(node.children, out);
  }
  return out;
}
function stable(value) { try { return JSON.stringify(value ?? null); } catch { return String(value); } }
function classifyKey(key) { const lower = String(key).toLowerCase(); return STYLE_HINTS.some((hint) => lower.includes(hint)) ? "style" : "content"; }

export function compareBuilderContents(current, previous) {
  const a = flatten(current); const b = flatten(previous);
  const result = { added: 0, removed: 0, contentChanges: 0, styleChanges: 0, changedNodes: [] };
  for (const [id, node] of a) {
    if (!b.has(id)) { result.added += 1; result.changedNodes.push({ id, type: "added" }); continue; }
    const before = b.get(id); let content = 0; let style = 0;
    if (node.type !== before.type) content += 1;
    const keys = new Set([...Object.keys(node.props || {}), ...Object.keys(before.props || {}), ...Object.keys(node.styles || {}), ...Object.keys(before.styles || {})]);
    for (const key of keys) {
      const afterValue = Object.prototype.hasOwnProperty.call(node.props || {}, key) ? node.props?.[key] : node.styles?.[key];
      const beforeValue = Object.prototype.hasOwnProperty.call(before.props || {}, key) ? before.props?.[key] : before.styles?.[key];
      if (stable(afterValue) === stable(beforeValue)) continue;
      if (classifyKey(key) === "style") style += 1; else content += 1;
    }
    for (const key of ["responsive", "interactions", "meta"]) if (stable(node[key]) !== stable(before[key])) style += 1;
    if (content || style) {
      result.contentChanges += content; result.styleChanges += style;
      result.changedNodes.push({ id, type: "changed", contentChanges: content, styleChanges: style });
    }
  }
  for (const [id] of b) if (!a.has(id)) { result.removed += 1; result.changedNodes.push({ id, type: "removed" }); }
  result.total = result.added + result.removed + result.contentChanges + result.styleChanges;
  return result;
}
