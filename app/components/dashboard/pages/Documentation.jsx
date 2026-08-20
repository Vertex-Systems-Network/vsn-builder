import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import DocsContent from '../documentation/DocsContent.jsx';
import { DOC_SECTIONS } from '../documentation/docsCatalog.js';

export default function Documentation(){
  const [active,setActive]=useState(()=>{if(typeof window==='undefined')return 'getting-started';const requested=new URLSearchParams(window.location.search).get('doc');return DOC_SECTIONS.some(row=>row.id===requested)?requested:'getting-started';});
  const [search,setSearch]=useState('');
  const filtered=useMemo(()=>{const needle=search.trim().toLowerCase();return needle?DOC_SECTIONS.filter(row=>`${row.label} ${row.group} ${row.tags||''}`.toLowerCase().includes(needle)):DOC_SECTIONS;},[search]);
  const current=DOC_SECTIONS.find(row=>row.id===active)||DOC_SECTIONS[0];
  useEffect(()=>{if(typeof window==='undefined')return;const requested=new URLSearchParams(window.location.search).get('doc');if(DOC_SECTIONS.some(row=>row.id===requested))setActive(requested);},[]);
  const choose=(id)=>{setActive(id);if(typeof window!=='undefined'){const url=new URL(window.location.href);url.searchParams.set('view','documentation');url.searchParams.set('doc',id);window.history.replaceState({},'',url);}};
  return <div className="vsn-docs-page page-fade"><header className="vsn-docs-header"><div><span>VSN Builder Help Center</span><h1>Documentation</h1><p>Task-based user guidance, developer references and source-audited ecosystem coverage.</p></div></header><div className="vsn-docs-layout"><aside className="vsn-docs-nav"><label className="vsn-doc-search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documentation"/></label><div className="vsn-doc-nav-list">{filtered.map(row=>{const Icon=row.icon;return <button key={row.id} className={active===row.id?'is-active':''} onClick={()=>choose(row.id)}><Icon size={15}/><span><strong>{row.label}</strong><small>{row.group}</small></span><ChevronRight size={13}/></button>})}{!filtered.length?<div className="vsn-doc-empty">No documentation sections match that search.</div>:null}</div></aside><main className="vsn-docs-content" aria-label={`${current.label} documentation`}><DocsContent active={active}/></main></div></div>;
}
