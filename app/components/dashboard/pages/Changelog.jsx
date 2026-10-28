const typeMeta = {
  feature: { label: 'Feature', tone: 'info' },
  fix: { label: 'Fix', tone: 'warning' },
  performance: { label: 'Performance', tone: 'neutral' },
};

export default function Changelog({ releases = [], currentVersion }) {
  const installed = String(currentVersion || '0.0.0').replace(/^v/i, '');
  return <s-page heading="Changelog">
    <s-stack direction="block" gap="base">
      <s-paragraph color="subdued">Release notes for VSN Builder. Current installed version: v{installed}.</s-paragraph>
      {releases.map((release) => {
        const meta = typeMeta[release.type] || typeMeta.feature;
        return <s-section key={release.version}>
          <s-stack direction="block" gap="small-200">
            <s-stack direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
              <s-stack direction="inline" gap="small-200" alignItems="center"><s-text type="strong">v{release.version}</s-text><s-badge tone={meta.tone}>{meta.label}</s-badge>{installed === String(release.version).replace(/^v/i, '') ? <s-badge tone="success">Current</s-badge> : null}</s-stack>
              <s-text color="subdued">{new Date(release.date).toLocaleDateString()}</s-text>
            </s-stack>
            <s-heading>{release.title}</s-heading>
            <s-paragraph color="subdued">{release.summary}</s-paragraph>
            {(release.changes || []).length ? <s-unordered-list>{release.changes.map((change) => <s-list-item key={change}>{change}</s-list-item>)}</s-unordered-list> : null}
          </s-stack>
        </s-section>;
      })}
      {!releases.length ? <s-section><s-text color="subdued">No release entries have been published yet.</s-text></s-section> : null}
    </s-stack>
  </s-page>;
}
