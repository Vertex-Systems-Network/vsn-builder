import { useState, useMemo, useEffect } from 'react';
import { useFetcher } from "react-router";
import { Search, Grid, List, Save, CheckSquare, Square, Heading, AlignLeft, MousePointerClick, Minus, Image, Star, AlertCircle, FileText, ChevronDown, Layout, Hash, BarChart2, Clock, RefreshCw, Images, ImagePlus, GalleryHorizontal, Film, Layers, Play, Anchor, ChevronRight, Share2, List as ListIcon, Sparkles, UserCircle, Quote, Megaphone, MapPin, Code, Box, Grid as GridIcon } from 'lucide-react';

const iconMap = {
  Heading: <Heading size={18} />, AlignLeft: <AlignLeft size={18} />, MousePointerClick: <MousePointerClick size={18} />,
  Minus: <Minus size={18} />, Image: <Image size={18} />, Star: <Star size={18} />,
  AlertCircle: <AlertCircle size={18} />, FileText: <FileText size={18} />, ChevronDown: <ChevronDown size={18} />,
  Layout: <Layout size={18} />, Hash: <Hash size={18} />, BarChart2: <BarChart2 size={18} />,
  Clock: <Clock size={18} />, RefreshCw: <RefreshCw size={18} />, Grid: <GridIcon size={18} />,
  Images: <Images size={18} />, ImagePlus: <ImagePlus size={18} />, GalleryHorizontal: <GalleryHorizontal size={18} />,
  Film: <Film size={18} />, Layers: <Layers size={18} />, Play: <Play size={18} />,
  Anchor: <Anchor size={18} />, ChevronRight: <ChevronRight size={18} />, Share2: <Share2 size={18} />,
  List: <ListIcon size={18} />, Sparkles: <Sparkles size={18} />, UserCircle: <UserCircle size={18} />,
  Quote: <Quote size={18} />, Megaphone: <Megaphone size={18} />, MapPin: <MapPin size={18} />,
  Code: <Code size={18} />, Box: <Box size={18} />,
};

const categoryColors = {
  Basic: { bg: 'rgba(92,106,196,0.1)', text: '#5C6AC4' },
  Interactive: { bg: 'rgba(var(--vsn-accent-rgb),0.1)', text: 'var(--vsn-green-dark)' },
  Media: { bg: 'rgba(245,158,11,0.1)', text: '#D97706' },
  Navigation: { bg: 'rgba(139,92,246,0.1)', text: '#7C3AED' },
  Advanced: { bg: 'rgba(239,68,68,0.1)', text: '#DC2626' },
};

export default function WidgetsPage({ widgetsFeatcher, darkMode, onToast, onSettingsSaved, focusWidgetId = null }) {

  const fetcher = useFetcher();

  const iswidgetsLoaded = widgetsFeatcher.state === "loading" ? true : false;
  const widgetLoadedData = widgetsFeatcher.data?.settings;

  // State for widgets, search, category, view mode, and saving status
  const [widgets, setWidgets] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [viewMode, setViewMode] = useState('grid');
  const [saving, setSaving] = useState(false);
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';

  // Update widgets state when widgetLoadedData changes
  useEffect(() => {
    if (widgetLoadedData?.widgets) {
      setWidgets(widgetLoadedData.widgets);
    }
  }, [widgetLoadedData]);

  useEffect(() => {
    if (!focusWidgetId || !widgets.length) return;
    const target = widgets.find((widget) => widget.id === focusWidgetId);
    if (!target) return;
    setCategory('All');
    setSearch(target.name || target.id);
  }, [focusWidgetId, widgets]);

  // Update widgets state when widgetsFeatcher data changes
  const categories = useMemo(() => ['All', ...Array.from(new Set(widgets.map((w) => w.category).filter(Boolean)))], [widgets]);

  const filtered = useMemo(() => widgets.filter(w => {
    const matchCat = category === 'All' || w.category === category;
    const matchSearch = w.name.toLowerCase().includes(search.toLowerCase()) || w.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [widgets, search, category]);

  const toggleWidget = (id) => setWidgets(prev => prev.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));
  const bulkToggle = (enabled) => setWidgets(prev => prev.map(w => (category === 'All' || w.category === category) ? { ...w, enabled } : w));

  // Save changes to server
  const handleSave = () => {

    fetcher.submit(
      {
        intent: "save-widgets",
        widgets: JSON.stringify(widgets.map((widget) => ({ id: widget.id, enabled: widget.enabled }))),
      },
      { method: "POST" },
    );
    setSaving(true);
  };

  useEffect(() => {
    if (fetcher.state === "idle" && saving && fetcher.data) {
      setSaving(false);
      if (fetcher.data.success && fetcher.data.settings) {
        setWidgets(fetcher.data.settings.widgets || []);
        onSettingsSaved?.(fetcher.data.settings);
        onToast({ type: 'success', title: 'Changes saved', message: `${fetcher.data.settings.activeCount} widgets active.` });
      } else if (fetcher.data.error) {
        onToast({ type: 'error', title: 'Save failed', message: fetcher.data.error });
      }
    }
  }, [fetcher.state, fetcher.data, saving, onSettingsSaved, onToast]);

  const activeCount = widgets.filter((w) => w.enabled).length;
  const totalCount = widgets.length;
  const disabledCount = widgets.filter((w) => !w.enabled).length;
  const inactiveCount = widgets.filter((w) => w.enabled && w.used === false).length;
  const stats = [
    { label:'Total Widgets', value:totalCount, icon:<Grid size={20}/>, color:'#5C6AC4', bg:'rgba(92,106,196,.1)' },
    { label:'Active Widgets', value:activeCount, icon:<CheckSquare size={20}/>, color:'var(--vsn-green)', bg:'rgba(var(--vsn-accent-rgb),.1)' },
    { label:'Disabled Widgets', value:disabledCount, icon:<Square size={20}/>, color:'#F59E0B', bg:'rgba(245,158,11,.1)' },
    { label:'Inactive', value:inactiveCount, icon:<AlertCircle size={20}/>, color:'#8B5CF6', bg:'rgba(139,92,246,.1)', detail:'Enabled but not used on a saved page' },
  ];

  return (<div className="page-fade" style={{ padding: '28px 32px', maxWidth: 1560, margin: '0 auto' }}>
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: text }}>Widgets</h1>
      <p style={{ margin: '4px 0 0', fontSize: 14, color: muted }}>Enable or disable widgets for your store. {activeCount} of {totalCount} active.</p>
    </div>

    <div className="dashboard-stat-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:16, marginBottom:22 }}>
      {stats.map((stat)=><div key={stat.label} style={{ background:darkMode?'#1A1F2E':'#FFFFFF', borderRadius:12, border:`1px solid ${darkMode?'#2D3748':'#E5E7EB'}`, boxShadow:darkMode?'none':'0 1px 4px rgba(0,0,0,.04)', padding:'20px' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:13 }}><span style={{ fontSize:13,fontWeight:500,color:muted }}>{stat.label}</span><div style={{ width:36,height:36,borderRadius:8,background:stat.bg,display:'grid',placeItems:'center',color:stat.color }}>{stat.icon}</div></div>
        <div style={{ fontSize:28,fontWeight:800,color:text }}>{stat.value}</div>{stat.detail?<div style={{ marginTop:4,fontSize:10.5,color:muted }}>{stat.detail}</div>:null}
      </div>)}
    </div>

    {/* Toolbar */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: darkMode ? '#1F2937' : '#F9FAFB',
        border: `1px solid ${darkMode ? '#2D3748' : '#E5E7EB'}`,
        borderRadius: 8, padding: '0 12px', height: 36, minWidth: 220,
      }}>
        <Search size={14} color={muted} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search widgets..." style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: text, flex: 1 }} />
      </div>

      {/* Category filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {categories.map(cat => (<button key={cat} onClick={() => setCategory(cat)} style={{
          padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
          border: `1px solid ${category === cat ? 'var(--vsn-green)' : (darkMode ? '#2D3748' : '#E5E7EB')}`,
          background: category === cat ? 'var(--vsn-green)' : 'transparent',
          color: category === cat ? 'white' : muted,
          cursor: 'pointer',
        }}>
          {cat}
          <span style={{
            fontSize: 11, fontWeight: 600, lineHeight: 1,
            background: category === cat ? '#F3F4F6' : (darkMode ? '#2D3748' : '#F3F4F6'),
            color: category === cat ? '#6B7280' : (darkMode ? '#9CA3AF' : '#6B7280'),
            padding: '2px 7px', borderRadius: 20,
            marginLeft: 6,
          }}>
            {widgetLoadedData?.categoryCounts?.[cat] || 0}
          </span>
        </button>))}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {/* Bulk actions */}
        <button onClick={() => bulkToggle(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          border: `1px solid ${darkMode ? '#2D3748' : '#E5E7EB'}`,
          background: 'transparent', color: muted, cursor: 'pointer',
        }}>
          <CheckSquare size={14} /> Enable All
        </button>
        <button onClick={() => bulkToggle(false)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          border: `1px solid ${darkMode ? '#2D3748' : '#E5E7EB'}`,
          background: 'transparent', color: muted, cursor: 'pointer',
        }}>
          <Square size={14} /> Disable All
        </button>

        {/* View toggle */}
        <div style={{
          display: 'flex', border: `1px solid ${darkMode ? '#2D3748' : '#E5E7EB'}`,
          borderRadius: 8, overflow: 'hidden',
        }}>
          {['grid', 'list'].map(mode => (<button key={mode} onClick={() => setViewMode(mode)} style={{
            padding: '7px 10px',
            background: viewMode === mode ? (darkMode ? '#2D3748' : '#F3F4F6') : 'transparent',
            border: 'none', cursor: 'pointer',
            color: viewMode === mode ? text : muted,
          }}>
            {mode === 'grid' ? <Grid size={15} /> : <List size={15} />}
          </button>))}
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          border: 'none', background: 'var(--vsn-green)', color: 'white', cursor: 'pointer',
          opacity: saving ? 0.7 : 1,
        }}>
          <Save size={14} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>

    {/* Grid / List */}
    {viewMode === 'grid' ? (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
      {filtered.map(widget => (<WidgetCard key={widget.id} comp={widget} onToggle={toggleWidget} darkMode={darkMode} />))}
    </div>) : (<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {filtered.map(widget => (<WidgetListRow key={widget.id} comp={widget} onToggle={toggleWidget} darkMode={darkMode} />))}
    </div>)}

    {filtered.length === 0 && (<div style={{ textAlign: 'center', padding: '60px 20px', color: muted }}>
      <Search size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
      <div style={{ fontSize: 15, fontWeight: 600, color: text }}>No widgets found</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>Try adjusting your search or filter.</div>
    </div>)}
  </div>);
}

const WidgetCard = ({ comp, onToggle, darkMode }) => {
  const cc = categoryColors[comp.category] || { bg: 'rgba(92,106,196,0.1)', text: '#5C6AC4' };
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  return (<div style={{
    background: darkMode ? '#1A1F2E' : '#FFFFFF',
    borderRadius: 12,
    border: `1px solid ${comp.enabled ? (darkMode ? 'rgba(var(--vsn-accent-rgb),0.3)' : 'rgba(var(--vsn-accent-rgb),0.4)') : (darkMode ? '#2D3748' : '#E5E7EB')}`,
    padding: '18px',
    transition: 'all 0.15s',
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{
        width: 38, height: 38, borderRadius: 8,
        background: comp.enabled ? 'rgba(var(--vsn-accent-rgb),0.12)' : (darkMode ? '#1F2937' : '#F9FAFB'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: comp.enabled ? 'var(--vsn-green)' : (darkMode ? '#4B5563' : '#9CA3AF'),
        transition: 'all 0.2s',
      }}>
        {iconMap[comp.icon] || <Box size={18} />}
      </div>
      <label className="toggle-switch">
        <input type="checkbox" checked={comp.enabled} onChange={() => onToggle(comp.id)} />
        <span className="toggle-slider" />
      </label>
    </div>
    <div style={{ fontSize: 14, fontWeight: 600, color: text, marginBottom: 4 }}>{comp.name}</div>
    <div style={{ fontSize: 12, color: muted, lineHeight: 1.5, marginBottom: 12 }}>{comp.description}</div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
        background: cc.bg, color: cc.text,
      }}>{comp.category}</span>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
        background: comp.enabled ? 'rgba(var(--vsn-accent-rgb),0.1)' : (darkMode ? '#1F2937' : '#F3F4F6'),
        color: comp.enabled ? 'var(--vsn-green)' : muted,
      }}>
        {comp.enabled ? '● Active' : '○ Disabled'}
      </span>
    </div>
  </div>);
}

const WidgetListRow = ({ comp, onToggle, darkMode }) => {
  const cc = categoryColors[comp.category] || { bg: 'rgba(92,106,196,0.1)', text: '#5C6AC4' };
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  return (<div style={{
    background: darkMode ? '#1A1F2E' : '#FFFFFF',
    borderRadius: 10,
    border: `1px solid ${darkMode ? '#2D3748' : '#E5E7EB'}`,
    padding: '14px 18px',
    display: 'flex', alignItems: 'center', gap: 16,
  }}>
    <div style={{
      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
      background: comp.enabled ? 'rgba(var(--vsn-accent-rgb),0.12)' : (darkMode ? '#1F2937' : '#F9FAFB'),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: comp.enabled ? 'var(--vsn-green)' : (darkMode ? '#4B5563' : '#9CA3AF'),
    }}>
      {iconMap[comp.icon] || <Box size={16} />}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{comp.name}</div>
      <div style={{ fontSize: 12, color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{comp.description}</div>
    </div>
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: cc.bg, color: cc.text, flexShrink: 0 }}>{comp.category}</span>
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, flexShrink: 0,
      background: comp.enabled ? 'rgba(var(--vsn-accent-rgb),0.1)' : (darkMode ? '#1F2937' : '#F3F4F6'),
      color: comp.enabled ? 'var(--vsn-green)' : muted,
    }}>
      {comp.enabled ? 'Active' : 'Disabled'}
    </span>
    <label className="toggle-switch" title={comp.enabled ? "Disable widget" : "Enable widget"}>
      <input type="checkbox" checked={comp.enabled} onChange={() => onToggle(comp.id)} />
      <span className="toggle-slider" />
    </label>
  </div>);
}
