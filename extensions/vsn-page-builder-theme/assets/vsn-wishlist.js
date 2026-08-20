(() => {
  const STORAGE_KEY = "vsn:wishlist:v2";
  const LEGACY_KEY = "vsn:wishlist:v1";
  const CHANGE_EVENT = "vsn:wishlist:change";
  const PROXY_URL = "/apps/vsn-builder/runtime";
  const MAX_ITEMS = 500;
  let scheduled = false;
  let serverSyncTimer = null;
  let syncing = false;
  let hydratedServer = false;

  const context = () => window.VSN_PAGE_CONTEXT || {};
  const isLoggedIn = () => Boolean(context().customerLoggedIn);

  function clean(value, max = 700) { return String(value == null ? "" : value).trim().slice(0, max); }
  function itemKey(item) {
    const explicit = clean(item?.key, 360);
    if (explicit) return explicit;
    const base = clean(item?.productId || item?.handle, 180);
    const variant = clean(item?.variantId, 180);
    return variant ? `${base}::${variant}` : base;
  }
  function normalize(items) {
    const out = [];
    const seen = new Set();
    for (const raw of Array.isArray(items) ? items : []) {
      if (!raw || typeof raw !== "object") continue;
      const productId = clean(raw.productId, 180).split("/").pop();
      const variantId = clean(raw.variantId, 180).split("/").pop();
      const handle = clean(raw.handle, 255);
      const key = itemKey({ ...raw, productId: productId || handle, variantId, handle });
      if (!key || (!productId && !handle) || seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        productId,
        variantId,
        handle,
        title: clean(raw.title || "Product", 240) || "Product",
        url: clean(raw.url || (handle ? `/products/${handle}` : ""), 700),
        image: clean(raw.image, 1400),
        price: clean(raw.price, 80),
        currency: clean(raw.currency, 20),
        available: raw.available !== false,
        live: raw.live === true,
        addedAt: Number.isFinite(Date.parse(raw.addedAt || "")) ? new Date(raw.addedAt).toISOString() : new Date().toISOString(),
      });
      if (out.length >= MAX_ITEMS) break;
    }
    return out;
  }
  function merge(local, server) {
    return normalize([...normalize(local), ...normalize(server)].sort((a, b) => Date.parse(b.addedAt || 0) - Date.parse(a.addedAt || 0)));
  }
  function readRaw(key) {
    try { const parsed = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  function read() {
    const current = normalize(readRaw(STORAGE_KEY));
    if (current.length) return current;
    const legacy = normalize(readRaw(LEGACY_KEY));
    if (legacy.length) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy)); localStorage.removeItem(LEGACY_KEY); } catch {}
    }
    return legacy;
  }
  function emit(items, source = "local") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { items, count: items.length, source, authenticated: isLoggedIn() } }));
  }
  function write(items, { source = "local", pushServer = true } = {}) {
    const next = normalize(items);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    emit(next, source);
    scheduleRender();
    if (pushServer && isLoggedIn() && hydratedServer) scheduleServerSave(next);
    return next;
  }

  function currentVariantId(button) {
    if (button.dataset.vsnWishlistVariantMode !== "current") return "";
    const scope = button.closest("product-info, product-form, form, [data-product-root], [data-product]") || document;
    const input = scope.querySelector?.('input[name="id"]:checked, select[name="id"], input[name="id"]');
    return clean(input?.value || button.dataset.vsnVariantId, 180);
  }
  function itemFromButton(button) {
    const productId = clean(button.dataset.vsnProductId, 180);
    const handle = clean(button.dataset.vsnProductHandle, 255);
    const variantId = currentVariantId(button);
    const variantMode = button.dataset.vsnWishlistVariantMode === "current" ? "current" : "product";
    return normalize([{
      key: variantMode === "current" && variantId ? `${productId || handle}::${variantId}` : (productId || handle),
      productId,
      variantId: variantMode === "current" ? variantId : "",
      handle,
      title: button.dataset.vsnProductTitle || "Product",
      url: button.dataset.vsnProductUrl || (handle ? `/products/${handle}` : ""),
      image: button.dataset.vsnProductImage || "",
      price: button.dataset.vsnProductPrice || "",
      currency: button.dataset.vsnProductCurrency || context().currency || "",
      addedAt: new Date().toISOString(),
    }])[0] || null;
  }

  function renderButton(button, items) {
    const item = itemFromButton(button);
    const key = itemKey(item);
    const active = Boolean(key && items.some((row) => itemKey(row) === key));
    const showIcon = button.dataset.vsnWishlistShowIcon !== "0";
    const addText = button.dataset.vsnWishlistAddText || "Add to wishlist";
    const removeText = button.dataset.vsnWishlistRemoveText || "Remove from wishlist";
    const label = active ? removeText : addText;
    const text = `${showIcon ? (active ? "♥ " : "♡ ") : ""}${label}`;
    if (button.textContent !== text) button.textContent = text;
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.setAttribute("aria-label", label);
    button.classList.toggle("is-active", active);
  }
  function renderCount(node, count) {
    const prefix = node.dataset.vsnWishlistPrefix || "";
    const suffix = node.dataset.vsnWishlistSuffix || "";
    const empty = node.dataset.vsnWishlistEmpty || "0";
    const text = `${prefix}${count ? count : empty}${suffix}`;
    if (node.textContent !== text) node.textContent = text;
    node.dataset.vsnWishlistValue = String(count);
  }
  function money(item) {
    const amount = Number(item.price);
    if (!Number.isFinite(amount)) return clean(item.price, 80);
    const currency = clean(item.currency || context().currency || "USD", 20) || "USD";
    const locale = document.documentElement.lang || navigator.language || "en";
    try { return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount); } catch { return `${amount.toFixed(2)} ${currency}`; }
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function cardFor(item, grid) {
    const card = element("article", "vsn-wishlist-card");
    card.setAttribute("role", "listitem");
    card.dataset.vsnWishlistKey = itemKey(item);
    const url = item.url || (item.handle ? `/products/${item.handle}` : "#");
    if (grid.dataset.vsnWishlistShowImage !== "0" && item.image) {
      const link = element("a", "vsn-wishlist-card-image-link"); link.href = url;
      const img = element("img", "vsn-wishlist-card-image"); img.src = item.image; img.alt = item.title || "Product"; img.loading = "lazy"; img.decoding = "async";
      img.style.aspectRatio = grid.dataset.vsnWishlistImageRatio || "1 / 1"; link.appendChild(img); card.appendChild(link);
    }
    const content = element("div", "vsn-wishlist-card-content");
    if (grid.dataset.vsnWishlistShowTitle !== "0") { const title = element("a", "vsn-wishlist-card-title", item.title || "Product"); title.href = url; content.appendChild(title); }
    if (grid.dataset.vsnWishlistShowPrice !== "0" && item.price !== "") content.appendChild(element("span", "vsn-wishlist-card-price", money(item)));
    if (item.available === false) content.appendChild(element("span", "vsn-wishlist-card-unavailable", grid.dataset.vsnWishlistSoldOutText || "Sold out"));
    if (grid.dataset.vsnWishlistShowRemove !== "0") {
      const remove = element("button", "vsn-wishlist-card-remove", grid.dataset.vsnWishlistRemoveText || "Remove");
      remove.type = "button"; remove.dataset.vsnWishlistRemoveKey = itemKey(item); remove.setAttribute("aria-label", `${remove.textContent}: ${item.title || "Product"}`); content.appendChild(remove);
    }
    card.appendChild(content); return card;
  }
  function renderGrid(grid, items) {
    const limit = Math.max(1, Math.min(48, Number(grid.dataset.vsnWishlistLimit || 24) || 24));
    grid.style.setProperty("--vsn-wishlist-cols-desktop", String(Math.max(1, Math.min(6, Number(grid.dataset.vsnWishlistColumnsDesktop || 4) || 4))));
    grid.style.setProperty("--vsn-wishlist-cols-tablet", String(Math.max(1, Math.min(4, Number(grid.dataset.vsnWishlistColumnsTablet || 2) || 2))));
    grid.style.setProperty("--vsn-wishlist-cols-mobile", String(Math.max(1, Math.min(2, Number(grid.dataset.vsnWishlistColumnsMobile || 1) || 1))));
    const nextKeys = items.slice(0, limit).map(itemKey).join("|");
    if (grid.dataset.vsnWishlistRenderedKeys === nextKeys) return;
    grid.dataset.vsnWishlistRenderedKeys = nextKeys;
    grid.replaceChildren(...items.slice(0, limit).map((item) => cardFor(item, grid)));
  }
  function renderEmpty(node, count) { node.hidden = count > 0; node.setAttribute("aria-hidden", count > 0 ? "true" : "false"); }
  function render() {
    scheduled = false;
    const items = read();
    document.querySelectorAll("[data-vsn-wishlist-button]").forEach((node) => renderButton(node, items));
    document.querySelectorAll("[data-vsn-wishlist-count]").forEach((node) => renderCount(node, items.length));
    document.querySelectorAll("[data-vsn-wishlist-grid]").forEach((node) => renderGrid(node, items));
    document.querySelectorAll("[data-vsn-wishlist-empty-state]").forEach((node) => renderEmpty(node, items.length));
  }
  function scheduleRender() { if (!scheduled) { scheduled = true; requestAnimationFrame(render); } }

  async function loadServerWishlist() {
    if (!isLoggedIn() || syncing) { hydratedServer = true; return; }
    syncing = true;
    try {
      const url = new URL(PROXY_URL, location.origin); url.searchParams.set("wishlist", "1"); url.searchParams.set("limit", "60");
      const response = await fetch(`${url.pathname}${url.search}`, { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Wishlist load failed (${response.status})`);
      const data = await response.json();
      if (!data?.authenticated) { hydratedServer = true; return; }
      const combined = merge(read(), data.items || []);
      write(combined, { source: "server-merge", pushServer: false });
      hydratedServer = true;
      await saveServerWishlist(combined, "replace");
      refreshMarketSnapshots(combined).catch(() => {});
    } catch (error) {
      hydratedServer = true;
      console.warn("VSN wishlist server hydration:", error?.message || error);
    } finally { syncing = false; }
  }
  async function saveServerWishlist(items, mode = "replace") {
    if (!isLoggedIn()) return false;
    const form = new FormData(); form.set("_vsnAction", "wishlist-sync"); form.set("mode", mode); form.set("items", JSON.stringify(normalize(items)));
    try {
      const response = await fetch(PROXY_URL, { method: "POST", credentials: "same-origin", headers: { Accept: "application/json" }, body: form });
      if (!response.ok) throw new Error(`Wishlist save failed (${response.status})`);
      const data = await response.json();
      if (data?.authenticated && Array.isArray(data.items)) write(data.items, { source: "server-save", pushServer: false });
      return Boolean(data?.ok);
    } catch (error) { console.warn("VSN wishlist server save:", error?.message || error); return false; }
  }
  function scheduleServerSave(items) {
    clearTimeout(serverSyncTimer);
    serverSyncTimer = setTimeout(() => { serverSyncTimer = null; saveServerWishlist(items, "replace"); }, 450);
  }

  async function refreshMarketSnapshots(items) {
    const candidates = normalize(items).filter((item) => item.handle).slice(0, 48);
    if (!candidates.length) return;
    const results = await Promise.allSettled(candidates.map(async (item) => {
      const response = await fetch(`/products/${encodeURIComponent(item.handle)}.js`, { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) return null;
      const product = await response.json();
      const variants = Array.isArray(product.variants) ? product.variants : [];
      const selected = item.variantId ? variants.find((variant) => String(variant.id) === String(item.variantId)) : variants.find((variant) => variant.available) || variants[0];
      const image = selected?.featured_image?.src || product.featured_image || item.image;
      return { ...item, title: product.title || item.title, url: product.url || `/products/${product.handle || item.handle}`, image, price: selected && Number.isFinite(Number(selected.price)) ? String(Number(selected.price) / 100) : item.price, currency: context().currency || item.currency, available: selected ? selected.available !== false : item.available, live: true };
    }));
    const byKey = new Map();
    results.forEach((result) => { if (result.status === "fulfilled" && result.value) byKey.set(itemKey(result.value), result.value); });
    if (!byKey.size) return;
    const next = read().map((item) => byKey.get(itemKey(item)) || item);
    write(next, { source: "market-refresh", pushServer: false });
  }

  document.addEventListener("click", (event) => {
    const remove = event.target.closest?.("[data-vsn-wishlist-remove-key]");
    if (remove) {
      event.preventDefault(); const key = clean(remove.dataset.vsnWishlistRemoveKey, 360);
      write(read().filter((item) => itemKey(item) !== key)); return;
    }
    const button = event.target.closest?.("[data-vsn-wishlist-button]");
    if (!button || button.disabled) return;
    event.preventDefault();
    const item = itemFromButton(button); if (!item) return;
    const items = read(); const index = items.findIndex((row) => itemKey(row) === item.key);
    if (index >= 0) items.splice(index, 1); else items.unshift(item);
    write(items);
  });
  document.addEventListener("change", (event) => { if (event.target?.matches?.('input[name="id"], select[name="id"]')) scheduleRender(); });
  window.addEventListener("storage", (event) => { if (event.key === STORAGE_KEY || event.key === LEGACY_KEY) scheduleRender(); });
  window.addEventListener(CHANGE_EVENT, scheduleRender);
  document.addEventListener("DOMContentLoaded", scheduleRender, { once: true });
  const observer = new MutationObserver((records) => { if (records.some((record) => record.addedNodes?.length)) scheduleRender(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scheduleRender();
  queueMicrotask(loadServerWishlist);

  window.VSNWishlist = Object.freeze({
    version: 2,
    getItems: () => read().map((item) => ({ ...item })),
    count: () => read().length,
    clear: () => write([]),
    remove: (key) => write(read().filter((item) => itemKey(item) !== String(key || ""))),
    sync: () => isLoggedIn() ? loadServerWishlist() : Promise.resolve(),
    storageKey: STORAGE_KEY,
  });
})();
