export function formatMoney(
	amount,
	currencyCode = "USD",
) {
	const numericAmount =
		Number(amount || 0);

	try {
		return new Intl.NumberFormat(
			"en",
			{
				style: "currency",
				currency:
					currencyCode || "USD",
			},
		).format(numericAmount);
	} catch {
		return `${numericAmount.toFixed(
			2,
		)} ${currencyCode}`;
	}
}

export function readPath(source, path) {
	if (!source || !path) return undefined;
	return String(path).split(".").reduce((value, key) => value == null ? undefined : value[key], source);
}

export function applyDynamicSource(node, renderContext) {
	const dynamic = node?.dynamicSource;
	if (!dynamic?.enabled || !dynamic.source) return node;
	let value;
	if (dynamic.source === "query.search") {
		value = dynamic.fallback || "";
	} else if (dynamic.source === "product.price") {
		const money = renderContext?.product?.price;
		value = money ? formatMoney(money.amount, money.currencyCode) : undefined;
	} else if (dynamic.source === "product.metafield") {
		const namespace = String(dynamic.namespace || "custom");
		const key = String(dynamic.key || "");
		const metafields = renderContext?.product?.metafields?.nodes || renderContext?.product?.metafields || [];
		value = metafields.find((item) => item.namespace === namespace && item.key === key)?.value;
	} else if (dynamic.source === "metaobject.field") {
		const signature = `${dynamic.metaobjectType || ""}|${dynamic.metaobjectId || ""}|${dynamic.key || ""}`;
		value = renderContext?.dynamicMetaobjects?.[signature];
	} else {
		value = readPath(renderContext, dynamic.source);
	}
	if (value == null || value === "") value = dynamic.fallback;
	if (value == null || value === "") return node;
	const target = dynamic.target || "text";
	const props = { ...(node.props || {}) };
	if (target === "src") props.src = String(value);
	else if (target === "url") props.url = String(value);
	else {
		if (["button","announcement-bar"].includes(node.type)) props.text = String(value);
		else if (node.type === "image") props.alt = props.alt || String(value);
		else props.text = String(value);
	}
	return { ...node, props };
}
