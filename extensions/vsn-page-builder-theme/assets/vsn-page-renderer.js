(function () {
	console.log("VSN Page Renderer loaded");

	function getContext() {
		const context =
			window.VSN_PAGE_CONTEXT || {};

		return {
			template: String(
				context.template || "",
			).trim(),

			path: String(
				context.path ||
				window.location.pathname ||
				"",
			).trim(),

			resourceId:
				context.resourceId || null,

			resourceHandle: String(
				context.resourceHandle || "",
			).trim(),

			resourceTitle: String(context.resourceTitle || "").trim(),
			searchQuery: String(context.searchQuery || "").trim(),
			blogHandle: String(context.blogHandle || "").trim(),
			articleHandle: String(context.articleHandle || "").trim(),
			pageType: String(context.pageType || "").trim(),
			customerLoggedIn: context.customerLoggedIn === true,
			customerId: context.customerId || null,
			customerName: String(context.customerName || "").trim(),
			customerEmail: String(context.customerEmail || "").trim(),
			cartItemCount: Number(context.cartItemCount || 0) || 0,
			productInventory: Number(context.productInventory || 0) || 0,
		};
	}


	function randomId(prefix) {
		try { if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`; } catch {}
		return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
	}
	function visitorIdentity() {
		let visitorId = "", sessionId = "";
		try { visitorId = localStorage.getItem("vsn_visitor_id") || ""; if (!visitorId) { visitorId = randomId("visitor"); localStorage.setItem("vsn_visitor_id", visitorId); } } catch { visitorId = randomId("visitor"); }
		try { sessionId = sessionStorage.getItem("vsn_session_id") || ""; if (!sessionId) { sessionId = randomId("session"); sessionStorage.setItem("vsn_session_id", sessionId); } } catch { sessionId = randomId("session"); }
		return { visitorId, sessionId };
	}


	const vsnLoadedAssetStyles = new Map();
	const vsnLoadedAssetScripts = new Map();
	const vsnLoadedRuntimeScripts = new Map();

	function assetManifest() {
		const value = window.__VSN_ASSET_MANIFEST__;
		return value && typeof value === "object" ? value : null;
	}

	function manifestTemplate(pageId) {
		const manifest = assetManifest();
		if (!manifest || !pageId) return null;
		return manifest.templates?.[String(pageId)] || null;
	}

	function manifestAssetUrl(filename) {
		const manifest = assetManifest();
		const raw = String(filename || "").trim();
		if (!raw) return "";
		if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) return raw;
		const name = raw.replace(/^assets\//, "");
		if (!manifest?.baseUrl) return "";
		try { return new URL(encodeURIComponent(name), manifest.baseUrl).href; }
		catch { return `${manifest.baseUrl}${encodeURIComponent(name)}`; }
	}

	function preloadTemplateFonts(entry) {
		const urls = Array.isArray(entry?.fontPreloads) ? entry.fontPreloads : [];
		for (const raw of urls) {
			const href = String(raw || "").trim(); if (!href) continue;
			if (Array.from(document.head.querySelectorAll("link[data-vsn-font-preload]")).some(function (link) { return link.getAttribute("data-vsn-font-preload") === href; })) continue;
			const link = document.createElement("link"); link.rel = "preload"; link.as = "font"; link.href = href; link.crossOrigin = "anonymous"; link.dataset.vsnFontPreload = href; document.head.appendChild(link);
		}
	}

	function injectCriticalStyles(entry) {
		const css = String(entry?.criticalCss || "").trim();
		const pageId = String(entry?.id || "").trim();
		if (!css || !pageId) return false;
		let style = Array.from(document.head.querySelectorAll("style[data-vsn-critical-css]")).find(function (node) { return node.getAttribute("data-vsn-critical-css") === pageId; });
		if (!style) { style = document.createElement("style"); style.setAttribute("data-vsn-critical-css", pageId); document.head.appendChild(style); }
		if (style.textContent !== css) style.textContent = css;
		return true;
	}

	function loadTemplateStylesheet(filename) {
		const name = String(filename || "").trim();
		if (!name) return Promise.resolve(false);
		if (vsnLoadedAssetStyles.has(name)) return vsnLoadedAssetStyles.get(name);
		const promise = new Promise((resolve) => {
			const url = manifestAssetUrl(name);
			if (!url) { resolve(false); return; }
			const existing = Array.from(document.querySelectorAll('link[data-vsn-template-css]')).find((link) => link.dataset.vsnTemplateCss === name);
			if (existing) { resolve(true); return; }
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = url;
			link.dataset.vsnTemplateCss = name;
			link.addEventListener("load", () => resolve(true), { once: true });
			link.addEventListener("error", () => { console.error("VSN template CSS could not be loaded:", name); resolve(false); }, { once: true });
			document.head.appendChild(link);
		});
		vsnLoadedAssetStyles.set(name, promise);
		return promise;
	}

	function loadTemplateScript(filename) {
		const name = String(filename || "").trim();
		if (!name) return Promise.resolve(true);
		if (vsnLoadedAssetScripts.has(name)) return vsnLoadedAssetScripts.get(name);
		const promise = new Promise((resolve) => {
			const url = manifestAssetUrl(name);
			if (!url) { resolve(false); return; }
			const existing = Array.from(document.querySelectorAll('script[data-vsn-template-js]')).find((script) => script.dataset.vsnTemplateJs === name);
			if (existing) { resolve(true); return; }
			const script = document.createElement("script");
			script.src = url;
			script.defer = true;
			script.dataset.vsnTemplateJs = name;
			script.addEventListener("load", () => resolve(true), { once: true });
			script.addEventListener("error", () => { console.error("VSN template JavaScript could not be loaded:", name); resolve(false); }, { once: true });
			document.head.appendChild(script);
		});
		vsnLoadedAssetScripts.set(name, promise);
		return promise;
	}

	function loadRuntimeDependency(name) {
		const key = String(name || "").trim();
		if (!key) return Promise.resolve(true);
		if (vsnLoadedRuntimeScripts.has(key)) return vsnLoadedRuntimeScripts.get(key);
		const url = String(window.__VSN_RUNTIME_ASSETS__?.[key] || "").trim();
		if (!url) return Promise.resolve(false);
		const promise = new Promise((resolve) => {
			const existing = document.querySelector(`script[data-vsn-runtime="${key}"]`);
			if (existing) { resolve(true); return; }
			const script = document.createElement("script");
			script.src = url; script.defer = true; script.dataset.vsnRuntime = key;
			script.addEventListener("load", () => resolve(true), { once:true });
			script.addEventListener("error", () => { console.error("VSN runtime dependency could not be loaded:", key); resolve(false); }, { once:true });
			document.head.appendChild(script);
		});
		vsnLoadedRuntimeScripts.set(key, promise);
		return promise;
	}

	async function ensureTemplateAssets(pageId) {
		const entry = manifestTemplate(pageId);
		if (!entry) return { found: false, cssReady: false, jsReady: false };
		preloadTemplateFonts(entry);
		const criticalReady = injectCriticalStyles(entry);
		const cssPromise = loadTemplateStylesheet(entry.cssUrl || entry.css);
		if (criticalReady) cssPromise.then(function (loaded) { if (!loaded) return; const node = Array.from(document.head.querySelectorAll("style[data-vsn-critical-css]")).find(function (style) { return style.getAttribute("data-vsn-critical-css") === String(entry.id || ""); }); if (node) node.remove(); });
		const runtimeDependencies = Array.isArray(entry.dependencies) ? entry.dependencies.filter((name) => window.__VSN_RUNTIME_ASSETS__?.[name]) : [];
		const [cssLoaded, jsReady, runtimeReady] = await Promise.all([
			criticalReady ? Promise.resolve(true) : cssPromise,
			(entry.jsUrl || entry.js) ? loadTemplateScript(entry.jsUrl || entry.js) : Promise.resolve(true),
			Promise.all(runtimeDependencies.map(loadRuntimeDependency)).then((results)=>results.every(Boolean)),
		]);
		return { found: true, cssReady: cssLoaded, criticalReady, jsReady, runtimeReady, entry };
	}

	async function prepareBuilderHtml(html) {
		const source = String(html || "");
		if (!source || !assetManifest()) return source;
		let parsed;
		try { parsed = new DOMParser().parseFromString(source, "text/html"); }
		catch { return source; }
		const pageRoot = parsed.querySelector("[data-vsn-page-id]");
		const pageId = String(pageRoot?.dataset?.vsnPageId || "").trim();
		if (!pageId) return source;
		const state = await ensureTemplateAssets(pageId);
		if (!state.cssReady) return source;
		if (pageRoot?.dataset?.vsnExperimentRuntimeCss === "1") return source; // experiment variations keep their compiled inline delta CSS.
		parsed.querySelectorAll('style[data-vsn-inline-bundle="1"]').forEach((style) => style.remove());
		return parsed.body?.innerHTML || source;
	}

	function isHomePage(context) {
		return (
			context.template === "index" ||
			context.path === "/"
		);
	}

	function isCollectionPage(context) {
		return context.template === "collection";
	}

	function isProductPage(context) { return context.template === "product"; }
	function isSearchPage(context) { return context.template === "search" || context.path === "/search"; }
	function isBlogPage(context) { return context.template === "blog"; }
	function isArticlePage(context) { return context.template === "article"; }
	function specialTemplate(context) {
		const path = String(context.path || "");
		const template = String(context.template || "");
		const pageType = String(context.pageType || "");
		if (template === "cart" || pageType === "cart" || path === "/cart") return "cart";
		if (template === "404" || pageType === "404") return "404";
		if (template === "password" || pageType === "password" || path === "/password") return "password";
		if (/^\/account\/login/.test(path)) return "customer-login";
		if (/^\/account\/register/.test(path)) return "customer-register";
		if (/^\/account\/addresses/.test(path)) return "customer-addresses";
		if (/^\/account\/orders\//.test(path)) return "customer-order";
		if (path === "/account" || template === "customers/account" || pageType === "customers/account") return "customer-account";
		return "";
	}

	function findThemeMain() {
		return (
			document.querySelector(
				'main[id="MainContent"]',
			) ||
			document.querySelector(
				"main#MainContent",
			) ||
			document.querySelector(
				'[role="main"]',
			) ||
			document.querySelector("main")
		);
	}

	function withVisitorParams(input) {
		const context = getContext();
		const url = new URL(input, window.location.origin);
		url.searchParams.set("customerLoggedIn", context.customerLoggedIn ? "1" : "0");
		url.searchParams.set("visitorPath", window.location.pathname || context.path || "/");
		if (context.customerId) url.searchParams.set("customerId", String(context.customerId));
		if (context.customerName) url.searchParams.set("customerName", context.customerName);
		if (context.customerEmail) url.searchParams.set("customerEmail", context.customerEmail);
		const identity=visitorIdentity(); url.searchParams.set("vsnVisitorId",identity.visitorId); url.searchParams.set("vsnSessionId",identity.sessionId);
		const pageContext=window.VSN_PAGE_CONTEXT||{}; if(pageContext.language)url.searchParams.set("language",String(pageContext.language)); if(pageContext.country)url.searchParams.set("country",String(pageContext.country)); if(pageContext.market)url.searchParams.set("market",String(pageContext.market)); if(pageContext.cartItemCount!=null)url.searchParams.set("cartItemCount",String(pageContext.cartItemCount));
		const current=new URL(window.location.href); if(current.searchParams.get("vsn_exp_preview"))url.searchParams.set("vsnExpPreview",current.searchParams.get("vsn_exp_preview")); if(current.searchParams.get("vsn_variant"))url.searchParams.set("vsnVariant",current.searchParams.get("vsn_variant"));
		if (window.VSN_ASSET_PIPELINE_READY === true) url.searchParams.set("vsnAssetPipeline", "1");
		return `${url.pathname}${url.search}`;
	}

	async function fetchBuilderHtml(url) {
		const response = await fetch(withVisitorParams(url), {
			method: "GET",
			credentials: "same-origin",
			headers: {
				Accept: "text/html",
			},
		});

		let html = await response.text();

		if (!response.ok) {
			throw new Error(
				`Builder request failed: ${response.status}`,
			);
		}

		if (!html.trim()) {
			throw new Error(
				"Builder returned empty content.",
			);
		}

		html = await prepareBuilderHtml(html);
		return html;
	}

	async function renderExistingMount(mount) {
		if (
			!mount ||
			mount.dataset.vsnLoaded === "true"
		) {
			return;
		}

		const pageId = String(
			mount.dataset.vsnPageId || "",
		).trim();

		const handle = String(
			mount.dataset.vsnPageHandle || "",
		).trim();

		const reference = pageId || handle;

		if (!reference) {
			return;
		}

		mount.dataset.vsnLoaded = "true";

		try {
			const html = await fetchBuilderHtml(
				`/apps/vsn-builder/${encodeURIComponent(
					reference,
				)}?fragment=1`,
			);

			mount.innerHTML = html;
			initializeBuilderEnhancements(mount);
		} catch (error) {
			console.error(
				"VSN normal page renderer:",
				error,
			);

			mount.dataset.vsnLoaded = "false";

			mount.innerHTML = `
      <div class="vsn-builder-error">
        Builder content could not be loaded.
      </div>
    `;
		}
	}

	function installGlobalSections(main) {
		if (!main) return;
		const header = main.querySelector?.(".vsn-global-header");
		const footer = main.querySelector?.(".vsn-global-footer");
		const mountedHeader = document.querySelector("[data-vsn-global-header-mounted]");
		const mountedFooter = document.querySelector("[data-vsn-global-footer-mounted]");
		if (header) {
			header.dataset.vsnGlobalHeaderMounted = "1";
			if (mountedHeader && mountedHeader !== header) mountedHeader.replaceWith(header);
			else if (!mountedHeader) main.parentNode?.insertBefore(header, main);
		}
		if (footer) {
			footer.dataset.vsnGlobalFooterMounted = "1";
			if (mountedFooter && mountedFooter !== footer) mountedFooter.replaceWith(footer);
			else if (!mountedFooter) main.parentNode?.insertBefore(footer, main.nextSibling);
		}
	}


	function applySeoPayload(root = document) {
		const script = root.querySelector?.(".vsn-seo-payload");
		if (!script) return;
		try {
			const data = JSON.parse(script.textContent || "{}");
			if (data.title) document.title = data.title;
			const setMeta = (selector, attrName, attrValue, content) => {
				if (!content) return;
				let element = document.head.querySelector(selector);
				if (!element) { element = document.createElement("meta"); element.setAttribute(attrName, attrValue); document.head.appendChild(element); }
				element.setAttribute("content", content);
			};
			setMeta('meta[name="description"]', "name", "description", data.description);
			setMeta('meta[property="og:title"]', "property", "og:title", data.ogTitle);
			setMeta('meta[property="og:description"]', "property", "og:description", data.ogDescription);
			setMeta('meta[property="og:image"]', "property", "og:image", data.ogImage);
			if (data.canonical) {
				let link = document.head.querySelector('link[rel="canonical"]');
				if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
				link.href = data.canonical;
			}
		} catch (error) { console.error("VSN SEO payload error:", error); }
	}

	function decodeFormRules(value) {
		try { return decodeURIComponent(String(value || "")); } catch { return String(value || ""); }
	}
	function formFieldValues(form, name) {
		const fields = [...form.querySelectorAll(`[name="${CSS.escape(String(name || ""))}"]`)];
		return fields.flatMap((field) => {
			if ((field.type === "checkbox" || field.type === "radio") && !field.checked) return [];
			return [String(field.value ?? "")];
		});
	}
	function setFormNamedValue(form, name, value) {
		const fields = [...form.querySelectorAll(`[name="${CSS.escape(String(name || ""))}"]`)];
		if (!fields.length) return;
		for (const field of fields) {
			if (field.type === "checkbox" || field.type === "radio") field.checked = String(field.value) === String(value);
			else if (field.type !== "file") field.value = String(value ?? "");
		}
	}
	function evaluateConditionalRule(form, rule) {
		const [source, operator = "equals", expected = "", target = ""] = String(rule || "").split("|").map((x) => x.trim());
		if (!source || !target) return;
		const values = formFieldValues(form, source);
		const actual = values.join(",");
		const op = operator.toLowerCase();
		const match = op === "not-equals" ? !values.includes(expected) : op === "contains" ? actual.includes(expected) : values.includes(expected);
		const targetFields = [...form.querySelectorAll(`[name="${CSS.escape(target)}"]`)];
		const wrappers = [...new Set(targetFields.map((field) => field.closest(".vsn-form-field")).filter(Boolean))];
		wrappers.forEach((wrapper) => {
			wrapper.hidden = !match;
			wrapper.dataset.vsnConditionalHidden = match ? "0" : "1";
			wrapper.querySelectorAll("input,textarea,select").forEach((field) => { field.disabled = !match; });
		});
	}
	function applyFormConditions(form) {
		decodeFormRules(form.dataset.vsnConditional).split(/\r?\n/).map((x) => x.trim()).filter(Boolean).forEach((rule) => evaluateConditionalRule(form, rule));
	}
	function applyFormValidation(form) {
		form.querySelectorAll("input,textarea,select").forEach((field) => field.setCustomValidity?.(""));
		decodeFormRules(form.dataset.vsnValidation).split(/\r?\n/).map((x) => x.trim()).filter(Boolean).forEach((line) => {
			const [name, rule, rawValue = "", message = "Invalid value."] = line.split("|").map((x) => x.trim());
			const field = form.querySelector(`[name="${CSS.escape(name || "")}"]`); if (!field || field.disabled) return;
			const value = String(field.value || ""); const n = Number(rawValue); let invalid = false;
			if (rule === "minLength") invalid = value.length < n;
			else if (rule === "maxLength") invalid = value.length > n;
			else if (rule === "min") invalid = value !== "" && Number(value) < n;
			else if (rule === "max") invalid = value !== "" && Number(value) > n;
			else if (rule === "pattern") { try { invalid = value !== "" && !(new RegExp(rawValue)).test(value); } catch {} }
			if (invalid) field.setCustomValidity?.(message || "Invalid value.");
		});
	}
	function arithmeticValue(token, form) {
		const clean = String(token || "").trim();
		if (/^-?\d+(?:\.\d+)?$/.test(clean)) return Number(clean);
		const raw = formFieldValues(form, clean)[0]; const value = Number(raw); return Number.isFinite(value) ? value : 0;
	}
	function applyFormCalculations(form) {
		decodeFormRules(form.dataset.vsnCalculations).split(/\r?\n/).map((x) => x.trim()).filter(Boolean).forEach((line) => {
			const [target, expression = ""] = line.split("|").map((x) => x.trim()); if (!target || !expression) return;
			const match = expression.match(/^([a-zA-Z0-9_.-]+|-?\d+(?:\.\d+)?)\s*([+\-*/])\s*([a-zA-Z0-9_.-]+|-?\d+(?:\.\d+)?)$/); if (!match) return;
			const a = arithmeticValue(match[1], form), b = arithmeticValue(match[3], form); let result = 0;
			if (match[2] === "+") result = a + b; else if (match[2] === "-") result = a - b; else if (match[2] === "*") result = a * b; else result = b === 0 ? 0 : a / b;
			setFormNamedValue(form, target, Number.isFinite(result) ? Math.round(result * 1000000) / 1000000 : 0);
		});
	}
	function applyFormQueryPrefill(form) {
		if (form.dataset.vsnPrefillQuery !== "1") return;
		const params = new URLSearchParams(window.location.search);
		for (const [key, value] of params.entries()) if (form.querySelector(`[name="${CSS.escape(key)}"]`)) setFormNamedValue(form, key, value);
	}
	function prepareBuilderForm(form) {
		applyFormQueryPrefill(form); applyFormCalculations(form); applyFormConditions(form); applyFormValidation(form);
	}
	let googleRecaptchaPromise = null;
	function renderGoogleRecaptchaWidgets() {
		if (!window.grecaptcha?.render) return;
		document.querySelectorAll(".vsn-builder-form .vsn-g-recaptcha").forEach((node) => { if (node.dataset.vsnWidgetId) return; const sitekey=node.dataset.sitekey||""; if(!sitekey)return; try { const id=window.grecaptcha.render(node,{sitekey});node.dataset.vsnWidgetId=String(id); } catch {} });
		document.querySelectorAll(".vsn-builder-form .vsn-g-recaptcha-v3").forEach((node) => { if (node.dataset.vsnWidgetId) return; const sitekey=node.dataset.sitekey||""; if(!sitekey)return; try { const id=window.grecaptcha.render(node,{sitekey,size:"invisible",badge:"bottomright"});node.dataset.vsnWidgetId=String(id); } catch {} });
	}
	function ensureGoogleRecaptcha() {
		if (!document.querySelector(".vsn-builder-form .vsn-g-recaptcha,.vsn-builder-form .vsn-g-recaptcha-v3")) return Promise.resolve(null);
		if (window.grecaptcha?.render) { renderGoogleRecaptchaWidgets(); return Promise.resolve(window.grecaptcha); }
		if (googleRecaptchaPromise) return googleRecaptchaPromise;
		googleRecaptchaPromise=new Promise((resolve,reject)=>{window.__vsnGoogleRecaptchaReady=()=>{try{renderGoogleRecaptchaWidgets();resolve(window.grecaptcha);}catch(error){reject(error);}};const existing=document.querySelector('script[data-vsn-google-recaptcha="1"]');if(existing){existing.addEventListener("error",()=>reject(new Error("Google reCAPTCHA failed to load.")),{once:true});return;}const script=document.createElement("script");script.src="https://www.google.com/recaptcha/api.js?onload=__vsnGoogleRecaptchaReady&render=explicit";script.async=true;script.defer=true;script.dataset.vsnGoogleRecaptcha="1";script.onerror=()=>reject(new Error("Google reCAPTCHA failed to load."));document.head.appendChild(script);});
		return googleRecaptchaPromise;
	}
	function ensureCaptchaScripts() {
		if (document.querySelector(".vsn-builder-form .cf-turnstile") && !document.querySelector('script[data-vsn-turnstile="1"]')) { const script=document.createElement("script");script.src="https://challenges.cloudflare.com/turnstile/v0/api.js";script.async=true;script.defer=true;script.dataset.vsnTurnstile="1";document.head.appendChild(script); }
		if (document.querySelector(".vsn-builder-form .h-captcha") && !document.querySelector('script[data-vsn-hcaptcha="1"]')) { const script=document.createElement("script");script.src="https://js.hcaptcha.com/1/api.js";script.async=true;script.defer=true;script.dataset.vsnHcaptcha="1";document.head.appendChild(script); }
		ensureGoogleRecaptcha().catch((error)=>console.error("VSN Google reCAPTCHA load error:",error));
	}
	function executeFormSuccess(form, result, status) {
		const action = result?.actions || { type: form.dataset.vsnSuccessAction || "message", message: form.dataset.vsnSuccess || "Thanks. Your message has been received.", redirectUrl: form.dataset.vsnRedirect || "", eventName: form.dataset.vsnEvent || "vsn:form-success", couponCode: form.dataset.vsnCoupon || "" };
		if (status) { status.textContent = action.message || form.dataset.vsnSuccess || "Thanks. Your message has been received."; status.style.color = "#008060"; }
		if (action.type === "redirect" && action.redirectUrl) { window.location.assign(action.redirectUrl); return true; }
		if (action.type === "popup-close") { const overlay = form.closest(".vsn-campaign-overlay"); overlay?.querySelector?.("[data-vsn-campaign-close]")?.click?.(); }
		if (action.type === "custom-event") window.dispatchEvent(new CustomEvent(action.eventName || "vsn:form-success", { detail: { form, result } }));
		if (action.type === "coupon" && action.couponCode) { const redirect = `${window.location.pathname}${window.location.search}`; window.location.assign(`/discount/${encodeURIComponent(action.couponCode)}?redirect=${encodeURIComponent(redirect)}`); return true; }
		return false;
	}

	let builderFormHandlerInitialized = false;
	function initializeBuilderForms() {
		if (builderFormHandlerInitialized) { document.querySelectorAll(".vsn-builder-form").forEach(prepareBuilderForm); ensureCaptchaScripts(); return; }
		builderFormHandlerInitialized = true;
		document.querySelectorAll(".vsn-builder-form").forEach(prepareBuilderForm); ensureCaptchaScripts();
		document.addEventListener("input", (event) => { const form = event.target?.closest?.(".vsn-builder-form"); if (form) { applyFormCalculations(form); applyFormConditions(form); applyFormValidation(form); } });
		document.addEventListener("change", (event) => { const form = event.target?.closest?.(".vsn-builder-form"); if (form) { applyFormCalculations(form); applyFormConditions(form); applyFormValidation(form); } });
		document.addEventListener("click", (event) => {
			const next = event.target?.closest?.(".vsn-form-next");
			const prev = event.target?.closest?.(".vsn-form-prev");
			if (!next && !prev) return;
			const form = (next || prev).closest(".vsn-form-builder");
			if (!form) return;
			const maxStep = Math.max(1, Number(form.dataset.vsnMaxStep || 1));
			let step = Math.max(1, Number(form.dataset.vsnCurrentStep || 1));
			if (next) {
				const fields = [...form.querySelectorAll(`[data-vsn-form-step="${step}"] input, [data-vsn-form-step="${step}"] textarea, [data-vsn-form-step="${step}"] select`)];
				const invalid = fields.find((field) => typeof field.reportValidity === "function" && !field.reportValidity());
				if (invalid) return;
				step = Math.min(maxStep, step + 1);
			} else step = Math.max(1, step - 1);
			form.dataset.vsnCurrentStep = String(step);
			form.querySelectorAll("[data-vsn-form-step]").forEach((el) => {
				el.style.display = Number(el.dataset.vsnFormStep || 1) === step ? (el.tagName === "INPUT" && el.type === "hidden" ? "none" : "grid") : "none";
			});
			const prevButton = form.querySelector(".vsn-form-prev");
			const nextButton = form.querySelector(".vsn-form-next");
			const submitButton = form.querySelector(".vsn-form-submit");
			if (prevButton) prevButton.style.display = step > 1 ? "inline-flex" : "none";
			if (nextButton) nextButton.style.display = step < maxStep ? "inline-flex" : "none";
			if (submitButton) submitButton.style.display = step === maxStep ? "inline-flex" : "none";
		});
		document.addEventListener("submit", async (event) => {
			const form = event.target?.closest?.(".vsn-builder-form");
			if (!form) return;
			event.preventDefault();
			applyFormCalculations(form); applyFormConditions(form); applyFormValidation(form);
			if (!form.checkValidity()) { form.reportValidity?.(); return; }
			const status = form.querySelector(".vsn-form-status");
			const button = form.querySelector('button[type="submit"]');
			if (button?.disabled) return;
			if (button) button.disabled = true;
			if (status) { status.textContent = "Sending…"; status.style.color = "inherit"; }
			try {
				if (form.dataset.vsnCaptchaMode === "recaptcha-v3") { const api=await ensureGoogleRecaptcha();const node=form.querySelector(".vsn-g-recaptcha-v3");const widgetId=Number(node?.dataset?.vsnWidgetId);const action=form.dataset.vsnRecaptchaV3Action||"form_submit";if(!api||!Number.isFinite(widgetId))throw new Error("Google reCAPTCHA v3 is not ready.");const token=await api.execute(widgetId,{action});if(!token)throw new Error("Google reCAPTCHA v3 did not return a token.");let hidden=form.querySelector('input[data-vsn-recaptcha-token="1"]');if(!hidden){hidden=document.createElement("input");hidden.type="hidden";hidden.name="g-recaptcha-response";hidden.dataset.vsnRecaptchaToken="1";form.appendChild(hidden);}hidden.value=token; }
				const data = new FormData(form);
				data.set("pageUrl", window.location.href);
				const response = await fetch("/apps/vsn-builder/default?formSubmit=1", { method: "POST", credentials: "same-origin", body: data, headers: { Accept: "application/json" } });
				const result = await response.json().catch(() => ({}));
				if (!response.ok || !result.ok) throw new Error(result.error || `Request failed: ${response.status}`);
				const navigated = executeFormSuccess(form, result, status);
				window.VSNAnalytics?.track?.("form_submit",{root:form,metadata:{formKey:String(data.get("formKey")||data.get("formType")||"")}});
				if (!navigated) { form.reset(); prepareBuilderForm(form); if (window.turnstile) form.querySelectorAll(".cf-turnstile").forEach((node) => { try { window.turnstile.reset(node); } catch {} }); if (window.hcaptcha) form.querySelectorAll(".h-captcha").forEach((node) => { try { window.hcaptcha.reset(node); } catch {} }); if(window.grecaptcha) form.querySelectorAll(".vsn-g-recaptcha").forEach((node)=>{const id=Number(node.dataset.vsnWidgetId);if(Number.isFinite(id))try{window.grecaptcha.reset(id);}catch{}}); }
			} catch (error) {
				console.error("VSN form submit error:", error);
				if (status) { status.textContent = error?.message || form.dataset.vsnError || "Please try again."; status.style.color = "#b42318"; }
			} finally { if (button) button.disabled = false; }
		});
	}

	let navigationHandlerInitialized = false;
	function refreshNavigationMenus() {
		document.querySelectorAll(".vsn-global-header .vsn-nav[data-vsn-mobile='1']").forEach((nav) => {
			const header = nav.closest(".vsn-global-header");
			const breakpoint = Number(header?.dataset.vsnMobileBreakpoint || 749);
			const mobile = window.innerWidth <= breakpoint;
			const toggle = nav.querySelector(".vsn-nav-toggle");
			const links = nav.querySelector(".vsn-nav-links");
			if (toggle) toggle.style.display = mobile ? "inline-flex" : "none";
			if (links) {
				links.style.display = !mobile || nav.classList.contains("is-open") ? "flex" : "none";
				links.style.flexDirection = mobile ? "column" : "row";
				links.style.alignItems = mobile ? "stretch" : "center";
				links.style.marginTop = mobile ? "10px" : "0";
			}
		});
	}
	function initializeNavigationMenus() {
		if (!navigationHandlerInitialized) {
			navigationHandlerInitialized = true;
			document.addEventListener("click", (event) => {
				const toggle = event.target?.closest?.(".vsn-nav-toggle");
				if (!toggle) return;
				const nav = toggle.closest(".vsn-nav");
				if (!nav) return;
				const open = nav.classList.toggle("is-open");
				toggle.setAttribute("aria-expanded", open ? "true" : "false");
				refreshNavigationMenus();
			});
			window.addEventListener("resize", refreshNavigationMenus, { passive: true });
		}
		setTimeout(refreshNavigationMenus, 0);
	}


	function initializeAdvancedWidgets(root = document) {
		root.querySelectorAll(".vsn-counter").forEach((counter) => {
			if (counter.dataset.vsnCounterReady === "1") return;
			counter.dataset.vsnCounterReady = "1";
			const start = Number(counter.dataset.vsnStart || 0);
			const end = Number(counter.dataset.vsnEnd || 0);
			const duration = Math.max(100, Number(counter.dataset.vsnDuration || 1200));
			const prefix = counter.dataset.vsnPrefix || "";
			const suffix = counter.dataset.vsnSuffix || "";
			const started = performance.now();
			const tick = (now) => {
				const progress = Math.min(1, (now - started) / duration);
				const value = start + (end - start) * (1 - Math.pow(1 - progress, 3));
				counter.textContent = `${prefix}${Math.round(value)}${suffix}`;
				if (progress < 1) requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		});

		root.querySelectorAll(".vsn-countdown").forEach((countdown) => {
			if (countdown.dataset.vsnCountdownReady === "1") return;
			countdown.dataset.vsnCountdownReady = "1";
			const target = Date.parse(countdown.dataset.vsnEnd || "");
			if (!Number.isFinite(target)) return;
			const update = () => {
				const left = Math.max(0, target - Date.now());
				if (left <= 0 && countdown.dataset.vsnExpiredText) { countdown.textContent = countdown.dataset.vsnExpiredText; return false; }
				const values = { days: Math.floor(left / 86400000), hours: Math.floor((left / 3600000) % 24), minutes: Math.floor((left / 60000) % 60), seconds: Math.floor((left / 1000) % 60) };
				for (const [key, value] of Object.entries(values)) { const el = countdown.querySelector(`[data-vsn-countdown-${key}]`); if (el) el.textContent = `${String(value).padStart(2,"0")}${key === "days" ? "d" : key === "hours" ? "h" : key === "minutes" ? "m" : "s"}`; }
				return left > 0;
			};
			if (!update()) return;
			const timer = setInterval(() => { if (!update()) clearInterval(timer); }, 1000);
		});

		root.querySelectorAll(".vsn-video-widget").forEach((widget) => {
			if (widget.dataset.vsnVideoReady === "1") return;
			widget.dataset.vsnVideoReady = "1";
			const video = widget.querySelector(".vsn-video-element");
			const frame = widget.querySelector(".vsn-video-frame");
			const poster = widget.querySelector(".vsn-video-poster");
			const play = widget.querySelector(".vsn-video-play");
			const start = Math.max(0, Number(widget.dataset.vsnVideoStart || 0));
			const end = Math.max(0, Number(widget.dataset.vsnVideoEnd || 0));
			const volume = Math.max(0, Math.min(1, Number(widget.dataset.vsnVideoVolume || 100) / 100));
			if (video) {
				video.volume = volume;
				const seek = () => { if (start > 0 && Number.isFinite(video.duration) && video.currentTime < start) { try { video.currentTime = start; } catch {} } };
				video.addEventListener("loadedmetadata", seek, { once: true });
				video.addEventListener("timeupdate", () => {
					if (end > 0 && video.currentTime >= end) {
						if (video.loop) { video.currentTime = start; video.play().catch(()=>{}); }
						else video.pause();
					}
				});
			}
			play?.addEventListener("click", (event) => {
				event.preventDefault(); event.stopPropagation();
				if (frame) {
					const src = frame.dataset.vsnVideoSrc;
					if (src && !frame.getAttribute("src")) frame.setAttribute("src", src);
					frame.style.display = "block";
				}
				if (poster) poster.style.display = "none";
				if (video) { if (start > 0) { try { video.currentTime = start; } catch {} } video.play().catch(()=>{}); }
				play.style.display = "none";
			});
		});

		root.querySelectorAll("[data-vsn-slider='1']").forEach((slider) => {
			if (slider.dataset.vsnSliderReady === "1") return;
			slider.dataset.vsnSliderReady = "1";
			const viewport = slider.querySelector(".vsn-slider-viewport");
			const track = slider.querySelector(".vsn-slider-track");
			const slides = Array.from(slider.querySelectorAll(":scope > .vsn-slider-viewport > .vsn-slider-track > .vsn-slider-slide"));
			if (!viewport || !track || !slides.length) return;
			const gap = Math.max(0, Number(slider.dataset.vsnSliderGap || 16));
			const speed = Math.max(0, Number(slider.dataset.vsnSliderSpeed || 450));
			const direction = slider.dataset.vsnSliderDirection === "vertical" ? "vertical" : "horizontal";
			const effect = slider.dataset.vsnSliderEffect === "fade" ? "fade" : "slide";
			const centered = slider.dataset.vsnSliderCentered === "1";
			const autoHeight = slider.dataset.vsnSliderAutoHeight === "1";
			const equalHeight = slider.dataset.vsnSliderEqualHeight === "1";
			let index = Math.max(0, Number(slider.dataset.vsnSliderIndex || 0));
			let timer = null; let startX = null; let startY = null;
			const perView = () => {
				if (effect === "fade") return 1;
				return window.innerWidth <= 749 ? Math.max(1, Number(slider.dataset.vsnSliderMobile || 1)) : window.innerWidth <= 1024 ? Math.max(1, Number(slider.dataset.vsnSliderTablet || 1)) : Math.max(1, Number(slider.dataset.vsnSliderDesktop || 1));
			};
			const maxIndex = () => Math.max(0, slides.length - perView());
			const normalize = (next) => {
				const max = maxIndex();
				if (slider.dataset.vsnSliderLoop === "1" || slider.dataset.vsnSliderRewind === "1") return max >= 0 ? (next < 0 ? max : next > max ? 0 : next) : 0;
				return Math.max(0, Math.min(max, next));
			};
			const syncHeights = () => {
				slides.forEach((slide) => { slide.style.minHeight = ""; });
				if (equalHeight) {
					const maxHeight = Math.max(...slides.map((slide) => slide.scrollHeight || slide.getBoundingClientRect().height || 0));
					if (maxHeight > 0) slides.forEach((slide) => { slide.style.minHeight = `${maxHeight}px`; });
				}
				if (autoHeight) {
					const active = slides[index]; const height = active?.scrollHeight || active?.getBoundingClientRect().height || 0;
					if (height > 0) viewport.style.height = `${height}px`;
				} else viewport.style.height = "";
			};
			const update = (next = index, interacted = false) => {
				index = normalize(next); slider.dataset.vsnSliderIndex = String(index);
				track.style.transitionDuration = `${speed}ms`;
				if (effect === "fade") {
					track.style.display = "block"; track.style.position = "relative"; track.style.transform = "none";
					slides.forEach((slide, slideIndex) => {
						slide.style.position = slideIndex === index ? "relative" : "absolute"; slide.style.inset = "0";
						slide.style.width = "100%"; slide.style.flexBasis = "100%"; slide.style.opacity = slideIndex === index ? "1" : "0";
						slide.style.visibility = slideIndex === index ? "visible" : "hidden"; slide.style.pointerEvents = slideIndex === index ? "auto" : "none";
						slide.style.transition = `opacity ${speed}ms ease`;
					});
				} else if (direction === "vertical") {
					track.style.display = "flex"; track.style.position = "relative"; track.style.flexDirection = "column";
					slides.forEach((slide) => { slide.style.position = "relative"; slide.style.inset = "auto"; slide.style.opacity = "1"; slide.style.visibility = "visible"; slide.style.pointerEvents = "auto"; });
					const first = slides[0]; const amount = (first?.getBoundingClientRect().height || viewport.getBoundingClientRect().height) + gap;
					track.style.transform = `translate3d(0, ${-index * amount}px, 0)`;
				} else {
					track.style.display = "flex"; track.style.position = "relative"; track.style.flexDirection = "row";
					slides.forEach((slide) => { slide.style.position = "relative"; slide.style.inset = "auto"; slide.style.opacity = "1"; slide.style.visibility = "visible"; slide.style.pointerEvents = "auto"; });
					const width = viewport.getBoundingClientRect().width; const per = perView(); const slideWidth = Math.max(0, (width - gap * (per - 1)) / per);
					slides.forEach((slide) => { slide.style.flexBasis = `${slideWidth}px`; });
					let offset = index * (slideWidth + gap);
					if (centered && per > 1) {
						const centeredOffset = offset - (width - slideWidth) / 2;
						const totalWidth = slides.length * slideWidth + Math.max(0, slides.length - 1) * gap;
						offset = Math.max(0, Math.min(Math.max(0, totalWidth - width), centeredOffset));
					}
					track.style.transform = `translate3d(${-offset}px, 0, 0)`;
				}
				syncHeights();
				slider.querySelectorAll("[data-vsn-slider-dot]").forEach((dot) => dot.classList.toggle("is-active", Number(dot.dataset.vsnSliderDot) === index));
				const current = slider.querySelector("[data-vsn-slider-current]"); if (current) current.textContent = String(index + 1);
				const progress = slider.querySelector("[data-vsn-slider-progress-bar]"); if (progress) progress.style.width = `${((index + 1) / Math.max(1, maxIndex() + 1)) * 100}%`;
				if (interacted && slider.dataset.vsnSliderPauseInteraction === "1") stopAutoplay();
			};
			const stopAutoplay = () => { if (timer) clearInterval(timer); timer = null; };
			const startAutoplay = () => { stopAutoplay(); if (slider.dataset.vsnSliderAutoplay !== "1" || slides.length <= 1) return; const delay = Math.max(500, Number(slider.dataset.vsnSliderDelay || 4500)); timer = setInterval(() => { const max=maxIndex(); if (index >= max && slider.dataset.vsnSliderStopLast === "1" && slider.dataset.vsnSliderLoop !== "1" && slider.dataset.vsnSliderRewind !== "1") { stopAutoplay(); return; } update(index + 1, false); }, delay); };
			slider.querySelector(".vsn-slider-prev")?.addEventListener("click", () => update(index - 1, true));
			slider.querySelector(".vsn-slider-next")?.addEventListener("click", () => update(index + 1, true));
			slider.querySelectorAll("[data-vsn-slider-dot]").forEach((dot) => dot.addEventListener("click", () => update(Number(dot.dataset.vsnSliderDot || 0), true)));
			if (slider.dataset.vsnSliderKeyboard === "1") { slider.tabIndex = slider.tabIndex >= 0 ? slider.tabIndex : 0; slider.addEventListener("keydown", (event) => { if (event.key === "ArrowRight" || event.key === "ArrowDown") update(index + 1, true); if (event.key === "ArrowLeft" || event.key === "ArrowUp") update(index - 1, true); }); }
			if (slider.dataset.vsnSliderSwipe === "1") {
				viewport.addEventListener("pointerdown", (event) => { startX = event.clientX; startY = event.clientY; });
				viewport.addEventListener("pointerup", (event) => { if (startX == null || startY == null) return; const delta = direction === "vertical" ? event.clientY - startY : event.clientX - startX; if (Math.abs(delta) > 45) update(index + (delta < 0 ? 1 : -1), true); startX = null; startY = null; });
			}
			if (slider.dataset.vsnSliderPauseHover === "1") { slider.addEventListener("mouseenter", stopAutoplay); slider.addEventListener("mouseleave", startAutoplay); }
			window.addEventListener("resize", () => update(index, false));
			update(index, false); startAutoplay();
		});

		root.querySelectorAll("[data-vsn-tabs]").forEach((tabs) => {
			if (tabs.dataset.vsnTabsReady === "1") return;
			tabs.dataset.vsnTabsReady = "1";
			tabs.addEventListener("click", (event) => {
				const button = event.target.closest("[data-vsn-tab]");
				if (!button) return;
				const index = button.dataset.vsnTab;
				tabs.querySelectorAll("[data-vsn-tab]").forEach((el) => el.classList.toggle("is-active", el === button));
				tabs.querySelectorAll("[data-vsn-tab-panel]").forEach((panel) => { panel.style.display = panel.dataset.vsnTabPanel === index ? "" : "none"; });
			});
		});

		root.querySelectorAll(".vsn-announcement-bar[data-vsn-dismissible='1']").forEach((bar) => {
			if (bar.dataset.vsnDismissReady === "1") return;
			bar.dataset.vsnDismissReady = "1";
			bar.querySelector(".vsn-announcement-dismiss")?.addEventListener("click", () => { bar.hidden = true; });
		});

		root.querySelectorAll(".vsn-mega-menu").forEach((menu) => {
			if (menu.dataset.vsnMegaReady === "1") return;
			menu.dataset.vsnMegaReady = "1";
			const trigger = menu.querySelector(".vsn-mega-trigger");
			const panel = menu.querySelector(".vsn-mega-panel");
			trigger?.addEventListener("click", (event) => {
				event.preventDefault();
				const open = panel?.style.display !== "none";
				if (panel) panel.style.display = open ? "none" : "block";
				trigger.setAttribute("aria-expanded", open ? "false" : "true");
			});
		});

		root.querySelectorAll(".vsn-localization-form").forEach((form) => {
			const returnTo = form.querySelector('input[name="return_to"]');
			if (returnTo) returnTo.value = `${window.location.pathname}${window.location.search}`;
		});

		root.querySelectorAll(".vsn-cart-trigger").forEach((button) => {
			if (button.dataset.vsnCartReady === "1") return;
			button.dataset.vsnCartReady = "1";
			button.addEventListener("click", () => refreshCartDrawer(true).catch(console.error));
		});

		const currentProductRoot = root.querySelector?.(".vsn-page[data-vsn-page-handle]");
		const productHandle = document.body?.classList?.contains("template-product") ? currentProductRoot?.dataset?.vsnPageHandle : "";
		if (productHandle) {
			try {
				const key = "vsn-recent-products";
				const current = JSON.parse(localStorage.getItem(key) || "[]");
				const next = [productHandle, ...current.filter((item) => item !== productHandle)].slice(0, 12);
				localStorage.setItem(key, JSON.stringify(next));
			} catch {}
		}

		root.querySelectorAll(".vsn-recently-viewed").forEach(async (section) => {
			if (section.dataset.vsnLoaded === "1") return;
			section.dataset.vsnLoaded = "1";
			const grid = section.querySelector(".vsn-recently-viewed-grid");
			if (!grid) return;
			const desktop = Math.max(1, Number(section.dataset.vsnColumnsDesktop || 4));
			const tablet = Math.max(1, Number(section.dataset.vsnColumnsTablet || 2));
			const mobile = Math.max(1, Number(section.dataset.vsnColumnsMobile || 1));
			const gap = Math.max(0, Number(section.dataset.vsnGap || 18));
			grid.style.gridTemplateColumns = `repeat(${desktop},minmax(0,1fr))`; grid.style.gap = `${gap}px`;
			grid.style.setProperty('--vsn-recent-cols-tablet', String(tablet)); grid.style.setProperty('--vsn-recent-cols-mobile', String(mobile));
			let handles = [];
			try { handles = JSON.parse(localStorage.getItem("vsn-recent-products") || "[]"); } catch {}
			const current = section.dataset.vsnCurrentHandle || "";
			handles = handles.filter((handle) => handle && handle !== current).slice(0, Math.max(1, Number(section.dataset.vsnLimit || 4)));
			if (!handles.length) { grid.innerHTML = '<div style="color:#777;font-size:14px">No recently viewed products yet.</div>'; return; }
			const cards = [];
			for (const handle of handles) {
				try {
					const response = await fetch(`/products/${encodeURIComponent(handle)}.js`, { headers: { Accept: "application/json" } });
					if (!response.ok) continue;
					const product = await response.json();
					const showImage = section.dataset.vsnShowImage !== "0", showTitle = section.dataset.vsnShowTitle !== "0", showPrice = section.dataset.vsnShowPrice !== "0"; const ratio = section.dataset.vsnImageRatio || "1 / 1";
					cards.push(`<a href="${product.url || `/products/${handle}`}" style="color:inherit;text-decoration:none">${showImage ? `<img src="${product.featured_image || product.images?.[0] || ""}" alt="${product.title || ""}" loading="lazy" style="display:block;width:100%;aspect-ratio:${ratio};object-fit:cover;border-radius:10px">` : ""}${showTitle ? `<div style="margin-top:8px;font-weight:600">${product.title || ""}</div>` : ""}${showPrice && product.price != null ? `<div style="margin-top:4px">${moneyText(Number(product.price || 0)/100, window.Shopify?.currency?.active || "USD")}</div>` : ""}</a>`);
				} catch {}
			}
			grid.innerHTML = cards.join("") || '<div style="color:#777;font-size:14px">No recently viewed products yet.</div>';
		});
	}

	function findVsnElementById(id, root = document) {
		const wanted = String(id || "");
		if (!wanted) return null;
		const roots = [];
		if (root?.querySelectorAll) roots.push(root);
		if (root !== document) roots.push(document);
		for (const searchRoot of roots) {
			for (const element of searchRoot.querySelectorAll?.("[data-vsn-id]") || []) {
				if (element.getAttribute("data-vsn-id") === wanted) return element;
			}
		}
		return null;
	}

	function runRegisteredTemplateJavascript(pageId, root = document) {
		const entries = window.__VSN_TEMPLATE_CUSTOM_JS__?.[String(pageId || "")];
		if (!Array.isArray(entries)) return false;
		for (const entry of entries) {
			const element = findVsnElementById(entry?.id, root);
			if (!element || element.dataset.vsnJsReady === "1") continue;
			try {
				(new Function("element", "document", "window", `"use strict";\n${String(entry?.code || "")}`))(element, document, window);
				element.dataset.vsnJsReady = "1";
			} catch (error) {
				console.error("VSN template custom JS error", entry?.id, error);
			}
		}
		return true;
	}

	function customJsPageIdFromUrl(url = "") {
		try {
			const parsed = new URL(url, window.location.origin);
			const match = parsed.pathname.match(/\/apps\/vsn-builder\/([^/]+)$/);
			return match ? decodeURIComponent(match[1]) : "";
		} catch { return ""; }
	}

	function initializeCustomJavascript(root = document) {
		const pageRoots = [];
		if (root?.matches?.("[data-vsn-page-id]")) pageRoots.push(root);
		for (const item of root.querySelectorAll?.("[data-vsn-page-id]") || []) if (!pageRoots.includes(item)) pageRoots.push(item);
		for (const pageRoot of pageRoots) {
			const pageId = String(pageRoot.dataset.vsnPageId || "").trim();
			if (pageId) runRegisteredTemplateJavascript(pageId, root);
		}

		const markers = root.querySelectorAll?.("[data-vsn-custom-js-url]") || [];
		markers.forEach((marker) => {
			if (marker.dataset.vsnCustomJsLoaded === "1") return;
			const url = String(marker.dataset.vsnCustomJsUrl || "").trim();
			const pageId = customJsPageIdFromUrl(url);
			if (pageId && runRegisteredTemplateJavascript(pageId, root)) {
				marker.dataset.vsnCustomJsLoaded = "1";
				return;
			}
			if (!url || !url.startsWith("/apps/vsn-builder/")) return;
			marker.dataset.vsnCustomJsLoaded = "1";
			const script = document.createElement("script");
			script.src = url;
			script.async = false;
			script.dataset.vsnCustomJsRuntime = "1";
			script.addEventListener("error", () => {
				marker.dataset.vsnCustomJsLoaded = "0";
				console.error("VSN custom JavaScript could not be loaded.");
			}, { once: true });
			(root === document ? document.body : root).appendChild(script);
		});
	}

	async function initializeThemeSectionBridges(root = document) {
		const bridges = Array.from(root.querySelectorAll?.("[data-vsn-theme-section-id]") || []);
		for (const bridge of bridges) {
			if (bridge.dataset.vsnThemeSectionReady === "1" || bridge.dataset.vsnThemeSectionLoading === "1") continue;
			const sectionId = String(bridge.dataset.vsnThemeSectionId || "").trim();
			if (!sectionId) { bridge.innerHTML = '<div class="vsn-builder-message vsn-builder-error">Theme section ID is required.</div>'; continue; }
			bridge.dataset.vsnThemeSectionLoading = "1";
			try {
				// Prefer moving the already-rendered Shopify section. This preserves DOM
				// state and event handlers from theme/third-party app blocks. If the VSN
				// page replacement removed the original section, fall back to Shopify's
				// Section Rendering API and emit the standard reload event afterwards.
				const existing = document.getElementById(`shopify-section-${sectionId}`);
				if (existing && existing !== bridge && !existing.contains(bridge)) {
					bridge.replaceChildren(existing);
				} else {
					const url = new URL(window.location.href);
					url.searchParams.set("sections", sectionId);
					const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, credentials: "same-origin" });
					if (!response.ok) throw new Error(`Section Rendering API returned ${response.status}`);
					const json = await response.json();
					const html = json?.[sectionId];
					if (!html) throw new Error("Section is not present in the current JSON template.");
					bridge.innerHTML = html;
				}
				bridge.dataset.vsnThemeSectionReady = "1";
				bridge.dispatchEvent(new CustomEvent("shopify:section:load", { bubbles: true, detail: { sectionId } }));
				document.dispatchEvent(new CustomEvent("vsn:theme-section:loaded", { detail: { sectionId, bridge } }));
			} catch (error) {
				console.error("VSN Theme Section Bridge:", error);
				bridge.innerHTML = `<div class="vsn-builder-message vsn-builder-error">Theme section could not be rendered: ${String(error?.message || error)}</div>`;
			} finally { bridge.dataset.vsnThemeSectionLoading = "0"; }
		}
	}

	function ensureExperimentRuntime(root = document) {
		const exp = root?.matches?.('.vsn-page[data-vsn-experiment-id]:not([data-vsn-experiment-id=""])') ? root : root?.querySelector?.('.vsn-page[data-vsn-experiment-id]:not([data-vsn-experiment-id=""])');
		if (!exp) return;
		loadRuntimeDependency("experiments").then((ready)=>{ if(ready) window.VSNExperiments?.init?.(root); });
	}

	function initializeBuilderEnhancements(root = document) {
		ensureExperimentRuntime(root);
		evaluateBuilderBehaviors(root);
		initializeCustomJavascript(root);
		initializeSticky();
		initializeParallax();
		applySeoPayload(root);
		initializeBuilderForms();
		initializeNavigationMenus();
		initializeAdvancedWidgets(root);
		initializeThemeSectionBridges(root);
	}
	window.VSNInitializeBuilderEnhancements = initializeBuilderEnhancements;


	async function renderHomePage() {
		const main = findThemeMain();

		if (!main) {
			console.error(
				"VSN: Theme main content element was not found.",
			);
			return;
		}

		if (main.dataset.vsnHomeLoaded === "true") {
			return;
		}

		main.dataset.vsnHomeLoaded = "loading";

		/*
		 * Default theme content ko abhi remove nahi karna.
		 * Pehle builder HTML successfully fetch aur validate hogi.
		 */
		const requestUrl =
			"/apps/vsn-builder/home?fragment=1&template=index";

		try {
			console.log(
				"VSN homepage request:",
				requestUrl,
			);

			const response = await fetch(withVisitorParams(requestUrl), {
				method: "GET",
				credentials: "same-origin",
				headers: {
					Accept: "text/html",
				},
			});

			let html = await response.text();

			console.log(
				"VSN homepage response status:",
				response.status,
			);

			console.log(
				"VSN homepage response HTML:",
				html.slice(0, 1000),
			);

			if (!response.ok) {
				throw new Error(
					`Builder request failed with status ${response.status}.`,
				);
			}

			if (!html.trim()) {
				throw new Error(
					"Builder returned an empty response.",
				);
			}

			html = await prepareBuilderHtml(html);

			/*
			 * HTML ko temporary document mein parse karo.
			 */
			const parser = new DOMParser();

			const parsedDocument =
				parser.parseFromString(
					html,
					"text/html",
				);

			const builderPage =
				parsedDocument.querySelector(
					".vsn-page",
				);

			if (!builderPage) {
				throw new Error(
					"Builder response does not contain .vsn-page.",
				);
			}

			/*
			 * Sirf style tag hona valid content nahi.
			 */
			const renderedNodes =
				builderPage.querySelectorAll(
					[
						".vsn-container",
						".vsn-heading",
						".vsn-text",
						".vsn-button",
						"img",
						"hr",
					].join(","),
				);

			console.log(
				"VSN rendered node count:",
				renderedNodes.length,
			);

			if (renderedNodes.length === 0) {
				throw new Error(
					"Builder page was found, but it contains no rendered blocks.",
				);
			}

			/*
			 * Validation ke baad hi default homepage replace karo.
			 */
			main.innerHTML = html;
			installGlobalSections(main); initializeBuilderEnhancements(main);

			main.classList.add(
				"vsn-builder-home",
			);

			main.dataset.vsnHomeLoaded =
				"true";

			console.log(
				"VSN homepage rendered successfully.",
			);
		} catch (error) {
			console.error(
				"VSN homepage renderer error:",
				error,
			);

			/*
			 * Error par Shopify ka original homepage rehne do.
			 */
			main.dataset.vsnHomeLoaded =
				"false";
		}
	}

	async function renderCollectionPage(context) {

		const main = findThemeMain();

		if (!main) {
			console.error(
				"VSN: Collection main element was not found.",
			);
			return;
		}

		if (
			main.dataset.vsnCollectionLoaded ===
			"true"
		) {
			console.log(
				"VSN collection already loaded",
			);
			return;
		}

		main.dataset.vsnCollectionLoaded =
			"loading";

		const requestUrl =
			"/apps/vsn-builder/default" +
			"?fragment=1" +
			"&template=collection" +
			`&resourceHandle=${encodeURIComponent(
				context.resourceHandle || "",
			)}`;

		try {
			const response = await fetch(
				withVisitorParams(requestUrl),
				{
					method: "GET",
					credentials: "same-origin",
					headers: {
						Accept: "text/html",
					},
				},
			);

			let html = await response.text();

			/*
			 * No published builder template exists.
			 * Keep Shopify's original collection page.
			 */
			if (response.status === 404) {
				main.dataset.vsnCollectionLoaded =
					"fallback";

				return;
			}

			if (!response.ok) {
				throw new Error(
					`Collection request failed: ${response.status}`,
				);
			}

			if (!html.trim()) {
				throw new Error(
					"Collection builder returned empty HTML.",
				);
			}

			html = await prepareBuilderHtml(html);

			const parsedDocument =
				new DOMParser().parseFromString(
					html,
					"text/html",
				);

			const builderPage =
				parsedDocument.querySelector(
					".vsn-page",
				);

			if (!builderPage) {
				throw new Error(
					"Response does not contain .vsn-page.",
				);
			}

			const renderedNodes =
				builderPage.querySelectorAll(
					[
						".vsn-container",
						".vsn-heading",
						".vsn-text",
						".vsn-button",
						"img",
						"hr",
					].join(","),
				);

			console.log(
				"VSN collection node count:",
				renderedNodes.length,
			);

			if (renderedNodes.length === 0) {
				throw new Error(
					"Collection template has no rendered elements.",
				);
			}

			main.innerHTML = html;
			installGlobalSections(main); initializeBuilderEnhancements(main);
			initializeProductFilters();

			main.classList.add(
				"vsn-builder-collection",
			);

			main.dataset.vsnCollectionLoaded =
				"true";

			console.log(
				"VSN collection rendered successfully",
			);
		} catch (error) {
			console.error(
				"VSN collection renderer error:",
				error,
			);

			main.dataset.vsnCollectionLoaded =
				"false";
		}
	}


	async function renderProductPage(context) {
		const main = findThemeMain();
		if (!main) return;
		if (main.dataset.vsnProductLoaded === "true" || main.dataset.vsnProductLoaded === "loading") return;
		main.dataset.vsnProductLoaded = "loading";

		const requestUrl = "/apps/vsn-builder/default" +
			"?fragment=1" +
			"&template=product" +
			`&resourceHandle=${encodeURIComponent(context.resourceHandle || "")}`;

		try {
			const response = await fetch(withVisitorParams(requestUrl), {
				method: "GET",
				credentials: "same-origin",
				headers: { Accept: "text/html" },
			});
			let html = await response.text();
			if (response.status === 404) {
				main.dataset.vsnProductLoaded = "fallback";
				return;
			}
			if (!response.ok) throw new Error(`Product request failed: ${response.status}`);
			if (!html.trim()) throw new Error("Product builder returned empty HTML.");
			html = await prepareBuilderHtml(html);
			main.innerHTML = html;
			installGlobalSections(main); initializeBuilderEnhancements(main);
			main.classList.add("vsn-builder-product");
			try { const title=main.querySelector(".vsn-product-title")?.textContent?.trim(); const image=main.querySelector(".vsn-product-main-image")?.src||""; if(title){ const list=JSON.parse(localStorage.getItem("vsnRecentlyViewed")||"[]"); const item={title,image,url:window.location.pathname}; localStorage.setItem("vsnRecentlyViewed",JSON.stringify([item,...list.filter(x=>x.url!==item.url)].slice(0,12))); } } catch {}
			main.dataset.vsnProductLoaded = "true";
			const selector = main.querySelector(".vsn-product-variant-selector");
			if (selector?.options?.length) updateProductVariantUI(main, selector.options[selector.selectedIndex]);
			loadRecommendations(main);
		} catch (error) {
			console.error("VSN product renderer error:", error);
			main.dataset.vsnProductLoaded = "false";
		}
	}

	async function renderContentTemplate(context, template) {
		const main=findThemeMain(); if(!main) return;
		const key=`vsn${template[0].toUpperCase()+template.slice(1)}Loaded`;
		if(main.dataset[key]==="true"||main.dataset[key]==="loading") return;
		main.dataset[key]="loading";
		const params=new URLSearchParams({fragment:"1",template});
		if(context.resourceHandle) params.set("resourceHandle",context.resourceHandle);
		if(template==="search" && context.searchQuery) params.set("query",context.searchQuery);
		if(template==="blog" && context.blogHandle) params.set("resourceHandle",context.blogHandle);
		if(template==="article") { if(context.blogHandle) params.set("blogHandle",context.blogHandle); if(context.articleHandle) params.set("articleHandle",context.articleHandle); if(context.resourceHandle) params.set("resourceHandle",context.resourceHandle); }
		try {
			const response=await fetch(withVisitorParams(`/apps/vsn-builder/default?${params.toString()}`),{credentials:"same-origin",headers:{Accept:"text/html"}});
			let html=await response.text();
			if(response.status===404){main.dataset[key]="fallback";return;}
			if(!response.ok||!html.trim()) throw new Error(`${template} request failed: ${response.status}`);
			html=await prepareBuilderHtml(html);
			main.innerHTML=html; installGlobalSections(main); initializeBuilderEnhancements(main); main.classList.add(`vsn-builder-${template}`); main.dataset[key]="true";
		} catch(error){console.error(`VSN ${template} renderer error:`,error);main.dataset[key]="false";}
	}


	let productActionsInitialized = false;

	function moneyText(amount, currency) {
		const n = Number(amount || 0);
		try { return new Intl.NumberFormat("en", { style: "currency", currency: currency || "USD" }).format(n); }
		catch { return `${n.toFixed(2)} ${currency || ""}`; }
	}

	function updateProductVariantUI(root, option) {
		if (!root || !option) return;
		const available = option.dataset.available !== "0";
		const currency = option.dataset.currency || "USD";
		root.querySelectorAll(".vsn-product-price").forEach((el) => { el.textContent = `${el.dataset.vsnPrefix || ""}${moneyText(option.dataset.price, currency)}`; });
		root.querySelectorAll(".vsn-product-compare-price").forEach((el) => {
			const value = option.dataset.comparePrice;
			el.textContent = value ? `${el.dataset.vsnPrefix || ""}${moneyText(value, currency)}` : "";
			el.style.display = value ? "" : "none";
		});
		root.querySelectorAll(".vsn-product-sku .vsn-product-meta-value").forEach((el) => { el.textContent = option.dataset.sku || "—"; });
		root.querySelectorAll(".vsn-product-availability").forEach((el) => {
			el.textContent = available ? (el.dataset.vsnInStockText || "In stock") : (el.dataset.vsnSoldOutText || "Sold out");
		});
		root.querySelectorAll(".vsn-product-add-to-cart, .vsn-product-buy-now").forEach((button) => {
			button.disabled = !available;
			button.style.opacity = available ? "1" : ".55";
			button.style.cursor = available ? "pointer" : "not-allowed";
		});
		if (option.dataset.image) {
			root.querySelectorAll(".vsn-product-main-image").forEach((img) => { img.src = option.dataset.image; });
			root.querySelectorAll(".vsn-product-gallery-thumb").forEach((thumb) => thumb.classList.toggle("is-active", thumb.dataset.vsnGallerySrc === option.dataset.image));
		}
	}

	function ensureCartDrawer() {
		let drawer = document.getElementById("vsn-cart-drawer");
		if (drawer) return drawer;
		drawer = document.createElement("div");
		drawer.id = "vsn-cart-drawer";
		drawer.innerHTML = `<div class="vsn-cart-backdrop" data-vsn-cart-close></div><aside class="vsn-cart-panel" role="dialog" aria-modal="true" aria-label="Shopping cart"><div class="vsn-cart-head"><strong>Your cart</strong><button type="button" data-vsn-cart-close aria-label="Close">×</button></div><div class="vsn-cart-progress"><div class="vsn-cart-progress-text"></div><div class="vsn-cart-progress-track"><div class="vsn-cart-progress-bar"></div></div></div><div class="vsn-cart-body">Loading…</div><div class="vsn-cart-foot" style="display:block"><div class="vsn-cart-discounts"></div><label style="display:block;margin:10px 0 6px;font-size:13px">Cart note</label><textarea class="vsn-cart-note" placeholder="Add a note to your order"></textarea><div class="vsn-cart-discount-box" style="display:flex;gap:8px;margin-top:10px"><input class="vsn-cart-discount-input" placeholder="Discount code" style="flex:1;border:1px solid #ddd;border-radius:8px;padding:9px"><button type="button" data-vsn-apply-discount style="border:1px solid #ddd;border-radius:8px;background:#fff;padding:9px 12px">Apply</button></div><div class="vsn-cart-shipping-box" style="margin-top:10px"><div style="display:flex;gap:8px"><input class="vsn-cart-country" placeholder="Country code" value="US" style="width:90px;border:1px solid #ddd;border-radius:8px;padding:9px"><input class="vsn-cart-zip" placeholder="ZIP / Postal code" style="flex:1;border:1px solid #ddd;border-radius:8px;padding:9px"><button type="button" data-vsn-shipping-rates style="border:1px solid #ddd;border-radius:8px;background:#fff;padding:9px 12px">Rates</button></div><div class="vsn-cart-shipping-results" style="font-size:12px;color:#666;margin-top:6px"></div></div><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px"><div class="vsn-cart-subtotal"></div><a class="vsn-cart-checkout" href="/checkout">Checkout</a></div></div></aside>`;
		drawer.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:none";
		const style = document.createElement("style");
		style.textContent = `#vsn-cart-drawer.is-open{display:block}.vsn-cart-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.45)}.vsn-cart-panel{position:absolute;right:0;top:0;height:100%;width:min(430px,92vw);background:#fff;box-shadow:-10px 0 40px rgba(0,0,0,.18);display:flex;flex-direction:column}.vsn-cart-head,.vsn-cart-foot{padding:18px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;gap:12px}.vsn-cart-head button{font-size:28px;border:0;background:none;cursor:pointer}.vsn-cart-body{padding:18px;overflow:auto;flex:1}.vsn-cart-line{display:grid;grid-template-columns:72px 1fr auto;gap:12px;padding:12px 0;border-bottom:1px solid #eee}.vsn-cart-line img{width:72px;height:72px;object-fit:cover;border-radius:8px}.vsn-cart-line input{width:68px}.vsn-cart-remove{border:0;background:none;text-decoration:underline;cursor:pointer}.vsn-cart-checkout{display:inline-flex;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px}.vsn-product-gallery-thumb.is-active{outline:2px solid #111;outline-offset:2px}@media(max-width:749px){.vsn-product-recommendations[data-vsn-columns-mobile] .vsn-product-recommendations-grid{grid-template-columns:repeat(var(--vsn-mobile-cols,1),minmax(0,1fr))!important}.vsn-recently-viewed-grid{grid-template-columns:repeat(var(--vsn-recent-cols-mobile,1),minmax(0,1fr))!important}}@media(min-width:750px) and (max-width:989px){.vsn-product-recommendations[data-vsn-columns-tablet] .vsn-product-recommendations-grid{grid-template-columns:repeat(var(--vsn-tablet-cols,2),minmax(0,1fr))!important}.vsn-recently-viewed-grid{grid-template-columns:repeat(var(--vsn-recent-cols-tablet,2),minmax(0,1fr))!important}}
.vsn-cart-progress{padding:12px 18px;border-bottom:1px solid #eee}.vsn-cart-progress-track{height:6px;border-radius:999px;background:#eee;overflow:hidden}.vsn-cart-progress-bar{height:100%;background:#008060}.vsn-cart-note{width:100%;min-height:64px;border:1px solid #ddd;border-radius:8px;padding:8px}.vsn-cart-discounts{font-size:13px;color:#087f5b}.vsn-empty-recs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}.vsn-empty-recs a{text-decoration:none;color:inherit}.vsn-empty-recs img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px}
.vsn-entrance{opacity:0;transition:opacity .55s ease,transform .55s ease}.vsn-entrance.vsn-in-view{opacity:1;transform:none}.vsn-entrance-fade-up{transform:translateY(24px)}.vsn-entrance-slide-left{transform:translateX(-28px)}.vsn-entrance-slide-right{transform:translateX(28px)}.vsn-entrance-zoom-in{transform:scale(.96)}.vsn-hover-lift,.vsn-hover-scale,.vsn-hover-fade{transition:transform .2s ease,opacity .2s ease,box-shadow .2s ease}.vsn-hover-lift:hover{transform:translateY(-4px);box-shadow:0 10px 24px rgba(0,0,0,.1)}.vsn-hover-scale:hover{transform:scale(1.025)}.vsn-hover-fade:hover{opacity:.78}.vsn-exit{transition:opacity .35s ease,transform .35s ease}.vsn-exit-fade-out.vsn-out-view{opacity:0}.vsn-exit-slide-up-out.vsn-out-view{opacity:0;transform:translateY(-24px)}.vsn-exit-slide-down-out.vsn-out-view{opacity:0;transform:translateY(24px)}.vsn-exit-zoom-out.vsn-out-view{opacity:0;transform:scale(.92)}.vsn-sticky-element{position:relative;z-index:var(--vsn-sticky-z,20)}[data-vsn-sticky-element='1'],[data-vsn-parallax='1']{translate:0 calc(var(--vsn-sticky-y,0px) + var(--vsn-parallax-y,0px));will-change:translate}@media(prefers-reduced-motion:reduce){.vsn-entrance,.vsn-hover-lift,.vsn-hover-scale,.vsn-hover-fade{transition:none!important;animation:none!important}[data-vsn-parallax='1']{--vsn-parallax-y:0px!important}}`;
		document.head.appendChild(style);
		document.body.appendChild(drawer);
		return drawer;
	}

	async function refreshCartDrawer(open = false) {
		const drawer = ensureCartDrawer();
		const response = await fetch("/cart.js", { headers: { Accept: "application/json" } });
		if (!response.ok) return;
		const cart = await response.json();
		document.querySelectorAll(".vsn-cart-count").forEach((el) => { el.textContent = String(cart.item_count || 0); });
		const body = drawer.querySelector(".vsn-cart-body");
		const recent = (() => { try { return JSON.parse(localStorage.getItem("vsnRecentlyViewed") || "[]"); } catch { return []; } })();
		body.innerHTML = cart.items?.length ? cart.items.map((item,index)=>`<div class="vsn-cart-line"><img src="${item.image || ""}" alt=""><div><div><strong>${item.product_title || item.title || "Product"}</strong></div><div style="font-size:13px;color:#666">${item.variant_title && item.variant_title !== "Default Title" ? item.variant_title : ""}</div><div style="margin-top:8px"><input type="number" min="0" value="${item.quantity}" data-vsn-cart-line="${index+1}" aria-label="Quantity"></div></div><div><div>${moneyText((item.final_line_price || 0)/100, cart.currency)}</div><button class="vsn-cart-remove" type="button" data-vsn-cart-remove="${index+1}">Remove</button></div></div>`).join("") : `<p>Your cart is empty.</p>${recent.length ? `<div class="vsn-empty-recs">${recent.slice(0,4).map((item)=>`<a href="${item.url||'#'}"><img src="${item.image||''}" alt=""><div style="font-size:12px;margin-top:5px">${item.title||'Product'}</div></a>`).join('')}</div>` : ''}`;
		drawer.querySelector(".vsn-cart-subtotal").textContent = `Subtotal: ${moneyText((cart.total_price || 0)/100, cart.currency)}`;
		const threshold = Number(window.VSN_CART_FREE_SHIPPING_THRESHOLD || 100);
		const total = Number(cart.total_price || 0) / 100;
		const remaining = Math.max(0, threshold - total);
		const progress = Math.min(100, threshold > 0 ? total / threshold * 100 : 100);
		drawer.querySelector(".vsn-cart-progress-bar").style.width = `${progress}%`;
		drawer.querySelector(".vsn-cart-progress-text").textContent = remaining > 0 ? `${moneyText(remaining, cart.currency)} away from free shipping` : "You qualify for free shipping";
		const discounts = (cart.cart_level_discount_applications || []).map((d)=>d.title).filter(Boolean);
		drawer.querySelector(".vsn-cart-discounts").textContent = discounts.length ? `Discounts: ${discounts.join(", ")}` : "";
		const note = drawer.querySelector(".vsn-cart-note"); if (note && document.activeElement !== note) note.value = cart.note || "";
		if (open) drawer.classList.add("is-open");
	}

	async function changeCartLine(line, quantity) {
		await fetch("/cart/change.js", { method:"POST", headers:{"Content-Type":"application/json",Accept:"application/json"}, body:JSON.stringify({line:Number(line),quantity:Math.max(0,Number(quantity)||0)}) });
		await refreshCartDrawer(true);
		document.dispatchEvent(new CustomEvent("vsn:cart-updated"));
	}

	async function loadRecommendations(root = document) {
		for (const section of root.querySelectorAll(".vsn-product-recommendations")) {
			if (section.dataset.vsnLoaded === "1") continue;
			section.dataset.vsnLoaded = "1";
			const id = section.dataset.vsnProductId;
			const limit = Math.max(1, Math.min(12, Number(section.dataset.vsnLimit || 4)));
			const intent = section.dataset.vsnRecommendationIntent === "complementary" ? "complementary" : "related";
			if (!id) continue;
			try {
				const response = await fetch(`/recommendations/products.json?product_id=${encodeURIComponent(id)}&limit=${limit}&intent=${intent}`, { headers:{Accept:"application/json"} });
				if (!response.ok) throw new Error(`Recommendations failed: ${response.status}`);
				const data = await response.json();
				const products = data.products || [];
				const grid = section.querySelector(".vsn-product-recommendations-grid");
				const showImage = section.dataset.vsnShowImage !== "0", showTitle = section.dataset.vsnShowTitle !== "0", showPrice = section.dataset.vsnShowPrice !== "0"; const ratio = section.dataset.vsnImageRatio || "1 / 1"; const gap = Math.max(0, Number(section.dataset.vsnGap || 18));
				const desktop=Math.max(1,Number(section.dataset.vsnColumnsDesktop||section.dataset.vsnColumns||4)); const tablet=Math.max(1,Number(section.dataset.vsnColumnsTablet||2)); const mobile=Math.max(1,Number(section.dataset.vsnColumnsMobile||1)); grid.style.gridTemplateColumns=`repeat(${desktop},minmax(0,1fr))`; grid.style.gap=`${gap}px`; section.style.setProperty('--vsn-mobile-cols',String(mobile)); section.style.setProperty('--vsn-tablet-cols',String(tablet));
				grid.innerHTML = products.length ? products.map((product)=>`<a href="${product.url || `/products/${product.handle}`}" style="color:inherit;text-decoration:none">${showImage ? `<img src="${product.featured_image || product.images?.[0] || ""}" alt="${product.title || ""}" loading="lazy" style="display:block;width:100%;aspect-ratio:${ratio};object-fit:cover;border-radius:10px">` : ""}${showTitle ? `<div style="margin-top:8px;font-weight:600">${product.title || ""}</div>` : ""}${showPrice ? `<div style="margin-top:4px">${moneyText((product.price || 0)/100, product.currency || window.Shopify?.currency?.active || "USD")}</div>` : ""}</a>`).join("") : `<div style="color:#777;font-size:14px">No recommendations found.</div>`;
			} catch (error) { console.error("VSN recommendations error:", error); }
		}
	}

	function closeImageLightbox() {
		const overlay = document.getElementById("vsn-image-lightbox");
		if (overlay) overlay.remove();
	}

	function lightboxColor(color, opacity) {
		const value = String(color || "#000000").trim();
		const alpha = Math.max(0, Math.min(1, Number(opacity ?? 0.86)));
		const short = /^#([0-9a-f]{3})$/i.exec(value);
		const full = /^#([0-9a-f]{6})$/i.exec(value);
		if (short) {
			const hex = short[1].split("").map((char)=>char+char).join("");
			return `rgba(${parseInt(hex.slice(0,2),16)},${parseInt(hex.slice(2,4),16)},${parseInt(hex.slice(4,6),16)},${alpha})`;
		}
		if (full) {
			const hex = full[1];
			return `rgba(${parseInt(hex.slice(0,2),16)},${parseInt(hex.slice(2,4),16)},${parseInt(hex.slice(4,6),16)},${alpha})`;
		}
		return value;
	}

	function lightboxSettings(trigger) {
		const page = trigger?.closest?.(".vsn-page") || document.querySelector(".vsn-page");
		const d = page?.dataset || {};
		return {
			enabled: d.vsnLightboxEnabled !== "0",
			backdrop: d.vsnLightboxBackdrop || "#000000",
			opacity: Math.max(0, Math.min(1, Number(d.vsnLightboxOpacity ?? .86))),
			maxWidth: Math.max(40, Math.min(100, Number(d.vsnLightboxMaxWidth || 96))),
			maxHeight: Math.max(40, Math.min(100, Number(d.vsnLightboxMaxHeight || 92))),
			showClose: d.vsnLightboxShowClose !== "0",
			closeBackdrop: d.vsnLightboxCloseBackdrop !== "0",
			closeEscape: d.vsnLightboxCloseEscape !== "0",
			animation: ["none","fade","zoom"].includes(d.vsnLightboxAnimation) ? d.vsnLightboxAnimation : "fade",
		};
	}

	function openImageLightbox(source, alt = "", trigger = null) {
		const src = String(source || "").trim();
		if (!src) return;
		const settings = lightboxSettings(trigger);
		if (!settings.enabled) return;
		closeImageLightbox();
		const overlay = document.createElement("div");
		overlay.id = "vsn-image-lightbox";
		overlay.setAttribute("role", "dialog");
		overlay.setAttribute("aria-modal", "true");
		overlay.setAttribute("aria-label", alt || "Image preview");
		overlay.style.cssText = `position:fixed;inset:0;z-index:2147483001;background:${lightboxColor(settings.backdrop, settings.opacity)};display:grid;place-items:center;padding:28px;cursor:${settings.closeBackdrop ? "zoom-out" : "default"};opacity:${settings.animation === "none" ? "1" : "0"};transition:opacity .18s ease`;

		const image = document.createElement("img");
		image.src = src;
		image.alt = String(alt || "");
		const initialScale = settings.animation === "zoom" ? ".96" : "1";
		image.style.cssText = `display:block;max-width:${settings.maxWidth}vw;max-height:${settings.maxHeight}vh;width:auto;height:auto;object-fit:contain;box-shadow:0 18px 60px rgba(0,0,0,.35);cursor:default;transform:scale(${initialScale});transition:transform .2s ease`;
		image.addEventListener("click", (event) => event.stopPropagation());

		const close = document.createElement("button");
		close.type = "button";
		close.setAttribute("aria-label", "Close image preview");
		close.textContent = "×";
		close.style.cssText = "position:fixed;right:18px;top:14px;width:44px;height:44px;border:0;border-radius:999px;background:rgba(255,255,255,.94);color:#111;font-size:30px;line-height:1;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.25)";
		close.hidden = !settings.showClose;
		close.addEventListener("click", (event) => { event.stopPropagation(); closeImageLightbox(); });
		if (settings.closeBackdrop) overlay.addEventListener("click", closeImageLightbox);
		overlay.append(image, close);
		document.body.appendChild(overlay);
		requestAnimationFrame(()=>{ overlay.style.opacity = "1"; if (settings.animation === "zoom") image.style.transform = "scale(1)"; });
		if (settings.showClose) close.focus({ preventScroll: true });
		if (settings.closeEscape) {
			const onKeyDown = (event) => {
				if (event.key !== "Escape") return;
				closeImageLightbox();
				document.removeEventListener("keydown", onKeyDown);
			};
			document.addEventListener("keydown", onKeyDown);
		}
	}

	function initializeProductActions() {
		if (productActionsInitialized) return;
		productActionsInitialized = true;
		ensureCartDrawer();
		refreshCartDrawer(false).catch(()=>{});

		document.addEventListener("change", (event) => {
			const selector = event.target.closest?.(".vsn-product-variant-selector");
			if (selector) {
				const root = selector.closest(".vsn-page") || document;
				updateProductVariantUI(root, selector.options[selector.selectedIndex]);
				return;
			}
			const qty = event.target.closest?.("[data-vsn-cart-line]");
			if (qty) changeCartLine(qty.dataset.vsnCartLine, qty.value).catch(console.error);
		});

		document.addEventListener("change", async (event) => {
			const note = event.target.closest?.(".vsn-cart-note");
			if (!note) return;
			try { await fetch("/cart/update.js", { method:"POST", headers:{"Content-Type":"application/json",Accept:"application/json"}, body:JSON.stringify({ note: note.value }) }); } catch (error) { console.error("VSN cart note error:", error); }
		});

		document.addEventListener("click", async (event) => {
			const lightboxLink = event.target.closest?.("[data-vsn-lightbox='1']");
			if (lightboxLink) {
				event.preventDefault();
				openImageLightbox(lightboxLink.dataset.vsnLightboxSrc || lightboxLink.getAttribute("href") || "", lightboxLink.dataset.vsnLightboxAlt || lightboxLink.querySelector("img")?.alt || "", lightboxLink);
				return;
			}
			const thumb = event.target.closest?.(".vsn-product-gallery-thumb");
			if (thumb) {
				event.preventDefault();
				const gallery = thumb.closest(".vsn-product-gallery");
				const main = gallery?.querySelector(".vsn-product-gallery-main");
				if (main) { main.src = thumb.dataset.vsnGallerySrc || main.src; main.alt = thumb.dataset.vsnGalleryAlt || main.alt; }
				gallery?.querySelectorAll(".vsn-product-gallery-thumb").forEach((el)=>el.classList.toggle("is-active",el===thumb));
				return;
			}
			const closer = event.target.closest?.("[data-vsn-cart-close]");
			if (closer) { document.getElementById("vsn-cart-drawer")?.classList.remove("is-open"); return; }
			const remove = event.target.closest?.("[data-vsn-cart-remove]");
			if (remove) { await changeCartLine(remove.dataset.vsnCartRemove, 0); return; }
			const discountButton = event.target.closest?.("[data-vsn-apply-discount]");
			if (discountButton) { const drawer=discountButton.closest("#vsn-cart-drawer"); const code=drawer?.querySelector(".vsn-cart-discount-input")?.value?.trim(); if(code) window.location.href=`/discount/${encodeURIComponent(code)}?redirect=${encodeURIComponent('/checkout')}`; return; }
			const shippingButton = event.target.closest?.("[data-vsn-shipping-rates]");
			if (shippingButton) { const drawer=shippingButton.closest("#vsn-cart-drawer"); const country=drawer?.querySelector(".vsn-cart-country")?.value?.trim()||"US"; const zip=drawer?.querySelector(".vsn-cart-zip")?.value?.trim()||""; const out=drawer?.querySelector(".vsn-cart-shipping-results"); if(out) out.textContent="Checking…"; try { const url=`/cart/shipping_rates.json?shipping_address[country]=${encodeURIComponent(country)}&shipping_address[zip]=${encodeURIComponent(zip)}`; const response=await fetch(url,{headers:{Accept:"application/json"}}); const data=await response.json(); const rates=data.shipping_rates||[]; if(out) out.textContent=rates.length?rates.map((rate)=>`${rate.name}: ${rate.price} ${rate.currency||''}`.trim()).join(" · "):"No rates found."; } catch(error){ if(out) out.textContent="Shipping rates unavailable."; console.error("VSN shipping rates error:",error); } return; }

			const button = event.target.closest?.(".vsn-product-add-to-cart, .vsn-product-buy-now");
			if (!button) return;
			event.preventDefault();
			const root = button.closest(".vsn-page") || document;
			const selector = root.querySelector(".vsn-product-variant-selector");
			const quantityInput = root.querySelector(".vsn-product-quantity");
			const id = String(selector?.value || button.dataset.vsnDefaultVariantId || "").trim();
			const quantity = Math.max(1, Number(quantityInput?.value || 1));
			if (!id) return;
			const originalText = button.dataset.vsnReadyText || button.textContent;
			button.disabled = true; button.textContent = "Adding...";
			try {
				const response = await fetch("/cart/add.js", { method:"POST", headers:{"Content-Type":"application/json",Accept:"application/json"}, body:JSON.stringify({id:Number(id),quantity}) });
				if (!response.ok) throw new Error(`Cart add failed: ${response.status}`);
				window.VSNAnalytics?.track?.("add_to_cart",{root,metadata:{variantId:id,quantity}});
				await window.VSNAnalytics?.syncCart?.();
				if (button.classList.contains("vsn-product-buy-now")) { window.VSNAnalytics?.track?.("checkout",{root}); window.location.href = "/checkout"; return; }
				button.textContent = "Added";
				await refreshCartDrawer(true);
				document.dispatchEvent(new CustomEvent("vsn:cart-updated"));
				setTimeout(()=>{ button.textContent=originalText; button.disabled=false; },1000);
			} catch(error) { console.error("VSN add to cart error:",error); button.textContent="Try Again"; button.disabled=false; }
		});
	}

	function initializeNormalPages(root = document) {
		root
			.querySelectorAll(".vsn-builder-mount")
			.forEach(renderExistingMount);
	}

	function formatProductMoney(
		amount,
		currencyCode,
	) {
		const numeric =
			Number(amount || 0);

		try {
			return new Intl.NumberFormat(
				"en",
				{
					style: "currency",
					currency:
						currencyCode || "USD",
				},
			).format(numeric);
		} catch {
			return `${numeric.toFixed(
				2,
			)} ${currencyCode || ""}`;
		}
	}

	function renderLoadMoreProductCard(
		product,
		grid,
	) {
		const placeholder =
			"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20800%20800'%3E%3Crect%20width='800'%20height='800'%20fill='%23f1f1f1'/%3E%3Cpath%20d='M270%20515l100-115%2070%2075%2090-110%20100%20150H270z'%20fill='%23d7d7d7'/%3E%3Ccircle%20cx='330'%20cy='300'%20r='42'%20fill='%23d7d7d7'/%3E%3C/svg%3E";

		const showImage =
			grid?.dataset.vsnShowImage !== "0";

		const showTitle =
			grid?.dataset.vsnShowTitle !== "0";

		const showPrice =
			grid?.dataset.vsnShowPrice !== "0";

		const showComparePrice =
			grid?.dataset.vsnShowComparePrice !== "0";

		const imageNatural =
			grid?.dataset.vsnImageNatural === "1";

		const imageRatio =
			grid?.dataset.vsnImageRatio ||
			"1 / 1";

		const imageFit =
			grid?.dataset.vsnImageFit ||
			"cover";

		const imageRadius =
			grid?.dataset.vsnImageRadius ||
			"8px";

		const cardBackground =
			grid?.dataset.vsnCardBackground ||
			"#ffffff";

		const cardBorderColor =
			grid?.dataset.vsnCardBorderColor ||
			"#e5e5e5";

		const cardBorderWidth =
			grid?.dataset.vsnCardBorderWidth ||
			"1px";

		const cardRadius =
			grid?.dataset.vsnCardRadius ||
			"12px";

		const cardPadding =
			grid?.dataset.vsnCardPadding ||
			"12px";

		const imageUrl =
			product?.image?.url ||
			placeholder;

		const imageAlt =
			product?.image?.altText ||
			product?.title ||
			"Product image";

		const priceAmount =
			Number(
				product?.price?.amount || 0,
			);

		const compareAmount =
			Number(
				product?.compareAtPrice
					?.amount || 0,
			);

		const isOnSale =
			compareAmount >
			priceAmount;

		const isSoldOut =
			product?.availableForSale ===
			false;

		const price =
			formatProductMoney(
				priceAmount,
				product?.price
					?.currencyCode,
			);

		const comparePrice =
			isOnSale
				? formatProductMoney(
					compareAmount,
					product?.compareAtPrice
						?.currencyCode ||
					product?.price
						?.currencyCode,
				)
				: "";

		return `
    <article
      class="vsn-product-card"
      data-vsn-available="${isSoldOut ? "0" : "1"}"
      data-vsn-price="${priceAmount}"
      data-vsn-vendor="${String(product?.vendor || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}"
      data-vsn-product-type="${String(product?.productType || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}"
      style="
        opacity: ${isSoldOut ? "0.72" : "1"
			};
        background: ${cardBackground};
		border: ${cardBorderWidth} solid ${cardBorderColor};
		border-radius: ${cardRadius};
		padding: ${cardPadding};
        overflow: hidden;
      "
    >
      <a
        href="${product?.url || "#"
			}"
        style="
          color: inherit;
          text-decoration: none;
        "
      >
        <div
          style="
            position: relative;
            width: 100%;
          "
        >
          ${showImage
				? `
	<div
		class="vsn-product-image-wrap"
		style="
			position: relative;
			width: 100%;
		"
	>
		<img
			src="${imageUrl}"
			alt="${imageAlt}"
			loading="lazy"
			style="
				display: block;
				width: 100%;

				${imageNatural
					? "height: auto;"
					: `aspect-ratio: ${imageRatio};`
				}

				object-fit: ${imageFit};
				border-radius: ${imageRadius};
			"
		>

		${isSoldOut
					? `
				<span
					class="vsn-product-badge vsn-product-badge-sold-out"
					style="
						position: absolute;
						top: 10px;
						left: 10px;
						display: inline-flex;
						align-items: center;
						padding: 6px 10px;
						border-radius: 999px;
						background: #1a1a1a;
						color: #ffffff;
						font-size: 11px;
						font-weight: 700;
						line-height: 1;
						text-transform: uppercase;
						letter-spacing: 0.04em;
					"
				>
					Sold out
				</span>
			`
					: isOnSale
						? `
					<span
						class="vsn-product-badge vsn-product-badge-sale"
						style="
							position: absolute;
							top: 10px;
							left: 10px;
							display: inline-flex;
							align-items: center;
							padding: 6px 10px;
							border-radius: 999px;
							background: #d72c0d;
							color: #ffffff;
							font-size: 11px;
							font-weight: 700;
							line-height: 1;
							text-transform: uppercase;
							letter-spacing: 0.04em;
						"
					>
						Sale
					</span>
				`
						: ""
				}
	</div>
`
				: ""
			}
        </div>

        ${showTitle
				? `
			<div
				style="
					margin-top: 12px;
					font-size: 16px;
					font-weight: 600;
					line-height: 1.4;
				"
			>
				${product?.title || ""}
			</div>
`
				: ""
			}

        ${showPrice
				? `
			<div
				style="
					display: flex;
					align-items: center;
					flex-wrap: wrap;
					gap: 8px;
					margin-top: 6px;
				"
			>
				<span
					style="
						font-weight: 600;
					"
				>
					${price}
				</span>

				${showComparePrice &&
					isOnSale &&
					comparePrice
					? `
							<span
								style="
									opacity: 0.55;
									text-decoration: line-through;
								"
							>
								${comparePrice}
							</span>
						`
					: ""
				}
			</div>
`
				: ""
			}
      </a>
    </article>
  `;
	}


	function findFiltersForGrid(grid) {
		if (!grid) return null;
		const gridId = grid.getAttribute("data-vsn-id") || "";
		if (!gridId) return null;
		return document.querySelector(
			`.vsn-product-filters[data-vsn-grid-id="${CSS.escape(gridId)}"]`,
		);
	}

	function refreshProductFilterOptions(filters, grid) {
		if (!filters || !grid) return;
		[["vendor", "vsnVendor"], ["product-type", "vsnProductType"]].forEach(([filterName, datasetKey]) => {
			const select = filters.querySelector(`[data-vsn-filter="${filterName}"]`);
			if (!select) return;
			const selected = select.value;
			const values = new Set();
			grid.querySelectorAll(".vsn-product-card").forEach((card) => {
				const value = String(card.dataset[datasetKey] || "").trim();
				if (value) values.add(value);
			});
			const firstOption = select.options[0]?.cloneNode(true);
			select.innerHTML = "";
			if (firstOption) select.appendChild(firstOption);
			Array.from(values).sort((a, b) => a.localeCompare(b)).forEach((value) => {
				const option = document.createElement("option");
				option.value = value;
				option.textContent = value;
				select.appendChild(option);
			});
			select.value = Array.from(values).includes(selected) ? selected : "";
		});
	}

	function applyProductFilters(filters) {
		if (!filters) return;
		const gridId = filters.getAttribute("data-vsn-grid-id") || "";
		if (!gridId) return;
		const grid = document.querySelector(`.vsn-collection-product-grid[data-vsn-id="${CSS.escape(gridId)}"]`);
		if (!grid) return;
		const availability = filters.querySelector('[data-vsn-filter="availability"]')?.value || "all";
		const minRaw = filters.querySelector('[data-vsn-filter="min-price"]')?.value ?? "";
		const maxRaw = filters.querySelector('[data-vsn-filter="max-price"]')?.value ?? "";
		const vendor = filters.querySelector('[data-vsn-filter="vendor"]')?.value || "";
		const productType = filters.querySelector('[data-vsn-filter="product-type"]')?.value || "";
		const minPrice = minRaw === "" ? null : Number(minRaw);
		const maxPrice = maxRaw === "" ? null : Number(maxRaw);
		let visible = 0;
		grid.querySelectorAll(".vsn-product-card").forEach((card) => {
			const available = card.dataset.vsnAvailable === "1";
			const price = Number(card.dataset.vsnPrice || 0);
			const availabilityMatch = availability === "all" || (availability === "in-stock" && available) || (availability === "out-of-stock" && !available);
			const minMatch = minPrice === null || Number.isNaN(minPrice) || price >= minPrice;
			const maxMatch = maxPrice === null || Number.isNaN(maxPrice) || price <= maxPrice;
			const matches = availabilityMatch && minMatch && maxMatch && (!vendor || card.dataset.vsnVendor === vendor) && (!productType || card.dataset.vsnProductType === productType);
			card.hidden = !matches;
			if (matches) visible += 1;
		});
		const empty = document.querySelector(`[data-vsn-filter-empty-for="${CSS.escape(gridId)}"]`);
		if (empty) empty.hidden = visible !== 0;
	}

	function initializeProductFilters() {
		document.querySelectorAll(".vsn-product-filters").forEach((filters) => {
			let gridId = filters.getAttribute("data-vsn-grid-id") || "";
			if (!gridId && filters.classList.contains("vsn-standalone-filters")) {
				const firstGrid = document.querySelector(".vsn-collection-product-grid[data-vsn-id]");
				gridId = firstGrid?.getAttribute("data-vsn-id") || "";
				if (gridId) filters.setAttribute("data-vsn-grid-id", gridId);
			}
			const grid = gridId ? document.querySelector(`.vsn-collection-product-grid[data-vsn-id="${CSS.escape(gridId)}"]`) : null;
			refreshProductFilterOptions(filters, grid);
			applyProductFilters(filters);
		});
	}

	document.addEventListener("input", (event) => {
		const filters = event.target.closest?.(".vsn-product-filters");
		if (filters) applyProductFilters(filters);
	});
	document.addEventListener("change", (event) => {
		const filters = event.target.closest?.(".vsn-product-filters");
		if (filters) applyProductFilters(filters);
	});
	document.addEventListener("click", (event) => {
		const clear = event.target.closest?.("[data-vsn-filter-clear]");
		if (!clear) return;
		const filters = clear.closest(".vsn-product-filters");
		if (!filters) return;
		filters.querySelectorAll("select").forEach((field) => { field.selectedIndex = 0; });
		filters.querySelectorAll('input[type="number"]').forEach((field) => { field.value = ""; });
		applyProductFilters(filters);
	});

	document.addEventListener("change", (event) => {
		const select = event.target?.closest?.(".vsn-standalone-sort");
		if (!select) return;
		const grid = document.querySelector(".vsn-collection-product-grid[data-vsn-id]");
		if (!grid) return;
		const cards = [...grid.querySelectorAll(":scope > .vsn-product-card")];
		const mode = select.value || "featured";
		if (mode === "featured") return;
		cards.sort((a, b) => {
			if (mode.startsWith("price-")) {
				const av = Number(a.dataset.vsnPrice || 0), bv = Number(b.dataset.vsnPrice || 0);
				return mode === "price-ascending" ? av - bv : bv - av;
			}
			const av = String(a.dataset.vsnTitle || ""), bv = String(b.dataset.vsnTitle || "");
			return mode === "title-descending" ? bv.localeCompare(av) : av.localeCompare(bv);
		});
		cards.forEach((card) => grid.appendChild(card));
	});

	document.addEventListener("click", (event) => {
		const standalone = event.target?.closest?.(".vsn-collection-load-more");
		if (!standalone) return;
		const actual = document.querySelector(".vsn-load-more-button:not([disabled])");
		if (actual) actual.click();
	});

	let loadMoreInitialized = false;

	function initializeLoadMore() {
		if (loadMoreInitialized) {
			return;
		}

		loadMoreInitialized = true;
		document.addEventListener(
			"click",
			async function (event) {
				const button =
					event.target.closest(
						".vsn-load-more-button",
					);

				if (!button) {
					return;
				}

				const gridId =
					button.getAttribute(
						"data-vsn-grid-id",
					);

				if (!gridId) {
					return;
				}

				const grid =
					document.querySelector(
						`.vsn-collection-product-grid[data-vsn-id="${CSS.escape(
							gridId,
						)}"]`,
					);

				if (!grid) {
					return;
				}

				const handle =
					grid.getAttribute(
						"data-vsn-collection-handle",
					) || "";

				const cursor =
					grid.getAttribute(
						"data-vsn-end-cursor",
					) || "";

				const pageSize = Math.max(
					1,
					Math.min(
						24,
						Number(
							grid.getAttribute(
								"data-vsn-page-size",
							) || 8,
						),
					),
				);

				const sortBy =
					grid.getAttribute(
						"data-vsn-sort-by",
					) || "featured";

				if (!handle) {
					return;
				}

				const originalText =
					button.textContent;

				const loadingText =
					button.getAttribute(
						"data-vsn-loading-text",
					) || "Loading...";

				button.disabled = true;
				button.textContent =
					loadingText;

				try {
					const params =
						new URLSearchParams();

					params.set(
						"loadMore",
						"1",
					);

					params.set(
						"template",
						"collection",
					);

					params.set(
						"resourceHandle",
						handle,
					);

					params.set(
						"pageSize",
						String(pageSize),
					);

					params.set(
						"sortBy",
						sortBy,
					);

					if (cursor) {
						params.set(
							"after",
							cursor,
						);
					}

					const response =
						await fetch(
							`/apps/vsn-builder/default?${params.toString()}`,
							{
								credentials:
									"same-origin",
							},
						);

					if (!response.ok) {
						throw new Error(
							`Load More failed: ${response.status}`,
						);
					}

					const data =
						await response.json();

					if (
						!data?.ok ||
						!Array.isArray(
							data.products,
						)
					) {
						throw new Error(
							"Invalid Load More response",
						);
					}

					const html =
						data.products
							.map((product) =>
								renderLoadMoreProductCard(
									product,
									grid,
								),
							)
							.join("");

					grid.insertAdjacentHTML(
						"beforeend",
						html,
					);

					const filters = findFiltersForGrid(grid);
					refreshProductFilterOptions(filters, grid);
					applyProductFilters(filters);

					const hasNextPage =
						data.pageInfo
							?.hasNextPage === true;

					const nextCursor =
						data.pageInfo
							?.endCursor || "";

					grid.setAttribute(
						"data-vsn-has-next",
						hasNextPage
							? "1"
							: "0",
					);

					grid.setAttribute(
						"data-vsn-end-cursor",
						nextCursor,
					);

					if (!hasNextPage) {
						const wrap =
							button.closest(
								".vsn-load-more-wrap",
							);

						if (wrap) {
							wrap.remove();
						}
					} else {
						button.disabled =
							false;

						button.textContent =
							originalText ||
							"Load More";
					}
				} catch (error) {
					console.error(
						"VSN Load More error:",
						error,
					);

					button.disabled =
						false;

					button.textContent =
						"Try Again";
				}
			},
		);
	}


	let behaviorObserver = null;
	let exitObserver = null;
	function evaluateBuilderBehaviors(root = document) {
		const context = getContext();
		const params = new URLSearchParams(window.location.search);
		const pageRoot = root.querySelector?.(".vsn-page") || document.querySelector(".vsn-page");
		const mobileBreakpoint = Number(pageRoot?.dataset?.vsnMobileBreakpoint || 749);
		const tabletBreakpoint = Number(pageRoot?.dataset?.vsnTabletBreakpoint || 989);
		const evaluateRule = (item = {}) => {
			const rule = item.rule || "always";
			const key = item.key || "";
			const value = String(item.value || "");
			if (rule === "always") return true;
			if (rule === "logged-in") return context.customerLoggedIn;
			if (rule === "logged-out") return !context.customerLoggedIn;
			if (rule === "cart-empty") return Number(context.cartItemCount || 0) <= 0;
			if (rule === "cart-has-items") return Number(context.cartItemCount || 0) > 0;
			if (rule === "cart-items-min") return Number(context.cartItemCount || 0) >= Math.max(0, Number(value || 0));
			if (rule === "product-inventory-min") return Number(context.productInventory || 0) >= Number(value || 0);
			if (rule === "product-inventory-max") return Number(context.productInventory || 0) <= Number(value || 0);
			if (rule === "device-mobile") return window.matchMedia(`(max-width: ${mobileBreakpoint}px)`).matches;
			if (rule === "device-tablet") return window.matchMedia(`(min-width: ${mobileBreakpoint + 1}px) and (max-width: ${tabletBreakpoint}px)`).matches;
			if (rule === "device-desktop") return window.matchMedia(`(min-width: ${tabletBreakpoint + 1}px)`).matches;
			if (rule === "query-param") return String(params.get(key) || "") === value;
			if (rule === "market") return String(window.Shopify?.country || document.documentElement.dataset.country || "").toLowerCase() === value.toLowerCase();
			if (rule === "language") return String(window.Shopify?.locale || document.documentElement.lang || "").toLowerCase().startsWith(value.toLowerCase());
			if (rule === "date-after") return !value || Date.now() >= new Date(value).getTime();
			if (rule === "date-before") return !value || Date.now() <= new Date(value).getTime();
			return true;
		};
		root.querySelectorAll("[data-vsn-condition-rule]").forEach((el) => {
			let visible = true;
			if (el.dataset.vsnConditions) {
				try {
					const config = JSON.parse(el.dataset.vsnConditions);
					const groupResults = (config.groups || []).map((group) => {
						const results = (group.rules || []).map(evaluateRule);
						return String(group.operator || "AND").toUpperCase() === "OR" ? results.some(Boolean) : results.every(Boolean);
					});
					visible = String(config.operator || "AND").toUpperCase() === "OR" ? groupResults.some(Boolean) : groupResults.every(Boolean);
				} catch (error) { console.warn("VSN condition parse failed", error); }
			} else {
				visible = evaluateRule({ rule: el.dataset.vsnConditionRule, key: el.dataset.vsnConditionKey, value: el.dataset.vsnConditionValue });
			}
			el.hidden = !visible;
		});
		root.querySelectorAll("[data-vsn-dynamic-query]").forEach((el) => {
			const key = el.dataset.vsnDynamicQuery;
			const value = params.get(key) || el.dataset.vsnDynamicFallback || "";
			if (!value) return;
			const target = el.dataset.vsnDynamicTarget || "text";
			if (target === "src" && el instanceof HTMLImageElement) el.src = value;
			else if (target === "url" && el instanceof HTMLAnchorElement) el.href = value;
			else el.textContent = value;
		});
		root.querySelectorAll("[data-vsn-hover]").forEach((el) => el.classList.add(`vsn-hover-${el.dataset.vsnHover}`));
		root.querySelectorAll("[data-vsn-sticky-element='1']").forEach((el) => {
			el.classList.add("vsn-sticky-element");
			el.style.setProperty("--vsn-sticky-z", String(Number(el.dataset.vsnStickyZIndex || 20) || 20));
		});
		scheduleStickyUpdate();
		if (!behaviorObserver && "IntersectionObserver" in window) {
			behaviorObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
				if (entry.isIntersecting) { entry.target.classList.add("vsn-in-view"); behaviorObserver.unobserve(entry.target); }
			}), { threshold: 0.08 });
		}
		root.querySelectorAll("[data-vsn-entrance]").forEach((el) => {
			el.classList.add("vsn-entrance", `vsn-entrance-${el.dataset.vsnEntrance}`);
			if (behaviorObserver) behaviorObserver.observe(el); else el.classList.add("vsn-in-view");
		});
		if (!exitObserver && "IntersectionObserver" in window) {
			exitObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
				if (entry.isIntersecting) { entry.target.dataset.vsnSeen = "1"; entry.target.classList.remove("vsn-out-view"); }
				else if (entry.target.dataset.vsnSeen === "1") entry.target.classList.add("vsn-out-view");
			}), { threshold: 0.02 });
		}
		root.querySelectorAll("[data-vsn-exit]").forEach((el) => {
			el.classList.add("vsn-exit", `vsn-exit-${el.dataset.vsnExit}`);
			if (exitObserver) exitObserver.observe(el);
		});
	}

	let stickyInitialized = false;
	let stickyTicking = false;
	function stickyDeviceEnabled(el) {
		const width = window.innerWidth || document.documentElement.clientWidth || 1200;
		if (width <= 749) return el.dataset.vsnStickyMobile !== "0";
		if (width <= 1024) return el.dataset.vsnStickyTablet !== "0";
		return el.dataset.vsnStickyDesktop !== "0";
	}
	function stickyBoundary(el) {
		const mode = el.dataset.vsnStickyBoundary || "parent";
		const ancestor = (selector) => el.parentElement?.closest?.(selector) || null;
		if (mode === "column") return ancestor("[data-vsn-column-cell='1']") || ancestor("[data-vsn-node-type='columns']") || ancestor("[data-vsn-node-type]") || el.closest(".vsn-page");
		if (mode === "section") return ancestor("[data-vsn-node-type='section']") || ancestor("[data-vsn-node-type]") || el.closest(".vsn-page");
		if (mode === "page") return el.closest("[data-vsn-page-boundary='1']") || el.closest(".vsn-page");
		if (mode === "custom") {
			const wanted = String(el.dataset.vsnStickyTarget || "").trim();
			if (wanted) {
				const match = Array.from(el.closest(".vsn-page")?.querySelectorAll?.("[data-vsn-id]") || []).find((node) => node.getAttribute("data-vsn-id") === wanted);
				if (match && match.contains(el)) return match;
			}
		}
		return ancestor("[data-vsn-node-type]") || el.closest(".vsn-page");
	}
	function updateStickyPositions() {
		stickyTicking = false;
		document.querySelectorAll("[data-vsn-sticky-element='1']").forEach((el) => {
			if (!stickyDeviceEnabled(el)) {
				el.style.setProperty("--vsn-sticky-y", "0px");
				return;
			}
			const boundary = stickyBoundary(el);
			if (!boundary || boundary === el) return;
			const currentShift = Number.parseFloat(el.style.getPropertyValue("--vsn-sticky-y")) || 0;
			const parallaxShift = Number.parseFloat(el.style.getPropertyValue("--vsn-parallax-y")) || 0;
			const rect = el.getBoundingClientRect();
			const naturalTop = rect.top - currentShift - parallaxShift;
			const naturalBottom = naturalTop + rect.height;
			const boundaryRect = boundary.getBoundingClientRect();
			const topOffset = Math.max(0, Math.min(1000, Number(el.dataset.vsnStickyOffset || 12) || 0));
			const endOffset = Math.max(0, Math.min(1000, Number(el.dataset.vsnStickyEndOffset || 0) || 0));
			const desired = topOffset - naturalTop;
			const maxShift = Math.max(0, boundaryRect.bottom - endOffset - naturalBottom);
			el.style.setProperty("--vsn-sticky-y", `${Math.max(0, Math.min(desired, maxShift))}px`);
		});
	}
	function scheduleStickyUpdate() {
		if (stickyTicking) return;
		stickyTicking = true;
		requestAnimationFrame(updateStickyPositions);
	}
	function initializeSticky() {
		if (stickyInitialized) { scheduleStickyUpdate(); return; }
		stickyInitialized = true;
		window.addEventListener("scroll", scheduleStickyUpdate, { passive: true });
		window.addEventListener("resize", scheduleStickyUpdate, { passive: true });
		scheduleStickyUpdate();
	}

	let parallaxInitialized = false;
	function initializeParallax() {
		if (parallaxInitialized) return;
		parallaxInitialized = true;
		let ticking = false;
		window.addEventListener("scroll", () => {
			if (ticking || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
			ticking = true;
			requestAnimationFrame(() => {
				document.querySelectorAll("[data-vsn-parallax='1']").forEach((el) => {
					const rect = el.getBoundingClientRect();
					const stickyShift = Number.parseFloat(el.style.getPropertyValue("--vsn-sticky-y")) || 0;
					el.style.setProperty("--vsn-parallax-y", `${Math.max(-30, Math.min(30, -(rect.top - stickyShift) * 0.035))}px`);
				});
				scheduleStickyUpdate();
				ticking = false;
			});
		}, { passive: true });
	}

	let loopLoadMoreInitialized = false;
	function initializeLoopLoadMore() {
		if (loopLoadMoreInitialized) return;
		loopLoadMoreInitialized = true;
		document.addEventListener("click", async (event) => {
			const button = event.target?.closest?.("[data-vsn-loop-load-more='1']");
			if (!button || button.disabled) return;
			const loop = button.closest("[data-vsn-node-type='loop']");
			const page = button.closest("[data-vsn-page-id]") || document.querySelector("[data-vsn-page-id]");
			const pageHandle = String(page?.dataset?.vsnPageHandle || page?.dataset?.vsnPageId || "default").trim() || "default";
			const loopId = String(button.dataset.vsnLoopId || "").trim();
			const after = String(button.dataset.vsnLoopAfter || "").trim();
			const pageSize = String(button.dataset.vsnLoopPageSize || "12");
			if (!loop || !loopId || !after) return;
			button.disabled = true;
			const oldText = button.textContent;
			button.textContent = "Loading…";
			try {
				const context = getContext();
				const params = new URLSearchParams({ fragment:"1", loopQuery:"1", loopId, loopAfter:after, loopPageSize:pageSize, template:String(context.template || "") });
				if (context.resourceHandle) params.set("resourceHandle", context.resourceHandle);
				if (context.searchQuery) params.set("query", context.searchQuery);
				if (context.blogHandle) params.set("blogHandle", context.blogHandle);
				if (context.articleHandle) params.set("articleHandle", context.articleHandle);
				const response = await fetch(withVisitorParams(`/apps/vsn-builder/${encodeURIComponent(pageHandle)}?${params.toString()}`), { credentials:"same-origin", headers:{Accept:"application/json"} });
				const payload = await response.json();
				if (!payload?.ok) throw new Error(payload?.error || "Loop items could not be loaded.");
				const grid = loop.querySelector(".vsn-loop-grid");
				if (grid && payload.html) {
					grid.insertAdjacentHTML("beforeend", payload.html);
					initializeBuilderEnhancements(grid);
				}
				const next = payload.pageInfo || {};
				if (next.hasNextPage && next.endCursor) {
					button.dataset.vsnLoopAfter = next.endCursor;
					button.disabled = false;
					button.textContent = oldText || "Load more";
				} else button.remove();
			} catch (error) {
				console.error("VSN Loop load-more failed:", error);
				button.disabled = false;
				button.textContent = "Try again";
			}
		});
	}


	function initialize() {
		const context = getContext();

		// Load More listener har page par
		// pehle initialize karo.
		initializeLoadMore();
		initializeLoopLoadMore();
		initializeProductActions();
		initializeBuilderEnhancements(document);

		if (context.template === "index") {
			renderHomePage();
			return;
		}

		if (
			context.template === "collection"
		) {
			renderCollectionPage(context);
			return;
		}

		if (context.template === "product") { renderProductPage(context); return; }
		if (isSearchPage(context)) { renderContentTemplate(context, "search"); return; }
		if (isArticlePage(context)) { renderContentTemplate(context, "article"); return; }
		if (isBlogPage(context)) { renderContentTemplate(context, "blog"); return; }
		const special = specialTemplate(context);
		if (special) { renderContentTemplate(context, special); return; }

		initializeNormalPages();
	}


	if (document.readyState === "loading") {
		document.addEventListener(
			"DOMContentLoaded",
			initialize,
		);
	} else {
		initialize();
	}

	document.addEventListener(
		"shopify:section:load",
		(event) => {
			const context = getContext();

			if (isHomePage(context)) {
				renderHomePage();
				return;
			}

			if (isCollectionPage(context)) {
				renderCollectionPage(context);
				return;
			}

			if (isProductPage(context)) { renderProductPage(context); return; }
			if (isSearchPage(context)) { renderContentTemplate(context, "search"); return; }
			if (isArticlePage(context)) { renderContentTemplate(context, "article"); return; }
			if (isBlogPage(context)) { renderContentTemplate(context, "blog"); return; }
			const special = specialTemplate(context);
			if (special) { renderContentTemplate(context, special); return; }

			initializeNormalPages(event.target);
		},
	);
})();