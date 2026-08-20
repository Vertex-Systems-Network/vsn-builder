import {
  getVsnEditorRenderer,
  getVsnStorefrontRenderer,
  getVsnWidgetDefinition,
  getVsnWidgetHooks,
  reportVsnSdkError,
} from "./registry.js";
import { isVsnRenderDescriptor, serializeVsnDescriptor } from "./renderDescriptor.js";

export function isVsnSdkWidget(type) { return Boolean(getVsnWidgetDefinition(type)); }

function descriptorValueIsSafe(value) {
  if (value == null || value === false || typeof value === "string" || typeof value === "number") return true;
  if (Array.isArray(value)) return value.every(descriptorValueIsSafe);
  if (!isVsnRenderDescriptor(value)) return false;
  return descriptorValueIsSafe(value.children || []);
}

export function renderVsnEditorWidget(node, context = {}) {
  const definition = getVsnWidgetDefinition(node?.type);
  const renderer = getVsnEditorRenderer(node?.type);
  if (!renderer) return { handled: false, value: null };
  try {
    const value = renderer({ node, context, helpers: context.helpers || {} });
    if (definition?.pluginId !== "vsn.core" && !descriptorValueIsSafe(value)) {
      throw new Error("Third-party editor renderers must return VSN render descriptors, text, or arrays of descriptors.");
    }
    return { handled: true, value };
  } catch (error) {
    reportVsnSdkError("editor.render", node?.type || "unknown", error);
    return { handled: true, error, value: null };
  }
}

export function renderVsnStorefrontWidget(node, context = {}) {
  const definition = getVsnWidgetDefinition(node?.type);
  const renderer = getVsnStorefrontRenderer(node?.type);
  if (!renderer) return { handled: false, value: "" };
  try {
    const raw = renderer({ node, context, helpers: context.helpers || {} });
    const value = definition?.pluginId === "vsn.core" && typeof raw === "string"
      ? raw
      : serializeVsnDescriptor(raw);
    return { handled: true, value: String(value ?? "") };
  } catch (error) {
    reportVsnSdkError("storefront.render", node?.type || "unknown", error);
    return {
      handled: true,
      error,
      value: `<div class="vsn-sdk-error" data-vsn-sdk-widget="${String(node?.type || "unknown").replace(/[^a-z0-9-]/gi, "")}">Widget unavailable</div>`,
    };
  }
}

export async function prepareVsnSdkNodesForSave(nodes, context = {}) {
  const walk = async (node) => {
    if (!node || typeof node !== "object") return node;
    let next = structuredClone(node);
    const hook = getVsnWidgetHooks(next.type)?.save;
    if (typeof hook === "function") {
      try {
        const saved = await hook({ node: next, context });
        if (saved && typeof saved === "object") next = saved;
      } catch (error) {
        reportVsnSdkError("widget.save", next.type, error);
        throw new Error(`Plugin save hook failed for ${next.type}: ${error instanceof Error ? error.message : error}`);
      }
    }
    if (Array.isArray(next.children)) next.children = await Promise.all(next.children.map(walk));
    return next;
  };
  return Promise.all((Array.isArray(nodes) ? nodes : []).map(walk));
}
