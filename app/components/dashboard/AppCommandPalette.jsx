import { useEffect, useMemo, useRef, useState } from 'react';
import { Command, Moon, Search, Sun } from 'lucide-react';

const NAV_SYSTEM = {home:'dashboard',pages:'pages',library:'library',marketplace:'marketplace','widget-studio':'widgetStudio',campaigns:'campaigns','email-builder':'emailBuilder',animations:'animations','developer-studio':'developerStudio','platform-intelligence':'platformIntelligence','control-center':'controlCenter',documentation:'documentation'};

const NAV_COMMANDS = [
  ['home','Dashboard','Overview and workspace status'],
  ['pages','Templates','Templates and visual editor'],
  ['library','Saved Library','Saved pages, sections and components'],
  ['marketplace','Marketplace','VSN templates and sections'],
  ['widget-studio','Widget Studio','Custom widgets and Template Lab'],
  ['campaigns','Campaigns','Popups and campaign targeting'],
  ['email-builder','Email Builder','Visual email templates'],
  ['animations','Motion Library','Reusable motion presets'],
  ['developer-studio','Developer Studio','GraphQL and Global CSS/JS'],
  ['platform-intelligence','Platform Intelligence','Dependency graph and Design Tokens 2.0'],
  ['control-center','System Health','Diagnostics and release readiness'],
  ['documentation','Documentation','User and developer guides'],
];

export default function AppCommandPalette({ onNavigate, darkMode=false, onToggleDark, systemAccess={} }) {
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const [active,setActive]=useState(0);
  const inputRef=useRef(null);
  useEffect(()=>{
    const key=(event)=>{const mod=event.metaKey||event.ctrlKey;if(mod&&event.key.toLowerCase()==='k'){event.preventDefault();setOpen((value)=>!value);setQuery('');setActive(0);}if(event.key==='Escape')setOpen(false);};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[]);
  useEffect(()=>{if(open)setTimeout(()=>inputRef.current?.focus(),0)},[open]);
  const commands=useMemo(()=>{
    const rows=NAV_COMMANDS.filter(([id])=>systemAccess?.[NAV_SYSTEM[id]]!==false).map(([id,label,description])=>({id:`nav:${id}`,label,description,run:()=>onNavigate?.(id)}));
    rows.push({id:'theme',label:darkMode?'Use light appearance':'Use dark appearance',description:'Toggle VSN dashboard appearance',run:onToggleDark,icon:darkMode?Sun:Moon});
    return rows;
  },[darkMode,onNavigate,onToggleDark,systemAccess]);
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?commands.filter((item)=>`${item.label} ${item.description}`.toLowerCase().includes(q)):commands},[commands,query]);
  useEffect(()=>{if(active>=filtered.length)setActive(0)},[active,filtered.length]);
  if(!open)return null;
  const execute=(item)=>{item?.run?.();setOpen(false);setQuery('')};
  return <div className="fixed inset-0 z-[9998] flex items-start justify-center bg-black/35 px-4 pt-[10vh]" onMouseDown={(event)=>{if(event.currentTarget===event.target)setOpen(false)}}>
    <div className={`w-[680px] max-w-full overflow-hidden rounded-2xl border shadow-2xl ${darkMode?'border-[#334155] bg-[#111827] text-white':'border-[#d9d9d9] bg-white text-[#202223]'}`} role="dialog" aria-modal="true" aria-label="VSN command palette">
      <div className={`flex items-center gap-3 border-b px-4 ${darkMode?'border-[#273142]':'border-[#eeeeee]'}`}><Search size={17} className="text-[var(--vsn-green-dark)]"/><input ref={inputRef} value={query} onChange={(event)=>{setQuery(event.target.value);setActive(0)}} onKeyDown={(event)=>{if(event.key==='ArrowDown'){event.preventDefault();setActive((value)=>Math.min(filtered.length-1,value+1))}else if(event.key==='ArrowUp'){event.preventDefault();setActive((value)=>Math.max(0,value-1))}else if(event.key==='Enter'){event.preventDefault();execute(filtered[active])}}} placeholder="Search pages, systems or commands…" className="min-w-0 flex-1 bg-transparent py-4 text-sm outline-none"/><kbd className={`rounded border px-2 py-1 text-[10px] ${darkMode?'border-[#374151] bg-[#1f2937]':'border-[#d9d9d9] bg-[#f6f6f7]'}`}>Esc</kbd></div>
      <div className="max-h-[58vh] overflow-y-auto p-2">{filtered.map((item,index)=>{const Icon=item.icon||Command;return <button key={item.id} type="button" onMouseEnter={()=>setActive(index)} onClick={()=>execute(item)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${index===active?(darkMode?'bg-[#1f2937]':'bg-[#f3f7eb]'):''}`}><span className={`grid h-8 w-8 place-items-center rounded-lg ${darkMode?'bg-[#0f172a] text-[var(--vsn-green)]':'bg-white text-[var(--vsn-green-dark)] border border-[#e3e3e3]'}`}><Icon size={15}/></span><span className="min-w-0 flex-1"><strong className="block text-sm">{item.label}</strong><small className={`block truncate ${darkMode?'text-[#9ca3af]':'text-[#6d7175]'}`}>{item.description}</small></span>{index===active?<kbd className={`rounded border px-1.5 py-0.5 text-[9px] ${darkMode?'border-[#374151]':'border-[#d9d9d9]'}`}>Enter</kbd>:null}</button>})}{!filtered.length?<div className={`p-10 text-center text-sm ${darkMode?'text-[#9ca3af]':'text-[#6d7175]'}`}>No commands found.</div>:null}</div>
      <div className={`flex items-center justify-between border-t px-4 py-2 text-[10px] ${darkMode?'border-[#273142] text-[#9ca3af]':'border-[#eeeeee] text-[#8c9196]'}`}><span>VSN Command Palette</span><span>Ctrl/Cmd + K</span></div>
    </div>
  </div>;
}
