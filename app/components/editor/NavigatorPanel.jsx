import { VsnButton, VsnTextField, VsnNumberField, VsnTextArea, VsnSelect, VsnOption, VsnCheckbox, VsnColorField, VsnSearchField, VsnUrlField, VsnDateField, VsnSpinner } from "./EditorUi";
import { useMemo, useState } from "react";
import PolarisIcon, { WidgetPolarisIcon } from "../ui/PolarisIcon";
import { acceptsChildren } from "../../builder/widgetRegistry";

function nodeMatches(node, query) {
  if (!query) return true;
  const haystack = `${node.label || ""} ${node.type || ""}`.toLowerCase();
  if (haystack.includes(query)) return true;
  return (node.children || []).some((child) => nodeMatches(child, query));
}

function findPath(nodes, id, path = []) {
  for (const node of nodes || []) {
    const nextPath = [...path, node];
    if (node.id === id) return nextPath;
    const nested = findPath(node.children || [], id, nextPath);
    if (nested) return nested;
  }
  return null;
}

function TreeRow({
  node,
  depth,
  parentId,
  selectedId,
  collapsed,
  collapsedIds,
  onToggleCollapsed,
  onSelect,
  onMoveNode,
  onRename,
  onToggleHidden,
  onToggleLocked,
  onDuplicate,
  onDelete,
  query,
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(node.label || node.type || "Element");
  const [dropState, setDropState] = useState("");
  const children = node.children || [];
  const hasChildren = children.length > 0;
  const hidden = node.meta?.hidden === true;
  const locked = node.meta?.locked === true;

  if (!nodeMatches(node, query)) return null;

  const finishRename = () => {
    setRenaming(false);
    const nextName = name.trim() || node.type || "Element";
    setName(nextName);
    onRename?.(node.id, nextName);
  };

  const onDragStart = (event) => {
    if (locked) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("vsnNodeId", node.id);
    event.dataTransfer.setData("vsnDragKind", "existing-node");
  };

  const resolveDropMode = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    if (y < rect.height * 0.26) return "before";
    if (y > rect.height * 0.74) return "after";
    return acceptsChildren(node.type) ? "inside" : (y < rect.height / 2 ? "before" : "after");
  };

  const performDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const mode = dropState || resolveDropMode(event);
    setDropState("");
    const draggedId = event.dataTransfer.getData("vsnNodeId");
    if (!draggedId || draggedId === node.id) return;
    if (mode === "inside" && acceptsChildren(node.type)) {
      onMoveNode?.(draggedId, { parentId: node.id, beforeId: null });
    } else if (mode === "after") {
      onMoveNode?.(draggedId, { parentId: parentId || null, afterId: node.id });
    } else {
      onMoveNode?.(draggedId, { parentId: parentId || null, beforeId: node.id });
    }
  };

  return (
    <div>
      <div
        className={`group relative flex items-center gap-1 rounded-md border px-1.5 py-1.5 transition ${selectedId === node.id ? "border-[#95BF47]/40 bg-emerald-50 text-[#95BF47]" : dropState === "inside" ? "border-[#95BF47] bg-emerald-50/70" : "border-transparent hover:bg-[#f6f6f7]"}`}
        style={{ marginLeft: depth * 12 }}
        draggable={!locked}
        onDragStart={onDragStart}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
          setDropState(resolveDropMode(event));
        }}
        onDragLeave={() => setDropState("")}
        onDrop={performDrop}
      >
        {dropState === "before" ? <span className="pointer-events-none absolute -top-0.5 left-0 right-0 h-0.5 bg-[#95BF47]" /> : null}
        {dropState === "after" ? <span className="pointer-events-none absolute -bottom-0.5 left-0 right-0 h-0.5 bg-[#95BF47]" /> : null}

        <VsnButton
          type="button"
          variant="icon"
          size="sm"
          className="vsn-nav-disclosure"
          onClick={(event) => { event.stopPropagation(); if (hasChildren) onToggleCollapsed(node.id); }}
          aria-label={collapsed ? "Expand" : "Collapse"}
        >
          {hasChildren ? <span className={`transition-transform ${collapsed ? "" : "rotate-90"}`}><PolarisIcon type="chevron-right" size="small" /></span> : <span className="w-3" />}
        </VsnButton>

        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#f3f3f3] text-[#666] ${selectedId === node.id ? "bg-white text-[#95BF47]" : ""}`}>
          <WidgetPolarisIcon widgetType={node.type} size="small" />
        </span>

        <VsnButton type="button" variant="plain" size="sm" onClick={() => onSelect?.(node.id)} className="vsn-nav-label-button">
          {renaming ? (
            <VsnTextField label="Element name" labelAccessibilityVisibility="exclusive" value={name} onInput={(event) => setName(event.currentTarget.value)} onBlur={finishRename} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setName(node.label || node.type || "Element"); setRenaming(false); } }} onClick={(event) => event.stopPropagation()} />
          ) : (
            <span className={`flex min-w-0 items-center gap-1.5 text-xs ${hidden ? "opacity-45" : ""}`}>
              <span className="truncate font-medium">{node.label || node.type || "Element"}</span>
              <span className="shrink-0 text-[9px] text-[#aaa]">{node.type}</span>
            </span>
          )}
        </VsnButton>

        <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <VsnButton type="button" variant="icon" size="sm" title="Rename" onClick={() => setRenaming(true)} className="vsn-icon-button"><PolarisIcon type="edit" size="small" /></VsnButton>
          <VsnButton type="button" variant="icon" size="sm" title={hidden ? "Show" : "Hide"} onClick={() => onToggleHidden?.(node.id)} className="vsn-icon-button"><PolarisIcon type={hidden ? "eye" : "eye-off"} size="small" /></VsnButton>
          <VsnButton type="button" variant="icon" size="sm" title={locked ? "Unlock" : "Lock"} onClick={() => onToggleLocked?.(node.id)} className="vsn-icon-button"><PolarisIcon type={locked ? "unlock" : "lock"} size="small" /></VsnButton>
          <VsnButton type="button" variant="icon" size="sm" title="Duplicate" onClick={() => onDuplicate?.(node.id)} className="vsn-icon-button"><PolarisIcon type="clipboard" size="small" /></VsnButton>
          <VsnButton type="button" variant="icon" size="sm" tone="critical" title="Delete" disabled={locked} onClick={() => onDelete?.(node.id)} className="vsn-icon-button"><PolarisIcon type="delete" size="small" /></VsnButton>
        </div>
      </div>

      {hasChildren && !collapsed ? (
        <div className="mt-0.5">
          {children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              parentId={node.id}
              selectedId={selectedId}
              collapsed={collapsedIds?.has(child.id) || false}
              collapsedIds={collapsedIds}
              onToggleCollapsed={onToggleCollapsed}
              onSelect={onSelect}
              onMoveNode={onMoveNode}
              onRename={onRename}
              onToggleHidden={onToggleHidden}
              onToggleLocked={onToggleLocked}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              query={query}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function NavigatorPanel({
  elements = [],
  selectedId,
  onSelect,
  onMoveNode,
  onRename,
  onToggleHidden,
  onToggleLocked,
  onDuplicate,
  onDelete,
}) {
  const [query, setQuery] = useState("");
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const visibleElements = useMemo(() => (elements || []).filter((node) => !["global-styles", "template-settings"].includes(node?.type)), [elements]);
  const path = useMemo(() => selectedId ? findPath(visibleElements, selectedId) || [] : [], [visibleElements, selectedId]);
  const normalizedQuery = query.trim().toLowerCase();

  const toggleCollapsed = (id) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[#f0f0f0] p-2.5">
        <VsnSearchField label="Search navigator" labelAccessibilityVisibility="exclusive" value={query} onInput={(event) => setQuery(event.currentTarget.value)} placeholder="Search navigator..." />
        {path.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-1 text-[9px] text-[#888]">
            {path.map((item, index) => (
              <span key={item.id} className="flex items-center gap-1">
                {index ? <PolarisIcon type="chevron-right" size="small" /> : null}
                <VsnButton type="button" variant="plain" size="sm" onClick={() => onSelect?.(item.id)} className={item.id === selectedId ? "vsn-nav-crumb is-active" : "vsn-nav-crumb"}>{item.label || item.type}</VsnButton>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-b border-[#f3f3f3] px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6d6d6d]">Structure</span>
        <div className="flex gap-1">
          <VsnButton type="button" variant="tertiary" size="sm" onClick={() => setCollapsedIds(new Set())} className="vsn-mini-button">Expand all</VsnButton>
          <VsnButton type="button" onClick={() => {
            const ids = new Set();
            const walk = (nodes) => (nodes || []).forEach((node) => { if ((node.children || []).length) ids.add(node.id); walk(node.children || []); });
            walk(visibleElements);
            setCollapsedIds(ids);
          }} variant="tertiary" size="sm" className="vsn-mini-button">Collapse all</VsnButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {visibleElements.map((node) => (
          <TreeRow
            key={node.id}
            node={node}
            depth={0}
            parentId={null}
            selectedId={selectedId}
            collapsed={collapsedIds.has(node.id)}
            collapsedIds={collapsedIds}
            onToggleCollapsed={toggleCollapsed}
            onSelect={onSelect}
            onMoveNode={onMoveNode}
            onRename={onRename}
            onToggleHidden={onToggleHidden}
            onToggleLocked={onToggleLocked}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            query={normalizedQuery}
          />
        ))}
        {!visibleElements.length ? <div className="py-10 text-center text-xs text-[#aaa]">Canvas is empty</div> : null}
      </div>

      <div className="border-t border-[#f0f0f0] px-3 py-2 text-[9px] text-[#999]">
        Drag above, below, or into containers. Drop indicators show the exact destination.
      </div>
    </div>
  );
}
