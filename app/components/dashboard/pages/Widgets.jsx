import { useState, useMemo, useEffect } from 'react';
import { useFetcher } from "react-router";
import { Heading, AlignLeft, MousePointerClick, Minus, Image, Star, AlertCircle, FileText, ChevronDown, Layout, Hash, BarChart2, Clock, RefreshCw, Images, ImagePlus, GalleryHorizontal, Film, Layers, Play, Anchor, ChevronRight, Share2, List as ListIcon, Sparkles, UserCircle, Quote, Megaphone, MapPin, Code, Box, Grid as GridIcon } from 'lucide-react';

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

export default function WidgetsPage({ widgetsFeatcher, onToast, onSettingsSaved, focusWidgetId = null }) {

  const fetcher = useFetcher();

  const widgetLoadedData = widgetsFeatcher.data?.settings;

  // State for widgets, search, category, view mode, and saving status
  const [widgets, setWidgets] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [viewMode, setViewMode] = useState('grid');
  const [saving, setSaving] = useState(false);

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

  const savedWidgets = fetcher.data?.settings?.widgets || widgetLoadedData?.widgets || [];
  const savedEnabled = new Map(savedWidgets.map((w) => [w.id, w.enabled]));
  const dirty = widgets.some((w) => savedEnabled.get(w.id) !== w.enabled);
  const activeCount = widgets.filter((w) => w.enabled).length;
  const totalCount = widgets.length;
  const disabledCount = widgets.filter((w) => !w.enabled).length;
  const inactiveCount = widgets.filter((w) => w.enabled && w.used === false).length;
  const stats = [
    { label:'Total Widgets', value:totalCount },
    { label:'Active Widgets', value:activeCount },
    { label:'Disabled Widgets', value:disabledCount },
    { label:'Inactive', value:inactiveCount, detail:'Enabled but not used on a saved page' },
  ];

  return (<s-page heading="Widgets" inlineSize="large">
    <s-button slot="primary-action" variant="primary" icon="save" loading={saving || undefined} disabled={saving || !dirty} onClick={handleSave}>{saving ? 'Saving...' : 'Save Changes'}</s-button>
    <s-stack direction="block" gap="base">
    <s-paragraph color="subdued">Enable or disable widgets for your store. {activeCount} of {totalCount} active.</s-paragraph>

    <div className="vsn-widgets-stats">
      {stats.map((stat)=><div key={stat.label} className="vsn-widgets-stat"><span>{stat.label}</span><strong>{stat.value}</strong>{stat.detail?<small>{stat.detail}</small>:null}</div>)}
    </div>
    {dirty ? <s-banner tone="warning">You have unsaved widget changes. Save to update the editor element library.</s-banner> : null}

    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
          <div className="vsn-widgets-search"><input type="search" aria-label="Search widgets" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search widgets..." className="dashboard-search-input"/></div>
          <s-stack direction="inline" gap="small-200">
            <s-button icon="check" onClick={() => bulkToggle(true)}>Enable All</s-button>
            <s-button onClick={() => bulkToggle(false)}>Disable All</s-button>
            <s-button-group>
              <s-button slot="secondary-actions" variant={viewMode === 'grid' ? 'primary' : 'secondary'} accessibilityLabel="Grid view" icon="layout-columns-3" onClick={() => setViewMode('grid')}/>
              <s-button slot="secondary-actions" variant={viewMode === 'list' ? 'primary' : 'secondary'} accessibilityLabel="List view" icon="list-bulleted" onClick={() => setViewMode('list')}/>
            </s-button-group>
          </s-stack>
        </s-stack>
        <div className="vsn-widgets-chips" role="tablist" aria-label="Widget categories">
          {categories.map(cat => (<button key={cat} type="button" role="tab" aria-selected={category === cat} className={category === cat ? 'is-active' : ''} onClick={() => setCategory(cat)}>{cat}<span>{cat === 'All' ? widgets.length : widgets.filter((w) => w.category === cat).length}</span></button>))}
        </div>
      </s-stack>
    </s-section>

    {viewMode === 'grid' ? (<div className="vsn-widgets-grid">
      {filtered.map(widget => (<WidgetCard key={widget.id} comp={widget} onToggle={toggleWidget} />))}
    </div>) : (<div className="vsn-widgets-list">
      {filtered.map(widget => (<WidgetListRow key={widget.id} comp={widget} onToggle={toggleWidget} />))}
    </div>)}

    {filtered.length === 0 && (<s-section><s-stack direction="block" alignItems="center" gap="small-200"><s-heading>No widgets found</s-heading><s-text color="subdued">Try adjusting your search or filter.</s-text></s-stack></s-section>)}
    </s-stack>
  </s-page>);
}

const WidgetToggle = ({ comp, onToggle }) => <label /* eslint-disable-line jsx-a11y/label-has-associated-control -- label wraps its own input; accessible text comes from nested content */ className="toggle-switch" title={comp.enabled ? "Disable widget" : "Enable widget"}>
  <input type="checkbox" aria-label={`${comp.name} enabled`} checked={comp.enabled} onChange={() => onToggle(comp.id)} />
  <span className="toggle-slider" />
</label>;

const WidgetCard = ({ comp, onToggle }) => <div className={`vsn-widget-card${comp.enabled ? '' : ' is-off'}`}>
  <div className="vsn-widget-card__top"><span className="vsn-widget-card__icon">{iconMap[comp.icon] || <Box size={18} />}</span><WidgetToggle comp={comp} onToggle={onToggle}/></div>
  <strong className="vsn-widget-card__name">{comp.name}</strong>
  <p className="vsn-widget-card__desc">{comp.description}</p>
  <div className="vsn-widget-card__foot"><s-badge>{comp.category}</s-badge><s-badge tone={comp.enabled ? 'success' : 'neutral'}>{comp.enabled ? 'Active' : 'Disabled'}</s-badge></div>
</div>;

const WidgetListRow = ({ comp, onToggle }) => <div className={`vsn-widget-row${comp.enabled ? '' : ' is-off'}`}>
  <span className="vsn-widget-card__icon">{iconMap[comp.icon] || <Box size={16} />}</span>
  <div className="vsn-widget-row__text"><strong>{comp.name}</strong><span>{comp.description}</span></div>
  <s-badge>{comp.category}</s-badge><s-badge tone={comp.enabled ? 'success' : 'neutral'}>{comp.enabled ? 'Active' : 'Disabled'}</s-badge><WidgetToggle comp={comp} onToggle={onToggle}/>
</div>;
