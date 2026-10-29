// Opens a storefront preview in a new browser tab, outside the Shopify admin.
// The tab is opened synchronously (inside the click) so popup blockers allow it,
// then sent to the signed storefront URL once /app/preview-link answers.
export function openPreviewTab() {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.document.title = "Opening preview…";
  return tab;
}

export async function navigatePreviewTab(tab, params) {
  try {
    const response = await fetch(`/app/preview-link?${new URLSearchParams(params)}`, { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) throw new Error(data.error || `Preview failed (${response.status})`);
    if (tab && !tab.closed) tab.location.href = data.url;
    else window.open(data.url, "_blank");
    return data.url;
  } catch (error) {
    if (tab && !tab.closed) tab.close();
    window.shopify?.toast?.show?.(error.message || "Preview could not open.", { isError: true });
    return "";
  }
}

export function openStorefrontPreview(params) {
  return navigatePreviewTab(openPreviewTab(), params);
}
