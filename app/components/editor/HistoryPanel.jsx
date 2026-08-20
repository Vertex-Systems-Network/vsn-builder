import { VsnButton, VsnTextField, VsnNumberField, VsnTextArea, VsnSelect, VsnOption, VsnCheckbox, VsnColorField, VsnSearchField, VsnUrlField, VsnDateField, VsnSpinner } from "./EditorUi";
import PolarisIcon from "../ui/PolarisIcon";

function relativeTime(time) {
  if (!time) return "";
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
}

function historyIcon(entry) {
  const value = String(entry?.icon || "").toLowerCase();
  if (value.includes("delete") || value === "−") return "delete";
  if (value.includes("move") || value === "↕") return "reorder";
  if (value.includes("duplicate") || value === "⧉" || value === "⎘") return "clipboard";
  if (value.includes("setting") || value === "⚙") return "settings";
  if (value.includes("revision")) return "clock";
  if (value.includes("rename") || value === "✎") return "edit";
  if (value.includes("add") || value === "+" || value === "▦") return "plus";
  return "clock";
}

export default function HistoryPanel({ isOpen, onClose, entries = [], currentIndex = 0, onRestore, autosaveLabel = "" }) {
  if (!isOpen) return null;
  return (
    <div className="absolute bottom-16 right-[calc(var(--vsn-right-panel,256px)+12px)] z-30 w-72 overflow-hidden rounded-xl border border-[#e3e3e3] bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-[#f1f1f1] px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#4a4a4a]"><PolarisIcon type="clock" />History</span>
        <VsnButton type="button" onClick={onClose} variant="icon" size="sm" className="vsn-icon-button" title="Close history"><PolarisIcon type="x" /></VsnButton>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {[...entries].map((entry, index) => {
          const current = index === currentIndex;
          return (
            <VsnButton
              type="button"
              variant="plain"
              key={`${entry.time || index}-${index}`}
              onClick={() => onRestore?.(index)}
              className={`flex w-full items-center gap-3 border-b border-[#f7f7f7] px-4 py-2.5 text-left transition-colors hover:bg-[#f6f6f7] ${current ? "bg-emerald-50/60" : ""}`}
            >
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${current ? "bg-[#95BF47] text-white" : "bg-[#f6f6f7] text-[#6d6d6d]"}`}><PolarisIcon type={historyIcon(entry)} size="small" /></div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-xs font-medium ${current ? "text-[#95BF47]" : "text-[#4a4a4a]"}`}>{entry.label || "Change"}</p>
                <p className="text-[10px] text-[#a8a8a8]">{relativeTime(entry.time)}</p>
              </div>
              {current && <PolarisIcon type="check" tone="success" size="small" />}
            </VsnButton>
          );
        })}
      </div>
      <div className="border-t border-[#f1f1f1] bg-[#fafafa] px-4 py-3">
        <p className="text-center text-[10px] text-[#a8a8a8]">{autosaveLabel || "Autosave ready"}</p>
      </div>
    </div>
  );
}
