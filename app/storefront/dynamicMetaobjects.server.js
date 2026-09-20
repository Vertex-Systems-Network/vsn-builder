import { normalizeBindings } from "../builder/dynamicBindings.js";

export const STOREFRONT_METAOBJECT_BINDING_LIMIT = 30;

export function collectDynamicMetaobjectBindings(elements = []) {
  const out = [];
  const seen = new Set();

  const addBinding = (binding) => {
    if (!binding?.enabled || binding.source !== "metaobject.field" || !binding.key || !binding.metaobjectId) return;
    const type = String(binding.metaobjectType || "");
    const idOrHandle = String(binding.metaobjectId || "");
    const key = String(binding.key || "");
    const signature = `${type}|${idOrHandle}|${key}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    out.push({ signature, type, idOrHandle, key });
  };

  const walk = (nodes = []) => {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      addBinding(node?.dynamicSource);
      for (const binding of Object.values(normalizeBindings(node?.bindings))) addBinding(binding);
      walk(node?.children || []);
      if (out.length >= STOREFRONT_METAOBJECT_BINDING_LIMIT) return;
    }
  };

  walk(elements);
  return out.slice(0, STOREFRONT_METAOBJECT_BINDING_LIMIT);
}

export async function loadDynamicMetaobjects({ admin, elements = [] }) {
  const bindings = collectDynamicMetaobjectBindings(elements);
  const values = {};

  for (const binding of bindings) {
    try {
      const isGid = binding.idOrHandle.startsWith("gid://");
      const query = isGid
        ? `#graphql\nquery VsnMetaobjectById($id: ID!){ metaobject(id:$id){ id handle type fields { key value } } }`
        : `#graphql\nquery VsnMetaobjectByHandle($handle: MetaobjectHandleInput!){ metaobjectByHandle(handle:$handle){ id handle type fields { key value } } }`;
      const variables = isGid
        ? { id: binding.idOrHandle }
        : { handle: { type: binding.type, handle: binding.idOrHandle } };

      if (!isGid && !binding.type) continue;

      const response = await admin.graphql(query, { variables });
      const json = await response.json();
      const object = json.data?.metaobject || json.data?.metaobjectByHandle;
      const field = object?.fields?.find((item) => item.key === binding.key);
      if (field?.value != null) values[binding.signature] = field.value;
    } catch (error) {
      console.warn("VSN dynamic metaobject lookup failed", binding.signature, error?.message || error);
    }
  }

  return values;
}
