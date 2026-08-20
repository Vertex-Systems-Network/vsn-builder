import { useFetcher } from 'react-router';
import { AlertTriangle, ArrowRightLeft, ArrowUpRight, Boxes, CalendarDays, CheckCircle, Clock3, CreditCard, DatabaseBackup, Lock, RefreshCw, ShieldCheck, Store } from 'lucide-react';
import { buildBillingLifecycle } from '../../../config/billingLifecycle.js';

function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
}

function statusColors(tone, darkMode) {
  const tones = {
    success: darkMode ? ['#86EFAC','rgba(34,197,94,.10)','#166534'] : ['#166534','#F0FDF4','#BBF7D0'],
    info: darkMode ? ['#93C5FD','rgba(59,130,246,.10)','#1E40AF'] : ['#1D4ED8','#EFF6FF','#BFDBFE'],
    warning: darkMode ? ['#FCD34D','rgba(245,158,11,.10)','#92400E'] : ['#92400E','#FFFBEB','#FDE68A'],
    critical: darkMode ? ['#FCA5A5','rgba(239,68,68,.10)','#991B1B'] : ['#B91C1C','#FEF2F2','#FECACA'],
    neutral: darkMode ? ['#D1D5DB','rgba(107,114,128,.10)','#374151'] : ['#4B5563','#F9FAFB','#E5E7EB'],
  };
  const [color, background, border] = tones[tone] || tones.neutral;
  return { color, background, border };
}

function pendingTitle(kind) {
  if (kind === 'upgrade') return 'Upgrade pending';
  if (kind === 'downgrade') return 'Downgrade pending';
  if (kind === 'cancellation') return 'Cancellation scheduled';
  return 'Plan update pending';
}

export function LicenseSummary({ darkMode, plan, entitlements, shop, billingUrl, pricing, pricingReturn, subscriptionSync, canManageBilling = false }) {
  const refresh = useFetcher();
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? '#2D3748' : '#E5E7EB';
  const current = plan || { key:'core', name:'Free', maxPages:5, forms:true, globalLibrary:false, backups:false, subscription:null, developerMode:true };
  const lifecycle = buildBillingLifecycle(current);
  const tone = statusColors(lifecycle.statusTone, darkMode);
  const syncConfig = subscriptionSync?.config || null;
  const refreshBusy = refresh.state !== 'idle';
  const refreshResult = refresh.data || null;
  const productionVerification = !entitlements?.developerMode;
  const features = [
    { icon: Boxes, label: 'Page allowance', value: current.maxPages >= 1000 ? 'Extended' : `${current.maxPages} pages` },
    { icon: ShieldCheck, label: 'Forms', value: current.forms ? 'Included' : 'Not included' },
    { icon: Store, label: 'Global library', value: current.globalLibrary ? 'Included' : 'Local only' },
    { icon: DatabaseBackup, label: 'Backups', value: current.backups ? 'Included' : 'Manual export' },
  ];

  return <section aria-label="Current plan and license" style={{ marginBottom:28 }}>
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:12 }}>
      <div><h2 style={{ margin:0, fontSize:17, fontWeight:800, color:text }}>Current Plan & License</h2><p style={{ margin:'4px 0 0', fontSize:12.5, color:muted }}>Verified Shopify billing lifecycle and the capabilities currently available to this store.</p></div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {productionVerification ? <refresh.Form method="post"><input type="hidden" name="intent" value="billing-refresh"/><button type="submit" disabled={refreshBusy} className="dashboard-secondary-action" style={{ cursor:refreshBusy?'wait':'pointer' }}><RefreshCw size={14} style={refreshBusy?{animation:'vsn-spin .7s linear infinite'}:undefined}/>{refreshBusy?' Verifying…':' Refresh Shopify status'}</button></refresh.Form> : null}
        {billingUrl && canManageBilling ? <a href={billingUrl} target="_top" className="dashboard-secondary-action" style={{ textDecoration:'none' }}><CreditCard size={14}/> Manage plan in Shopify <ArrowUpRight size={13}/></a> : null}
        {!canManageBilling ? <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11.5, color:muted, padding:'8px 10px', border:`1px solid ${border}`, borderRadius:8 }}><Lock size={13}/> Billing changes restricted</span> : null}
      </div>
    </div>

    {refreshResult ? <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:9, border:`1px solid ${refreshResult.success===false||refreshResult.ok===false?'#FECACA':'#BBF7D0'}`, background:refreshResult.success===false||refreshResult.ok===false?(darkMode?'rgba(239,68,68,.08)':'#FEF2F2'):(darkMode?'rgba(34,197,94,.08)':'#F0FDF4'), color:refreshResult.success===false||refreshResult.ok===false?(darkMode?'#FCA5A5':'#B91C1C'):(darkMode?'#86EFAC':'#166534'), fontSize:11.5 }}>{refreshResult.error || refreshResult.message || 'Shopify billing status refreshed.'}</div> : null}

    <div style={{ background:darkMode?'#1A1F2E':'#FFFFFF', borderRadius:12, border:`1px solid ${tone.border}`, padding:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <div style={{ width:44, height:44, borderRadius:11, background:tone.background, color:tone.color, display:'grid', placeItems:'center' }}><CheckCircle size={20}/></div>
        <div style={{ minWidth:200, flex:'1 1 280px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}><strong style={{ fontSize:16, color:text }}>{lifecycle.currentName} Plan</strong><span style={{ fontSize:10.5, fontWeight:700, color:tone.color, background:tone.background, border:`1px solid ${tone.border}`, padding:'3px 8px', borderRadius:20 }}>{lifecycle.statusLabel}</span></div>
          <div style={{ marginTop:4, fontSize:12, color:muted }}>Store: {shop || 'Current Shopify store'}{lifecycle.planHandle ? ` · Shopify key: ${lifecycle.planHandle}` : ''}</div>
          <div style={{ marginTop:3, fontSize:10.5, color:muted }}>Billing provider: {pricing?.provider === 'shopify-app-pricing' ? 'Shopify App Pricing' : 'Not configured'}{pricing?.mode ? ` · ${pricing.mode}` : ''}</div>
          <div style={{ marginTop:3, fontSize:10.5, color:muted }}>Entitlement authority: {entitlements?.source || current.entitlementSource || 'unknown'}{entitlements?.verified ? ' · verified' : entitlements?.developerMode ? ' · developer simulation' : ' · fail-closed'}</div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(120px,1fr))', gap:8, flex:'1 1 320px' }}>
          {features.map((item)=>{const Icon=item.icon;return <div key={item.label} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', border:`1px solid ${border}`, borderRadius:9, background:darkMode?'#171C28':'rgba(255,255,255,.76)' }}><Icon size={14} color="#6B7280"/><span style={{ minWidth:0 }}><small style={{ display:'block', color:muted, fontSize:10.5 }}>{item.label}</small><strong style={{ display:'block', marginTop:1, color:text, fontSize:11.5 }}>{item.value}</strong></span></div>})}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:9, marginTop:16, paddingTop:14, borderTop:`1px solid ${border}` }}>
        <div style={{ padding:'10px 11px', border:`1px solid ${border}`, borderRadius:9 }}><small style={{ display:'block', color:muted }}>Billing period</small><strong style={{ display:'block', marginTop:3, color:text, fontSize:12 }}>{lifecycle.developerMode?'Developer simulation':lifecycle.billingPeriodLabel}</strong></div>
        <div style={{ padding:'10px 11px', border:`1px solid ${border}`, borderRadius:9 }}><small style={{ display:'block', color:muted }}>Current cycle</small><strong style={{ display:'block', marginTop:3, color:text, fontSize:12 }}>{lifecycle.currentCycleStart&&lifecycle.currentCycleEnd?`${formatDate(lifecycle.currentCycleStart)} → ${formatDate(lifecycle.currentCycleEnd)}`:'Not reported'}</strong></div>
        <div style={{ padding:'10px 11px', border:`1px solid ${border}`, borderRadius:9 }}><small style={{ display:'block', color:muted }}>Last verified</small><strong style={{ display:'block', marginTop:3, color:text, fontSize:12 }}>{lifecycle.verifiedAt?formatDate(lifecycle.verifiedAt,true):(lifecycle.developerMode?'Not required':'Not verified')}</strong></div>
      </div>

      {lifecycle.trialEndsAt ? <div style={{ marginTop:12, padding:'11px 12px', borderRadius:9, border:'1px solid #BFDBFE', background:darkMode?'rgba(59,130,246,.08)':'#EFF6FF', color:darkMode?'#BFDBFE':'#1D4ED8', fontSize:11.5, display:'flex', alignItems:'center', gap:8 }}><Clock3 size={14}/>Trial ends {formatDate(lifecycle.trialEndsAt)}{lifecycle.trialDaysRemaining?` · ${lifecycle.trialDaysRemaining} day${lifecycle.trialDaysRemaining===1?'':'s'} remaining`:''}</div> : null}

      {lifecycle.pendingKind ? <div style={{ marginTop:12, padding:'11px 12px', borderRadius:9, border:'1px solid #FDE68A', background:darkMode?'rgba(245,158,11,.08)':'#FFFBEB', color:darkMode?'#FCD34D':'#92400E', fontSize:11.5, display:'flex', alignItems:'flex-start', gap:8 }}><ArrowRightLeft size={14} style={{ marginTop:1 }}/><div><strong>{pendingTitle(lifecycle.pendingKind)}</strong>{lifecycle.pendingKind==='cancellation' ? <> · access moves to Free{lifecycle.cancelEffectiveOn?` on ${formatDate(lifecycle.cancelEffectiveOn)}`:lifecycle.currentCycleEnd?` after ${formatDate(lifecycle.currentCycleEnd)}`:''}.</> : <> · {lifecycle.currentName} → {lifecycle.pendingName}{lifecycle.pendingBillingPeriodLabel?` · ${lifecycle.pendingBillingPeriodLabel}`:''}{lifecycle.pendingHandle?` · Shopify key ${lifecycle.pendingHandle}`:''}.</>}</div></div> : null}

      {pricingReturn?.pendingVerification ? <div style={{ marginTop:12, color:muted, fontSize:11.5, display:'flex', alignItems:'center', gap:8 }}><ShieldCheck size={13}/>Shopify returned key <code>{pricingReturn.planHandle}</code>; VSN is waiting for Partner API verification before changing entitlements.</div> : null}

      {lifecycle.lastSyncError ? <div style={{ marginTop:12, padding:'11px 12px', borderRadius:9, border:'1px solid #FDE68A', background:darkMode?'rgba(245,158,11,.08)':'#FFFBEB', color:darkMode?'#FCD34D':'#92400E', fontSize:11.5, display:'flex', alignItems:'flex-start', gap:8 }}><AlertTriangle size={14} style={{ marginTop:1 }}/><div><strong>Verification warning.</strong> {lifecycle.lastSyncError}{lifecycle.lastSyncErrorAt?` · ${formatDate(lifecycle.lastSyncErrorAt,true)}`:''}</div></div> : null}

      {productionVerification && syncConfig && !syncConfig.configured ? <div style={{ marginTop:12, padding:'11px 12px', borderRadius:9, border:'1px solid #FECACA', background:darkMode?'rgba(239,68,68,.08)':'#FEF2F2', color:darkMode?'#FCA5A5':'#B91C1C', fontSize:11.5 }}><strong>Shopify subscription verification is not configured.</strong>{syncConfig.issues?.length ? <div style={{ marginTop:4 }}>{syncConfig.issues.join(' ')}</div> : null}</div> : null}
    </div>
  </section>;
}

export default function License(props) {
  const text = props.darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = props.darkMode ? '#9CA3AF' : '#6B7280';
  return <div className="page-fade" style={{ padding:'28px 32px', maxWidth:1100, margin:'0 auto' }}><div style={{ marginBottom:20 }}><h1 style={{ margin:0, fontSize:22, fontWeight:800, color:text }}>Plans & License</h1><p style={{ margin:'4px 0 0', fontSize:13.5, color:muted }}>Your Shopify-managed subscription, billing lifecycle and VSN Builder access.</p></div><LicenseSummary {...props}/></div>;
}
