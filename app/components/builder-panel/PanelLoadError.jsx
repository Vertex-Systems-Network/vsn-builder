import { AlertTriangle, RefreshCw, Activity } from "lucide-react";
import { VsnButton, VsnCard } from "../ui/VsnToolkit";

/**
 * End-user panel failure state. Technical exceptions belong in server logs/System Health,
 * not in the Builder workspace. Keep this copy short, actionable, and consistent with VSN UI.
 */
export default function PanelLoadError({ data, panelLabel, onRetry, onOpenHealth }) {
  const title = data?.userTitle || `${panelLabel} is temporarily unavailable`;
  const message = data?.userMessage || `VSN Builder could not load ${panelLabel} right now. Your saved work was not changed.`;
  const hint = data?.userHint || "Try again. If the issue remains, System Health can identify the service or permission that needs attention.";

  return <VsnCard className="vsn-panel-error-card">
    <div className="vsn-panel-error-state" role="alert">
      <span className="vsn-panel-error-icon" aria-hidden="true"><AlertTriangle size={20}/></span>
      <div className="vsn-panel-error-copy">
        <strong>{title}</strong>
        <p>{message}</p>
        <small>{hint}</small>
      </div>
      <div className="vsn-panel-error-actions">
        <VsnButton variant="primary" size="sm" icon={<RefreshCw size={14}/>} onClick={onRetry}>Try again</VsnButton>
        <VsnButton size="sm" icon={<Activity size={14}/>} onClick={onOpenHealth}>Open System Health</VsnButton>
      </div>
    </div>
  </VsnCard>;
}
