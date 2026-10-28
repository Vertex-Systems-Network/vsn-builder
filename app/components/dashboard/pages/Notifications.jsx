import { useEffect, useMemo, useState } from 'react';
import { useFetcher } from 'react-router';
import { formatDate } from '../../../utils/format-date.js';

const typeConfig = {
  update: { tone: 'info', label: 'Updates' },
  security: { tone: 'critical', label: 'Security' },
  billing: { tone: 'warning', label: 'Billing' },
  support: { tone: 'neutral', label: 'Support' },
  system: { tone: 'neutral', label: 'System' },
};

function ago(value, now) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  if (!now) return formatDate(value, 'date', '');
  const mins = Math.floor((now - time) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60); if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24); if (days < 14) return `${days}d ago`;
  return formatDate(value, 'date', '');
}

export default function Notifications({ notifications = [], onNotificationsChange, onNavigate }) {
  const fetcher = useFetcher();
  const [now, setNow] = useState(null);
  useEffect(() => { setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  const [activeTab, setActiveTab] = useState('all');
  const [pending, setPending] = useState(null);
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

  return <s-page heading="Notifications">
    <s-button slot="secondary-actions" icon="check" disabled={!unreadCount || fetcher.state !== 'idle'} onClick={() => submit('notification-read-all')}>Mark all read</s-button>
    <s-stack direction="block" gap="base">
      <s-paragraph color="subdued">{unreadCount} unread notification{unreadCount === 1 ? '' : 's'}.</s-paragraph>
      <s-stack direction="inline" gap="small-200">{tabs.map((tab) => <s-button key={tab} variant={activeTab === tab ? 'primary' : 'secondary'} onClick={() => setActiveTab(tab)}>{tab === 'all' ? 'All' : typeConfig[tab]?.label || tab}</s-button>)}</s-stack>
      <s-section padding="none">
        {filtered.length ? <s-stack direction="block">{filtered.map((item, index) => {
          const cfg = typeConfig[item.type] || typeConfig.system;
          return <s-box key={item.id} padding="base" background={!item.readAt ? 'subdued' : 'transparent'} borderWidth={index < filtered.length - 1 ? 'none none base none' : 'none'}>
            <s-stack direction="inline" justifyContent="space-between" alignItems="start" gap="base">
              <s-stack direction="block" gap="small-100">
                <s-stack direction="inline" gap="small-200" alignItems="center"><s-text type="strong">{item.title}</s-text>{!item.readAt ? <s-badge tone="success">New</s-badge> : null}</s-stack>
                <s-text color="subdued">{item.message}</s-text>
                <s-stack direction="inline" gap="small-200" alignItems="center"><s-badge tone={cfg.tone}>{cfg.label}</s-badge><s-text color="subdued">{ago(item.createdAt, now)}</s-text>{item.href ? <s-button variant="tertiary" icon="external" onClick={(event) => openNotificationTarget(item, event)}>Open</s-button> : null}</s-stack>
              </s-stack>
              <s-button variant="tertiary" icon="x" accessibilityLabel="Dismiss notification" disabled={fetcher.state !== 'idle'} onClick={(event) => { event.stopPropagation(); submit('notification-dismiss', item.id); }}/>
            </s-stack>
          </s-box>;
        })}</s-stack> : <s-box padding="large"><s-stack direction="block" alignItems="center" gap="small-200"><s-heading>No notifications</s-heading><s-text color="subdued">There is nothing in this category right now.</s-text></s-stack></s-box>}
      </s-section>
    </s-stack>
  </s-page>;
}
