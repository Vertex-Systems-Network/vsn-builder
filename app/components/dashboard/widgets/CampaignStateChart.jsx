const STATE_META = [
  ['active','Active','var(--vsn-green)'],
  ['scheduled','Scheduled','#F59E0B'],
  ['disabled','Disabled','#9CA3AF'],
  ['expired','Expired','#8B5CF6'],
];

export default function CampaignStateChart({ campaigns = {}, darkMode, onOpen }) {
  const states = campaigns.states || {};
  const max = Math.max(1, ...STATE_META.map(([key]) => Number(states[key] || 0)));
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  return <div className="vsn-campaign-chart">
    <div className="vsn-campaign-chart-summary"><div><strong style={{ color:text }}>{Number(campaigns.active || 0)}</strong><span style={{ color:muted }}>active now</span></div><button type="button" onClick={onOpen}>Open campaigns</button></div>
    <div className="vsn-campaign-bars">{STATE_META.map(([key,label,color])=>{const value=Number(states[key]||0);return <div key={key} className="vsn-campaign-bar-row"><span style={{ color:muted }}>{label}</span><div><i style={{ width:`${Math.max(value?10:0,(value/max)*100)}%`, background:color }}/></div><strong style={{ color:text }}>{value}</strong></div>})}</div>
  </div>;
}
