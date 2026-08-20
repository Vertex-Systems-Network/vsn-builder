import { AlertTriangle, CheckCircle2, Globe2, Languages, RefreshCw } from 'lucide-react';

function statCard(label, value, hint, darkMode) {
  const border = darkMode ? '#2D3748' : '#E5E7EB';
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  return <div style={{ border:`1px solid ${border}`, borderRadius:12, padding:16, background:darkMode?'#1A1F2E':'#fff' }}><div style={{fontSize:11,fontWeight:700,color:muted,textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</div><div style={{marginTop:5,fontSize:24,fontWeight:800,color:text}}>{value}</div><div style={{marginTop:3,fontSize:11,color:muted}}>{hint}</div></div>;
}

export default function Localization({ darkMode, data = null }) {
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? '#2D3748' : '#E5E7EB';
  const surface = darkMode ? '#1A1F2E' : '#fff';
  const config = data?.config || { baseLocale:'en', locales:[], markets:[] };
  const pages = data?.pages || [];
  const totals = data?.totals || { pages:0, translations:0, missing:0, outdated:0 };
  const alternateLocales = (config.locales || []).filter((item)=>!item.primary);

  const openPage = (pageId) => {
    if (typeof window === 'undefined') return;
    window.location.assign(`/app/builder/${encodeURIComponent(pageId)}?localization=1`);
  };

  return <div className="page-fade" style={{padding:'28px 32px',maxWidth:1560,margin:'0 auto'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:20,marginBottom:22}}>
      <div><h1 style={{margin:0,fontSize:22,fontWeight:800,color:text}}>Localization & Shopify Markets</h1><p style={{margin:'5px 0 0',fontSize:13.5,color:muted,maxWidth:720}}>Track locale coverage, stale translations and market variants. Edit translations inside each page so the base VSN schema stays unchanged.</p></div>
      <button type="button" onClick={()=>window.location.reload()} style={{display:'inline-flex',alignItems:'center',gap:7,border:`1px solid ${border}`,borderRadius:9,padding:'8px 11px',background:surface,color:text,cursor:'pointer',fontSize:12,fontWeight:700}}><RefreshCw size={14}/>Refresh</button>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:12,marginBottom:16}}>
      {statCard('Pages',totals.pages,'Builder pages tracked',darkMode)}
      {statCard('Translation records',totals.translations,`${alternateLocales.length} alternate locale(s)`,darkMode)}
      {statCard('Missing',totals.missing,'Locale records not marked translated',darkMode)}
      {statCard('Outdated',totals.outdated,'Base page changed after translation',darkMode)}
    </div>

    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.35fr) minmax(280px,.65fr)',gap:14,alignItems:'start'}}>
      <section style={{border:`1px solid ${border}`,borderRadius:12,background:surface,overflow:'hidden'}}>
        <div style={{padding:'14px 16px',borderBottom:`1px solid ${border}`,display:'flex',alignItems:'center',gap:9}}><Languages size={17} color="var(--vsn-green-dark)"/><div><div style={{fontSize:13,fontWeight:800,color:text}}>Translation dashboard</div><div style={{fontSize:11,color:muted}}>Open a page to translate text, media, SEO and market overrides.</div></div></div>
        <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr style={{background:darkMode?'#111827':'#FAFAFA',color:muted,textAlign:'left'}}>{['Page','Template','Locales','Missing','Outdated',''].map((heading)=><th key={heading} style={{padding:'10px 12px',fontSize:10.5,textTransform:'uppercase',letterSpacing:'.03em',borderBottom:`1px solid ${border}`}}>{heading}</th>)}</tr></thead><tbody>{pages.map((page)=><tr key={page.id} style={{borderBottom:`1px solid ${border}`}}><td style={{padding:'11px 12px',color:text,fontWeight:700,maxWidth:280}}><div style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={page.title}>{page.title}</div><div style={{fontSize:10,color:muted,fontWeight:500}}>v{page.version} · {page.status}</div></td><td style={{padding:'11px 12px',color:muted}}>{page.template}</td><td style={{padding:'11px 12px',color:text}}>{page.translatedLocales}/{page.expectedLocales}</td><td style={{padding:'11px 12px'}}>{page.missingLocales ? <span style={{display:'inline-flex',gap:4,alignItems:'center',color:'#B45309',fontWeight:700}}><AlertTriangle size={13}/>{page.missingLocales}</span> : <span style={{display:'inline-flex',gap:4,alignItems:'center',color:'var(--vsn-green-dark)',fontWeight:700}}><CheckCircle2 size={13}/>0</span>}</td><td style={{padding:'11px 12px',color:page.outdated?'#B45309':muted,fontWeight:page.outdated?700:500}}>{page.outdated}</td><td style={{padding:'11px 12px',textAlign:'right'}}><button type="button" onClick={()=>openPage(page.id)} style={{border:'none',borderRadius:8,padding:'7px 10px',background:'var(--vsn-green)',color:'#fff',fontSize:11,fontWeight:800,cursor:'pointer'}}>Translate</button></td></tr>)}{!pages.length?<tr><td colSpan={6} style={{padding:34,textAlign:'center',color:muted}}>No builder pages are available yet.</td></tr>:null}</tbody></table></div>
      </section>

      <aside style={{display:'grid',gap:12}}>
        <section style={{border:`1px solid ${border}`,borderRadius:12,padding:15,background:surface}}><div style={{display:'flex',alignItems:'center',gap:8,color:text,fontSize:13,fontWeight:800}}><Globe2 size={17} color="var(--vsn-green-dark)"/>Locales</div><div style={{marginTop:10,fontSize:11,color:muted}}>Base locale</div><div style={{marginTop:4,fontSize:13,fontWeight:800,color:text}}>{config.baseLocale || 'en'}</div><div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:10}}>{(config.locales||[]).map((locale)=><span key={locale.locale} style={{fontSize:10,fontWeight:700,padding:'5px 7px',borderRadius:99,background:locale.primary?'rgba(var(--vsn-accent-rgb),.13)':(darkMode?'#111827':'#F3F4F6'),color:locale.primary?'var(--vsn-green-dark)':text}}>{locale.name || locale.locale} · {locale.locale}{locale.direction==='rtl'?' · RTL':''}</span>)}</div>{!(config.locales||[]).length?<div style={{marginTop:10,fontSize:11,color:muted}}>Open a page and use “Refresh Shopify locales” after the required dev scopes are approved.</div>:null}</section>
        <section style={{border:`1px solid ${border}`,borderRadius:12,padding:15,background:surface}}><div style={{fontSize:13,fontWeight:800,color:text}}>Markets</div><div style={{display:'grid',gap:7,marginTop:10}}>{(config.markets||[]).map((market)=><div key={market.key} style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:11,color:text}}><span>{market.name}</span><span style={{color:muted}}>{market.status || market.handle || market.key}</span></div>)}{!(config.markets||[]).length?<div style={{fontSize:11,color:muted}}>No Shopify Markets catalog has been synced yet.</div>:null}</div></section>
      </aside>
    </div>
  </div>;
}
