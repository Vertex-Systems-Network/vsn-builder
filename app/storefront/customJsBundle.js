import { collectCustomJsGroups, validateCustomJs } from "../builder/customCode.js";

export function buildCustomJsBundle(groups = []) {
	const entries = collectCustomJsGroups(groups);
	const valid = [];
	const invalid = [];
	for (const entry of entries) {
		const check = validateCustomJs(entry.code);
		if (check.valid) valid.push(entry);
		else invalid.push({ id: entry.id, message: check.error });
	}
	const lines = [
		"(function(){",
		"var __vsnScript=document.currentScript;",
		"var __vsnRoot=(__vsnScript&&__vsnScript.parentElement)||document;",
		"function __vsnFind(id){var roots=[__vsnRoot,document];for(var r=0;r<roots.length;r++){var list=roots[r]&&roots[r].querySelectorAll?roots[r].querySelectorAll('[data-vsn-id]'):[];for(var i=0;i<list.length;i++){if(list[i].getAttribute('data-vsn-id')===id)return list[i];}}return null;}",
	];
	for (const entry of valid) {
		const errorLabel = JSON.stringify(`VSN custom JS failed for ${String(entry.id)}:`);
		lines.push(`try{var element=__vsnFind(${JSON.stringify(entry.id)});if(element){(function(element,document,window){"use strict";\n${entry.code}\n}).call(element,element,document,window);element.setAttribute('data-vsn-js-ready','1');}}catch(error){console.error(${errorLabel},error);}`);
	}
	for (const entry of invalid) lines.push(`console.warn(${JSON.stringify(`VSN custom JS skipped for ${entry.id}: ${entry.message}`)});`);
	lines.push("})();");
	return lines.join("\n");
}
