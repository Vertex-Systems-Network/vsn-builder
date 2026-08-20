import { buildNodeStyle, stateStyleDeclarations, styleObjectToCssDeclarations } from "./styleEngine.js";
import { buildWidgetSpecificCss } from "./widgetSpecificStyleEngine.js";
import { breakpointMediaQuery, containerQueryCondition, normalizeContainerQuery, normalizeResponsiveBreakpoints, responsiveInheritanceOrder } from "./responsiveEngine.js";
const HOVER_TRANSFORMS = {
  lift: "translateY(-6px)",
  scale: "scale(1.04)",
  shrink: "scale(.96)",
  rotate: "rotate(2deg)",
};

function present(value) {
  return value !== undefined && value !== null && value !== "";
}

function escapeCssAttribute(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]/g, "");
}

function importantDeclarations(style = {}) {
  return styleObjectToCssDeclarations(style)
    .split(";")
    .filter(Boolean)
    .map((item) => item.startsWith("--") ? item : `${item} !important`)
    .join(";");
}

export function dedupeGeneratedCss(css = "") {
  // Only dedupe complete single-line generated rules. Multiline merchant CSS must
  // keep repeated braces/declarations intact or valid custom CSS can be corrupted.
  const seen = new Set();
  return String(css || "")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      const completeRule = trimmed.includes("{") && trimmed.includes("}") && !trimmed.startsWith("@media");
      if (completeRule) {
        if (seen.has(trimmed)) return "";
        seen.add(trimmed);
      }
      return line;
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function sanitizeCustomCss(css = "") {
  return String(css || "")
    .replace(/<\/?style\b[^>]*>/gi, "")
    .replace(/@import\b[^;]+;?/gi, "")
    .replace(/@charset\b[^;]+;?/gi, "");
}

export function mergeDeep(base = {}, patch = {}) {
  const result = { ...(base || {}) };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = mergeDeep(result[key] || {}, value);
    } else if (value !== undefined && value !== "") {
      result[key] = value;
    }
  }
  return result;
}

export function effectiveResponsiveConfig(node, device = "desktop", breakpointConfig = {}) {
  const responsive = node?.responsive || {};
  const order = responsiveInheritanceOrder(breakpointConfig, device);
  // Legacy pages without a custom breakpoint config still inherit desktop -> tablet -> mobile.
  const fallbackOrder = device === "mobile" ? ["desktop", "tablet", "mobile"] : device === "tablet" ? ["desktop", "tablet"] : ["desktop"];
  const keys = order.includes(device) ? order : fallbackOrder;
  return keys.reduce((acc, key) => {
    const cfg = responsive?.[key] || {};
    return { styles: mergeDeep(acc.styles, cfg.styles || {}), props: mergeDeep(acc.props, cfg.props || {}) };
  }, { styles: {}, props: {} });
}

export function applyResponsiveNode(node, device = "desktop", breakpointConfig = {}) {
  if (!node || typeof node !== "object") return node;
  const effective = effectiveResponsiveConfig(node, device, breakpointConfig);
  return { ...node, props: mergeDeep(node.props || {}, effective.props || {}), styles: mergeDeep(node.styles || {}, effective.styles || {}) };
}

export function applyResponsiveTree(nodes = [], device = "desktop", breakpointConfig = {}) {
  return (Array.isArray(nodes) ? nodes : []).map((node) => {
    if (!node || typeof node !== "object") return node;
    const resolved = applyResponsiveNode(node, device, breakpointConfig);
    return { ...resolved, children: applyResponsiveTree(resolved.children || [], device, breakpointConfig) };
  });
}

export function buildNodeScopedCss(node, options = {}) {
  if (!node || typeof node !== "object") return "";
  const id = String(node.id || "").trim();
  if (!id) return "";
  const selector = `[data-vsn-id="${escapeCssAttribute(id)}"]`;
  const rules = [];
  const styles = node.styles || {};
  const advanced = styles.advanced || {};

  if (options.includeHidden && node?.meta?.hidden === true) {
    rules.push(`${selector}{display:none !important}`);
  }

  if (options.includeBase) {
    const declarations = options.importantBase === false
      ? styleObjectToCssDeclarations(buildNodeStyle(styles))
      : importantDeclarations(buildNodeStyle(styles));
    if (declarations) rules.push(`${selector}{${declarations}}`);
  }

  const hover = styles?.effects?.hoverAnimation;
  if (hover && hover !== "none") {
    rules.push(`${selector}{transition:transform .22s ease,opacity .22s ease}`);
    rules.push(`${selector}:hover{${hover === "fade" ? "opacity:.72" : `transform:${HOVER_TRANSFORMS[hover] || "none"}`}}`);
  }

  const states = styles.states || {};
  for (const stateName of ["hover", "active", "focus", "disabled"]) {
    const state = states[stateName] || {};
    const declarations = stateStyleDeclarations(state);
    if (!declarations) continue;
    const stateTransition = buildNodeStyle(state).transition || "all .2s ease";
    rules.push(`${selector}{transition:${String(stateTransition).replace(/[{}]/g, "")}}`);
    if (stateName === "disabled") {
      rules.push(`${selector}[aria-disabled="true"],${selector}:disabled{${declarations}}`);
    } else {
      rules.push(`${selector}:${stateName}{${declarations}}`);
    }
  }

  const widgetCss = buildWidgetSpecificCss(node.type, id, styles.widget || {});
  if (widgetCss) rules.push(widgetCss);

  const custom = sanitizeCustomCss(advanced.customCss || "");
  if (custom.trim()) rules.push(custom.replace(/\bselector\b/g, selector));

  return rules.join("\n");
}

export function buildTreeScopedCss(nodes = [], options = {}) {
  const rules = [];
  const walk = (items) => {
    for (const node of Array.isArray(items) ? items : []) {
      if (!node || typeof node !== "object") continue;
      const css = buildNodeScopedCss(node, options);
      if (css) rules.push(css);
      walk(node.children || []);
    }
  };
  walk(nodes);
  return dedupeGeneratedCss(rules.join("\n"));
}

function responsiveRuleForNode(node, device, options = {}) {
  const id = String(node?.id || "").trim();
  if (!id) return "";
  const selector = `[data-vsn-id="${escapeCssAttribute(id)}"]`;
  const effective = effectiveResponsiveConfig(node, device, options.breakpoints || {});
  const declarations = [];
  if (effective.props?.visible === false) declarations.push("display:none !important");
  if (effective.props?.visible === true) declarations.push("display:revert !important");

  const css = styleObjectToCssDeclarations(buildNodeStyle(effective.styles || {}));
  if (css) {
    declarations.push(...css
      .split(";")
      .filter(Boolean)
      .map((item) => item.startsWith("--") || options.important === false ? item : `${item} !important`));
  }

  if (effective.props?.columns && node.type === "collection-product-grid") {
    declarations.push(`grid-template-columns:repeat(${Math.max(1, Number(effective.props.columns) || 1)},minmax(0,1fr))${options.important === false ? "" : " !important"}`);
  }

  return declarations.length ? `${selector}{${declarations.join(";")}}` : "";
}

export function buildResponsiveTreeCss(nodes = [], breakpoints = {}, options = {}) {
  const configs = normalizeResponsiveBreakpoints(breakpoints);
  const rules = Object.fromEntries(configs.map((bp) => [bp.id, []]));
  const containerRules = [];
  const walk = (items) => {
    for (const node of Array.isArray(items) ? items : []) {
      if (!node || typeof node !== "object") continue;
      if (options.includeHidden && node?.meta?.hidden === true && node.id) {
        const selector = `[data-vsn-id="${escapeCssAttribute(node.id)}"]`;
        for (const bp of configs) rules[bp.id].push(`${selector}{display:none !important}`);
      }
      if (node.responsive && typeof node.responsive === "object") {
        for (const bp of configs) {
          const rule = responsiveRuleForNode(node, bp.id, { ...options, breakpoints });
          if (rule) rules[bp.id].push(rule);
        }
      }
      const id = String(node.id || "").trim();
      if (id && node?.responsiveContainer?.enabled === true) {
        const c = node.responsiveContainer;
        const selector = `[data-vsn-id="${escapeCssAttribute(id)}"]`;
        containerRules.push(`${selector}{container-type:${c.type === "size" ? "size" : "inline-size"};container-name:${String(c.name || `vsn-${id}`).replace(/[^a-zA-Z0-9_-]/g,"-")}}`);
      }
      if (id && node?.containerQuery?.enabled === true) {
        const q = normalizeContainerQuery(node.containerQuery);
        const css = styleObjectToCssDeclarations(buildNodeStyle(q.styles || {}));
        const declarations = [];
        if (q.props?.visible === false) declarations.push("display:none !important");
        if (q.props?.visible === true) declarations.push("display:revert !important");
        if (css) declarations.push(...css.split(";").filter(Boolean).map((item)=>item.startsWith("--") || options.important === false ? item : `${item} !important`));
        if (declarations.length) containerRules.push(`@container ${q.name} ${containerQueryCondition(q)} { [data-vsn-id="${escapeCssAttribute(id)}"]{${declarations.join(";")}} }`);
      }
      walk(node.children || []);
    }
  };
  walk(nodes);
  const media = configs.map((bp) => `@media ${breakpointMediaQuery(bp)} { ${rules[bp.id].join("\n")} }`).join("\n");
  return dedupeGeneratedCss([media, ...containerRules].filter(Boolean).join("\n"));
}

export function buildStyleBundleCss(groups = [], breakpoints = {}, options = {}) {
  const normalizedGroups = Array.isArray(groups?.[0]) ? groups : [groups];
  const scoped = normalizedGroups
    .map((nodes) => buildTreeScopedCss(nodes, {
      includeBase: options.includeBase === true,
      importantBase: options.importantBase !== false,
      includeHidden: options.includeHidden === true,
    }))
    .filter(Boolean)
    .join("\n");
  const responsive = options.includeResponsive === false ? "" : normalizedGroups
    .map((nodes) => buildResponsiveTreeCss(nodes, breakpoints, {
      important: options.importantResponsive !== false,
      includeHidden: options.includeHidden === true,
    }))
    .filter(Boolean)
    .join("\n");
  return dedupeGeneratedCss([scoped, responsive].filter(Boolean).join("\n"));
}
