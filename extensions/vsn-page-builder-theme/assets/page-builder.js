(function () {
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
			script.addEventListener("error", () => { marker.dataset.vsnCustomJsLoaded = "0"; }, { once: true });
			root.appendChild(script);
		});
	}

	async function loadBuilderBlock(block) {
		if (!block || block.dataset.vsnLoaded === "true") {
			return;
		}

		const handle = String(
			block.dataset.pageHandle || "",
		).trim();

		const proxyPath = String(
			block.dataset.proxyPath || "/apps/vsn-builder",
		).replace(/\/+$/, "");

		if (!handle) {
			return;
		}

		block.dataset.vsnLoaded = "true";

		try {
			const response = await fetch(
				`${proxyPath}/${encodeURIComponent(handle)}?fragment=1`,
				{
					method: "GET",
					credentials: "same-origin",
					headers: {
						Accept: "text/html",
					},
				},
			);

			if (!response.ok) {
				throw new Error(
					`Builder request failed: ${response.status}`,
				);
			}

			const html = await response.text();

			if (!html.trim()) {
				throw new Error(
					"Builder returned an empty response.",
				);
			}

			block.innerHTML = html;
			loadCustomJavascript(block);
		} catch (error) {
			console.error(
				"VSN Builder:",
				error,
			);

			block.innerHTML = `
        <div class="vsn-builder-message vsn-builder-error">
          Builder content could not be loaded.
        </div>
      `;

			block.dataset.vsnLoaded = "false";
		}
	}

	function initializeBuilderBlocks(root = document) {
		root
			.querySelectorAll(".vsn-builder-block")
			.forEach(loadBuilderBlock);
	}

	if (document.readyState === "loading") {
		document.addEventListener(
			"DOMContentLoaded",
			() => initializeBuilderBlocks(),
		);
	} else {
		initializeBuilderBlocks();
	}

	document.addEventListener(
		"shopify:section:load",
		(event) => {
			initializeBuilderBlocks(event.target);
		},
	);

	document.addEventListener(
		"shopify:block:select",
		(event) => {
			const block =
				event.target.matches?.(
					".vsn-builder-block",
				)
					? event.target
					: event.target.querySelector?.(
						".vsn-builder-block",
					);

			if (block) {
				block.dataset.vsnLoaded = "false";
				loadBuilderBlock(block);
			}
		},
	);
})();