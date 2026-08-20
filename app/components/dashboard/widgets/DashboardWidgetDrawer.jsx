import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { DASHBOARD_WIDGETS } from '../../../config/dashboard-widgets.js';
import { VsnSettingsPopover } from '../../ui/VsnToolkit';

export default function DashboardWidgetDrawer({ open, darkMode, preferences, onClose, onToggle, onMove, onReset }) {
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  const byId = new Map(DASHBOARD_WIDGETS.map((item) => [item.id, item]));
  const ordered = (preferences?.order || []).map((id) => byId.get(id)).filter(Boolean);
  const visible = new Set(preferences?.visible || []);
  return <VsnSettingsPopover open={open} title="Dashboard settings" subtitle="Show, hide and reorder dashboard widgets." onClose={onClose} onReset={onReset} resetLabel="Reset dashboard" className="vsn-dashboard-settings-popover">
    <div className="vsn-dashboard-settings-list">
      {ordered.map((item,index)=>{const isVisible=visible.has(item.id);return <div key={item.id} className="vsn-dashboard-drawer-row">
        <button type="button" className={isVisible?'is-visible':''} onClick={()=>onToggle?.(item.id)} aria-pressed={isVisible}>{isVisible?<Eye size={15}/>:<EyeOff size={15}/>}</button>
        <div><strong style={{ color:text }}>{item.label}</strong><span style={{ color:muted }}>{item.description}</span></div>
        <div className="vsn-dashboard-drawer-move"><button type="button" disabled={index===0} onClick={()=>onMove?.(item.id,-1)} aria-label={`Move ${item.label} up`}><ChevronUp size={14}/></button><button type="button" disabled={index===ordered.length-1} onClick={()=>onMove?.(item.id,1)} aria-label={`Move ${item.label} down`}><ChevronDown size={14}/></button></div>
      </div>})}
    </div>
  </VsnSettingsPopover>;
}
