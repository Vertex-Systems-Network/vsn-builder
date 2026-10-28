import { useFetcher } from 'react-router';
import { buildBillingLifecycle } from '../../../config/billingLifecycle.js';
import { formatDate as formatUtcDate } from '../../../utils/format-date.js';

function formatDate(value, withTime = false) {
  return formatUtcDate(value, withTime ? 'datetime' : 'date');
}

function pendingTitle(kind) {
  if (kind === 'upgrade') return 'Upgrade pending';
  if (kind === 'downgrade') return 'Downgrade pending';
  if (kind === 'cancellation') return 'Cancellation scheduled';
  return 'Plan update pending';
}

export function LicenseSummary({ plan, entitlements, shop, billingUrl, pricing, pricingReturn, subscriptionSync, canManageBilling = false }) {
  const refresh = useFetcher();
  const current = plan || { key:'inactive', name:'No active subscription', maxPages:0, forms:false, globalLibrary:false, backups:false, subscription:null, developerMode:false };
  const lifecycle = buildBillingLifecycle(current);
  const statusTone = ['success','info','warning','critical'].includes(lifecycle.statusTone) ? lifecycle.statusTone : 'neutral';
  const syncConfig = subscriptionSync?.config || null;
  const refreshBusy = refresh.state !== 'idle';
  const refreshResult = refresh.data || null;
  const refreshFailed = refreshResult && (refreshResult.success === false || refreshResult.ok === false);
  const productionVerification = !entitlements?.developerMode;
  const features = [
    { label: 'Page allowance', value: current.maxPages >= 1000 ? 'Extended' : `${current.maxPages} pages` },
    { label: 'Forms', value: current.forms ? 'Included' : 'Not included' },
    { label: 'Global library', value: current.globalLibrary ? 'Included' : 'Local only' },
    { label: 'Backups', value: current.backups ? 'Included' : 'Manual export' },
  ];
  const cycle = [
    { label: 'Billing period', value: lifecycle.developerMode?'Developer simulation':lifecycle.billingPeriodLabel },
    { label: 'Current cycle', value: lifecycle.currentCycleStart&&lifecycle.currentCycleEnd?`${formatDate(lifecycle.currentCycleStart)} → ${formatDate(lifecycle.currentCycleEnd)}`:'Not reported' },
    { label: 'Last verified', value: lifecycle.verifiedAt?formatDate(lifecycle.verifiedAt,true):(lifecycle.developerMode?'Not required':'Not verified') },
  ];
  const tile = (item) => <s-box key={item.label} background="subdued" borderRadius="base" padding="small-200 base"><s-stack direction="block" gap="small-100"><s-text color="subdued">{item.label}</s-text><s-text type="strong">{item.value}</s-text></s-stack></s-box>;

  return <s-section heading="Current Plan & License" accessibilityLabel="Current plan and license">
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base">
        <s-paragraph color="subdued">Verified Shopify billing lifecycle and the capabilities currently available to this store.</s-paragraph>
        <s-stack direction="inline" gap="small-200">
          {productionVerification ? <refresh.Form method="post"><input type="hidden" name="intent" value="billing-refresh"/><s-button type="submit" icon="refresh" loading={refreshBusy || undefined} disabled={refreshBusy}>{refreshBusy?'Verifying…':'Refresh Shopify status'}</s-button></refresh.Form> : null}
          {billingUrl && canManageBilling ? <s-button href={billingUrl} target="_top" icon="credit-card">Manage plan in Shopify</s-button> : null}
          {!canManageBilling ? <s-badge icon="lock">Billing changes restricted</s-badge> : null}
        </s-stack>
      </s-stack>

      {refreshResult ? <s-banner tone={refreshFailed ? 'critical' : 'success'}>{refreshResult.error || refreshResult.message || 'Shopify billing status refreshed.'}</s-banner> : null}

      <s-stack direction="block" gap="small-200">
        <s-stack direction="inline" gap="small-200" alignItems="center"><s-heading>{lifecycle.currentName} Plan</s-heading><s-badge tone={statusTone}>{lifecycle.statusLabel}</s-badge></s-stack>
        <s-text color="subdued">Store: {shop || 'Current Shopify store'}{lifecycle.planHandle ? ` · Shopify key: ${lifecycle.planHandle}` : ''}</s-text>
        <s-text color="subdued">Billing provider: {pricing?.provider === 'shopify-app-pricing' ? 'Shopify App Pricing' : 'Not configured'}{pricing?.mode ? ` · ${pricing.mode}` : ''}</s-text>
        <s-text color="subdued">Entitlement authority: {entitlements?.source || current.entitlementSource || 'unknown'}{entitlements?.verified ? ' · verified' : entitlements?.developerMode ? ' · developer simulation' : ' · fail-closed'}</s-text>
      </s-stack>

      <s-grid gridTemplateColumns="@container (inline-size > 700px) repeat(4, 1fr), 1fr 1fr" gap="small-200">{features.map(tile)}</s-grid>
      <s-divider/>
      <s-grid gridTemplateColumns="@container (inline-size > 600px) repeat(3, 1fr), 1fr" gap="small-200">{cycle.map(tile)}</s-grid>

      {lifecycle.trialEndsAt ? <s-banner tone="info">Trial ends {formatDate(lifecycle.trialEndsAt)}{lifecycle.trialDaysRemaining?` · ${lifecycle.trialDaysRemaining} day${lifecycle.trialDaysRemaining===1?'':'s'} remaining`:''}</s-banner> : null}

      {lifecycle.pendingKind ? <s-banner tone="warning" heading={pendingTitle(lifecycle.pendingKind)}>{lifecycle.pendingKind==='cancellation' ? <>Paid access ends{lifecycle.cancelEffectiveOn?` on ${formatDate(lifecycle.cancelEffectiveOn)}`:lifecycle.currentCycleEnd?` after ${formatDate(lifecycle.currentCycleEnd)}`:''}.</> : <>{lifecycle.currentName} → {lifecycle.pendingName}{lifecycle.pendingBillingPeriodLabel?` · ${lifecycle.pendingBillingPeriodLabel}`:''}{lifecycle.pendingHandle?` · Shopify key ${lifecycle.pendingHandle}`:''}.</>}</s-banner> : null}

      {pricingReturn?.pendingVerification ? <s-text color="subdued">Shopify returned key <code>{pricingReturn.planHandle}</code>; VSN is waiting for Partner API verification before changing entitlements.</s-text> : null}

      {lifecycle.lastSyncError ? <s-banner tone="warning" heading="Verification warning.">{lifecycle.lastSyncError}{lifecycle.lastSyncErrorAt?` · ${formatDate(lifecycle.lastSyncErrorAt,true)}`:''}</s-banner> : null}

      {productionVerification && syncConfig && !syncConfig.configured ? <s-banner tone="critical" heading="Shopify subscription verification is not configured.">{syncConfig.issues?.length ? syncConfig.issues.join(' ') : null}</s-banner> : null}
    </s-stack>
  </s-section>;
}

export default function License(props) {
  return <s-page heading="Plans & License"><s-stack direction="block" gap="base"><s-paragraph color="subdued">Your Shopify-managed subscription, billing lifecycle and VSN Builder access.</s-paragraph><LicenseSummary {...props}/></s-stack></s-page>;
}
