import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Home, PanelsTopLeft, Library, Store, TrendingUp, Puzzle, BookOpen, CreditCard, Code2, Mail,
  Settings, Key, HeadphonesIcon, FileText, Bell, Info, ChevronLeft, ChevronRight,
  Zap, Languages, CheckCircle, Network, Images, Film, Music2
} from 'lucide-react';

const NAV_SYSTEM = {home:'dashboard',pages:'pages',library:'library',marketplace:'marketplace','brand-kits':'brandKits',widgets:'widgets','widget-studio':'widgetStudio',campaigns:'campaigns','email-builder':'emailBuilder',experiments:'experiments','floating-elements':'floatingElements',fonts:'fonts','svg-assets':'svgAssets','stock-images':'stockImages','stock-videos':'stockVideos','stock-audio':'stockAudio',animations:'animations','form-submissions':'submissions','form-settings':'formSettings',localization:'localization','developer-studio':'developerStudio','developer-sdk':'developerSdk','platform-intelligence':'platformIntelligence',onboarding:'onboarding',backups:'backups','role-manager':'roleManager','control-center':'controlCenter',documentation:'documentation',pricing:'plans',settings:'settings',support:'support',changelog:'changelog',notifications:'notifications',about:'about',profile:'profile'};

function navigationGroups(counts = {}, localizationEnabled = false, builderAccess = true, isOwner = false) {
  const groups = [
    { label: 'Overview', items: [
      { id: 'home', label: 'Dashboard', icon: <Home size={18} /> },
    ]},
    { label: 'Build', items: builderAccess ? [
      { id: 'pages', label: 'Templates', icon: <PanelsTopLeft size={18} />, badge: counts.pages ?? 0 },
      { id: 'library', label: 'Saved Library', icon: <Library size={18} />, badge: counts.library ?? 0 },
      { id: 'marketplace', label: 'Marketplace', icon: <Store size={18} />, badge: counts.marketplace ?? 0 },
      { id: 'brand-kits', label: 'Brand Kits', icon: <Zap size={18} />, badge: counts.brandKits ?? 0 },
      { id: 'widgets', label: 'Widgets', icon: <Puzzle size={18} />, badge: counts.widgets ?? 0 },
      { id: 'widget-studio', label: 'Widget Studio', icon: <Code2 size={18} /> },
    ] : [
      { id: 'widgets', label: 'Widgets', icon: <Puzzle size={18} />, badge: counts.widgets ?? 0 },
    ]},
    { label: 'Growth', items: builderAccess ? [
      { id: 'campaigns', label: 'Campaigns', icon: <TrendingUp size={18} />, badge: counts.campaigns ?? 0 },
      { id: 'email-builder', label: 'Email Builder', icon: <Mail size={18} />, badge: counts.emailTemplates ?? 0 },
      { id: 'experiments', label: 'CRO Experiments', icon: <Zap size={18} />, badge: counts.experiments ?? 0 },
      { id: 'floating-elements', label: 'Floating Elements', icon: <PanelsTopLeft size={18} />, badge: counts.floatingElements ?? 0 },
    ] : []},
    { label: 'Assets', items: builderAccess ? [
      { id: 'fonts', label: 'Custom Fonts', icon: <FileText size={18} />, badge: counts.fonts ?? 0 },
      { id: 'svg-assets', label: 'SVG Library', icon: <Library size={18} />, badge: counts.svgAssets ?? 0 },
      { id: 'stock-images', label: 'Stock Images', icon: <Images size={18} />, badge: counts.stockImages ?? 0 },
      { id: 'stock-videos', label: 'Stock Videos', icon: <Film size={18} />, badge: counts.stockVideos ?? 0 },
      { id: 'stock-audio', label: 'Stock Audio', icon: <Music2 size={18} />, badge: counts.stockAudio ?? 0 },
      { id: 'animations', label: 'Motion Library', icon: <Zap size={18} />, badge: counts.animations ?? 0 },
    ] : []},
    { label: 'Data & Forms', items: builderAccess ? [
      { id: 'form-submissions', label: 'Submissions', icon: <FileText size={18} /> },
      { id: 'form-settings', label: 'Form Settings', icon: <Settings size={18} /> },
    ] : []},
    { label: 'Localization', items: localizationEnabled ? [
      { id: 'localization', label: 'Languages & Markets', icon: <Languages size={18} /> },
    ] : []},
    { label: 'Developer', items: builderAccess ? [
      { id: 'developer-studio', label: 'Developer Studio', icon: <Code2 size={18} /> },
      { id: 'developer-sdk', label: 'Plugin SDK', icon: <Puzzle size={18} /> },
      { id: 'platform-intelligence', label: 'Platform Intelligence', icon: <Network size={18} /> },
    ] : []},
    { label: 'System', items: builderAccess ? [
      { id: 'onboarding', label: 'Setup', icon: <CheckCircle size={18} /> },
      { id: 'backups', label: 'Backups', icon: <Library size={18} /> },
      ...(isOwner ? [{ id: 'role-manager', label: 'Roles & Permissions', icon: <Key size={18} /> }] : []),
      { id: 'control-center', label: 'System Health', icon: <Settings size={18} /> },
    ] : []},
    { label: 'Manage', items: [
      { id: 'documentation', label: 'Documentation', icon: <BookOpen size={18} /> },
      { id: 'pricing', label: 'Plans & License', icon: <CreditCard size={18} /> },
      { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
      { id: 'support', label: 'Support', icon: <HeadphonesIcon size={18} /> },
      { id: 'changelog', label: 'Changelog', icon: <FileText size={18} /> },
      { id: 'notifications', label: 'Notifications', icon: <Bell size={18} />, dynamicBadge: 'notifications' },
      { id: 'about', label: 'About', icon: <Info size={18} /> },
    ]},
  ];
  return groups.filter((group) => group.items.length);
}

export default function Sidebar({ fullName, ownerImage, widgetsFeatcher, activePage, onNavigate, collapsed, onToggleCollapse, darkMode, notificationCount = 0, planName = 'Plan', localizationEnabled = false, builderAccess = true, isOwner = false, navigationCounts = {}, systemAccess = {} }) {
  const [hoverTooltip, setHoverTooltip] = useState(null);
  const showCollapsedTooltip = (event, label) => {
    if (!collapsed || typeof document === 'undefined') return;
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverTooltip({ label, top: rect.top + rect.height / 2 });
  };
  const hideCollapsedTooltip = () => setHoverTooltip(null);
  const widgetLoadedData = widgetsFeatcher.data?.settings;
  const groups = navigationGroups({ ...navigationCounts, widgets: navigationCounts.widgets ?? widgetLoadedData?.totalCount ?? 0 }, localizationEnabled, builderAccess, isOwner).map((group) => ({
    ...group,
    items: group.items.filter((item)=>isOwner || systemAccess?.[NAV_SYSTEM[item.id]] !== false).map((item) => item.dynamicBadge === 'notifications' ? { ...item, badge: notificationCount } : item),
  })).filter((group)=>group.items.length);
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#4B5563';
  const iconColor = darkMode ? '#6B7280' : '#9CA3AF';

  return (
    <aside style={{ width: collapsed ? 64 : 240, minHeight: '100vh', background: darkMode ? '#111827' : '#FFFFFF', borderRight: `1px solid ${darkMode ? '#1F2937' : '#E5E7EB'}`, display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease', position: 'sticky', top: 0, height: '100vh', flexShrink: 0, zIndex: 99, overflow: 'visible' }}>
      <div style={{ padding: collapsed ? '20px 0' : '20px 16px', borderBottom: `1px solid ${darkMode ? '#1F2937' : '#E5E7EB'}`, display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start', flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--vsn-green) 0%, var(--vsn-green-dark) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Zap size={16} color="white" /></div>
        {!collapsed ? <div><div style={{ fontWeight: 600, fontSize: 12, color: muted, lineHeight: 1.2 }}>Workspace</div></div> : null}
      </div>

      <nav style={{ padding: '10px 8px', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }} aria-label="VSN Builder navigation">
        {groups.map((group) => <section key={group.label} style={{ marginBottom: collapsed ? 6 : 12 }}>
          {!collapsed ? <div style={{ padding: '5px 10px 6px', fontSize: 10, lineHeight: 1.2, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: darkMode ? '#4B5563' : '#A0A7B4' }}>{group.label}</div> : null}
          {group.items.map((item) => {
            const active = activePage === item.id || (item.id === 'home' && activePage === 'dashboard');
            return <button key={item.id} onClick={() => onNavigate(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px 0' : '9px 10px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 2, background: active ? (darkMode ? 'rgba(var(--vsn-accent-rgb),0.15)' : 'rgba(var(--vsn-accent-rgb),0.1)') : 'transparent', color: active ? 'var(--vsn-green)' : muted, fontWeight: active ? 600 : 400, fontSize: 14, position: 'relative', transition: 'all 0.15s' }} onMouseEnter={(event) => { if (!active) event.currentTarget.style.background = darkMode ? '#1F2937' : '#F9FAFB'; showCollapsedTooltip(event, `${item.label}${item.badge !== undefined && item.badge !== null ? ` · ${item.badge}` : ''}`); }} onMouseLeave={(event) => { if (!active) event.currentTarget.style.background = 'transparent'; hideCollapsedTooltip(); }}>
              {active ? <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, borderRadius: '0 3px 3px 0', background: 'var(--vsn-green)' }} /> : null}
              <span style={{ flexShrink: 0, color: active ? 'var(--vsn-green)' : iconColor }}>{item.icon}</span>
              {!collapsed ? <><span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>{item.badge !== undefined && item.badge !== null ? <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1, background: active ? 'var(--vsn-green)' : (darkMode ? '#2D3748' : '#F3F4F6'), color: active ? 'white' : (darkMode ? '#9CA3AF' : '#6B7280'), padding: '2px 7px', borderRadius: 20 }}>{item.badge}</span> : null}</> : null}
            </button>;
          })}
        </section>)}
      </nav>

      <div style={{ padding: collapsed ? '12px 0' : '12px 8px', borderTop: `1px solid ${darkMode ? '#1F2937' : '#E5E7EB'}`, flexShrink: 0 }}>
        <button onClick={() => onNavigate('profile')} onMouseEnter={(event)=>showCollapsedTooltip(event, `Profile · ${fullName || 'User'}`)} onMouseLeave={hideCollapsedTooltip} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '8px 0' : '8px 10px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 8, border: 'none', cursor: 'pointer', background: activePage === 'profile' ? (darkMode ? 'rgba(var(--vsn-accent-rgb),0.15)' : 'rgba(var(--vsn-accent-rgb),0.1)') : 'transparent', color: activePage === 'profile' ? 'var(--vsn-green)' : muted, transition: 'all 0.15s' }}>
          {ownerImage?.url ? <img src={ownerImage.url} alt={ownerImage?.altText || 'User Avatar'} style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} /> : <div aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'rgba(var(--vsn-accent-rgb),.14)', color: 'var(--vsn-green-dark)', fontSize: 11, fontWeight: 800 }}>{String(fullName || 'U').trim().charAt(0).toUpperCase() || 'U'}</div>}
          {!collapsed ? <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</div><div style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{planName} Plan</div></div> : null}
        </button>
      </div>

      {hoverTooltip && typeof document !== 'undefined' ? createPortal(
        <div className="vsn-sidebar-portal-tooltip" role="tooltip" style={{ top: hoverTooltip.top }}>{hoverTooltip.label}</div>,
        document.body,
      ) : null}

      <button onClick={() => { hideCollapsedTooltip(); onToggleCollapse?.(); }} style={{ position: 'absolute', right: -12, top: 28, width: 24, height: 24, borderRadius: '50%', background: darkMode ? '#1F2937' : '#FFFFFF', border: `1px solid ${darkMode ? '#374151' : '#E5E7EB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', zIndex: 100, color: darkMode ? '#9CA3AF' : '#6B7280', transition: 'all 0.15s' }} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
