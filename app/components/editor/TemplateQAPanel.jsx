import { useMemo } from "react";
import { scanResponsiveIssues } from "../../builder/responsiveEngine.js";
import { scanBuilderPage } from "../../builder/healthScanner.js";

function flatten(nodes, result = []) {
  for (const node of nodes || []) {
    if (!["global-styles", "template-settings"].includes(node?.type)) result.push(node);
    flatten(node?.children || [], result);
  }
  return result;
}

export default function TemplateQAPanel({ elements = [], page, componentDefinitions = [], onSelect }) {
  const report = useMemo(() => scanBuilderPage({ page, elements, componentDefinitions }), [elements, page, componentDefinitions]);
  const issues = useMemo(() => {
    const nodes = flatten(elements);
    const result = report.issues.map((issue) => ({
      level: issue.level === "error" ? "error" : issue.level === "warning" ? "warn" : "info",
      text: issue.message,
      nodeId: issue.nodeId,
      category: issue.category,
      code: issue.code,
    }));

    if (page?.status !== "published") result.push({ level: "info", text: "Template has unpublished draft changes or is not published.", category: "workflow" });
    if (page?.template === "collection") {
      if (!nodes.some((node) => node.type === "collection-product-grid")) result.push({ level: "error", text: "Collection template has no Product Grid.", category: "structure" });
      if (!nodes.some((node) => node.type === "collection-title")) result.push({ level: "warn", text: "Collection template has no dynamic Collection Title.", category: "structure" });
    }
    if (page?.template === "product") {
      if (!nodes.some((node) => node.type === "product-add-to-cart")) result.push({ level: "error", text: "Product template has no Add to Cart widget.", category: "structure" });
      if (!nodes.some((node) => node.type === "product-title")) result.push({ level: "warn", text: "Product template has no dynamic Product Title.", category: "structure" });
      if (!nodes.some((node) => ["product-image", "product-gallery"].includes(node.type))) result.push({ level: "warn", text: "Product template has no product image/gallery.", category: "structure" });
    }
    if (page?.template === "header") {
      if (!nodes.some((node) => ["navigation-menu", "mega-menu"].includes(node.type))) result.push({ level: "warn", text: "Header has no navigation or mega menu.", category: "structure" });
      if (!nodes.some((node) => node.type === "cart-icon")) result.push({ level: "info", text: "Header has no Cart Icon widget.", category: "structure" });
    }
    const globals = (elements || []).find((node) => node?.type === "global-styles")?.props || {};
    result.push(...scanResponsiveIssues(elements, globals).map((issue) => ({ level: issue.level || "warn", text: issue.text || issue.message, nodeId: issue.nodeId, category: "responsive" })));
    return result;
  }, [elements, page, report]);

  const tone = { error: "border-red-200 bg-red-50 text-red-700", warn: "border-amber-200 bg-amber-50 text-amber-800", info: "border-blue-200 bg-blue-50 text-blue-700" };
  return (
    <div className="absolute bottom-16 right-[calc(var(--vsn-right-panel,256px)+12px)] z-30 w-80 overflow-hidden rounded-xl border border-[#e3e3e3] bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-[#f1f1f1] px-4 py-3">
        <div><strong className="block text-xs text-[#333]">Template Health</strong><span className="text-[10px] text-[#999]">Accessibility · SEO · performance · responsive</span></div>
        <div className="text-right"><b className="block text-xs text-[#333]">{report.score}/100</b><span className="text-[10px] text-[#999]">{issues.length ? `${issues.length} finding${issues.length === 1 ? "" : "s"}` : "All clear"}</span></div>
      </div>
      <div className="max-h-80 space-y-2 overflow-auto p-3">
        {issues.length ? issues.map((issue, index) => (
          <div key={`${issue.code || issue.text}-${index}`} className={`rounded-lg border px-3 py-2 text-xs ${tone[issue.level] || tone.info}`}><span className="mb-1 block text-[9px] font-bold uppercase opacity-70">{issue.category || "Health"}</span><span>{issue.text}</span>{issue.nodeId && onSelect ? <button type="button" className="ml-2 font-semibold underline" onClick={()=>onSelect(issue.nodeId)}>Open element</button> : null}</div>
        )) : <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-700">No obvious accessibility, SEO, performance or responsive issues found.</div>}
      </div>
    </div>
  );
}
