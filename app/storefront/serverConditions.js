import { evaluateCommerceConditionRule } from "../builder/commerceConditions.js";

export function conditionRuleMatches(rule = {}, ctx = {}) {
	const name = rule.rule || "always";
	const customer = ctx?.customer || {};
	if (name === "always") return true;
	if (name === "logged-in") return customer.loggedIn === true;
	if (name === "logged-out") return customer.loggedIn !== true;
	const commerceMatch = evaluateCommerceConditionRule(name, rule, ctx); if (commerceMatch !== null) return commerceMatch;
	if (name === "date-after") return !rule.value || Date.now() >= new Date(rule.value).getTime();
	if (name === "date-before") return !rule.value || Date.now() <= new Date(rule.value).getTime();
	// Device, query, market and language are browser-dependent and are finalized by the theme renderer.
	return true;
}

export function serverConditionMatches(node, ctx) {
	const c = node?.conditions;
	if (!c?.enabled) return true;
	if (Array.isArray(c.groups) && c.groups.length) {
		const groupResults = c.groups.map((group) => {
			const results = (group.rules || []).map((rule) => conditionRuleMatches(rule, ctx));
			return String(group.operator || "AND").toUpperCase() === "OR" ? results.some(Boolean) : results.every(Boolean);
		});
		return String(c.operator || "AND").toUpperCase() === "OR" ? groupResults.some(Boolean) : groupResults.every(Boolean);
	}
	return conditionRuleMatches(c, ctx);
}
