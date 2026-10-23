export default function Profile({ ownerImage, fullName, emailAddress, shopUrl, shopProfile = {}, plan }) {
  const domain = shopProfile?.primaryDomain?.host || shopProfile?.myshopifyDomain || shopUrl || '';
  const storeName = shopProfile?.name || domain || 'Shopify store';
  const planName = plan?.name || 'Current plan';
  const subscriptionStatus = plan?.subscription?.status || 'active';
  const ownerInitials = String(fullName || 'SO').split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]).join('').toUpperCase();
  const fields = [{ label: 'Full Name', value: fullName }, { label: 'Email Address', value: emailAddress }, { label: 'Shopify Store URL', value: shopProfile?.myshopifyDomain || shopUrl }, { label: 'Primary Domain', value: domain }];
  const subscription = [
    { label: 'Current Plan', value: planName },
    { label: 'Status', value: subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1) },
    { label: 'Page Allowance', value: Number.isFinite(plan?.maxPages) ? String(plan.maxPages) : 'Unlimited' },
  ];

  return <s-page heading="Store Owner Profile" inlineSize="small">
    <s-stack direction="block" gap="base">
      <s-paragraph color="subdued">Live owner and store information from Shopify.</s-paragraph>
      <s-section>
        <s-stack direction="inline" gap="base" alignItems="center">
          {ownerImage?.url ? <s-avatar src={ownerImage.url} alt={ownerImage?.altText || fullName || 'Store owner'} size="large"/> : <s-avatar initials={ownerInitials || 'SO'} alt={fullName || 'Store owner'} size="large"/>}
          <s-stack direction="block" gap="small-200">
            <s-heading>{fullName || 'Store owner'}</s-heading>
            <s-text color="subdued">{emailAddress || 'Owner email unavailable'}</s-text>
            <s-stack direction="inline" gap="small-200"><s-badge tone="success" icon="check-circle">Shopify store owner</s-badge><s-badge icon="store">{storeName}</s-badge></s-stack>
          </s-stack>
        </s-stack>
      </s-section>
      <s-section heading="Account Information">
        <s-stack direction="block" gap="base">{fields.map((item) => <s-text-field key={item.label} label={item.label} value={item.value || ''} readOnly disabled/>)}</s-stack>
      </s-section>
      <s-section heading="Subscription">
        <s-grid gridTemplateColumns="@container (inline-size > 500px) repeat(3, 1fr), 1fr" gap="base">{subscription.map((item) => <s-box key={item.label} background="subdued" borderRadius="base" padding="base"><s-stack direction="block" gap="small-100"><s-text color="subdued">{item.label}</s-text><s-text type="strong">{item.value}</s-text></s-stack></s-box>)}</s-grid>
      </s-section>
    </s-stack>
  </s-page>;
}
