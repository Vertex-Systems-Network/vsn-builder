import { COMMERCIAL_PLANS, PLAN_FEATURE_ROWS, PLAN_ORDER } from "../../../config/commercialPlans.js";
import "../../../styles/plan-comparison.css";

export default function PlanComparison({ currentPlan, planHandles = {} }) {
  return <s-section heading="Compare all 8 paid plans">
    <s-paragraph color="subdued">Every plan is paid and includes a 10-day Shopify-managed trial. Feature access and usage caps apply to active subscriptions.</s-paragraph>
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- lets keyboard users scroll the wide comparison table */}
    <div className="plan-comparison-scroll" role="region" aria-label="Plan comparison" tabIndex="0">
      <table className="plan-comparison-table">
        <thead>
          <tr><th scope="col">Plan features</th>{PLAN_ORDER.map((key) => {
            const plan = COMMERCIAL_PLANS[key];
            return <th scope="col" key={key}>
              <span className="plan-comparison-name">{plan.name}</span>
              {currentPlan?.key === key ? <span className="plan-comparison-current">Current</span> : null}
              <span className="plan-comparison-price">${plan.monthlyUsd}/mo</span>
              {plan.annualUsd ? <span className="plan-comparison-annual">${plan.annualUsd}/yr annual option</span> : null}
              <span className="plan-comparison-handle">{planHandles[key] || plan.shopifyHandle}</span>
            </th>;
          })}</tr>
        </thead>
        <tbody>{PLAN_FEATURE_ROWS.map((row) => <tr key={row.key}>
          <th scope="row">{row.label}</th>
          {PLAN_ORDER.map((key) => <td key={key}>{row.format(COMMERCIAL_PLANS[key][row.key])}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </s-section>;
}
