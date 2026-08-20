import { useEffect, useMemo, useState } from 'react';
import { useFetcher } from 'react-router';
import { Bell, Shield, CreditCard, Cpu, CheckCheck, X, LifeBuoy, ExternalLink } from 'lucide-react';

const typeConfig = {
  update: { icon: Bell, color: '#5C6AC4', bg: 'rgba(92,106,196,0.1)', label: 'Updates' },
  security: { icon: Shield, color: '#DC2626', bg: 'rgba(220,38,38,0.1)', label: 'Security' },
  billing: { icon: CreditCard, color: '#D97706', bg: 'rgba(217,119,6,0.1)', label: 'Billing' },
  support: { icon: LifeBuoy, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', label: 'Support' },
  system: { icon: Cpu, color: '#6B7280', bg: 'rgba(107,114,128,0.1)', label: 'System' },
};

function ago(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const mins = Math.floor((Date.now() - time) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60); if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24); if (days < 14) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

export default function Notifications({ darkMode, notifications = [], onNotificationsChange, onNavigate }) {
  const fetcher = useFetcher();
  const [activeTab, setActiveTab] = useState('all');
  const [pending, setPending] = useState(null);
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  const card = { background: darkMode ? '#1A1F2E' : '#FFFFFF', borderRadius: 12, border: `1px solid ${darkMode ? '#2D3748' : '#E5E7EB'}` };
  const tabs = ['all', ...Object.keys(typeConfig)];
  const filtered = useMemo(() => notifications.filter((item) => activeTab === 'all' || item.type === activeTab), [notifications, activeTab]);
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  const submit = (intent, id = '') => {
    setPending({ intent, id });
    fetcher.submit({ intent, id }, { method: 'post' });
  };

  useEffect(() => {
    if (!pending || fetcher.state !== 'idle' || !fetcher.data) return;
    if (fetcher.data.success) {
      const now = new Date().toISOString();
      if (pending.intent === 'notification-read') onNotificationsChange?.(notifications.map((item) => item.id === pending.id ? { ...item, readAt: item.readAt || now } : item));
      if (pending.intent === 'notification-read-all') onNotificationsChange?.(notifications.map((item) => ({ ...item, readAt: item.readAt || now })));
      if (pending.intent === 'notification-dismiss') onNotificationsChange?.(notifications.filter((item) => item.id !== pending.id));
    }
    setPending(null);
  }, [fetcher.state, fetcher.data, pending, notifications, onNotificationsChange]);

  const openNotificationTarget = (item, event) => {
    event?.stopPropagation?.();
    if (!item.readAt) submit('notification-read', item.id);

    const fallbackByType = {
      update: '/app?view=changelog',
      support: '/app?view=support',
      billing: '/app?view=license',
      security: '/app/pages',
      system: '/app',
    };
    const target = item.href || fallbackByType[item.type] || '/app';

    if (target.startsWith('/app?view=')) {
      const view = new URL(target, 'https://vsn.local').searchParams.get('view');
      if (view) onNavigate?.(view);
      return;
    }
    if (target === '/app') { onNavigate?.('dashboard'); return; }
    window.location.assign(target);
  };

  return <div className="page-fade" style={{ padding: '28px 32px', maxWidth: 960, margin: '0 auto' }}>
    <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
      <div><h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: text }}>Notifications</h1><p style={{ margin: '4px 0 0', fontSize: 14, color: muted }}>{unreadCount} unread notification{unreadCount === 1 ? '' : 's'}.</p></div>
      <button disabled={!unreadCount || fetcher.state !== 'idle'} onClick={() => submit('notification-read-all')} style={{ display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${darkMode ? '#2D3748' : '#E5E7EB'}`, borderRadius: 8, background: darkMode ? '#1A1F2E' : '#fff', color: text, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: unreadCount ? 'pointer' : 'default', opacity: unreadCount ? 1 : .5 }}><CheckCheck size={14}/>Mark all read</button>
    </div>

    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 4, padding: 8, borderBottom: `1px solid ${darkMode ? '#2D3748' : '#E5E7EB'}`, overflowX: 'auto' }}>
        {tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '7px 11px', border: 0, borderRadius: 7, cursor: 'pointer', background: activeTab === tab ? (darkMode ? '#252C3B' : '#F3F4F6') : 'transparent', color: activeTab === tab ? text : muted, fontSize: 12, fontWeight: 650, whiteSpace: 'nowrap' }}>{tab === 'all' ? 'All' : typeConfig[tab]?.label || tab}</button>)}
      </div>

      {filtered.length ? filtered.map((item, index) => {
        const cfg = typeConfig[item.type] || typeConfig.system; const Icon = cfg.icon;
        return <div key={item.id} onClick={(event) => openNotificationTarget(item, event)} style={{ padding: '15px 18px', display: 'flex', gap: 13, cursor: item.href ? 'pointer' : 'default', background: !item.readAt ? (darkMode ? 'rgba(var(--vsn-accent-rgb),.035)' : '#FCFFF8') : 'transparent', borderBottom: index < filtered.length - 1 ? `1px solid ${darkMode ? '#222938' : '#F0F1F2'}` : 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: cfg.bg, color: cfg.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={16}/></div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><strong style={{ color: text, fontSize: 13.5 }}>{item.title}</strong>{!item.readAt ? <span style={{ width: 7, height: 7, background: 'var(--vsn-green)', borderRadius: '50%' }}/> : null}</div>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.55, color: muted }}>{item.message}</p>
            <div style={{ marginTop: 7, display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: muted }}><span>{cfg.label}</span><span>·</span><span>{ago(item.createdAt)}</span>{item.href ? <><span>·</span><button type="button" onClick={(event) => openNotificationTarget(item, event)} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: cfg.color, border: 0, background: 'transparent', padding: 0, font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Open <ExternalLink size={10}/></button></> : null}</div>
          </div>
          <button aria-label="Dismiss notification" onClick={(event) => { event.stopPropagation(); submit('notification-dismiss', item.id); }} disabled={fetcher.state !== 'idle'} style={{ width: 30, height: 30, border: 0, background: 'transparent', color: muted, cursor: 'pointer', display: 'grid', placeItems: 'center', borderRadius: 7 }}><X size={14}/></button>
        </div>;
      }) : <div style={{ padding: 48, textAlign: 'center' }}><Bell size={28} color={muted}/><div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: text }}>No notifications</div><div style={{ marginTop: 4, fontSize: 12, color: muted }}>There is nothing in this category right now.</div></div>}
    </div>
  </div>;
}
