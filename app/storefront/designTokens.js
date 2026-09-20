export function toCssSize(value, fallback = "0px") {
	if (value === null || value === undefined || value === "") {
		return fallback;
	}

	if (typeof value === "number" && Number.isFinite(value)) {
		return `${value}px`;
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return fallback;
		return /^-?\d+(?:\.\d+)?$/.test(trimmed)
			? `${trimmed}px`
			: trimmed;
	}

	if (typeof value === "object") {
		const candidate =
			value.desktop ??
			value.value ??
			value.tablet ??
			value.mobile;

		if (candidate !== undefined && candidate !== null && candidate !== "") {
			const unit = value.unit || "px";
			return typeof candidate === "number"
				? `${candidate}${unit}`
				: toCssSize(candidate, fallback);
		}
	}

	return fallback;
}

export function getGlobalStyles(elements) {
	const node = (Array.isArray(elements) ? elements : []).find(
		(item) => item?.type === "global-styles",
	);
	return {
		primaryColor: node?.props?.primaryColor || "#008060",
		secondaryColor: node?.props?.secondaryColor || "#6d7175",
		accentColor: node?.props?.accentColor || node?.props?.primaryColor || "#008060",
		textColor: node?.props?.textColor || "#1a1a1a",
		backgroundColor: node?.props?.backgroundColor || "#ffffff",
		surfaceColor: node?.props?.surfaceColor || "#ffffff",
		mutedSurfaceColor: node?.props?.mutedSurfaceColor || "#f6f6f7",
		borderColor: node?.props?.borderColor || "#e3e3e3",
		fontFamily: node?.props?.fontFamily || "Inter, system-ui, sans-serif",
		headingFontFamily: node?.props?.headingFontFamily || "inherit",
		headingScale: Math.max(1, Math.min(2, Number(node?.props?.headingScale || 1.25))),
		buttonBackground: node?.props?.buttonBackground || "#1a1a1a",
		buttonTextColor: node?.props?.buttonTextColor || "#ffffff",
		buttonRadius: toCssSize(node?.props?.buttonRadius, "8px"),
		formBackground: node?.props?.formBackground || "#ffffff",
		formTextColor: node?.props?.formTextColor || "#202223",
		formBorderColor: node?.props?.formBorderColor || "#c9cccf",
		formRadius: toCssSize(node?.props?.formRadius, "8px"),
		radiusSm: toCssSize(node?.props?.radiusSm, "6px"),
		radiusMd: toCssSize(node?.props?.radiusMd, "12px"),
		radiusLg: toCssSize(node?.props?.radiusLg, "20px"),
		spacingBase: Math.max(1, Number(node?.props?.spacingBase || 4)),
		shadowSm: node?.props?.shadowSm || "0 1px 2px rgba(0,0,0,.08)",
		shadowMd: node?.props?.shadowMd || "0 8px 24px rgba(0,0,0,.12)",
		shadowLg: node?.props?.shadowLg || "0 20px 50px rgba(0,0,0,.16)",
		containerMaxWidth: toCssSize(node?.props?.containerMaxWidth, "1200px"),
		mobileBreakpoint: Math.max(320, Number(node?.props?.mobileBreakpoint || 749)),
		tabletBreakpoint: Math.max(500, Number(node?.props?.tabletBreakpoint || 989)),
	};
}

export function mergeShopDesignTokens(globals, tokens = {}) {
	const out = { ...globals };
	const keys = ["primaryColor","secondaryColor","accentColor","textColor","backgroundColor","surfaceColor","mutedSurfaceColor","borderColor","fontFamily","headingFontFamily","buttonBackground","buttonTextColor","buttonRadius","formBackground","formTextColor","formBorderColor","formRadius","radiusSm","radiusMd","radiusLg","shadowSm","shadowMd","shadowLg","containerMaxWidth"];
	for (const key of keys) if (tokens[key] !== undefined && tokens[key] !== null && String(tokens[key]).trim() !== "") out[key] = tokens[key];
	if (tokens.containerMd) out.containerMaxWidth = tokens.containerMd;
	if (tokens.spacingBase) out.spacingBase = Math.max(1, Number(tokens.spacingBase) || out.spacingBase || 4);
	if (tokens.headingScale) out.headingScale = Math.max(1, Math.min(2, Number(tokens.headingScale) || out.headingScale || 1.25));
	return out;
}
