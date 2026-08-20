function makeId(prefix = "node") {
  try {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  } catch {}
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children ?? [], id);
    if (found) return found;
  }
  return null;
}

export function findParentId(nodes, id, parentId = null) {
  for (const node of nodes) {
    if (node.id === id) return parentId;
    const found = findParentId(node.children ?? [], id, node.id);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function updateNode(nodes, id, updater) {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === id) { changed = true; return updater(node); }
    const children = node.children ?? [];
    if (!children.length) return node;
    const nextChildren = updateNode(children, id, updater);
    if (nextChildren === children) return node;
    changed = true;
    return { ...node, children: nextChildren };
  });
  return changed ? next : nodes;
}

export function insertNode(nodes, newNode, parentId = null, index = null) {
  if (!parentId) {
    const copy = [...nodes];
    const safeIndex = Number.isInteger(index) ? Math.max(0, Math.min(index, copy.length)) : copy.length;
    copy.splice(safeIndex, 0, newNode);
    return copy;
  }

  // Never silently lose a node when a stale drag target no longer exists.
  if (!findNode(nodes, parentId)) return nodes;

  return updateNode(nodes, parentId, (parent) => {
    const children = [...(parent.children ?? [])];
    const safeIndex = Number.isInteger(index) ? Math.max(0, Math.min(index, children.length)) : children.length;
    children.splice(safeIndex, 0, newNode);
    return { ...parent, children };
  });
}

export function removeNode(nodes, id) {
  let changed = false;
  const next = [];
  for (const node of nodes) {
    if (node.id === id) { changed = true; continue; }
    const children = node.children ?? [];
    const nextChildren = children.length ? removeNode(children, id) : children;
    if (nextChildren !== children) { changed = true; next.push({ ...node, children: nextChildren }); }
    else next.push(node);
  }
  return changed ? next : nodes;
}

export function cloneNodeWithNewIds(node) {
  if (!node) return null;
  return {
    ...structuredClone(node),
    id: makeId(node.type || "node"),
    children: (node.children ?? []).map(cloneNodeWithNewIds),
  };
}

export function duplicateNode(nodes, id) {
  const node = findNode(nodes, id);
  if (!node) return { nodes, newId: null };
  const clone = cloneNodeWithNewIds(node);
  const parentId = findParentId(nodes, id);

  const siblings = parentId ? findNode(nodes, parentId)?.children ?? [] : nodes;
  const index = siblings.findIndex((item) => item.id === id);
  return {
    nodes: insertNode(nodes, clone, parentId ?? null, index >= 0 ? index + 1 : null),
    newId: clone.id,
  };
}

export function moveNode(nodes, id, direction) {
  const parentId = findParentId(nodes, id);
  const siblings = parentId ? findNode(nodes, parentId)?.children ?? [] : nodes;
  const index = siblings.findIndex((item) => item.id === id);
  if (index < 0) return nodes;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= siblings.length) return nodes;

  const reordered = [...siblings];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  if (!parentId) return reordered;
  return updateNode(nodes, parentId, (parent) => ({ ...parent, children: reordered }));
}

export function flattenNodes(nodes, depth = 0, result = []) {
  for (const node of nodes) {
    result.push({ node, depth });
    flattenNodes(node.children ?? [], depth + 1, result);
  }
  return result;
}

export function nodeContainsId(node, id) {
  if (!node) return false;
  if (node.id === id) return true;
  return (node.children ?? []).some((child) => nodeContainsId(child, id));
}

export function relocateNode(nodes, id, { parentId = null, beforeId = null, afterId = null } = {}) {
  const moving = findNode(nodes, id);
  if (!moving) return nodes;
  if (parentId === id || beforeId === id || afterId === id) return nodes;
  if (parentId && nodeContainsId(moving, parentId)) return nodes;
  if (beforeId && nodeContainsId(moving, beforeId)) return nodes;
  if (afterId && nodeContainsId(moving, afterId)) return nodes;

  const countNodes = (items) => items.reduce((total, item) => total + 1 + countNodes(item.children ?? []), 0);
  const beforeCount = countNodes(nodes);
  const without = removeNode(nodes, id);

  // A stale / invalid parent used to remove the moving node and then fail to
  // reinsert it, which could make the canvas appear blank after a drop.
  if (parentId && !findNode(without, parentId)) return nodes;

  const targetParent = parentId ? findNode(without, parentId) : null;
  const siblings = parentId ? (targetParent?.children ?? []) : without;
  let index = siblings.length;

  if (beforeId) {
    const beforeIndex = siblings.findIndex((item) => item.id === beforeId);
    if (beforeIndex < 0) return nodes;
    index = beforeIndex;
  } else if (afterId) {
    const afterIndex = siblings.findIndex((item) => item.id === afterId);
    if (afterIndex < 0) return nodes;
    index = afterIndex + 1;
  }

  const result = insertNode(without, moving, parentId, index);
  return countNodes(result) === beforeCount ? result : nodes;
}
