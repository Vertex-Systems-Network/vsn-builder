import { FALLBACK_GOOGLE_FONTS } from "../data/font-catalog.js";
import {
	buildGoogleFontHref,
	collectFontUsages,
	mergeFontUsage,
	SYSTEM_FONT_FAMILIES,
} from "../utils/font-runtime.js";

export function vsnFontRuntime({ elements = [], globals = {}, customFonts = [] } = {}) {
	const usages = collectFontUsages({ elements, globals });
	if (globals.fontFamily) mergeFontUsage(usages, globals.fontFamily, { weights: [400,500,600,700], styles: ["normal"] });
	if (globals.headingFontFamily && globals.headingFontFamily !== "inherit") mergeFontUsage(usages, globals.headingFontFamily, { weights: [400,500,600,700,800], styles: ["normal"] });

	const customByFamily = new Map();
	for (const font of customFonts || []) {
		const key = String(font.family || "").toLowerCase();
		if (!customByFamily.has(key)) customByFamily.set(key, []);
		customByFamily.get(key).push(font);
	}

	const css = [];
	const googleUsages = new Map();
	for (const [key, usage] of usages) {
		const customVariants = customByFamily.get(key) || [];
		if (customVariants.length) {
			for (const custom of customVariants) {
				const mime = String(custom.mimeType || "");
				const format = mime.includes("woff2") ? "woff2" : mime.includes("woff") ? "woff" : (mime.includes("otf") || mime.includes("opentype")) ? "opentype" : "truetype";
				css.push(`@font-face{font-family:${JSON.stringify(custom.family)};src:url('/apps/vsn-builder/font/${encodeURIComponent(custom.id)}') format('${format}');font-style:${custom.style || "normal"};font-weight:${custom.weight || 400};font-display:swap;}`);
			}
			continue;
		}
		if (!SYSTEM_FONT_FAMILIES.has(key)) googleUsages.set(key, usage);
	}

	return {
		css: css.join("\n"),
		googleUrl: buildGoogleFontHref(googleUsages, FALLBACK_GOOGLE_FONTS),
	};
}
