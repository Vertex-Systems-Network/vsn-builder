import { COMMERCIAL_PLANS, PLAN_ORDER, quotaLabel } from '../../../config/commercialPlans.js';
import { LicenseSummary } from './License.jsx';
import PlanComparison from './PlanComparison.jsx';

import '../../../styles/dashboard-pricing-grid.css';

const faqs = [
  { q:'Are the displayed prices final?', a:'VSN displays the planned USD rates and 10-day trials. The merchant confirms the actual recurring price, trial and billing period on Shopify’s hosted App Pricing page.' },
  { q:'Where do I choose monthly or yearly billing?', a:'On Shopify’s hosted pricing page when that option is enabled for the plan. VSN no longer adds undocumented plan or interval query parameters to the Shopify URL.' },
  { q:'Do lower plans remove widgets from existing designs?', a:'No. VSN differentiates plans by systems and usage limits rather than hiding individual builder widgets. Existing content is not deleted by changing the selected plan.' },
];

function planFeatures(plan) {
  return [
    `${quotaLabel(plan.maxPages)} saved builder pages`,
    `${quotaLabel(plan.templateQuota)} Marketplace installs`,
    `${quotaLabel(plan.aiMonthly)} AI generations / month`,
    `${quotaLabel(plan.croExperiments)} active CRO experiments`,
    `${quotaLabel(plan.teamMembers)} collaboration seats`,
    plan.collaboration ? 'Collaboration & review included' : 'Single-user workflow',
    plan.enterpriseControls ? 'Enterprise hardening included' : 'Standard hardening',
    'All widgets included',
  ];
}

export default function Pricing({ currentPlan, entitlements, billingUrl, pricing, pricingReturn, subscriptionSync, shop, canManageBilling = false }) {
  return <s-page heading="8 paid plans for every stage">
    <s-stack direction="block" gap="base">
      <s-stack direction="block" gap="small-200">
        <s-paragraph color="subdued">Your Shopify plan maps directly to VSN entitlements. Every plan keeps the same visual widget library; capacity and advanced systems increase from Starter through Scale.</s-paragraph>
        <s-text color="subdued">Prices, trials, billing periods, upgrades and downgrades are confirmed in Shopify Admin.</s-text>
      </s-stack>

      <LicenseSummary plan={currentPlan} entitlements={entitlements} shop={shop} billingUrl={billingUrl} pricing={pricing} pricingReturn={pricingReturn} subscriptionSync={subscriptionSync} canManageBilling={canManageBilling} />

      {pricingReturn ? <s-banner tone={pricingReturn.shopMatches ? 'info' : 'critical'}>{pricingReturn.shopMatches ? <>Shopify returned <b>{pricingReturn.planHandle}</b>{pricingReturn.planKey?<> → {COMMERCIAL_PLANS[pricingReturn.planKey]?.name}</>:null}. This return signal is checked against the live Partner API contract before VSN changes entitlements.</> : <>The returned Shopify shop did not match this authenticated store, so the pricing signal was ignored.</>}</s-banner> : null}

      <div className="dashboard-pricing-grid">
        {PLAN_ORDER.map((key)=>{
          const plan = COMMERCIAL_PLANS[key];
          const active = currentPlan?.key === key;
          const popular = key === 'silver';
          const href = billingUrl || '';
          const shopifyHandle = pricing?.planHandles?.[key] || key;
          return <div className="dashboard-pricing-card" key={key}><s-section heading={plan.name}>
            <s-stack direction="block" gap="small-200">
              {popular || active ? <s-stack direction="inline" gap="small-200">{popular ? <s-badge tone="info">★ Most Popular</s-badge> : null}{active ? <s-badge tone="success">Current</s-badge> : null}</s-stack> : null}
              <s-paragraph color="subdued">{plan.description}</s-paragraph>
              <s-text color="subdued">Shopify handle: <code>{shopifyHandle}</code></s-text>
              <s-heading>${plan.monthlyUsd}/mo</s-heading>
              <s-text color="subdued">{plan.trialDays}-day free trial{plan.annualUsd ? ` · ${plan.annualUsd}/year` : ''}</s-text>
              <s-text color="subdued">Shopify Admin confirms the actual charge</s-text>
              {active ? <s-button disabled>Current plan</s-button>
                : !canManageBilling ? <s-badge>Billing management restricted</s-badge>
                : href ? <s-button variant={popular ? 'primary' : 'secondary'} href={href} target="_top">Review plans in Shopify</s-button>
                : <s-badge>Shopify App Pricing not configured</s-badge>}
              <s-divider/>
              <s-unordered-list>{planFeatures(plan).map((feature)=><s-list-item key={feature}>{feature}</s-list-item>)}</s-unordered-list>
            </s-stack>
          </s-section></div>;
        })}
      </div>

      <PlanComparison currentPlan={currentPlan} planHandles={pricing?.planHandles} />

      <s-banner tone="info" heading="Shopify App Pricing remains authoritative">VSN now links directly to Shopify’s hosted App Pricing page. It does not create Billing API subscriptions and it never treats a plan_handle query parameter as proof of an active contract.</s-banner>

      <s-section heading="Frequently Asked Questions">
        <s-stack direction="block" gap="small-200">{faqs.map((faq)=><details key={faq.q}><summary><s-text type="strong">{faq.q}</s-text></summary><s-paragraph color="subdued">{faq.a}</s-paragraph></details>)}</s-stack>
      </s-section>
    </s-stack>
  </s-page>;
}
