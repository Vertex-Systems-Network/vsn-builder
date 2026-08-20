import { useState } from 'react';
import { Check, Layers3, Sparkles, FlaskConical, Building2, ArrowRight, HelpCircle, ShieldCheck } from 'lucide-react';
import { COMMERCIAL_PLANS, PLAN_ORDER, quotaLabel } from '../../../config/commercialPlans.js';
import { LicenseSummary } from './License.jsx';

const icons = { core: Layers3, pro: Sparkles, cro: FlaskConical, agency: Building2 };
const accents = {
  core: { color:'#6B7280', bg:'rgba(107,114,128,.10)' },
  pro: { color:'var(--vsn-green-dark)', bg:'rgba(var(--vsn-accent-rgb),.12)' },
  cro: { color:'#5C6AC4', bg:'rgba(92,106,196,.11)' },
  agency: { color:'#7C3AED', bg:'rgba(124,58,237,.10)' },
};

const faqs = [
  { q:'Why are exact paid prices not hard-coded here?', a:'Shopify App Pricing hosts the authoritative plan selection and approval page. VSN shows entitlement differences, while Shopify shows the configured recurring price, trial and billing period.' },
  { q:'Where do I choose monthly or yearly billing?', a:'On Shopify’s hosted pricing page when that option is enabled for the plan. VSN no longer adds undocumented plan or interval query parameters to the Shopify URL.' },
  { q:'Do lower plans remove widgets from existing designs?', a:'No. VSN differentiates plans by systems and usage limits rather than hiding individual builder widgets. Existing content is not deleted by changing the selected plan.' },
];

function planFeatures(plan) {
  return [
    `${quotaLabel(plan.maxPages)} builder pages/templates`,
    `${quotaLabel(plan.templateQuota)} Marketplace installs`,
    `${quotaLabel(plan.aiMonthly)} AI generations / month`,
    `${quotaLabel(plan.croExperiments)} active CRO experiments`,
    `${quotaLabel(plan.teamMembers)} collaboration seats`,
    plan.collaboration ? 'Collaboration & review included' : 'Single-user workflow',
    plan.enterpriseControls ? 'Enterprise hardening included' : 'Standard hardening',
    'All widgets included',
  ];
}

export default function Pricing({ darkMode, currentPlan, entitlements, billingUrl, pricing, pricingReturn, subscriptionSync, shop, canManageBilling = false }) {
  const [openFaq, setOpenFaq] = useState(null);
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  const cardBg = darkMode ? '#1A1F2E' : '#FFFFFF';
  const border = darkMode ? '#2D3748' : '#E5E7EB';

  return <div className="page-fade" style={{ padding:'28px 32px', maxWidth:1480, margin:'0 auto' }}>
    <div style={{ textAlign:'center', marginBottom:38 }}>
      <h1 style={{ margin:0, fontSize:28, fontWeight:800, color:text }}>Free, Silver, Gold & Platinum</h1>
      <p style={{ margin:'8px auto 0', fontSize:14, color:muted, maxWidth:720 }}>Your Shopify plans map directly to VSN entitlements. Every plan keeps the same visual widget library; capacity and advanced systems increase from Free through Platinum.</p>
      <div style={{ marginTop:18, fontSize:12, color:muted }}>Prices, trials, billing periods, upgrades and downgrades are confirmed in Shopify Admin.</div>
    </div>

    <LicenseSummary darkMode={darkMode} plan={currentPlan} entitlements={entitlements} shop={shop} billingUrl={billingUrl} pricing={pricing} pricingReturn={pricingReturn} subscriptionSync={subscriptionSync} canManageBilling={canManageBilling} />

    {pricingReturn ? <div style={{ marginBottom:18, padding:14, borderRadius:11, border:`1px solid ${pricingReturn.shopMatches?'#BFDBFE':'#FECACA'}`, background:pricingReturn.shopMatches?(darkMode?'rgba(59,130,246,.08)':'#EFF6FF'):(darkMode?'rgba(239,68,68,.08)':'#FEF2F2'), color:pricingReturn.shopMatches?(darkMode?'#BFDBFE':'#1D4ED8'):(darkMode?'#FCA5A5':'#B91C1C'), fontSize:12.5, lineHeight:1.55 }}>{pricingReturn.shopMatches ? <>Shopify returned <b>{pricingReturn.planHandle}</b>{pricingReturn.planKey?<> → {COMMERCIAL_PLANS[pricingReturn.planKey]?.name}</>:null}. This return signal is checked against the live Partner API contract before VSN changes entitlements.</> : <>The returned Shopify shop did not match this authenticated store, so the pricing signal was ignored.</>}</div> : null}

    <div className="dashboard-pricing-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:18, marginBottom:42 }}>
      {PLAN_ORDER.map((key)=>{
        const plan = COMMERCIAL_PLANS[key];
        const Icon = icons[key];
        const accent = accents[key];
        const active = currentPlan?.key === key;
        const popular = key === 'pro';
        const paid = key !== 'core';
        const href = billingUrl || '';
        const shopifyHandle = pricing?.planHandles?.[key] || key;
        return <article key={key} style={{
          background: cardBg,
          borderRadius:16,
          border: popular ? '2px solid var(--vsn-green)' : `${active ? 2 : 1}px solid ${active ? 'var(--vsn-green)' : border}`,
          padding:'26px 22px',
          position:'relative',
          boxShadow: popular ? '0 8px 30px rgba(var(--vsn-accent-rgb),.12)' : (active ? '0 7px 24px rgba(var(--vsn-accent-rgb),.08)' : (darkMode ? 'none' : '0 2px 8px rgba(0,0,0,.04)')),
          minWidth:0,
        }}>
          {popular ? <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'var(--vsn-green)', color:'white', fontSize:10.5, fontWeight:700, padding:'4px 13px', borderRadius:20, whiteSpace:'nowrap' }}>★ Most Popular</div> : null}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:accent.bg, display:'grid', placeItems:'center', color:accent.color }}><Icon size={20}/></div>
            {active ? <span style={{ fontSize:10.5, fontWeight:700, color:'#2E7D32', background:'rgba(var(--vsn-accent-rgb),.12)', padding:'4px 8px', borderRadius:20 }}>Current</span> : null}
          </div>
          <div style={{ fontSize:17, fontWeight:800, color:text, marginTop:16 }}>{plan.name}</div>
          <div style={{ fontSize:12, color:muted, lineHeight:1.55, minHeight:57, marginTop:4 }}>{plan.description}</div>
          <div style={{ fontSize:10.5, color:muted, marginTop:6 }}>Shopify handle: <code>{shopifyHandle}</code></div>
          <div style={{ margin:'18px 0 4px', color:text }}>
            {paid ? <><span style={{ fontSize:23, fontWeight:800 }}>Shopify priced</span><div style={{ fontSize:11.5, color:muted, marginTop:3 }}>Authoritative price shown in Shopify Admin</div></> : <><span style={{ fontSize:36, fontWeight:800 }}>$0</span><span style={{ fontSize:13, color:muted }}>/mo</span><div style={{ fontSize:11.5, color:muted, marginTop:2 }}>Free entitlement profile</div></>}
          </div>
          <div style={{ marginTop:18 }}>
            {active ? <div style={{ width:'100%', padding:'10px', borderRadius:9, border:`1px solid ${border}`, textAlign:'center', fontSize:12.5, fontWeight:700, color:muted }}>Current plan</div>
              : !canManageBilling ? <div style={{ width:'100%', boxSizing:'border-box', padding:'10px', borderRadius:9, border:`1px solid ${border}`, textAlign:'center', fontSize:12, color:muted }}>Billing management restricted</div>
              : href ? <a href={href} target="_top" style={{ width:'100%', boxSizing:'border-box', padding:'10px', borderRadius:9, border:'none', background:popular?'var(--vsn-green)':accent.color, color:'#fff', fontSize:12.5, fontWeight:700, textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>Review plans in Shopify <ArrowRight size={14}/></a>
              : <div style={{ width:'100%', boxSizing:'border-box', padding:'10px', borderRadius:9, border:`1px solid ${border}`, textAlign:'center', fontSize:12, color:muted }}>Shopify App Pricing not configured</div>}
          </div>
          <div style={{ borderTop:`1px solid ${border}`, paddingTop:18, marginTop:20 }}>
            {planFeatures(plan).map((feature)=><div key={feature} style={{ display:'flex', alignItems:'flex-start', gap:9, marginBottom:9 }}><Check size={14} color="var(--vsn-green)" style={{ flexShrink:0, marginTop:1 }}/><span style={{ fontSize:12, lineHeight:1.45, color:text }}>{feature}</span></div>)}
          </div>
        </article>;
      })}
    </div>

    <div style={{ marginBottom:34, padding:17, border:`1px solid ${border}`, borderRadius:12, background:cardBg, display:'flex', gap:12, alignItems:'flex-start' }}><ShieldCheck size={20} color="#5C6AC4"/><div><div style={{ fontSize:13, fontWeight:700, color:text }}>Shopify App Pricing remains authoritative</div><div style={{ fontSize:12, color:muted, lineHeight:1.6, marginTop:3 }}>VSN now links directly to Shopify’s hosted App Pricing page. It does not create Billing API subscriptions and it never treats a plan_handle query parameter as proof of an active contract.</div></div></div>

    <div style={{ maxWidth:720, margin:'0 auto' }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:text, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}><HelpCircle size={18} color="var(--vsn-green)"/> Frequently Asked Questions</h2>
      {faqs.map((faq,index)=><div key={faq.q} style={{ background:cardBg, borderRadius:10, border:`1px solid ${border}`, marginBottom:10, overflow:'hidden' }}>
        <button type="button" onClick={()=>setOpenFaq(openFaq===index?null:index)} style={{ width:'100%', padding:'16px 18px', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, textAlign:'left' }}><span style={{ fontSize:14, fontWeight:600, color:text }}>{faq.q}</span><span aria-hidden="true" style={{ color:muted, transform:openFaq===index?'rotate(180deg)':'none', transition:'transform .2s', flexShrink:0 }}>▾</span></button>
        {openFaq===index ? <div style={{ padding:'0 18px 16px', fontSize:13, color:muted, lineHeight:1.65 }}>{faq.a}</div> : null}
      </div>)}
    </div>
  </div>;
}
