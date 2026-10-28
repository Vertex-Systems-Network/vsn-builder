// Shared Columns widget contract for the editor canvas, preview and storefront renderer.
const clamp = (value, fallback) => Math.max(1, Math.min(6, Math.round(Number(value) || fallback)));

export function normalizeColumnsProps(props = {}, childCount = 0) {
  const columns = clamp(props.columns, childCount || 2);
  return {
    columns,
    columnsTablet: clamp(props.columnsTablet, Math.min(columns, 2)),
    columnsMobile: clamp(props.columnsMobile, 1),
  };
}

export function columnsForDevice(props = {}, childCount = 0, device = "desktop") {
  const settings = normalizeColumnsProps(props, childCount);
  if (device === "mobile") return settings.columnsMobile;
  if (device === "tablet") return settings.columnsTablet;
  return settings.columns;
}

// Each column is an empty container cell, like Elementor's inner columns, so a new widget renders as a grid.
export function createColumnCell(index = 0) {
  return {
    id: `el-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${index}`}`,
    type: "container",
    label: `Column ${index + 1}`,
    props: {},
    styles: { spacing: { paddingTop: "16px", paddingRight: "16px", paddingBottom: "16px", paddingLeft: "16px" } },
    children: [],
  };
}

// Adds cells up to the column count; only trailing empty cells are removed so content is never lost.
export function syncColumnCells(children = [], count = 2) {
  const next = [...children];
  while (next.length < count) next.push(createColumnCell(next.length));
  while (next.length > count && !(next[next.length - 1]?.children || []).length) next.pop();
  return next;
}

export function columnsResponsiveCss(id, props = {}, childCount = 0) {
  const { columnsTablet, columnsMobile } = normalizeColumnsProps(props, childCount);
  const selector = `[data-vsn-id="${String(id).replace(/["\\]/g, "")}"].vsn-columns`;
  return `@media(min-width:750px) and (max-width:989px){${selector}{grid-template-columns:repeat(${columnsTablet},minmax(0,1fr))!important}}@media(max-width:749px){${selector}{grid-template-columns:repeat(${columnsMobile},minmax(0,1fr))!important}}`;
}
