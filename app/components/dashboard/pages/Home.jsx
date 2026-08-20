import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import {
  Activity, ArrowRight, Bell, Boxes, Clock3, CreditCard, FilePenLine,
  FileText, FlaskConical, Globe2, Inbox, Megaphone, PanelTopOpen, Puzzle, RotateCcw,
  Save, Settings, ShieldAlert, SlidersHorizontal, Sparkles, Upload, Wrench,
  LifeBuoy, PanelsTopLeft, DatabaseBackup
} from 'lucide-react';
import { DASHBOARD_WIDGETS, DEFAULT_DASHBOARD_VISIBLE_WIDGETS, DEFAULT_DASHBOARD_WIDGET_ORDER } from '../../../config/dashboard-widgets.js';
import DashboardWidgetShell from '../widgets/DashboardWidgetShell.jsx';
import DashboardWidgetDrawer from '../widgets/DashboardWidgetDrawer.jsx';
import { VsnFloatingSettingsButton } from '../../ui/VsnToolkit';
import CampaignStateChart from '../widgets/CampaignStateChart.jsx';
import LiveMonitorWidget from '../widgets/LiveMonitorWidget.jsx';
import VisitorMapWidget from '../widgets/VisitorMapWidget.jsx';
import { authenticatedAppFetch, readAppJson } from '../../../utils/authenticated-app-fetch.js';

function relativeTime(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const seconds = Math.max(1, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

const activityIcons = { publish: Upload, save: Save, restore: RotateCcw, settings: Settings, maintenance: Wrench, support: LifeBuoy, widgets: Boxes, import: PanelsTopLeft, system: Activity };
const DASHBOARD_PREFS_VERSION = 2;
const WIDGET_SIZE_WEIGHT = Object.fromEntries(DASHBOARD_WIDGETS.map((item)=>[item.id,item.size === 'stat' ? 0 : item.size === 'medium' ? 1 : 2]));
const DEFAULT_PREFS = { version:DASHBOARD_PREFS_VERSION, order:[...DEFAULT_DASHBOARD_WIDGET_ORDER], visible:[...DEFAULT_DASHBOARD_VISIBLE_WIDGETS] };

function normalizePrefs(value) {
  const known = new Set(DASHBOARD_WIDGETS.map((item)=>item.id));
  const rawOrder = Array.isArray(value?.order) ? value.order.filter((id)=>known.has(id)) : [];
  const completeOrder = [...new Set(rawOrder), ...DEFAULT_DASHBOARD_WIDGET_ORDER.filter((id)=>!rawOrder.includes(id))];
  const order = Number(value?.version || 0) < DASHBOARD_PREFS_VERSION
    ? completeOrder.map((id,index)=>({id,index,weight:WIDGET_SIZE_WEIGHT[id] ?? 9})).sort((a,b)=>a.weight-b.weight || a.index-b.index).map((row)=>row.id)
    : completeOrder;
  const visible = value?.visible == null ? [...DEFAULT_DASHBOARD_VISIBLE_WIDGETS] : [...new Set((Array.isArray(value.visible)?value.visible:[]).filter((id)=>known.has(id)))];
  return { version:DASHBOARD_PREFS_VERSION, order, visible };
}

function Metric({ icon:Icon, label, value, tone='#5C6AC4', bg='rgba(92,106,196,.1)', darkMode, detail=null, onClick=null }) {
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  const content = <><div className="vsn-dashboard-metric-top"><span style={{ color:muted }}>{label}</span><div style={{ background:bg, color:tone }}><Icon size={18}/></div></div><strong style={{ color:text }}>{value}</strong>{detail ? <small style={{ color:muted }}>{detail}</small> : null}</>;
  if (onClick) return <button type="button" className="vsn-dashboard-metric-card" onClick={onClick}>{content}</button>;
  return <div className="vsn-dashboard-metric-card">{content}</div>;
}

function PlanUsage({ plan, planUsage, darkMode, onNavigate }) {
  const text = darkMode ? '#F9FAFB' : '#1A1F36'; const muted = darkMode ? '#9CA3AF' : '#6B7280';
  const pageUsed = Number(planUsage?.pages?.used ?? planUsage?.pages ?? planUsage?.pageCount ?? 0); const pageMax = Number(plan?.maxPages || 0); const pct = pageMax > 0 ? Math.min(100,(pageUsed/pageMax)*100) : 0;
  return <div><div style={{ display:'flex',justifyContent:'space-between',gap:12,alignItems:'center' }}><div><strong style={{ color:text, fontSize:20 }}>{plan?.name || 'Free'}</strong><span style={{ display:'block',marginTop:3,color:muted,fontSize:11.5 }}>Current Shopify-managed plan</span></div><button className="dashboard-secondary-action" type="button" onClick={()=>onNavigate('pricing')}>Manage plan</button></div><div style={{ marginTop:18 }}><div style={{ display:'flex',justifyContent:'space-between',fontSize:11.5,color:muted }}><span>Pages</span><span>{pageUsed} / {pageMax >= 1000 ? 'Extended' : pageMax}</span></div><div className="vsn-dashboard-usage-track"><i style={{ width:`${pct}%` }}/></div></div></div>;
}

export default function Home({ userName, version, darkMode, onNavigate, activities = [], releases = [], summary = {}, plan = null, planUsage = null, dashboardPreferences = null }) {
  const fetcher = useFetcher();
  const [preferences, setPreferences] = useState(()=>normalizePrefs(dashboardPreferences || DEFAULT_PREFS));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [live, setLive] = useState({ monitor:summary?.liveMonitor || {}, visitors:summary?.visitors || {}, campaigns:{ states:summary?.growth?.campaignStates || {}, active:summary?.growth?.activeCampaigns || 0 } });
  const mounted = useRef(true);
  const dragOriginalOrder = useRef(null);
  const dragOrderRef = useRef([...preferences.order]);
  const draggingIdRef = useRef(null);
  const preferencesRef = useRef(preferences);
  const gridRef = useRef(null);
  const previousRectsRef = useRef(null);
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  const sub = darkMode ? '#6B7280' : '#9CA3AF';
  const currentVersion = String(version || '0.0.0').replace(/^v/i, '');

  useEffect(()=>{ const next=normalizePrefs(dashboardPreferences || DEFAULT_PREFS); preferencesRef.current=next; dragOrderRef.current=[...next.order]; setPreferences(next); },[dashboardPreferences]);
  useEffect(()=>{ preferencesRef.current=preferences; if(!draggingIdRef.current) dragOrderRef.current=[...preferences.order]; },[preferences]);
  useEffect(()=>{ mounted.current=true; return ()=>{mounted.current=false;}; },[]);
  useEffect(()=>{
    let stopped = false;
    let inFlight = false;
    let activeController = null;
    const refresh = async()=>{
      if (stopped || inFlight || document.visibilityState === 'hidden' || navigator.onLine === false) return;
      inFlight = true;
      activeController = new AbortController();
      try {
        const response = await authenticatedAppFetch('/app/dashboard-live', { credentials:'same-origin', headers:{Accept:'application/json'}, signal:activeController.signal }, { timeoutMs:8000 });
        const data = await readAppJson(response, 'Dashboard live data could not be refreshed.');
        if (data?.ok && mounted.current && !stopped) setLive({ monitor:data.monitor || {}, visitors:data.visitors || {}, campaigns:data.campaigns || {} });
      } catch (error) {
        if (error?.name !== 'AbortError' && error?.name !== 'TimeoutError') console.warn('VSN dashboard live refresh warning:', error instanceof Error ? error.message : error);
      } finally {
        inFlight = false;
        activeController = null;
      }
    };
    const timer = window.setInterval(refresh, 15000);
    const onVisible = ()=>{ if(document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);
    return ()=>{ stopped = true; activeController?.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', refresh); };
  },[]);

  const captureWidgetRects = useCallback(()=>{
    const root=gridRef.current;if(!root)return null;const rects=new Map();
    root.querySelectorAll('[data-widget-id]').forEach((node)=>rects.set(node.getAttribute('data-widget-id'),node.getBoundingClientRect()));
    return rects;
  },[]);
  useEffect(()=>{
    const before=previousRectsRef.current,root=gridRef.current;if(!before||!root)return;previousRectsRef.current=null;
    const reduce=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;if(reduce)return;
    root.querySelectorAll('[data-widget-id]').forEach((node)=>{const prev=before.get(node.getAttribute('data-widget-id'));if(!prev)return;const next=node.getBoundingClientRect();const x=prev.left-next.left,y=prev.top-next.top;if(Math.abs(x)<1&&Math.abs(y)<1)return;node.animate?.([{transform:`translate(${x}px, ${y}px)`},{transform:'translate(0, 0)'}],{duration:190,easing:'cubic-bezier(.2,.8,.2,1)'});});
  },[preferences.order]);

  const persist = useCallback((next)=>{
    const normalized = normalizePrefs(next);
    preferencesRef.current=normalized;
    dragOrderRef.current=[...normalized.order];
    setPreferences(normalized);
    fetcher.submit({ intent:'save-dashboard-layout', preferences:JSON.stringify(normalized) }, { method:'POST' });
  },[fetcher]);

  const toggleWidget = (id)=>persist({ ...preferences, visible:preferences.visible.includes(id)?preferences.visible.filter((item)=>item!==id):[...preferences.visible,id] });
  const moveWidget = (id,direction)=>{const order=[...preferences.order];const index=order.indexOf(id);const target=index+direction;if(index<0||target<0||target>=order.length)return;[order[index],order[target]]=[order[target],order[index]];persist({...preferences,order});};
  const beginDrag=(id)=>{dragOriginalOrder.current=[...preferencesRef.current.order];dragOrderRef.current=[...preferencesRef.current.order];draggingIdRef.current=id;setDragging(id);};
  const hoverWidget=(targetId)=>{const activeId=draggingIdRef.current;if(!activeId||activeId===targetId)return;previousRectsRef.current=captureWidgetRects();setPreferences(current=>{const order=[...current.order];const from=order.indexOf(activeId),to=order.indexOf(targetId);if(from<0||to<0||from===to){previousRectsRef.current=null;return current;}order.splice(to,0,order.splice(from,1)[0]);dragOrderRef.current=[...order];const next={...current,order};preferencesRef.current=next;return next;});};
  const finishDrag=()=>{if(!draggingIdRef.current)return;draggingIdRef.current=null;setDragging(null);dragOriginalOrder.current=null;const next={...preferencesRef.current,order:[...dragOrderRef.current]};persist(next);};
  const dropWidget=()=>finishDrag();
  const resetDashboard = ()=>persist(DEFAULT_PREFS);

  const visibleSet = useMemo(()=>new Set(preferences.visible),[preferences.visible]);
  const visibleIds = useMemo(()=>preferences.order.filter((id)=>visibleSet.has(id)),[preferences.order,visibleSet]);
  const recentUpdates = releases.slice(0,3);
  const widgetSummary = summary?.widgets || {};
  const activeExperiments = Number(summary?.growth?.activeExperiments || 0);
  const experimentStates = summary?.growth?.experiments || {};
  const healthTotal = Number(summary?.health?.errors || 0) + Number(summary?.health?.warnings || 0);

  const renderWidget = (id) => {
    const common = { id, darkMode, onDragStart:beginDrag, onDragEnter:hoverWidget, onDrop:dropWidget, onDragEnd:finishDrag, draggingId:dragging };
    if (id === 'published-pages') return <DashboardWidgetShell {...common} title="Published Templates" subtitle="Live storefront templates"><Metric icon={Globe2} label="Published" value={summary?.pages?.published ?? 0} tone="var(--vsn-green)" bg="rgba(var(--vsn-accent-rgb),.1)" darkMode={darkMode} detail={`${summary?.pages?.total ?? 0} total pages`} onClick={()=>onNavigate('pages')}/></DashboardWidgetShell>;
    if (id === 'system-health') return <DashboardWidgetShell {...common} title="System Health Issues" subtitle="Errors and warnings"><Metric icon={ShieldAlert} label="Needs attention" value={healthTotal} tone={healthTotal?'#DC2626':'var(--vsn-green)'} bg={healthTotal?'rgba(220,38,38,.09)':'rgba(var(--vsn-accent-rgb),.1)'} darkMode={darkMode} detail={`${summary?.health?.errors ?? 0} errors · ${summary?.health?.warnings ?? 0} warnings`} onClick={()=>onNavigate('control-center')}/></DashboardWidgetShell>;
    if (id === 'draft-pages') return <DashboardWidgetShell {...common} title="Draft Templates"><Metric icon={FilePenLine} label="Drafts" value={summary?.pages?.draft ?? 0} tone="#F59E0B" bg="rgba(245,158,11,.1)" darkMode={darkMode} onClick={()=>onNavigate('pages')}/></DashboardWidgetShell>;
    if (id === 'total-pages') return <DashboardWidgetShell {...common} title="Total Templates"><Metric icon={FileText} label="Templates" value={summary?.pages?.total ?? 0} darkMode={darkMode} onClick={()=>onNavigate('pages')}/></DashboardWidgetShell>;
    if (id === 'cro-experiments') return <DashboardWidgetShell {...common} title="CRO Experiments"><Metric icon={FlaskConical} label="Active workflows" value={activeExperiments} tone="#8B5CF6" bg="rgba(139,92,246,.1)" darkMode={darkMode} detail={`${Number(experimentStates.running||0)} running · ${Number(experimentStates.paused||0)} paused`} onClick={()=>onNavigate('experiments')}/></DashboardWidgetShell>;
    if (id === 'unread-submissions') return <DashboardWidgetShell {...common} title="Unread Submissions"><Metric icon={Inbox} label="Unread" value={summary?.forms?.unreadSubmissions ?? 0} tone="#5C6AC4" bg="rgba(92,106,196,.1)" darkMode={darkMode} onClick={()=>onNavigate('form-submissions')}/></DashboardWidgetShell>;
    if (id === 'saved-library') return <DashboardWidgetShell {...common} title="Saved Library"><Metric icon={Boxes} label="Saved resources" value={summary?.library?.saved ?? 0} tone="#5C6AC4" bg="rgba(92,106,196,.1)" darkMode={darkMode} onClick={()=>onNavigate('library')}/></DashboardWidgetShell>;
    if (id === 'marketplace-installs') return <DashboardWidgetShell {...common} title="Marketplace Installs"><Metric icon={Sparkles} label="Installed" value={summary?.marketplace?.installs ?? 0} tone="var(--vsn-green)" bg="rgba(var(--vsn-accent-rgb),.1)" darkMode={darkMode} onClick={()=>onNavigate('marketplace')}/></DashboardWidgetShell>;
    if (id === 'active-widgets') return <DashboardWidgetShell {...common} title="Active Widgets"><Metric icon={Puzzle} label="Enabled" value={widgetSummary.active ?? 0} tone="var(--vsn-green)" bg="rgba(var(--vsn-accent-rgb),.1)" darkMode={darkMode} detail={`${widgetSummary.total ?? 0} total`} onClick={()=>onNavigate('widgets')}/></DashboardWidgetShell>;
    if (id === 'ai-usage') return <DashboardWidgetShell {...common} title="AI Usage"><Metric icon={Sparkles} label="This month" value={summary?.ai?.monthlyUsage ?? 0} tone="#7C3AED" bg="rgba(124,58,237,.1)" darkMode={darkMode}/></DashboardWidgetShell>;
    if (id === 'backups') return <DashboardWidgetShell {...common} title="Backups"><Metric icon={DatabaseBackup} label="Available backups" value={summary?.backups?.total ?? 0} tone="#5C6AC4" bg="rgba(92,106,196,.1)" darkMode={darkMode} onClick={()=>onNavigate('backups')}/></DashboardWidgetShell>;
    if (id === 'active-campaigns') return <DashboardWidgetShell {...common} title="Active Campaigns" subtitle="Current campaign states"><CampaignStateChart campaigns={live.campaigns} darkMode={darkMode} onOpen={()=>onNavigate('campaigns')}/></DashboardWidgetShell>;
    if (id === 'live-monitor') return <DashboardWidgetShell {...common} title="Live System Monitor" subtitle="Refreshes every 15 seconds"><LiveMonitorWidget monitor={live.monitor} darkMode={darkMode}/></DashboardWidgetShell>;
    if (id === 'visitor-map') return <DashboardWidgetShell {...common} title="Visitor Map" subtitle="VSN storefront sessions · last 24 hours"><VisitorMapWidget visitors={live.visitors} darkMode={darkMode}/></DashboardWidgetShell>;
    if (id === 'continue-editing') return <DashboardWidgetShell {...common} title="Continue Editing" subtitle="Recently updated merchant pages" toolbar={<button type="button" className="vsn-dashboard-head-link" onClick={()=>onNavigate('pages')}>All pages <ArrowRight size={12}/></button>}><div className="vsn-dashboard-recent-list">{(summary?.recentPages||[]).length?(summary.recentPages||[]).map((page)=><a key={page.id} href={`/app/pages?open=${encodeURIComponent(page.id)}`}><span><strong style={{ color:text }}>{page.title}</strong><small style={{ color:muted }}>{String(page.template||'page').replace(/-/g,' ')} · {page.status} · {relativeTime(page.updatedAt)}</small></span><ArrowRight size={14} color={sub}/></a>):<div className="vsn-dashboard-empty" style={{ color:muted }}>No merchant pages yet. Create a page to start building.</div>}</div></DashboardWidgetShell>;
    if (id === 'workspace-snapshot') return <DashboardWidgetShell {...common} title="Workspace Snapshot" subtitle="Growth and form activity"><div className="vsn-dashboard-snapshot">{[[Megaphone,'Campaigns',summary?.growth?.campaigns??0],[FlaskConical,'CRO experiments',activeExperiments],[PanelTopOpen,'Floating elements',summary?.growth?.floatingElements??0],[Inbox,'Unread submissions',summary?.forms?.unreadSubmissions??0]].map(([Icon,label,value])=><button type="button" key={label} onClick={()=>onNavigate(label==='Campaigns'?'campaigns':label==='CRO experiments'?'experiments':label==='Floating elements'?'floating-elements':'form-submissions')}><Icon size={14}/><span style={{ color:muted }}>{label}</span><strong style={{ color:text }}>{value}</strong></button>)}</div></DashboardWidgetShell>;
    if (id === 'activity-timeline') return <DashboardWidgetShell {...common} title="Activity Timeline" subtitle="Recent workspace events"><div className="vsn-dashboard-activity">{activities.length?activities.map((item)=>{const Icon=activityIcons[item.kind]||Bell;return <div key={item.id}><Icon size={13} color={item.kind==='publish'?'var(--vsn-green)':'#5C6AC4'}/><span><strong style={{ color:text }}>{item.label}{item.pageTitle?` · ${item.pageTitle}`:''}</strong>{item.details?<small style={{ color:muted }}>{item.actor}{item.actor&&item.details?' · ':''}{item.details}</small>:null}</span><time style={{ color:sub }}><Clock3 size={10}/>{relativeTime(item.createdAt)}</time></div>}):<div className="vsn-dashboard-empty" style={{ color:muted }}>No workspace activity has been recorded yet.</div>}</div></DashboardWidgetShell>;
    if (id === 'plan-usage') return <DashboardWidgetShell {...common} title="Plan Usage"><PlanUsage plan={plan} planUsage={planUsage} darkMode={darkMode} onNavigate={onNavigate}/></DashboardWidgetShell>;
    if (id === 'recent-updates') return <DashboardWidgetShell {...common} title="Recent Updates" toolbar={<button type="button" className="vsn-dashboard-head-link" onClick={()=>onNavigate('changelog')}>View all <ArrowRight size={12}/></button>}><div className="vsn-dashboard-updates">{recentUpdates.length?recentUpdates.map((item)=><div key={item.version}><b>v{item.version}</b><span style={{ color:text }}>{item.summary}</span><small style={{ color:sub }}>{new Date(item.date).toLocaleDateString()}</small></div>):<div className="vsn-dashboard-empty" style={{ color:muted }}>No release notes available.</div>}</div></DashboardWidgetShell>;
    if (id === 'getting-started') return <DashboardWidgetShell {...common} title="Getting Started"><div className="vsn-dashboard-start-list">{[[PanelsTopLeft,'Templates','Create or edit responsive storefront templates.','pages'],[Settings,'Widgets','Choose which widgets are available in the editor.','widgets'],[Activity,'System Health','Review runtime, permissions and engine checks.','control-center']].map(([Icon,label,desc,target])=><button key={label} type="button" onClick={()=>onNavigate(target)}><Icon size={16}/><span><strong style={{ color:text }}>{label}</strong><small style={{ color:muted }}>{desc}</small></span><ArrowRight size={13}/></button>)}</div></DashboardWidgetShell>;
    return null;
  };

  return <div className="page-fade vsn-dashboard-page" style={{ padding:'28px 32px', maxWidth:1560, margin:'0 auto' }}>
    <div className="vsn-dashboard-page-head"><div><h1 style={{ color:text }}>Dashboard</h1><p style={{ color:muted }}>Welcome back, {userName}. Monitor VSN Builder, continue recent work and keep important store tools in one configurable view.</p></div><div><button className="dashboard-primary-action" type="button" onClick={()=>onNavigate('pages')}><PanelsTopLeft size={15}/> Templates</button><button className="dashboard-secondary-action" type="button" onClick={()=>onNavigate('marketplace')}><Boxes size={15}/> Marketplace</button><button className="dashboard-secondary-action" type="button" onClick={()=>onNavigate('pricing')}><CreditCard size={15}/> Plans & License</button></div></div>

    <div ref={gridRef} className="vsn-dashboard-layout" data-saving={fetcher.state !== 'idle' ? 'true' : 'false'}>{visibleIds.map((id)=><Fragment key={id}>{renderWidget(id)}</Fragment>)}</div>
    {!visibleIds.length ? <div className="vsn-dashboard-no-widgets" style={{ color:muted }}><SlidersHorizontal size={24}/><strong style={{ color:text }}>No dashboard widgets are visible</strong><span>Use Dashboard settings to enable the widgets you want to monitor.</span></div> : null}

    <VsnFloatingSettingsButton open={drawerOpen} onClick={()=>setDrawerOpen((current)=>!current)} label="Dashboard settings" />
    <DashboardWidgetDrawer open={drawerOpen} darkMode={darkMode} preferences={preferences} onClose={()=>setDrawerOpen(false)} onToggle={toggleWidget} onMove={moveWidget} onReset={resetDashboard}/>
    <div className="vsn-dashboard-version" style={{ color:sub }}>VSN Builder v{currentVersion}</div>
  </div>;
}
