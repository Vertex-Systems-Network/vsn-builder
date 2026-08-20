import { GitBranch, CheckCircle2, Wrench, Zap, Sparkles } from 'lucide-react';

const typeMeta = {
  feature: { icon: Sparkles, label: 'Feature', color: '#5C6AC4', bg: 'rgba(92,106,196,.10)' },
  fix: { icon: Wrench, label: 'Fix', color: '#D97706', bg: 'rgba(217,119,6,.10)' },
  performance: { icon: Zap, label: 'Performance', color: '#8B5CF6', bg: 'rgba(139,92,246,.10)' },
};

export default function Changelog({ darkMode, releases = [], currentVersion }) {
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? '#2D3748' : '#E5E7EB';
  return <div className="page-fade" style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
    <div style={{ marginBottom: 26 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: text }}>Changelog</h1>
      <p style={{ margin: '4px 0 0', fontSize: 14, color: muted }}>Release notes for VSN Builder. Current installed version: v{String(currentVersion || '0.0.0').replace(/^v/i, '')}.</p>
    </div>
    <div style={{ position: 'relative' }}>
      {releases.map((release, index) => {
        const meta = typeMeta[release.type] || typeMeta.feature; const Icon = meta.icon;
        return <div key={release.version} style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 14, position: 'relative', paddingBottom: 20 }}>
          {index < releases.length - 1 ? <div style={{ position: 'absolute', left: 21, top: 42, bottom: -3, width: 1, background: border }}/> : null}
          <div style={{ width: 42, height: 42, borderRadius: 11, display: 'grid', placeItems: 'center', background: meta.bg, color: meta.color, zIndex: 1 }}><Icon size={17}/></div>
          <article style={{ border: `1px solid ${border}`, borderRadius: 12, background: darkMode ? '#1A1F2E' : '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15, color: text }}>v{release.version}</strong>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: meta.bg, color: meta.color }}>{meta.label}</span>
              {String(currentVersion).replace(/^v/i, '') === String(release.version).replace(/^v/i, '') ? <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: 'rgba(var(--vsn-accent-rgb),.11)', color: 'var(--vsn-green-dark)' }}>Current</span> : null}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: muted }}>{new Date(release.date).toLocaleDateString()}</span>
            </div>
            <div style={{ padding: 18 }}>
              <h2 style={{ margin: 0, fontSize: 15, color: text }}>{release.title}</h2>
              <p style={{ margin: '6px 0 14px', fontSize: 12.5, lineHeight: 1.55, color: muted }}>{release.summary}</p>
              <div style={{ display: 'grid', gap: 8 }}>{(release.changes || []).map((change) => <div key={change} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: text, fontSize: 12.5 }}><CheckCircle2 size={14} color="var(--vsn-green)" style={{ flexShrink: 0, marginTop: 1 }}/><span>{change}</span></div>)}</div>
            </div>
          </article>
        </div>;
      })}
      {!releases.length ? <div style={{ padding: 32, border: `1px solid ${border}`, borderRadius: 12, color: muted, textAlign: 'center' }}><GitBranch size={24}/><p>No release entries have been published yet.</p></div> : null}
    </div>
  </div>;
}
