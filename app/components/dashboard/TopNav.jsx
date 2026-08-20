import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { Search, Bell, HelpCircle, Moon, Sun, CheckCircle, AlertTriangle, ChevronDown, ArrowRight, Loader2, LogOut, Pin, Trash2, UserRound } from 'lucide-react';
import { VsnAnchoredPopover } from '../ui/VsnToolkit';
import { useVsnConfirm } from '../ui/VsnConfirmProvider';

const THEME_EMBED_HANDLE = 'vsn-page-renderer';

function inspectThemeExtensions(extensions) {
  const themeExtensions = (Array.isArray(extensions) ? extensions : []).filter((row) => row?.type === 'theme_app_extension');
  const entries = themeExtensions.flatMap((row) => Array.isArray(row?.activations) ? row.activations : []);
  const embed = entries.find((row) => row?.handle === THEME_EMBED_HANDLE || String(row?.handle || '').endsWith(`/${THEME_EMBED_HANDLE}`));
  if (!embed) return themeExtensions.length ? { status:'unknown', active:null, source:'app-api', reason:'EMBED_ENTRY_NOT_FOUND' } : null;
  const status = String(embed.status || '').toLowerCase();
  if (status === 'active') return { status:'active', active:true, source:'app-api', reason:'APP_API_ACTIVE', themeId:embed.activations?.[0]?.themeId || '' };
  if (status === 'available' || status === 'unavailable') return { status:'inactive', active:false, source:'app-api', reason:`APP_API_${status.toUpperCase()}`, themeId:embed.activations?.[0]?.themeId || '' };
  return { status:'unknown', active:null, source:'app-api', reason:'APP_API_STATUS_UNKNOWN' };
}

function useThemeEmbedStatus(serverStatus) {
  const [clientStatus, setClientStatus] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let disposed = false;
    const check = async () => {
      const extensions = typeof window !== 'undefined' ? window.shopify?.app?.extensions : null;
      if (typeof extensions !== 'function') { if (!disposed) setChecking(false); return; }
      try {
        const rows = await window.shopify.app.extensions();
        const result = inspectThemeExtensions(rows);
        if (!disposed) { setClientStatus(result); setChecking(false); }
      } catch (error) {
        console.warn('VSN theme extension status check failed:', error instanceof Error ? error.message : error);
        if (!disposed) setChecking(false);
      }
    };
    const onFocus = () => check();
    const onVisibility = () => { if (document.visibilityState === 'visible') check(); };
    check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { disposed = true; window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  return { effective:{ ...(serverStatus || {}), ...(clientStatus || {}) }, checking:checking && !clientStatus };
}

export default function TopNav({ ownerImage, userName, darkMode, onToggleDark, onNavigate, notifCount, themeEmbed, searchQuery, onSearchChange, searchResults = [], onSearchSelect, isOwner = false }) {
  const bg = darkMode ? '#111827' : '#FFFFFF'; const border = darkMode ? '#1F2937' : '#E5E7EB'; const text = darkMode ? '#F9FAFB' : '#1A1F36'; const muted = darkMode ? '#9CA3AF' : '#6B7280';
  const searchRef = useRef(null);
  const profileRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const uninstallFetcher = useFetcher();
  const confirm = useVsnConfirm();
  const { effective:themeStatus, checking:checkingTheme } = useThemeEmbedStatus(themeEmbed);
  useEffect(() => { const onKey = (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus(); } if (event.key === 'Escape' && document.activeElement === searchRef.current) { onSearchChange?.(''); searchRef.current?.blur(); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onSearchChange]);
  useEffect(() => {
    const payload = uninstallFetcher.data;
    if (payload?.intent !== 'app-uninstall') return;
    if (payload.success && payload.redirectUrl) window.top.location.assign(payload.redirectUrl);
    else if (payload.error) window.shopify?.toast?.show?.(payload.error, { isError:true, duration:5000 });
  }, [uninstallFetcher.data]);

  const requestUninstall = async () => {
    setProfileOpen(false);
    const approved = await confirm({ title:'Uninstall VSN Builder?', message:'This removes VSN Builder from this Shopify store. Shopify treats app uninstall as irreversible. Type UNINSTALL to continue.', confirmLabel:'Uninstall app', tone:'danger', requireText:'UNINSTALL' });
    if (!approved) return;
    uninstallFetcher.submit({ intent:'app-uninstall', source:'profile-menu' }, { method:'post', action:'/app' });
  };
  const nativePinHelp = () => {
    window.shopify?.toast?.show?.('Use Shopify’s native pin icon in the admin app header. Shopify does not expose app pin state or a pin API to embedded apps.', { duration:5500 });
  };
  const nativeLogoutHelp = () => {
    window.shopify?.toast?.show?.('Shopify sign-out is controlled by the Shopify account menu. Click your store/account name in Shopify Admin, then choose Log out.', { duration:5500 });
  };

  const showResults = Boolean(searchQuery?.trim());
  const editorUrl = themeStatus?.editorUrl || themeEmbed?.editorUrl || undefined;
  const themeBadge = checkingTheme && themeStatus?.status === 'unknown'
    ? <a href={editorUrl} target="_top" title="Checking the published theme app embed status." className="vsn-theme-status-badge is-checking"><Loader2 size={13}/><span>Checking theme…</span></a>
    : themeStatus?.status === 'active'
      ? <a href={editorUrl} target="_top" title={`VSN theme app embed is enabled${themeStatus?.themeName?` on ${themeStatus.themeName}`:''}.`} className="vsn-theme-status-badge is-active"><CheckCircle size={13}/><span>Theme Active</span></a>
      : themeStatus?.status === 'inactive'
        ? <a href={editorUrl} target="_top" title="VSN theme app embed is available but not active on the published theme. Open Shopify Theme Editor to activate it." className="vsn-theme-status-badge is-inactive"><AlertTriangle size={13}/><span>Theme Inactive</span></a>
        : <a href={editorUrl} target="_top" title="Theme status could not be verified automatically. Open Theme Editor to verify the VSN app embed." className="vsn-theme-status-badge is-unknown"><AlertTriangle size={13}/><span>Verify Theme</span></a>;

  return (<header style={{ height:60, background:bg, borderBottom:`1px solid ${border}`, display:'flex', alignItems:'center', padding:'0 24px', gap:12, position:'sticky', top:0, zIndex:90 }}>
    <button type="button" onClick={() => onNavigate?.('home')} className="vsn-topbar-brand" title="VSN Builder dashboard"><strong>VSN Builder</strong></button>
    <div style={{ flex:1, maxWidth:430, position:'relative' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, background:darkMode?'#1F2937':'#F9FAFB', border:`1px solid ${border}`, borderRadius:8, padding:'0 12px', height:36 }}><Search size={15} color={muted}/><input ref={searchRef} value={searchQuery} onChange={(e) => onSearchChange?.(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && searchResults[0]) { e.preventDefault(); onSearchSelect?.(searchResults[0]); } }} placeholder="Search VSN Builder... (⌘K)" style={{ border:'none', background:'transparent', outline:'none', fontSize:13, color:text, flex:1 }}/><kbd style={{ fontSize:9.5, color:muted, border:`1px solid ${border}`, borderRadius:4, padding:'2px 5px', background:bg }}>⌘K</kbd></div>
      {showResults ? <div className="dashboard-search-results" style={{ position:'absolute', left:0, right:0, top:43, background:bg, border:`1px solid ${border}`, borderRadius:10, boxShadow:'0 14px 36px rgba(0,0,0,.13)', overflow:'hidden', zIndex:120 }}>
        {searchResults.length ? searchResults.slice(0,10).map((result) => <button key={result.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onSearchSelect?.(result)} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 12px', border:0, borderBottom:`1px solid ${darkMode?'#202838':'#F2F3F4'}`, background:'transparent', color:text, textAlign:'left', cursor:'pointer' }}><div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:12.5, fontWeight:700 }}>{result.label}</div><div style={{ marginTop:2, fontSize:10.5, color:muted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{result.description}</div></div><span style={{ fontSize:10, color:muted, textTransform:'uppercase', letterSpacing:'.04em' }}>{result.type}</span><ArrowRight size={12} color={muted}/></button>) : <div style={{ padding:18, textAlign:'center', fontSize:12, color:muted }}>No matching VSN Builder results.</div>}
      </div> : null}
    </div>

    <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4 }}>
      {themeBadge}
      <button onClick={onToggleDark} className="dashboard-icon-button" title={darkMode?'Use light mode':'Use dark mode'}>{darkMode?<Sun size={16}/>:<Moon size={16}/>}</button>
      <button className="dashboard-icon-button" onClick={() => onNavigate('support')} title="Support"><HelpCircle size={16}/></button>
      <button className="dashboard-icon-button" onClick={() => onNavigate('notifications')} title="Notifications" style={{ position:'relative' }}><Bell size={16}/>{notifCount>0?<span style={{ position:'absolute', top:6, right:6, width:8, height:8, borderRadius:'50%', background:'#EF4444', border:`2px solid ${bg}` }}/>:null}</button>
      <button ref={profileRef} onClick={() => setProfileOpen((current)=>!current)} className="dashboard-profile-button" aria-expanded={profileOpen}>{ownerImage?.url?<img src={ownerImage.url} alt={ownerImage?.altText || 'Store owner'} style={{ width:26, height:26, borderRadius:'50%', objectFit:'cover' }}/>:<div style={{ width:26, height:26, borderRadius:'50%', display:'grid', placeItems:'center', background:'rgba(var(--vsn-accent-rgb),.14)', color:'var(--vsn-green-dark)', fontSize:10.5, fontWeight:800 }}>{String(userName||'U').trim().charAt(0).toUpperCase()||'U'}</div>}<span style={{ fontSize:13, fontWeight:500, color:text }}>{userName}</span><ChevronDown size={13} color={muted}/></button>
      <VsnAnchoredPopover open={profileOpen} anchorRef={profileRef} onClose={() => setProfileOpen(false)} minWidth={230} maxWidth={260} className="vsn-profile-popover">
        <div className="vsn-profile-menu">
          <button type="button" onClick={() => { setProfileOpen(false); onNavigate?.('profile'); }}><UserRound size={15}/><span><strong>Profile</strong><small>VSN account & store profile</small></span></button>
          <button type="button" onClick={nativePinHelp}><Pin size={15}/><span><strong>Pin app in Shopify</strong><small>Uses Shopify’s native pin control</small></span></button>
          <button type="button" onClick={nativeLogoutHelp}><LogOut size={15}/><span><strong>Sign out of Shopify</strong><small>Uses Shopify’s account menu</small></span></button>
          {isOwner ? <button type="button" className="danger" disabled={uninstallFetcher.state !== 'idle'} onClick={requestUninstall}><Trash2 size={15}/><span><strong>{uninstallFetcher.state !== 'idle' ? 'Uninstalling…' : 'Uninstall VSN Builder'}</strong><small>Remove this app from the store</small></span></button> : null}
        </div>
      </VsnAnchoredPopover>
    </div>
  </header>);
}
