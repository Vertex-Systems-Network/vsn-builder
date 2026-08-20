import { Activity, Database, MousePointer2, UsersRound } from 'lucide-react';

function statusLabel(value) { return value === 'healthy' ? 'Healthy' : value === 'down' ? 'Unavailable' : 'Needs attention'; }
function relative(value) { if(!value)return 'No requests yet'; const ms=Date.now()-new Date(value).getTime(); if(ms<60000)return 'Just now'; if(ms<3600000)return `${Math.max(1,Math.floor(ms/60000))}m ago`; return `${Math.max(1,Math.floor(ms/3600000))}h ago`; }

export default function LiveMonitorWidget({ monitor = {}, darkMode }) {
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  const tone = monitor.status === 'healthy' ? 'var(--vsn-green)' : monitor.status === 'down' ? '#DC2626' : '#F59E0B';
  const metrics = [
    [Database, 'Database', monitor.database?.ok === false ? 'Unavailable' : `${Number(monitor.database?.latencyMs || 0)} ms`],
    [Activity, 'Requests / 5m', Number(monitor.recentRequests || 0)],
    [UsersRound, 'Active editors', Number(monitor.activeEditors || 0)],
    [MousePointer2, 'Active visitors', Number(monitor.activeVisitors || 0)],
  ];
  return <div>
    <div className="vsn-live-monitor-status"><span style={{ background:tone }}/><strong style={{ color:text }}>{statusLabel(monitor.status)}</strong><small style={{ color:muted }}>Updated {relative(monitor.checkedAt)}</small></div>
    <div className="vsn-live-monitor-grid">{metrics.map(([Icon,label,value])=><div key={label}><Icon size={15} color="#5C6AC4"/><span style={{ color:muted }}>{label}</span><strong style={{ color:text }}>{value}</strong></div>)}</div>
    <div className="vsn-live-monitor-foot" style={{ color:muted }}>Last backend request: {monitor.lastRequest ? `${monitor.lastRequest.route} · ${relative(monitor.lastRequest.createdAt)}` : 'No request telemetry yet'}</div>
  </div>;
}
