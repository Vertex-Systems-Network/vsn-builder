import { VsnButton, VsnTextField } from "./EditorUi";
import { useEffect, useMemo, useState } from "react";
import PolarisIcon from "../ui/PolarisIcon";

function formatRevisionDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RevisionsPanel({
  open,
  revisions = [],
  selectedRevisionId = "",
  onSelect,
  onApply,
  onClose,
  applying = false,
  diff = null,
  canLabel = false,
  onLabel,
}) {
  const selected = useMemo(
    () => revisions.find((revision) => revision.id === selectedRevisionId) || null,
    [revisions, selectedRevisionId],
  );
  const [label, setLabel] = useState("");
  useEffect(() => { setLabel(selected?.label || ""); }, [selected?.id, selected?.label]);

  if (!open) return null;

  return (
    <aside className="absolute bottom-16 right-[calc(var(--vsn-right-panel,256px)+12px)] z-40 flex max-h-[70vh] w-[360px] flex-col overflow-hidden rounded-xl border border-[#d9d9d9] bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#eeeeee] px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#202223]">
            <PolarisIcon type="clock" />
            Revisions
          </div>
          <div className="mt-0.5 text-[10px] text-[#777]">Preview a saved revision, then apply it to this draft.</div>
        </div>
        <VsnButton type="button" variant="icon" size="sm" className="vsn-icon-button" onClick={onClose} title="Close revisions">
          <PolarisIcon type="x" />
        </VsnButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {revisions.length ? revisions.map((revision) => {
          const active = revision.id === selectedRevisionId;
          return (
            <VsnButton
              type="button"
              variant="plain"
              key={revision.id}
              onClick={() => onSelect?.(revision)}
              className={`mb-1 flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ${active ? "border-[#95BF47] bg-emerald-50" : "border-transparent hover:border-[#e6e6e6] hover:bg-[#f7f7f7]"}`}
            >
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${active ? "bg-[#95BF47] text-white" : "bg-[#f1f1f1] text-[#666]"}`}>
                <PolarisIcon type={revision.kind === "publish" ? "check-circle" : "clock"} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-xs font-semibold ${active ? "text-[#6AAB1F]" : "text-[#303030]"}`}>{revision.label || revision.title || "Untitled revision"}</span>
                <span className="mt-0.5 block text-[10px] text-[#888]">{revision.kind || "save"} · {formatRevisionDate(revision.createdAt)}</span>
                {revision.label ? <span className="mt-0.5 block truncate text-[9px] text-[#aaa]">{revision.title}</span> : null}
                {revision.createdBy ? <span className="mt-0.5 block truncate text-[9px] text-[#aaa]">{revision.createdBy}</span> : null}
              </span>
              {active ? <PolarisIcon type="check" tone="success" /> : null}
            </VsnButton>
          );
        }) : <div className="py-12 text-center text-xs text-[#888]">No revisions yet. Save or publish the page first.</div>}
      </div>

      <div className="border-t border-[#ededed] bg-[#fafafa] p-3">
        {selected ? <>
          <div className="mb-2 text-[10px] text-[#666]">Revision is loaded into the canvas. Review it before applying.</div>
          {diff ? <div className="mb-2 grid grid-cols-4 gap-1 text-center text-[9px]"><span className="rounded bg-white px-1 py-1.5">+{diff.added} nodes</span><span className="rounded bg-white px-1 py-1.5">-{diff.removed} nodes</span><span className="rounded bg-white px-1 py-1.5">{diff.contentChanges} content</span><span className="rounded bg-white px-1 py-1.5">{diff.styleChanges} style</span></div> : null}
          {canLabel ? <div className="mb-2 flex gap-2"><VsnTextField value={label} onInput={(e)=>setLabel(e.currentTarget.value)} placeholder="Version label"/><VsnButton size="sm" disabled={applying} onClick={()=>onLabel?.(selected.id,label)}>Label</VsnButton></div> : null}
        </> : null}
        <VsnButton
          type="button"
          variant="primary"
          loading={applying}
          disabled={!selected || applying}
          onClick={() => selected && onApply?.(selected)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#95BF47] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#6AAB1F] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PolarisIcon type="check" />
          {applying ? "Applying…" : "Apply revision"}
        </VsnButton>
      </div>
    </aside>
  );
}
