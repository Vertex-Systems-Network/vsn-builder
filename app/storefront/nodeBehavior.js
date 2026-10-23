import { normalizeElementInteractions } from "../builder/interactionSchema.js";
import { escapeAttribute } from "./safeCss.js";

export function injectNodeBehavior(html, node) {
	if (!html || typeof html !== "string") return html;
	const c = node?.conditions || {};
	const i = normalizeElementInteractions(node?.interactions || {});
	const d = node?.dynamicSource || {};
	const attrs = [`data-vsn-node-type="${escapeAttribute(node?.type || "unknown")}"`];
	if (node?.meta?.componentId) attrs.push(`data-vsn-component-id="${escapeAttribute(node.meta.componentId)}"`);
	if (node?.meta?.__vsnComponentSlotName) attrs.push(`data-vsn-component-slot="${escapeAttribute(node.meta.__vsnComponentSlotName)}"`);
	if (c.enabled) {
		attrs.push(`data-vsn-condition-rule="${escapeAttribute(c.rule || "always")}"`);
		attrs.push(`data-vsn-condition-key="${escapeAttribute(c.key || "")}"`);
		attrs.push(`data-vsn-condition-value="${escapeAttribute(c.value || "")}"`);
		if (Array.isArray(c.groups) && c.groups.length) attrs.push(`data-vsn-conditions="${escapeAttribute(JSON.stringify({ operator: c.operator || "AND", groups: c.groups }))}"`);
	}
	if (i.entrance && i.entrance !== "none") attrs.push(`data-vsn-entrance="${escapeAttribute(i.entrance)}"`);
	if (i.hover && i.hover !== "none") attrs.push(`data-vsn-hover="${escapeAttribute(i.hover)}"`);
	const styleExit = node?.styles?.effects?.exitAnimation;
	if (styleExit && !["default", "none"].includes(styleExit)) attrs.push(`data-vsn-exit="${escapeAttribute(styleExit)}"`);
	if (i.sticky) {
		const stickyBoundary = ["parent", "column", "section", "page", "custom"].includes(String(i.stickyBoundary || "parent")) ? String(i.stickyBoundary || "parent") : "parent";
		attrs.push('data-vsn-sticky-element="1"');
		attrs.push(`data-vsn-sticky-boundary="${escapeAttribute(stickyBoundary)}"`);
		attrs.push(`data-vsn-sticky-offset="${escapeAttribute(Number.isFinite(Number(i.stickyOffset)) ? Math.max(0, Math.min(1000, Number(i.stickyOffset))) : 12)}"`);
		attrs.push(`data-vsn-sticky-end-offset="${escapeAttribute(Number.isFinite(Number(i.stickyEndOffset)) ? Math.max(0, Math.min(1000, Number(i.stickyEndOffset))) : 0)}"`);
		attrs.push(`data-vsn-sticky-z-index="${escapeAttribute(Number.isFinite(Number(i.stickyZIndex)) ? Math.max(-1, Math.min(2147483000, Number(i.stickyZIndex))) : 20)}"`);
		attrs.push(`data-vsn-sticky-desktop="${i.stickyDesktop === false ? "0" : "1"}"`);
		attrs.push(`data-vsn-sticky-tablet="${i.stickyTablet === false ? "0" : "1"}"`);
		attrs.push(`data-vsn-sticky-mobile="${i.stickyMobile === false ? "0" : "1"}"`);
		if (stickyBoundary === "custom" && typeof i.stickyCustomTarget === "string" && i.stickyCustomTarget.trim()) attrs.push(`data-vsn-sticky-target="${escapeAttribute(i.stickyCustomTarget.trim().slice(0, 256))}"`);
	}
	if (i.parallax) attrs.push('data-vsn-parallax="1"');
	if (Array.isArray(i.timelines) && i.timelines.length) attrs.push(`data-vsn-motion="${escapeAttribute(JSON.stringify({ schemaVersion:i.schemaVersion || 3, timelines:i.timelines }))}"`);
	if (d.enabled && d.source === "query.search") {
		attrs.push(`data-vsn-dynamic-query="${escapeAttribute(d.key || "")}"`);
		attrs.push(`data-vsn-dynamic-target="${escapeAttribute(d.target || "text")}"`);
		attrs.push(`data-vsn-dynamic-fallback="${escapeAttribute(d.fallback || "")}"`);
	}
	if (!attrs.length) return html;
	return html.replace(/^\s*<([a-zA-Z][\w:-]*)\b/, (match) => `${match} ${attrs.join(" ")}`);
}
