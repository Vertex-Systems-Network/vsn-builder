export function getTemplateSettings(elements = []) {
  const node = (Array.isArray(elements) ? elements : []).find(
    (item) => item?.type === "template-settings",
  );

  return {
    headerEnabled: node?.props?.headerEnabled !== false,
    footerEnabled: node?.props?.footerEnabled !== false,
    headerId: String(node?.props?.headerId || ""),
    footerId: String(node?.props?.footerId || ""),
    seoTitle: String(node?.props?.seoTitle || ""),
    seoDescription: String(node?.props?.seoDescription || ""),
    canonical: String(node?.props?.canonical || ""),
    ogTitle: String(node?.props?.ogTitle || ""),
    ogDescription: String(node?.props?.ogDescription || ""),
    ogImage: String(node?.props?.ogImage || ""),
    schemaEnabled: node?.props?.schemaEnabled !== false,
    sticky: node?.props?.sticky === true,
    transparent: node?.props?.transparent === true,
    mobileMenu: node?.props?.mobileMenu !== false,
    mobileBreakpoint: Math.max(
      320,
      Math.min(1200, Number(node?.props?.mobileBreakpoint || 749)),
    ),
    fullWidth: node?.props?.fullWidth !== false,
  };
}
