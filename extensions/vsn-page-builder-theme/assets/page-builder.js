(function () {
  "use strict";
  // Shopify theme editor can replace or reselect a block while its previous
  // app-proxy request is still pending. Never let an obsolete response or
  // cancelled request overwrite the merchant's new preview.
  const inFlight = new WeakMap();
  function cancelBlock(block) {
    const controller = inFlight.get(block);
    if (controller) {
      controller.abort();
      inFlight.delete(block);
    }
    if (block?.dataset) block.dataset.vsnLoaded = "false";
  }

  function loadCustomJavascript(root) {
    const markers = root?.querySelectorAll?.("[data-vsn-custom-js-url]") || [];
    markers.forEach((marker) => {
      if (marker.dataset.vsnCustomJsLoaded === "1") return;
      const url = String(marker.dataset.vsnCustomJsUrl || "").trim();
      if (!url || !url.startsWith("/apps/vsn-builder/")) return;
      marker.dataset.vsnCustomJsLoaded = "1";
      const script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.dataset.vsnCustomJsRuntime = "1";
      script.addEventListener("error", () => {
        marker.dataset.vsnCustomJsLoaded = "0";
      }, { once: true });
      root.appendChild(script);
    });
  }

  async function loadBuilderBlock(block) {
    if (!block || block.dataset.vsnLoaded === "true") return;
    const handle = String(block.dataset.pageHandle || "").trim();
    const proxyPath = String(block.dataset.proxyPath || "/apps/vsn-builder")
      .replace(/\/+$/, "");
    // The app block controls a single same-origin Shopify app proxy.
    // An edited/malformed path cannot turn this fetch into an external URL.
    if (!handle || proxyPath !== "/apps/vsn-builder") return;

    cancelBlock(block);
    const controller = new AbortController();
    inFlight.set(block, controller);
    block.dataset.vsnLoaded = "true";
    const current = () => (
      inFlight.get(block) === controller &&
      !controller.signal.aborted &&
      block.isConnected
    );
    try {
      const response = await fetch(
        proxyPath + "/" + encodeURIComponent(handle) + "?fragment=1",
        {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "text/html" },
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error("Builder request failed: " + response.status);
      const html = await response.text();
      if (!current()) return;
      if (!html.trim()) throw new Error("Builder returned an empty response.");
      block.innerHTML = html;
      loadCustomJavascript(block);
    } catch (error) {
      if (!current()) return;
      console.error("VSN Builder:", error);
      block.innerHTML =
        '<div class="vsn-builder-message vsn-builder-error">' +
        "Builder content could not be loaded." +
        "</div>";
      block.dataset.vsnLoaded = "false";
    } finally {
      if (inFlight.get(block) === controller) inFlight.delete(block);
    }
  }

  function eachBuilderBlock(root, callback) {
    if (!root) return;
    // Theme editor event.target may itself be an app block, not a section.
    const seen = new Set();
    const visit = (block) => {
      if (!block || seen.has(block)) return;
      seen.add(block);
      callback(block);
    };
    if (root.matches?.(".vsn-builder-block")) visit(root);
    root.querySelectorAll?.(".vsn-builder-block").forEach(visit);
  }
  const initializeBuilderBlocks = (root = document) =>
    eachBuilderBlock(root, loadBuilderBlock);
  const unloadBuilderBlocks = (root) =>
    eachBuilderBlock(root, cancelBlock);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initializeBuilderBlocks(), {once:true});
  } else {
    initializeBuilderBlocks();
  }

  document.addEventListener("shopify:section:load", (event) => {
    initializeBuilderBlocks(event.target);
  });
  document.addEventListener("shopify:section:unload", (event) => {
    unloadBuilderBlocks(event.target);
  });
  document.addEventListener("shopify:block:select", (event) => {
    const block = event.target.matches?.(".vsn-builder-block")
      ? event.target
      : event.target.querySelector?.(".vsn-builder-block");
    if (block) {
      cancelBlock(block);
      loadBuilderBlock(block);
    }
  });
})();
