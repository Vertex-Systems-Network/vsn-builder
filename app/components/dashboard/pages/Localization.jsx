function statCard(label, value, hint) {
  return <s-section padding="base"><s-stack direction="block" gap="small-100"><s-text color="subdued">{label}</s-text><s-heading>{value}</s-heading><s-text color="subdued">{hint}</s-text></s-stack></s-section>;
}

export default function Localization({ data = null }) {
  const config = data?.config || { baseLocale:'en', locales:[], markets:[] };
  const pages = data?.pages || [];
  const totals = data?.totals || { pages:0, translations:0, missing:0, outdated:0 };
  const alternateLocales = (config.locales || []).filter((item)=>!item.primary);

  const openPage = (pageId) => {
    if (typeof window === 'undefined') return;
    window.location.assign(`/app/builder/${encodeURIComponent(pageId)}?localization=1`);
  };

  return <s-page heading="Localization & Shopify Markets">
    <s-button slot="secondary-actions" icon="refresh" onClick={()=>window.location.reload()}>Refresh</s-button>
    <s-stack direction="block" gap="base">
      <s-paragraph color="subdued">Track locale coverage, stale translations and market variants. Edit translations inside each page so the base VSN schema stays unchanged.</s-paragraph>
      <s-grid gridTemplateColumns="@container (inline-size > 800px) repeat(4, 1fr), 1fr 1fr" gap="base">
        {statCard('Pages',totals.pages,'Builder pages tracked')}
        {statCard('Translation records',totals.translations,`${alternateLocales.length} alternate locale(s)`)}
        {statCard('Missing',totals.missing,'Locale records not marked translated')}
        {statCard('Outdated',totals.outdated,'Base page changed after translation')}
      </s-grid>
      <s-grid gridTemplateColumns="@container (inline-size > 900px) 2fr 1fr, 1fr" gap="base">
        <s-section heading="Translation dashboard" padding="none">
          <s-box padding="base"><s-text color="subdued">Open a page to translate text, media, SEO and market overrides.</s-text></s-box>
          {pages.length ? <s-table>
            <s-table-header-row><s-table-header listSlot="primary">Page</s-table-header><s-table-header>Template</s-table-header><s-table-header format="numeric">Locales</s-table-header><s-table-header format="numeric">Missing</s-table-header><s-table-header format="numeric">Outdated</s-table-header><s-table-header>Actions</s-table-header></s-table-header-row>
            <s-table-body>{pages.map((page)=><s-table-row key={page.id}>
              <s-table-cell><s-stack direction="block"><s-text type="strong">{page.title}</s-text><s-text color="subdued">v{page.version} · {page.status}</s-text></s-stack></s-table-cell>
              <s-table-cell>{page.template}</s-table-cell>
              <s-table-cell>{page.translatedLocales}/{page.expectedLocales}</s-table-cell>
              <s-table-cell>{page.missingLocales ? <s-badge tone="warning">{page.missingLocales}</s-badge> : <s-badge tone="success">0</s-badge>}</s-table-cell>
              <s-table-cell>{page.outdated ? <s-badge tone="warning">{page.outdated}</s-badge> : <s-text color="subdued">{page.outdated}</s-text>}</s-table-cell>
              <s-table-cell><s-button variant="primary" onClick={()=>openPage(page.id)}>Translate</s-button></s-table-cell>
            </s-table-row>)}</s-table-body>
          </s-table> : <s-box padding="base"><s-text color="subdued">No builder pages are available yet.</s-text></s-box>}
        </s-section>
        <s-stack direction="block" gap="base">
          <s-section heading="Locales">
            <s-stack direction="block" gap="small-200">
              <s-text color="subdued">Base locale</s-text>
              <s-text type="strong">{config.baseLocale || 'en'}</s-text>
              <s-stack direction="inline" gap="small-100">{(config.locales||[]).map((locale)=><s-badge key={locale.locale} tone={locale.primary?'success':'neutral'}>{locale.name || locale.locale} · {locale.locale}{locale.direction==='rtl'?' · RTL':''}</s-badge>)}</s-stack>
              {!(config.locales||[]).length?<s-text color="subdued">Open a page and use “Refresh Shopify locales” after the required dev scopes are approved.</s-text>:null}
            </s-stack>
          </s-section>
          <s-section heading="Markets">
            <s-stack direction="block" gap="small-200">{(config.markets||[]).map((market)=><s-stack key={market.key} direction="inline" justifyContent="space-between" gap="small-200"><s-text>{market.name}</s-text><s-text color="subdued">{market.status || market.handle || market.key}</s-text></s-stack>)}{!(config.markets||[]).length?<s-text color="subdued">No Shopify Markets catalog has been synced yet.</s-text>:null}</s-stack>
          </s-section>
        </s-stack>
      </s-grid>
    </s-stack>
  </s-page>;
}
