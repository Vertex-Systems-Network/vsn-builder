export function responsiveValue(
	value,
	fallback,
) {
	if (
		value &&
		typeof value === "object"
	) {
		const desktop =
			value.desktop ??
			value.value ??
			fallback;

		const unit =
			allowedUnit(value.unit) || "px";

		return `${safeNumber(
			desktop,
			fallback,
		)}${unit}`;
	}

	if (typeof value === "number") {
		return `${value}px`;
	}

	if (typeof value === "string") {
		const text = value.trim();
		if (/^-?(?:\d+\.?\d*|\.\d+)(?:px|%|em|rem|vw|vh|vmin|vmax|vi|vb|svw|svh|svi|svb|lvw|lvh|lvi|lvb|dvw|dvh|dvi|dvb|ch|ex|cap|ic|lh|rlh|cqw|cqh|cqi|cqb|cqmin|cqmax|cm|mm|q|in|pt|pc)$/i.test(text)) return text;
	}

	return `${fallback}px`;
}

export function cssSize(value, fallback) {
	if (
		typeof value === "number"
	) {
		return `${value}px`;
	}

	if (typeof value === "string") {
		const text = value.trim();
		if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) return `${text}px`;
		if (/^-?(?:\d+\.?\d*|\.\d+)(?:px|%|em|rem|vw|vh|vmin|vmax|vi|vb|svw|svh|svi|svb|lvw|lvh|lvi|lvb|dvw|dvh|dvi|dvb|ch|ex|cap|ic|lh|rlh|cqw|cqh|cqi|cqb|cqmin|cqmax|cm|mm|q|in|pt|pc)$/i.test(text)) return text;
		if (/^(?:auto|none|min-content|max-content|fit-content|content)$/i.test(text)) return text;
		if (/^(?:calc|min|max|clamp|var)\([^;{}]+\)$/i.test(text)) return text;
	}

	if (
		value &&
		typeof value === "object"
	) {
		const number =
			value.desktop ??
			value.value;

		const unit =
			allowedUnit(value.unit) ||
			"px";

		if (
			typeof number === "number"
		) {
			return `${number}${unit}`;
		}
	}

	return fallback;
}

export function individualSpacingCss(
	style = {},
) {
	const marginTop = cssSize(
		style.marginTop,
		"0px",
	);

	const marginRight = cssSize(
		style.marginRight,
		"0px",
	);

	const marginBottom = cssSize(
		style.marginBottom,
		"0px",
	);

	const marginLeft = cssSize(
		style.marginLeft,
		"0px",
	);

	const paddingTop = cssSize(
		style.paddingTop,
		"0px",
	);

	const paddingRight = cssSize(
		style.paddingRight,
		"0px",
	);

	const paddingBottom = cssSize(
		style.paddingBottom,
		"0px",
	);

	const paddingLeft = cssSize(
		style.paddingLeft,
		"0px",
	);

	return {
		margin:
			`${marginTop} ` +
			`${marginRight} ` +
			`${marginBottom} ` +
			`${marginLeft}`,

		padding:
			`${paddingTop} ` +
			`${paddingRight} ` +
			`${paddingBottom} ` +
			`${paddingLeft}`,
	};
}

export function spacingCss(
	value,
	fallback,
) {
	const fallbackValue =
		typeof fallback === "object"
			? fallback
			: {
				top: fallback,
				right: fallback,
				bottom: fallback,
				left: fallback,
			};

	const spacing =
		value &&
			typeof value === "object"
			? value.desktop || value
			: {};

	const unit =
		allowedUnit(
			spacing.unit ||
			value?.unit,
		) || "px";

	const top = safeNumber(
		spacing.top,
		fallbackValue.top,
	);

	const right = safeNumber(
		spacing.right,
		fallbackValue.right,
	);

	const bottom = safeNumber(
		spacing.bottom,
		fallbackValue.bottom,
	);

	const left = safeNumber(
		spacing.left,
		fallbackValue.left,
	);

	return `${top}${unit} ${right}${unit} ${bottom}${unit} ${left}${unit}`;
}

export function safeNumber(value, fallback) {
	const number = Number(value);

	return Number.isFinite(number)
		? number
		: fallback;
}

export function allowedUnit(value) {
	const allowed = new Set([
		"px",
		"em",
		"rem",
		"%",
		"vw",
		"vh",
	]);

	return allowed.has(value)
		? value
		: null;
}

export function allowedValue(
	value,
	allowed,
	fallback,
) {
	return allowed.includes(value)
		? value
		: fallback;
}

export function safeColor(value, fallback) {
	if (
		typeof value !== "string"
	) {
		return fallback;
	}

	const color = value.trim();

	if (
		/^#[0-9a-f]{3,8}$/i.test(color) ||
		/^rgba?\([0-9.,%\s]+\)$/i.test(
			color,
		) ||
		/^hsla?\([0-9.,%\s]+\)$/i.test(
			color,
		) ||
		color === "transparent" ||
		// Global Style Kit colour token, e.g. var(--vsn-color-primary, #111111)
		/^var\(--vsn-[a-z0-9-]{1,48}(\s*,\s*#[0-9a-f]{3,8})?\)$/i.test(color)
	) {
		return color;
	}

	return fallback;
}

export function safeUrl(value) {
	if (
		typeof value !== "string" ||
		!value.trim()
	) {
		return "#";
	}

	const url = value.trim();

	if (
		url.startsWith("/") ||
		url.startsWith("#") ||
		url.startsWith("mailto:") ||
		url.startsWith("tel:")
	) {
		return url;
	}

	try {
		const parsed = new URL(url);

		if (
			parsed.protocol === "https:" ||
			parsed.protocol === "http:"
		) {
			return url;
		}
	} catch {
		return "#";
	}

	return "#";
}

export function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

export function escapeAttribute(value) {
	return escapeHtml(value);
}
