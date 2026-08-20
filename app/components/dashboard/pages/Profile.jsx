import { Store, CreditCard, Mail, User, CheckCircle, Globe2, ShieldCheck } from 'lucide-react';

export default function Profile({ ownerImage, fullName, emailAddress, shopUrl, shopProfile = {}, plan, darkMode }) {
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? '#2D3748' : '#E5E7EB';
  const card = { background: darkMode ? '#1A1F2E' : '#FFFFFF', borderRadius: 12, border: `1px solid ${border}` };
  const input = { width: '100%', height: 40, padding: '0 12px', borderRadius: 8, fontSize: 13, color: text, border: `1px solid ${border}`, background: darkMode ? '#111827' : '#F9FAFB', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif' };
  const domain = shopProfile?.primaryDomain?.host || shopProfile?.myshopifyDomain || shopUrl || '';
  const storeName = shopProfile?.name || domain || 'Shopify store';
  const planName = plan?.name || 'Current plan';
  const subscriptionStatus = plan?.subscription?.status || 'active';
  const ownerInitials = String(fullName || 'SO').split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]).join('').toUpperCase();

  return (<div className="page-fade" style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
    <div style={{ marginBottom: 28 }}><h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: text }}>Store Owner Profile</h1><p style={{ margin: '4px 0 0', fontSize: 14, color: muted }}>Live owner and store information from Shopify.</p></div>

    <div style={{ ...card, padding: 28, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      {ownerImage?.url ? <img src={ownerImage.url} alt={ownerImage?.altText || fullName || 'Store owner'} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', display: 'block' }}/> : <div style={{ width: 88, height: 88, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(var(--vsn-accent-rgb),.14)', color: 'var(--vsn-green-dark)', fontSize: 24, fontWeight: 800 }}>{ownerInitials || 'SO'}</div>}
      <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontSize: 20, fontWeight: 800, color: text }}>{fullName || 'Store owner'}</div><div style={{ fontSize: 13, color: muted, marginTop: 2 }}>{emailAddress || 'Owner email unavailable'}</div><div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}><div className="profile-pill profile-pill-success"><ShieldCheck size={13}/><span>Shopify store owner</span></div><div className="profile-pill"><Store size={13}/><span>{storeName}</span></div></div></div>
    </div>

    <div style={{ ...card, padding: 24, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 20 }}>Account Information</div>
      {[{ label: 'Full Name', value: fullName, icon: User }, { label: 'Email Address', value: emailAddress, icon: Mail }, { label: 'Shopify Store URL', value: shopProfile?.myshopifyDomain || shopUrl, icon: Store }, { label: 'Primary Domain', value: domain, icon: Globe2 }].map((item) => { const Icon = item.icon; return <label key={item.label} style={{ display: 'grid', gap: 6, marginBottom: 16 }}><span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: muted }}><Icon size={12}/>{item.label}</span><input disabled value={item.value || ''} readOnly style={input}/></label>; })}
    </div>

    <div style={{ ...card, padding: 24 }}><div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 16 }}>Subscription</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }} className="profile-plan-grid">{[
      { label: 'Current Plan', value: planName, icon: CreditCard, color: 'var(--vsn-green)' },
      { label: 'Status', value: subscriptionStatus, icon: CheckCircle, color: '#5C6AC4' },
      { label: 'Page Allowance', value: Number.isFinite(plan?.maxPages) ? String(plan.maxPages) : 'Unlimited', icon: Store, color: '#8B5CF6' },
    ].map((item) => { const Icon = item.icon; return <div key={item.label} style={{ background: darkMode ? '#111827' : '#F9FAFB', borderRadius: 8, padding: '14px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><Icon size={16} color={item.color}/><span style={{ fontSize: 11, color: muted, fontWeight: 500 }}>{item.label}</span></div><div style={{ fontSize: 15, fontWeight: 700, color: text, textTransform: item.label === 'Status' ? 'capitalize' : 'none' }}>{item.value}</div></div>; })}</div></div>
  </div>);
}
