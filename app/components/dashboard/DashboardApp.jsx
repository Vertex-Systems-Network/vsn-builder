import { lazy, startTransition, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router';
import Toast from './Toast';

import Home from './pages/Home';


function lazyWithRetry(loader) {
  return lazy(async () => {
    try { return await loader(); }
    catch (firstError) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      try { return await loader(); } catch { throw firstError; }
    }
  });
}

const WidgetsPage = lazyWithRetry(() => import('./pages/Widgets'));
const Documentation = lazyWithRetry(() => import('./pages/Documentation'));
const Pricing = lazyWithRetry(() => import('./pages/Pricing'));
const Settings = lazyWithRetry(() => import('./pages/Settings'));
const Support = lazyWithRetry(() => import('./pages/Support'));
const Changelog = lazyWithRetry(() => import('./pages/Changelog'));
const Notifications = lazyWithRetry(() => import('./pages/Notifications'));
const About = lazyWithRetry(() => import('./pages/About'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const Localization = lazyWithRetry(() => import('./pages/Localization'));

function DashboardPageFallback() {
  return <div className="vsn-dashboard-lazy-fallback" role="status"><span className="vsn-tool-spinner"/><strong>Loading workspace…</strong></div>;
}

const VIEW_SYSTEM={home:'dashboard',widgets:'widgets',localization:'localization',documentation:'documentation',pricing:'plans',license:'plans',settings:'settings',support:'support',changelog:'changelog',notifications:'notifications',about:'about',profile:'profile'};

function normalizeView(value) {
  if (!value || value === 'dashboard') return 'home';
  if (value === 'license') return 'pricing';
  return value;
}


export default function DashboardApp({ session, ownerInfo, widgetSettings, dashboard }) {
  const location = useLocation();
  const shell = useOutletContext() || {};
  const darkMode = shell.darkMode === true;
  const [activePage, setActivePage] = useState(() => normalizeView(new URLSearchParams(location.search).get('view')));
  const [toasts, setToasts] = useState([]);
  const [settings, setSettings] = useState(widgetSettings);
  const [notifications, setNotifications] = useState(dashboard?.notifications || []);
  const [tickets, setTickets] = useState(dashboard?.tickets || []);
  const [focusTarget, setFocusTarget] = useState(null);

  useEffect(() => { startTransition(()=>setSettings(widgetSettings)); }, [widgetSettings]);
  useEffect(() => { startTransition(()=>setNotifications(dashboard?.notifications || [])); }, [dashboard?.notifications]);
  useEffect(() => { startTransition(()=>setTickets(dashboard?.tickets || [])); }, [dashboard?.tickets]);
  useEffect(() => { startTransition(()=>setActivePage(normalizeView(new URLSearchParams(location.search).get('view')))); }, [location.search]);

  const widgetsFeatcher = useMemo(() => ({ state: 'idle', data: { settings } }), [settings]);
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  const addToast = useCallback((toast) => {
    const id = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    setToasts((current) => [...current, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const handleNavigate = (page, query = null) => {
    setFocusTarget(null);
    if (shell.navigateApp) {
      shell.navigateApp(page === 'dashboard' ? 'home' : page, query);
      return;
    }
    const next = page === 'dashboard' ? 'home' : page;
    setActivePage(next);
  };

  const ownerName = [ownerInfo?.firstName, ownerInfo?.lastName].filter(Boolean).join(' ') || ownerInfo?.name || 'Store owner';
  const userName = ownerInfo?.firstName || ownerInfo?.name?.split(' ')?.[0] || 'Store owner';
  const userFullName = ownerName;
  const ownerImage = ownerInfo?.avatar || null;
  const emailAddress = ownerInfo?.email || ownerInfo?.shopEmail || '';
  const shopProfile = {
    name: ownerInfo?.shopName || '',
    myshopifyDomain: ownerInfo?.myshopifyDomain || session?.shop || '',
    primaryDomain: ownerInfo?.primaryDomain || null,
    email: ownerInfo?.shopEmail || '',
  };



  const renderPage = () => {
    const systemKey=VIEW_SYSTEM[activePage]||'dashboard';
    if(shell.systemAccess?.[systemKey]===false)return <div className="vsn-access-denied"><strong>Access restricted</strong><p>Your VSN role does not allow this system. Ask the store owner to update Roles & Permissions.</p></div>;
    switch (activePage) {
      case 'widgets': return <WidgetsPage widgetsFeatcher={widgetsFeatcher} darkMode={darkMode} onToast={addToast} onSettingsSaved={setSettings} focusWidgetId={focusTarget?.type === 'widget' ? focusTarget.id.replace('widget:', '') : null} />;
      case 'localization': return <Localization darkMode={darkMode} data={dashboard?.localization} />;
      case 'documentation': return <Documentation darkMode={darkMode} />;
      case 'pricing': return <Pricing darkMode={darkMode} currentPlan={dashboard?.plan} entitlements={dashboard?.entitlements} billingUrl={dashboard?.billingUrl} pricing={dashboard?.shopifyPricing} pricingReturn={dashboard?.pricingReturn} subscriptionSync={dashboard?.subscriptionSync} shop={session?.shop || ''} canManageBilling={shell.actionAccess?.billing?.manage === true} />;
      case 'settings': return <Settings darkMode={darkMode} themePreference={shell.themePreference || 'system'} onThemePreferenceChange={shell.setThemePreference} colorSchemePreference={shell.colorSchemePreference||'lime'} customAccent={shell.customAccent||'#95BF47'} onColorSchemeChange={shell.setColorSchemePreference} onCustomAccentChange={shell.setCustomAccent} onToast={addToast} ownerInfo={ownerInfo} settings={dashboard?.settings} isOwner={shell.isOwner === true} />;
      case 'license': return <Pricing darkMode={darkMode} currentPlan={dashboard?.plan} entitlements={dashboard?.entitlements} billingUrl={dashboard?.billingUrl} pricing={dashboard?.shopifyPricing} pricingReturn={dashboard?.pricingReturn} subscriptionSync={dashboard?.subscriptionSync} shop={session?.shop || ''} canManageBilling={shell.actionAccess?.billing?.manage === true} />;
      case 'support': return <Support onNavigate={handleNavigate} darkMode={darkMode} onToast={addToast} tickets={tickets} onTicketsChange={setTickets} onNotificationCreated={(item) => setNotifications((current) => item && !current.some((row) => row.id === item.id) ? [item, ...current] : current)} userName={userFullName} initialTicketId={focusTarget?.type === 'ticket' ? focusTarget.ticketId : null} />;
      case 'changelog': return <Changelog darkMode={darkMode} releases={dashboard?.releases || []} currentVersion={dashboard?.appVersion} />;
      case 'notifications': return <Notifications darkMode={darkMode} notifications={notifications} onNotificationsChange={setNotifications} onNavigate={handleNavigate} />;
      case 'about': return <About darkMode={darkMode} />;
      case 'profile': return <Profile ownerImage={ownerImage} fullName={userFullName} emailAddress={emailAddress} shopUrl={session?.shop || ''} shopProfile={shopProfile} plan={dashboard?.plan} darkMode={darkMode} onToast={addToast} />;
      case 'home':
      default: return <Home userName={userName} version={dashboard?.appVersion} darkMode={darkMode} onNavigate={handleNavigate} activities={dashboard?.activities || []} releases={dashboard?.releases || []} summary={dashboard?.workspaceSummary || {}} plan={dashboard?.plan} planUsage={dashboard?.planUsage} dashboardPreferences={dashboard?.dashboardPreferences} />;
    }
  };

  const background = darkMode ? '#0F1117' : '#FAFAFA';

  return (
    <div className={darkMode ? 'dashboard-content dark' : 'dashboard-content'} style={{ minHeight: '100%', background }}>
      {activePage === 'home' ? renderPage() : <Suspense fallback={<DashboardPageFallback/>}>{renderPage()}</Suspense>}
      <Toast toasts={toasts} onRemove={removeToast} darkMode={darkMode} />
    </div>
  );
}
