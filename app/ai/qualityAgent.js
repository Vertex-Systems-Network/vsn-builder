import { scanAiAccessibility, scanAiResponsive, validateAiVsnOutput } from "../builder/aiBuilder.js";
import { dynamicFieldsForWidget, dynamicSourcesForType, inspectDynamicBindings, normalizeBindings } from "../builder/dynamicBindings.js";
import { motionConflictWarnings, normalizeElementInteractions } from "../builder/interactionSchema.js";
import { analyzeEmailCompatibility } from "../email/emailCompatibility.js";

export const QUALITY_REPORT_VERSION = 1;
export const QUALITY_MAX_NODES = 600;
export const QUALITY_MAX_FINDINGS = 200;

const SEVERITY_ORDER = Object.freeze({ error: 0, danger: 0, warning: 1, info: 2 });
const CATEGORY_ORDER = Object.freeze({
  shopify: 0,
  accessibility: 1,
  responsive: 2,
  bindings: 3,
  links: 4,
  performance: 5,
  motion: 6,
  email: 7,
});
const BLOCKING = new Set(["error", "danger"]);
const CURRENT_RESOURCE_PREFIXES = Object.freeze([
  ["product-", "product"],
  ["collection-", "collection"],
  ["article-", "article"],
  ["blog-", "blog"],
]);

function text(value, max = 1200) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function finding({ category, code, severity = "warning", title, message, elementId = "", blockId = "", source = "deterministic" }) {
  const safeSeverity = Object.hasOwn(SEVERITY_ORDER, severity) ? severity : "warning";
  const safeCategory = Object.hasOwn(CATEGORY_ORDER, category) ? category : "shopify";
  return Object.freeze({
    category: safeCategory,
    code: text(code, 120) || "quality-finding",
    severity: safeSeverity,
    title: text(title, 240) || "Quality finding",
    message: text(message, 1600),
    elementId: text(elementId, 160),
    blockId: text(blockId, 160),
    source: text(source, 80) || "deterministic",
  });
}

function flattenNodes(nodes = []) {
  const rows = [];
  const stack = (Array.isArray(nodes) ? nodes : []).map((node) => ({ node, depth: 0 })).reverse();
  const seen = new Set();
  let truncated = false;
  while (stack.length) {
    const current = stack.pop();
    if (!current?.node || typeof current.node !== "object" || seen.has(current.node)) continue;
    seen.add(current.node);
    if (rows.length >= QUALITY_MAX_NODES) {
      truncated = true;
      break;
    }
    rows.push(current);
    const children = Array.isArray(current.node.children) ? current.node.children : [];
    for (let i = children.length - 1; i >= 0; i -= 1) stack.push({ node: children[i], depth: current.depth + 1 });
  }
  return { rows, truncated };
}

function normalizeScannerFinding(category, row = {}) {
  return finding({
    category,
    code: `${category}-${text(row.message, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "finding"}`,
    severity: row.severity === "error" ? "error" : "warning",
    title: category === "accessibility" ? "Accessibility issue" : "Responsive issue",
    message: row.message,
    elementId: row.elementId,
    source: category === "accessibility" ? "scanAiAccessibility" : "scanAiResponsive",
  });
}

function safeLinkSyntax(value = "") {
  const raw = text(value, 2000);
  if (!raw) return { ok: true, empty: true };
  if (raw.startsWith("#")) return { ok: raw.length > 1 || raw === "#" };
  if (raw.startsWith("/") && !raw.startsWith("//")) return { ok: true };
  let parsed;
  try { parsed = new URL(raw); } catch { return { ok: false, reason: "malformed" }; }
  const protocol = parsed.protocol.toLowerCase();
  if (["https:", "http:", "mailto:", "tel:"].includes(protocol)) return { ok: true };
  return { ok: false, reason: "unsafe-protocol", protocol };
}

function linkFindings(rows) {
  const out = [];
  const inspect = (node, label, value) => {
    const raw = text(value, 2000);
    if (!raw) return;
    const result = safeLinkSyntax(raw);
    if (result.ok) return;
    out.push(finding({
      category: "links",
      code: result.reason === "unsafe-protocol" ? "unsafe-link-protocol" : "invalid-link-syntax",
      severity: "error",
      title: result.reason === "unsafe-protocol" ? "Unsafe link protocol" : "Invalid link",
      message: result.reason === "unsafe-protocol"
        ? `${label} uses a blocked ${result.protocol || "unknown"} protocol.`
        : `${label} is not a valid relative, HTTP(S), mailto or tel link.`,
      elementId: node.id,
      source: "qualityAgent",
    }));
  };
  for (const { node } of rows) {
    const props = node?.props || {};
    inspect(node, "URL", props.url);
    inspect(node, "Link URL", props.linkUrl);
    inspect(node, "Href", props.href);
    for (const item of Array.isArray(props.items) ? props.items.slice(0, 80) : []) inspect(node, "Navigation item URL", item?.url || item?.href);
  }
  return out;
}

function bindingFindings(rows, bindingContext, contextProvided) {
  const out = [];
  for (const { node } of rows) {
    const bindings = normalizeBindings(node?.bindings);
    for (const field of dynamicFieldsForWidget(node?.type)) {
      const binding = bindings[field.path];
      if (!binding?.enabled) continue;
      if (!binding?.source) {
        out.push(finding({ category: "bindings", code: "binding-source-missing", severity: "error", title: "Binding source missing", message: `${field.label} has dynamic binding enabled without a source.`, elementId: node.id, source: "dynamicBindings" }));
        continue;
      }
      const allowed = new Set(dynamicSourcesForType(field.type).map((item) => item.value));
      if (!allowed.has(binding.source)) {
        out.push(finding({ category: "bindings", code: "binding-source-invalid", severity: "error", title: "Unsupported binding source", message: `${field.label} uses “${text(binding.source, 180)}”, which is not valid for a ${field.type} field.`, elementId: node.id, source: "dynamicBindings" }));
      }
      if (binding.source === "product.metafield" && !text(binding.key, 120)) {
        out.push(finding({ category: "bindings", code: "metafield-key-missing", severity: "error", title: "Metafield key missing", message: `${field.label} targets a product metafield without a key.`, elementId: node.id, source: "dynamicBindings" }));
      }
      if (binding.source === "metaobject.field" && (!text(binding.metaobjectType, 120) || !text(binding.metaobjectId, 180) || !text(binding.key, 120))) {
        out.push(finding({ category: "bindings", code: "metaobject-reference-incomplete", severity: "error", title: "Metaobject binding incomplete", message: `${field.label} requires metaobject type, ID and field key.`, elementId: node.id, source: "dynamicBindings" }));
      }
      if (binding.source === "query.search" && !text(binding.key, 120)) {
        out.push(finding({ category: "bindings", code: "query-key-missing", severity: "warning", title: "Query parameter key missing", message: `${field.label} uses URL query data without a named parameter key.`, elementId: node.id, source: "dynamicBindings" }));
      }
    }
    const legacy = node?.dynamicSource;
    if (legacy?.enabled) {
      const type = legacy.target === "src" ? "image" : legacy.target === "url" ? "url" : "text";
      const allowed = new Set(dynamicSourcesForType(type).map((item) => item.value));
      if (!legacy.source || !allowed.has(legacy.source)) {
        out.push(finding({ category: "bindings", code: "legacy-binding-source-invalid", severity: "error", title: "Legacy binding source invalid", message: "Legacy dynamic source is enabled with a missing or unsupported source.", elementId: node.id, source: "dynamicBindings" }));
      }
    }
    if (contextProvided) {
      for (const resolved of inspectDynamicBindings(node, bindingContext || {})) {
        if ((resolved.raw == null || resolved.raw === "") && !text(resolved.fallback, 1000)) {
          out.push(finding({ category: "bindings", code: "binding-unresolved", severity: "warning", title: "Binding did not resolve", message: `${resolved.label} did not resolve in the supplied preview context and has no fallback.`, elementId: node.id, source: "dynamicBindings" }));
        }
      }
    }
  }
  return out;
}

function shopifyFindings(nodes, rows, pageTemplate) {
  const out = [];
  const validation = validateAiVsnOutput(nodes);
  for (const message of validation.errors) out.push(finding({ category: "shopify", code: "vsn-validation-error", severity: "error", title: "VSN validation failed", message, source: "validateAiVsnOutput" }));
  for (const message of validation.warnings) out.push(finding({ category: "shopify", code: "vsn-validation-warning", severity: "warning", title: "VSN validation warning", message, source: "validateAiVsnOutput" }));

  const template = text(pageTemplate, 120).toLowerCase();
  if (!template) return out;
  for (const { node } of rows) {
    const type = text(node?.type, 120);
    const match = CURRENT_RESOURCE_PREFIXES.find(([prefix]) => type.startsWith(prefix));
    if (!match) continue;
    const expected = match[1];
    if (!template.includes(expected)) {
      out.push(finding({
        category: "shopify",
        code: "resource-widget-template-mismatch",
        severity: "warning",
        title: "Resource widget may lack Shopify context",
        message: `${type} expects current ${expected} context, but the page template is “${template}”.`,
        elementId: node.id,
        source: "qualityAgent",
      }));
    }
  }
  return out;
}

function performanceFindings(rows, truncated) {
  const out = [];
  if (truncated) out.push(finding({ category: "performance", code: "node-scan-truncated", severity: "warning", title: "Large page scan truncated", message: `Quality analysis is bounded to ${QUALITY_MAX_NODES} nodes; additional nodes were not scanned.`, source: "qualityAgent" }));
  if (rows.length > 350) out.push(finding({ category: "performance", code: "large-page-node-count", severity: "warning", title: "Large page structure", message: `${rows.length} nodes can increase editor and storefront work. Consider reusable sections or simpler nesting.`, source: "qualityAgent" }));
  const eagerImages = rows.filter(({ node }) => node?.type === "image" && String(node?.props?.loading || "").toLowerCase() === "eager");
  if (eagerImages.length > 3) out.push(finding({ category: "performance", code: "too-many-eager-images", severity: "warning", title: "Too many eager images", message: `${eagerImages.length} images are configured for eager loading. Keep eager loading focused on critical above-the-fold media.`, source: "qualityAgent" }));
  const highPriorityImages = rows.filter(({ node }) => node?.type === "image" && String(node?.props?.fetchPriority || "").toLowerCase() === "high");
  if (highPriorityImages.length > 2) out.push(finding({ category: "performance", code: "too-many-high-priority-images", severity: "warning", title: "Too many high-priority images", message: `${highPriorityImages.length} images request high fetch priority, which can compete for bandwidth.`, source: "qualityAgent" }));
  for (const { node } of rows) {
    if (node?.type === "video" && node?.props?.autoplay === true) {
      out.push(finding({ category: "performance", code: "autoplay-video", severity: "warning", title: "Autoplay video", message: "Autoplay video can increase initial media/network cost. Confirm it is essential and optimized.", elementId: node.id, source: "qualityAgent" }));
    }
  }
  return out;
}

function motionFindings(rows) {
  const out = [];
  for (const { node } of rows) {
    const interactions = normalizeElementInteractions(node?.interactions);
    for (const message of motionConflictWarnings(interactions)) {
      out.push(finding({ category: "motion", code: "motion-property-conflict", severity: "warning", title: "Motion conflict", message, elementId: node.id, source: "motionConflictWarnings" }));
    }
    for (const timeline of interactions.timelines.filter((item) => item.enabled)) {
      const hasMotion = timeline.actions.some((action) => action.type === "animate");
      if (hasMotion && timeline.timeline?.reducedMotion === "allow") {
        out.push(finding({ category: "motion", code: "reduced-motion-allow", severity: "warning", title: "Reduced-motion preference bypassed", message: `“${timeline.name}” explicitly allows animation when the visitor requests reduced motion.`, elementId: node.id, source: "interactionSchema" }));
      }
    }
    if (interactions.parallax) {
      out.push(finding({ category: "motion", code: "legacy-parallax-review", severity: "info", title: "Parallax motion present", message: "Review parallax behavior with prefers-reduced-motion enabled.", elementId: node.id, source: "interactionSchema" }));
    }
  }
  return out;
}

function emailFindings(emailDocument, emailMeta) {
  if (!emailDocument) return [];
  const report = analyzeEmailCompatibility(emailDocument, emailMeta || {});
  return report.issues.map((item) => finding({
    category: "email",
    code: item.code,
    severity: item.severity,
    title: item.title,
    message: item.message,
    blockId: item.blockId,
    source: "analyzeEmailCompatibility",
  }));
}

function sortedFindings(rows) {
  return [...rows].sort((a, b) =>
    (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    || (CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category])
    || a.elementId.localeCompare(b.elementId)
    || a.blockId.localeCompare(b.blockId)
    || a.code.localeCompare(b.code)
    || a.message.localeCompare(b.message)
  ).slice(0, QUALITY_MAX_FINDINGS);
}

function countsFor(findings) {
  const severity = { error: 0, danger: 0, warning: 0, info: 0, total: findings.length, blockers: 0 };
  const category = Object.fromEntries(Object.keys(CATEGORY_ORDER).map((key) => [key, 0]));
  for (const item of findings) {
    severity[item.severity] += 1;
    if (BLOCKING.has(item.severity)) severity.blockers += 1;
    category[item.category] += 1;
  }
  return { severity: Object.freeze(severity), category: Object.freeze(category) };
}

function scoreFor(counts) {
  return Math.max(0, Math.min(100, 100
    - (counts.severity.blockers * 15)
    - (counts.severity.warning * 5)
    - counts.severity.info));
}

function explanationFor(counts, findings) {
  const headline = counts.severity.blockers
    ? `${counts.severity.blockers} blocking quality issue${counts.severity.blockers === 1 ? "" : "s"} require attention.`
    : counts.severity.warning
      ? `No blockers; ${counts.severity.warning} warning${counts.severity.warning === 1 ? "" : "s"} remain.`
      : "No blocking issues or warnings were found by the deterministic quality checks.";
  return Object.freeze({
    headline,
    priorities: Object.freeze(findings.slice(0, 5).map((item) => Object.freeze({
      category: item.category,
      code: item.code,
      severity: item.severity,
      title: item.title,
      elementId: item.elementId,
      blockId: item.blockId,
    }))),
  });
}

export function buildQualityReport(nodes = [], options = {}) {
  const inputNodes = Array.isArray(nodes) ? nodes : [];
  const { rows, truncated } = flattenNodes(inputNodes);
  const contextProvided = Object.prototype.hasOwnProperty.call(options, "bindingContext");
  const findings = sortedFindings([
    ...shopifyFindings(inputNodes, rows, options.pageTemplate),
    ...scanAiAccessibility(inputNodes).map((row) => normalizeScannerFinding("accessibility", row)),
    ...scanAiResponsive(inputNodes).map((row) => normalizeScannerFinding("responsive", row)),
    ...bindingFindings(rows, options.bindingContext, contextProvided),
    ...linkFindings(rows),
    ...performanceFindings(rows, truncated),
    ...motionFindings(rows),
    ...emailFindings(options.emailDocument, options.emailMeta),
  ]);
  const counts = countsFor(findings);
  const score = scoreFor(counts);
  return Object.freeze({
    version: QUALITY_REPORT_VERSION,
    pass: counts.severity.blockers === 0,
    score,
    scoreMethod: "100 - (15 × blockers + 5 × warnings + 1 × info), clamped to 0–100",
    deterministic: true,
    validatorsAuthoritative: true,
    bounds: Object.freeze({ nodesScanned: rows.length, nodesTruncated: truncated, maxNodes: QUALITY_MAX_NODES, maxFindings: QUALITY_MAX_FINDINGS }),
    counts,
    explanation: explanationFor(counts, findings),
    findings: Object.freeze(findings),
  });
}
