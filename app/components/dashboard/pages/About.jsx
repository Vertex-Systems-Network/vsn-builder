const whyUs = [
  { title: 'Performance-minded', desc: 'Storefront output supports lazy-loaded media, CSS deduplication and font pruning to protect Core Web Vitals.' },
  { title: 'Shopify Native', desc: 'Built for Shopify themes, Markets, metaobjects and App Pricing, with server-enforced permissions.' },
  { title: 'Developer friendly', desc: 'GraphQL tooling, revisioned global code and a documented SDK for teams that extend their storefront.' },
  { title: 'One builder for every page', desc: 'Pages, templates, campaigns and email designs share one widget library and brand system.' },
];

export default function About({ version, onNavigate }) {
  const installed = String(version || '').replace(/^v/i, '');
  return <s-page heading="About VSN Builder">
    <s-stack direction="block" gap="base">
      <s-section>
        <s-stack direction="block" gap="small-200">
          <s-heading>VSN Builder</s-heading>
          <s-paragraph color="subdued">A visual page and template builder for Shopify stores, so merchants can design and publish conversion-focused storefront pages without writing code.</s-paragraph>
          {installed ? <s-stack direction="inline"><s-badge>v{installed}</s-badge></s-stack> : null}
        </s-stack>
      </s-section>
      <s-grid gridTemplateColumns="@container (inline-size > 700px) 1fr 1fr, 1fr" gap="base">
        <s-section heading="Our Mission"><s-paragraph color="subdued">Make professional Shopify store design accessible to every merchant, regardless of technical skill.</s-paragraph></s-section>
        <s-section heading="Our Vision"><s-paragraph color="subdued">Tools that feel effortless, look remarkable and perform reliably inside Shopify.</s-paragraph></s-section>
      </s-grid>
      <s-section heading="Why VSN Builder?">
        <s-grid gridTemplateColumns="@container (inline-size > 700px) 1fr 1fr, 1fr" gap="base">{whyUs.map((item) => <s-box key={item.title} background="subdued" borderRadius="base" padding="base"><s-stack direction="block" gap="small-100"><s-text type="strong">{item.title}</s-text><s-text color="subdued">{item.desc}</s-text></s-stack></s-box>)}</s-grid>
      </s-section>
      <s-section heading="Need help?">
        <s-stack direction="inline" gap="small-200"><s-button onClick={() => onNavigate?.('support')}>Open Support Center</s-button><s-button variant="tertiary" onClick={() => onNavigate?.('documentation')}>Documentation</s-button></s-stack>
      </s-section>
    </s-stack>
  </s-page>;
}
