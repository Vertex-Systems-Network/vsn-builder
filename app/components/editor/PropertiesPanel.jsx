import { VsnButton, VsnTextField, VsnNumberField, VsnTextArea, VsnSelect, VsnOption, VsnCheckbox, VsnUnitField } from "./EditorUi";
import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router';
import { DynamicSourcePanel, DynamicBindingsPanel, ConditionsBuilder, ResponsivePanel, AdvancedLayoutPanel, StateStylesPanel, BreakpointControls } from "./AdvancedBuilderControls";
import PolarisIcon from '../ui/PolarisIcon';
import { ColorGradientControl, CssLengthControl, DimensionsControl, SelectControl, SliderControl, TextControl, NumberControl, TypographyControl, DateTimeControl, TimeControl, CustomCssControl, CustomJsControl, GalleryControl, RepeaterControl, UrlControl, MediaControl, ImageDimensionsControl, IconControl, TextShadowControl, BoxShadowControl, TextStrokeControl, BorderControl, BackgroundControl } from './EditorControls';
import FilterEffectsControl from './FilterEffectsControl';
import FontFamilyControl from './fonts/FontFamilyControl';
import { getWidgetCapabilities } from '../../builder/widgetCapabilities';
import WidgetSpecificStyleControls from './WidgetSpecificStyleControls';
import { normalizeControlOptions } from '../../builder/controlSchema';
import { normalizeElementInteractions, mergeElementInteractions } from '../../builder/interactionSchema.js';
import { IMAGE_SOURCE_OPTIONS, IMAGE_RESOLUTION_OPTIONS, normalizeImageWidgetProps } from '../../builder/imageWidget.js';
import { GALLERY_LAYOUT_OPTIONS, GALLERY_RATIO_OPTIONS, normalizeGalleryWidgetProps } from '../../builder/galleryWidget.js';
import { VIDEO_SOURCE_OPTIONS, normalizeVideoWidgetProps } from '../../builder/videoWidget.js';
import { SLIDER_DIRECTION_OPTIONS, SLIDER_EFFECT_OPTIONS, SLIDER_PAGINATION_OPTIONS, createSliderSlide, duplicateSliderSlide, normalizeSliderProps } from '../../builder/sliderWidget.js';
import { createNestedCarouselItem, duplicateNestedCarouselItem, isNestedSliderType, nestedItemNoun, normalizeNestedSliderProps } from '../../builder/nestedCarouselWidget.js';
import { supportsStructuredItems, structuredItemSchema, normalizeStructuredItems, createStructuredItem, structuredItemsToLegacyText } from '../../builder/structuredItems.js';
import { dynamicFieldsForWidget } from '../../builder/dynamicBindings.js';
import { IMAGE_RESOLUTION_OPTIONS as CONTEXT_IMAGE_RESOLUTION_OPTIONS, normalizeContextImageProps } from '../../builder/contextMediaWidget.js';
import { GRID_SORT_OPTIONS, PRODUCT_GRID_SOURCE_OPTIONS, normalizeGridProps } from '../../builder/dataGridWidget.js';
import { QUERY_SOURCE_OPTIONS, QUERY_SORT_OPTIONS, QUERY_FILTER_FIELDS, createQueryFilter, normalizeQueryDefinition, queryCostEstimate, querySummary } from '../../builder/queryBuilder.js';
import { componentDefinitionFromLibraryItem, componentPropValue, resolveComponentInstance } from '../../builder/componentSystem.js';
import PreviewRenderer from './PreviewRenderer.jsx';
import InteractionTimelinePanel from './InteractionTimelinePanel.jsx';
import MotionLibrarySelect from './MotionLibrarySelect.jsx';
import SdkControlPanel from './SdkControlPanel.jsx';
function SectionHeader({ title, children }) {
  const [open, setOpen] = useState(true);
  return (<section className="vsn-inspector-section">
    <button type="button" className="vsn-inspector-section-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span>{title}</span>
      <span className={`vsn-inspector-chevron ${open ? "is-open" : ""}`}><PolarisIcon type="chevron-right" size="small" /></span>
    </button>
    {open ? <div className="vsn-inspector-section-body">{children}</div> : null}
  </section>);
}
function Label({ children }) {
  return <p className="vsn-field-caption">{children}</p>;
}
function ColorInput({ value, onChange }) {
  return <ColorGradientControl solidOnly value={{ type: 'color', color: value ?? '#000000' }} onChange={(next) => onChange(next.color)} />;
}
function NumberInput({ value, onChange, unit = "px", placeholder = "0" }) {
  return <VsnUnitField value={value ?? ""} unit={unit} placeholder={placeholder} onInput={(event) => onChange(event.currentTarget.value)} />;
}
function Select({ value, onChange, options = [] }) {
  const normalized = normalizeControlOptions(options);
  return <VsnSelect label="Select option" labelAccessibilityVisibility="exclusive" value={value ?? ""} onChange={(event) => onChange(event.currentTarget.value)}>{normalized.map((option, index) => <VsnOption key={`${option.value}-${index}`} value={option.value}>{String(option.label)}</VsnOption>)}</VsnSelect>;
}
function CheckboxControl({ label, checked, onChange }) {
  return <VsnCheckbox checked={checked} onChange={(event) => onChange(event.currentTarget.checked)}>{label}</VsnCheckbox>;
}
function LoopQuerySettingsPanel({ props, updateProps }) {
  const fetcher = useFetcher();
  const query = normalizeQueryDefinition(props.query || {});
  const cost = queryCostEstimate(query);
  const preview = fetcher.data?.intent === "query-preview" ? fetcher.data : null;
  const updateQuery = (patch) => updateProps({ query: normalizeQueryDefinition({ ...query, ...patch }) });
  const updateFilter = (index, patch) => updateQuery({ filters: query.filters.map((filter, i) => i === index ? { ...filter, ...patch } : filter) });
  const removeFilter = (index) => updateQuery({ filters: query.filters.filter((_, i) => i !== index) });
  const sourceLabel = QUERY_SOURCE_OPTIONS.find((option) => option.value === query.source)?.label || query.source;
  const sortOptions = QUERY_SORT_OPTIONS[query.source] || QUERY_SORT_OPTIONS.products || [];
  const filterFields = QUERY_FILTER_FIELDS[query.source] || [];
  const runPreview = () => {
    const form = new FormData();
    form.set("intent", "query-preview");
    form.set("query", JSON.stringify(query));
    fetcher.submit(form, { method: "post" });
  };
  return <>
    <div><Label>Data source</Label><Select value={query.source} onChange={(source)=>updateQuery({ source, sort:(QUERY_SORT_OPTIONS[source]||[])[0]?.value || "featured", filters:[] })} options={QUERY_SOURCE_OPTIONS}/></div>
    {query.source === "metaobjects" ? <VsnTextField label="Metaobject type" value={query.metaobjectType || ""} placeholder="e.g. product_feature" onInput={(e)=>updateQuery({metaobjectType:e.currentTarget.value})}/> : null}
    {query.source === "metafield-references" ? <div className="space-y-2"><div><Label>Owner</Label><Select value={query.metafieldOwner || "product"} onChange={(v)=>updateQuery({metafieldOwner:v})} options={[{value:"product",label:"Current Product"},{value:"collection",label:"Current Collection"}]}/></div><div className="grid grid-cols-2 gap-2"><VsnTextField label="Namespace" value={query.metafieldNamespace || "custom"} onInput={(e)=>updateQuery({metafieldNamespace:e.currentTarget.value})}/><VsnTextField label="Key" value={query.metafieldKey || ""} onInput={(e)=>updateQuery({metafieldKey:e.currentTarget.value})}/></div></div> : null}
    {query.source === "sdk-provider" ? <div className="space-y-2"><VsnTextField label="Provider ID" value={query.providerId || ""} placeholder="example:static-items or shopify:products" onInput={(e)=>updateQuery({providerId:e.currentTarget.value})}/><VsnTextArea label="Provider input (JSON)" value={query.providerInputJson || "{}"} onInput={(e)=>updateQuery({providerInputJson:e.currentTarget.value})}/><p className="text-[10px] leading-4 text-[#6d7175]">Provider IDs are registered by VSN core or bundled plugins. External providers are subject to SDK network restrictions.</p></div> : null}
    <VsnTextField label="Shopify search query" value={query.query || ""} placeholder={query.source === "search" ? "Search phrase" : "Optional Shopify query syntax"} onInput={(e)=>updateQuery({query:e.currentTarget.value})}/>
    <div><Label>Sort</Label><Select value={query.sort} onChange={(v)=>updateQuery({sort:v})} options={sortOptions}/></div>
    <div className="grid grid-cols-2 gap-2"><VsnNumberField label="Limit" min="1" max="100" value={query.limit} onInput={(e)=>updateQuery({limit:Math.max(1,Math.min(100,Number(e.currentTarget.value)||1))})}/><VsnNumberField label="Offset" min="0" max="500" value={query.offset} onInput={(e)=>updateQuery({offset:Math.max(0,Number(e.currentTarget.value)||0)})}/></div>
    <div><Label>Pagination mode</Label><Select value={query.pagination} onChange={(v)=>updateQuery({pagination:v})} options={[{value:"none",label:"None"},{value:"load-more",label:"Load More"},{value:"cursor",label:"Cursor / API"}]}/></div>
    <div className="rounded-lg border border-[#e3e3e3] bg-[#fafafa] p-2.5 space-y-2">
      <div className="flex items-center justify-between"><span className="text-[11px] font-semibold">Filters</span><VsnButton type="button" size="sm" onClick={()=>updateQuery({filters:[...query.filters,createQueryFilter({field:filterFields[0] || "title"})]})}>Add filter</VsnButton></div>
      {!query.filters.length ? <p className="text-[10px] text-[#8c9196]">No filters. Shopify query syntax above can still filter results.</p> : query.filters.map((filter,index)=><div key={filter.id || index} className="rounded-md border border-[#e3e3e3] bg-white p-2 space-y-2"><div className="grid grid-cols-2 gap-2"><Select value={filter.field} onChange={(v)=>updateFilter(index,{field:v})} options={filterFields.length?filterFields:[{value:"title",label:"Title"}]}/><Select value={filter.operator} onChange={(v)=>updateFilter(index,{operator:v})} options={[{value:"contains",label:"Contains"},{value:"equals",label:"Equals"},{value:"not-equals",label:"Not Equals"},{value:"starts-with",label:"Starts With"},{value:"exists",label:"Exists"},{value:"not-contains",label:"Does Not Contain"}]}/></div>{filter.operator !== "exists"?<VsnTextField label="Filter value" value={filter.value || ""} onInput={(e)=>updateFilter(index,{value:e.currentTarget.value})}/>:null}<VsnButton type="button" tone="critical" size="sm" onClick={()=>removeFilter(index)}>Remove filter</VsnButton></div>)}
    </div>
    <div className="grid grid-cols-3 gap-2"><VsnNumberField label="Desktop" min="1" max="12" value={props.columnsDesktop ?? 4} onInput={(e)=>updateProps({columnsDesktop:Math.max(1,Math.min(12,Number(e.currentTarget.value)||1))})}/><VsnNumberField label="Tablet" min="1" max="8" value={props.columnsTablet ?? 2} onInput={(e)=>updateProps({columnsTablet:Math.max(1,Math.min(8,Number(e.currentTarget.value)||1))})}/><VsnNumberField label="Mobile" min="1" max="4" value={props.columnsMobile ?? 1} onInput={(e)=>updateProps({columnsMobile:Math.max(1,Math.min(4,Number(e.currentTarget.value)||1))})}/></div>
    <VsnNumberField label="Item gap" min="0" max="200" value={props.gap ?? 20} onInput={(e)=>updateProps({gap:Math.max(0,Number(e.currentTarget.value)||0)})}/>
    <div className="grid grid-cols-1 gap-2"><VsnTextField label="Empty state" value={query.emptyText || "No items found."} onInput={(e)=>updateQuery({emptyText:e.currentTarget.value})}/><VsnTextField label="Loading state" value={query.loadingText || "Loading…"} onInput={(e)=>updateQuery({loadingText:e.currentTarget.value})}/><VsnTextField label="Error state" value={query.errorText || "Could not load items."} onInput={(e)=>updateQuery({errorText:e.currentTarget.value})}/></div>
    <div className={`rounded-lg border p-2.5 ${cost.level === "high" ? "border-[#e51c00] bg-[#fff4f4]" : cost.level === "medium" ? "border-[#f4b000] bg-[#fff9e8]" : "border-[#b7e4c7] bg-[#f3fbf5]"}`}><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold">Query estimate</span><span className="text-[10px] uppercase">{cost.level}</span></div><p className="mt-1 text-[10px] text-[#6d7175]">{querySummary(query)} · estimated cost {cost.estimate}</p></div>
    <VsnButton type="button" onClick={runPreview} loading={fetcher.state !== "idle"}>Preview query results</VsnButton>
    {preview ? <div className="rounded-lg border border-[#e3e3e3] bg-white p-2.5"><div className="flex items-center justify-between"><span className="text-[11px] font-semibold">{sourceLabel} preview</span><span className="text-[10px] text-[#6d7175]">{preview.total ?? preview.items?.length ?? 0} result(s)</span></div>{preview.success === false ? <p className="mt-2 text-[10px] text-[#bf0711]">{preview.error}</p> : <div className="mt-2 space-y-1">{(preview.items || []).slice(0,5).map((item,index)=><div key={item.id || index} className="rounded border border-[#eee] px-2 py-1.5"><p className="text-[10px] font-medium">{item.title || item.displayName || item.handle || `Item ${index+1}`}</p><p className="text-[9px] text-[#8c9196]">{item.meta || item.vendor || item.type || ""}</p></div>)}{!(preview.items || []).length ? <p className="text-[10px] text-[#8c9196]">No preview results.</p> : null}</div>}</div> : null}
    <p className="text-[10px] leading-4 text-[#6d7175]">The first child is the reusable Loop Item template. Bind its fields with Dynamic Bindings → Loop Item sources.</p>
  </>;
}
function GallerySettingsPanel({ props, updateProps }) {
  const gallery = normalizeGalleryWidgetProps(props);
  const updateItem = (index, patch) => updateProps({ galleryItems: gallery.galleryItems.map((item, i) => i === index ? { ...item, ...patch } : item) });
  const moveItemTo = (index, target) => {
    if (index < 0 || target < 0 || index >= gallery.galleryItems.length || target >= gallery.galleryItems.length || index === target) return;
    const next = [...gallery.galleryItems];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    updateProps({ galleryItems: next });
  };
  const moveItem = (index, offset) => moveItemTo(index, index + offset);
  return <>
    <GalleryControl label="Gallery Images" value={gallery.galleryItems} max={50} onChange={(items)=>updateProps({ galleryItems: items })} />
    {gallery.galleryItems.length ? <div className="space-y-2">
      {gallery.galleryItems.map((item,index)=><div key={item.id || `${item.url}-${index}`} onDragOver={(event)=>{if(event.dataTransfer.types.includes("text/vsn-gallery-index")){event.preventDefault();event.dataTransfer.dropEffect="move";}}} onDrop={(event)=>{const from=Number(event.dataTransfer.getData("text/vsn-gallery-index"));if(Number.isInteger(from)){event.preventDefault();moveItemTo(from,index);}}} className="rounded-lg border border-[#e3e3e3] bg-white p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-[11px] font-semibold"><span draggable onDragStart={(event)=>{event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/vsn-gallery-index",String(index));}} onDragEnd={(event)=>event.currentTarget.blur?.()} title="Drag to reorder" className="cursor-grab select-none rounded px-1 text-[#8c9196] active:cursor-grabbing">⋮⋮</span>Image {index+1}</span><div className="flex gap-1"><VsnButton type="button" variant="icon" size="sm" title="Move up" accessibilityLabel="Move up" disabled={index===0} onClick={()=>moveItem(index,-1)}>↑</VsnButton><VsnButton type="button" variant="icon" size="sm" title="Move down" accessibilityLabel="Move down" disabled={index===gallery.galleryItems.length-1} onClick={()=>moveItem(index,1)}>↓</VsnButton><VsnButton type="button" variant="icon" size="sm" tone="critical" title="Remove" accessibilityLabel="Remove" onClick={()=>updateProps({galleryItems:gallery.galleryItems.filter((_,i)=>i!==index)})}><PolarisIcon type="delete" size={14}/></VsnButton></div></div>
        <VsnTextField label="Alt text" value={item.alt || ""} onInput={(e)=>updateItem(index,{alt:e.currentTarget.value})}/>
        <VsnTextField label="Caption" value={item.caption || ""} onInput={(e)=>updateItem(index,{caption:e.currentTarget.value})}/>
        <VsnTextField label="Custom link" value={item.linkUrl || ""} placeholder="https:// or /pages/..." onInput={(e)=>updateItem(index,{linkUrl:e.currentTarget.value})}/>
      </div>)}
    </div>:null}
    <div><Label>Layout</Label><Select value={gallery.layout} onChange={(v)=>updateProps({layout:v})} options={GALLERY_LAYOUT_OPTIONS}/></div>
    <div className="grid grid-cols-3 gap-2"><VsnNumberField label="Desktop columns" min="1" max="8" value={gallery.columnsDesktop} onInput={(e)=>updateProps({columnsDesktop:Math.max(1,Math.min(8,Number(e.currentTarget.value)||1))})}/><VsnNumberField label="Tablet columns" min="1" max="6" value={gallery.columnsTablet} onInput={(e)=>updateProps({columnsTablet:Math.max(1,Math.min(6,Number(e.currentTarget.value)||1))})}/><VsnNumberField label="Mobile columns" min="1" max="4" value={gallery.columnsMobile} onInput={(e)=>updateProps({columnsMobile:Math.max(1,Math.min(4,Number(e.currentTarget.value)||1))})}/></div>
    <div className="grid grid-cols-2 gap-2"><VsnNumberField label="Column gap" min="0" max="200" value={gallery.gap} onInput={(e)=>updateProps({gap:Math.max(0,Number(e.currentTarget.value)||0)})}/><VsnNumberField label="Row gap" min="0" max="200" value={gallery.rowGap} onInput={(e)=>updateProps({rowGap:Math.max(0,Number(e.currentTarget.value)||0)})}/></div>
    <div><Label>Image ratio</Label><Select value={gallery.imageRatio} onChange={(v)=>updateProps({imageRatio:v})} options={GALLERY_RATIO_OPTIONS}/></div>
    {gallery.imageRatio === "custom" ? <div className="grid grid-cols-2 gap-2"><VsnNumberField label="Ratio width" min="1" max="100" value={gallery.customRatioWidth} onInput={(e)=>updateProps({customRatioWidth:Math.max(1,Number(e.currentTarget.value)||1)})}/><VsnNumberField label="Ratio height" min="1" max="100" value={gallery.customRatioHeight} onInput={(e)=>updateProps({customRatioHeight:Math.max(1,Number(e.currentTarget.value)||1)})}/></div>:null}
    <div><Label>Object fit</Label><Select value={gallery.objectFit} onChange={(v)=>updateProps({objectFit:v})} options={[{value:"cover",label:"Cover"},{value:"contain",label:"Contain"},{value:"fill",label:"Fill"},{value:"scale-down",label:"Scale Down"}]}/></div>
    <div><Label>Click action</Label><Select value={gallery.clickAction} onChange={(v)=>updateProps({clickAction:v})} options={[{value:"none",label:"None"},{value:"lightbox",label:"Lightbox"},{value:"link",label:"Custom Link"}]}/></div>
    <CheckboxControl label="Show captions" checked={gallery.showCaptions} onChange={(v)=>updateProps({showCaptions:v})}/>
    {gallery.clickAction === "link" ? <CheckboxControl label="Open links in new tab" checked={gallery.openLinksNewTab} onChange={(v)=>updateProps({openLinksNewTab:v})}/>:null}
  </>;
}

function VideoSettingsPanel({ props, updateProps }) {
  const video = normalizeVideoWidgetProps(props);
  return <>
    <div><Label>Video source</Label><Select value={video.sourceType} onChange={(v)=>updateProps({sourceType:v})} options={VIDEO_SOURCE_OPTIONS}/></div>
    {video.sourceType === "shopify" ? <MediaControl label="Shopify Video" mediaTypes={["Video"]} accept="video/*" value={video.videoMedia} onChange={(media)=>updateProps({videoMedia:media,url:media?.url||""})}/>:<VsnTextField label="Video URL" value={props.url || ""} placeholder="YouTube, Vimeo, Dailymotion or MP4/WebM URL" onInput={(e)=>updateProps({url:e.currentTarget.value})}/>} 
    <p className="text-[10px] leading-4 text-[#6d7175]">Detected provider: <strong>{video.provider === "direct" ? "Direct / HTML5" : video.provider[0].toUpperCase()+video.provider.slice(1)}</strong></p>
    <div className="grid grid-cols-2 gap-2"><VsnNumberField label="Start time (sec)" min="0" value={video.startTime} onInput={(e)=>updateProps({startTime:Math.max(0,Number(e.currentTarget.value)||0)})}/><VsnNumberField label="End time (sec)" min="0" value={video.endTime} onInput={(e)=>updateProps({endTime:Math.max(0,Number(e.currentTarget.value)||0)})}/></div>
    <CheckboxControl label="Autoplay" checked={video.autoplay} onChange={(v)=>updateProps({autoplay:v})}/>
    <CheckboxControl label="Mute" checked={video.muted} onChange={(v)=>updateProps({muted:v})}/>
    {video.autoplay && !video.muted ? <p className="text-[10px] leading-4 text-amber-700">Browsers normally block autoplay with sound. Muted autoplay is recommended.</p>:null}
    <CheckboxControl label="Loop" checked={video.loop} onChange={(v)=>updateProps({loop:v})}/>
    <CheckboxControl label="Player controls" checked={video.controls} onChange={(v)=>updateProps({controls:v})}/>
    <CheckboxControl label="Play inline" checked={video.playsInline} onChange={(v)=>updateProps({playsInline:v})}/>
    <SliderControl label="Default volume" value={video.defaultVolume} min={0} max={100} step={1} suffix="%" onChange={(v)=>updateProps({defaultVolume:Number(v)})}/>
    <div><Label>Preload</Label><Select value={video.preload} onChange={(v)=>updateProps({preload:v})} options={[{value:"none",label:"None"},{value:"metadata",label:"Metadata"},{value:"auto",label:"Auto"}]}/></div>
    <CheckboxControl label="Lazy load external player" checked={video.lazyLoad} onChange={(v)=>updateProps({lazyLoad:v})}/>
    <CheckboxControl label="Use poster / image overlay" checked={video.posterEnabled} onChange={(v)=>updateProps({posterEnabled:v})}/>
    {video.posterEnabled ? <MediaControl label="Poster Image" value={video.poster} onChange={(media)=>updateProps({poster:media})}/>:null}
    <CheckboxControl label="Show play icon" checked={video.showPlayIcon} onChange={(v)=>updateProps({showPlayIcon:v})}/>
    {video.showPlayIcon ? <><IconControl label="Play Icon" value={video.playIcon} onChange={(value)=>updateProps({playIcon:value||{}})}/><SliderControl label="Play icon size" value={video.playIconSize} min={20} max={160} step={1} suffix="px" onChange={(v)=>updateProps({playIconSize:Number(v)})}/></>:null}
  </>;
}

function SliderSettingsPanel({ selectedElement, props, onUpdate, nestedType = "slider" }) {
  const isNested = nestedType !== "slider";
  const settings = isNested ? normalizeNestedSliderProps(nestedType, props) : normalizeSliderProps(props);
  const noun = isNested ? nestedItemNoun(nestedType) : "Slide";
  const slides = Array.isArray(selectedElement?.children) ? selectedElement.children : [];
  const commitSlides = (next) => onUpdate(selectedElement.id,{children:next});
  const rename = (index,label) => commitSlides(slides.map((slide,i)=>i===index?{...slide,label:label||`${noun} ${index+1}`,props:{...(slide.props||{}),...(isNested?{__nestedSliderItem:true,nestedSliderType:nestedType}:{__sliderSlide:true}),slideLabel:label||`${noun} ${index+1}`}}:slide));
  const move = (index,offset) => { const target=index+offset; if(target<0||target>=slides.length)return; const next=[...slides]; [next[index],next[target]]=[next[target],next[index]]; commitSlides(next); };
  const update = (patch) => onUpdate(selectedElement.id,{props:{...props,...patch}});
  return <>
    <div className="space-y-2">
      <Label>{noun}s</Label>
      {slides.map((slide,index)=><div key={slide.id} className="flex items-center gap-1 rounded-lg border border-[#e3e3e3] bg-white p-1.5"><VsnTextField label={`${noun} ${index+1} name`} labelAccessibilityVisibility="exclusive" value={slide.props?.slideLabel||slide.label||`${noun} ${index+1}`} onInput={(e)=>rename(index,e.currentTarget.value)}/><VsnButton type="button" variant="icon" size="sm" title="Move up" disabled={index===0} onClick={()=>move(index,-1)}>↑</VsnButton><VsnButton type="button" variant="icon" size="sm" title="Move down" disabled={index===slides.length-1} onClick={()=>move(index,1)}>↓</VsnButton><VsnButton type="button" variant="icon" size="sm" title="Duplicate" onClick={()=>commitSlides([...slides.slice(0,index+1),(isNested?duplicateNestedCarouselItem(slide,nestedType,index):duplicateSliderSlide(slide,index)),...slides.slice(index+1)])}><PolarisIcon type="clipboard" size={14}/></VsnButton><VsnButton type="button" variant="icon" size="sm" tone="critical" title="Delete" disabled={slides.length<=1} onClick={()=>commitSlides(slides.filter((_,i)=>i!==index))}><PolarisIcon type="delete" size={14}/></VsnButton></div>)}
      <VsnButton type="button" variant="tertiary" size="sm" onClick={()=>commitSlides([...slides,(isNested?createNestedCarouselItem(nestedType,slides.length):createSliderSlide(slides.length))])}><PolarisIcon type="plus" size={15}/> {isNested ? `Add ${noun}` : "Add Slide"}</VsnButton>
      <p className="text-[10px] leading-4 text-[#6d7175]">Select an item on the canvas, then drag any widget into its + drop area.</p>
    </div>
    <div><Label>Direction</Label><Select value={settings.direction} onChange={(v)=>update({direction:v})} options={SLIDER_DIRECTION_OPTIONS}/></div>
    <div className="grid grid-cols-3 gap-2"><VsnNumberField label="Desktop" min="1" max="6" value={settings.slidesDesktop} onInput={(e)=>update({slidesDesktop:Math.max(1,Number(e.currentTarget.value)||1)})}/><VsnNumberField label="Tablet" min="1" max="4" value={settings.slidesTablet} onInput={(e)=>update({slidesTablet:Math.max(1,Number(e.currentTarget.value)||1)})}/><VsnNumberField label="Mobile" min="1" max="2" value={settings.slidesMobile} onInput={(e)=>update({slidesMobile:Math.max(1,Number(e.currentTarget.value)||1)})}/></div>
    <div className="grid grid-cols-2 gap-2"><VsnNumberField label="Gap" min="0" max="200" value={settings.gap} onInput={(e)=>update({gap:Math.max(0,Number(e.currentTarget.value)||0)})}/><VsnNumberField label="Edge padding" min="0" max="400" value={settings.edgePadding} onInput={(e)=>update({edgePadding:Math.max(0,Number(e.currentTarget.value)||0)})}/></div>
    <CheckboxControl label="Auto height" checked={settings.autoHeight} onChange={(v)=>update({autoHeight:v})}/><CheckboxControl label="Equal height slides" checked={settings.equalHeight} onChange={(v)=>update({equalHeight:v})}/><CheckboxControl label="Centered slides" checked={settings.centered} onChange={(v)=>update({centered:v})}/>
    <div><Label>Transition</Label><Select value={settings.effect} onChange={(v)=>update({effect:v})} options={SLIDER_EFFECT_OPTIONS}/></div>
    <SliderControl label="Transition speed" value={settings.speed} min={0} max={3000} step={50} suffix="ms" onChange={(v)=>update({speed:Number(v)})}/>
    <CheckboxControl label="Autoplay" checked={settings.autoplay} onChange={(v)=>update({autoplay:v})}/>{settings.autoplay?<><VsnNumberField label="Autoplay delay (ms)" min="500" max="60000" value={settings.autoplayDelay} onInput={(e)=>update({autoplayDelay:Math.max(500,Number(e.currentTarget.value)||4500)})}/><CheckboxControl label="Pause on hover" checked={settings.pauseOnHover} onChange={(v)=>update({pauseOnHover:v})}/><CheckboxControl label="Pause after interaction" checked={settings.pauseOnInteraction} onChange={(v)=>update({pauseOnInteraction:v})}/><CheckboxControl label="Stop on last slide" checked={settings.stopOnLastSlide} onChange={(v)=>update({stopOnLastSlide:v})}/></>:null}
    <CheckboxControl label="Infinite loop" checked={settings.loop} onChange={(v)=>update({loop:v})}/><CheckboxControl label="Rewind at end" checked={settings.rewind} onChange={(v)=>update({rewind:v})}/><CheckboxControl label="Navigation arrows" checked={settings.navigation} onChange={(v)=>update({navigation:v})}/>{settings.navigation?<div className="grid grid-cols-2 gap-2"><VsnTextField label="Previous icon" value={settings.previousIcon} onInput={(e)=>update({previousIcon:e.currentTarget.value})}/><VsnTextField label="Next icon" value={settings.nextIcon} onInput={(e)=>update({nextIcon:e.currentTarget.value})}/></div>:null}
    <div><Label>Pagination</Label><Select value={settings.pagination} onChange={(v)=>update({pagination:v})} options={SLIDER_PAGINATION_OPTIONS}/></div>
    <CheckboxControl label="Swipe / drag" checked={settings.swipe} onChange={(v)=>update({swipe:v})}/><CheckboxControl label="Keyboard navigation" checked={settings.keyboard} onChange={(v)=>update({keyboard:v})}/>
  </>;
}

function StructuredItemsPanel({ type, props, updateProps }) {
  const items = normalizeStructuredItems(type, props);
  const schema = structuredItemSchema(type);
  if (!schema.length) return null;
  const commit = (next) => updateProps({ items: next, itemsText: structuredItemsToLegacyText(type, next) });
  const updateItem = (index, patch) => commit(items.map((item,i)=>i===index?{...item,...patch}:item));
  const move = (index, offset) => { const target=index+offset; if(target<0||target>=items.length)return; const next=[...items]; [next[index],next[target]]=[next[target],next[index]]; commit(next); };
  return <div className="space-y-2">
    <div className="flex items-center justify-between"><Label>Items</Label><span className="text-[9px] text-[#8c9196]">Structured repeater</span></div>
    {items.map((item,index)=><div key={item.id||index} className="rounded-lg border border-[#e3e3e3] bg-white p-2.5">
      <div className="mb-2 flex items-center justify-between"><strong className="text-[10px]">Item {index+1}</strong><div className="flex gap-1"><VsnButton type="button" variant="icon" size="sm" disabled={index===0} onClick={()=>move(index,-1)}>↑</VsnButton><VsnButton type="button" variant="icon" size="sm" disabled={index===items.length-1} onClick={()=>move(index,1)}>↓</VsnButton><VsnButton type="button" variant="icon" size="sm" tone="critical" onClick={()=>commit(items.filter((_,i)=>i!==index))}><PolarisIcon type="delete" size={14}/></VsnButton></div></div>
      <div className="space-y-2">{schema.map(([key,label,fieldType])=>fieldType==='textarea'?<VsnTextArea key={key} label={label} value={item[key]||''} onInput={(e)=>updateItem(index,{[key]:e.currentTarget.value})}/>:fieldType==='media'?<MediaControl key={key} label={label} value={item[key]?{url:item[key]}:{}} onChange={(media)=>updateItem(index,{[key]:typeof media==='string'?media:(media?.url||'')})}/>:<VsnTextField key={key} label={label} value={item[key]||''} onInput={(e)=>updateItem(index,{[key]:e.currentTarget.value})}/>)}</div>
    </div>)}
    <VsnButton type="button" variant="tertiary" size="sm" onClick={()=>commit([...items,createStructuredItem(type,items.length)])}><PolarisIcon type="plus" size={14}/> Add item</VsnButton>
    {!items.length?<div className="rounded-lg border border-dashed border-[#c9cccf] bg-[#fafafa] p-4 text-center text-[10px] text-[#6d7175]">No items yet. Add the first structured item.</div>:null}
  </div>;
}

function ContextImageSettingsPanel({ props, updateProps, label='Fallback Image', gallery=false }) {
  const media = normalizeContextImageProps(props);
  return <>
    {!gallery ? <MediaControl label={label} value={media.fallbackMedia?.url?media.fallbackMedia:(media.fallbackSrc?{url:media.fallbackSrc}:{})} onChange={(value)=>updateProps({fallbackMedia:typeof value==='string'?{url:value}:(value||{}),fallbackSrc:typeof value==='string'?value:(value?.url||'')})}/> : null}
    <div><Label>Main image resolution</Label><Select value={media.resolution} onChange={(resolution)=>updateProps({resolution})} options={CONTEXT_IMAGE_RESOLUTION_OPTIONS}/></div>
    {media.resolution==='custom'?<div className="grid grid-cols-2 gap-2"><VsnNumberField label="Custom width" min="1" max="5760" value={media.customWidth||''} onInput={(e)=>updateProps({customWidth:e.currentTarget.value})}/><VsnNumberField label="Custom height" min="1" max="5760" value={media.customHeight||''} onInput={(e)=>updateProps({customHeight:e.currentTarget.value})}/></div>:null}
    {gallery ? <><div><Label>Thumbnail position</Label><Select value={props.thumbnailPosition||'bottom'} onChange={(thumbnailPosition)=>updateProps({thumbnailPosition})} options={[{value:'bottom',label:'Bottom'},{value:'top',label:'Top'},{value:'left',label:'Left'},{value:'right',label:'Right'}]}/></div><div><Label>Thumbnail resolution</Label><Select value={props.thumbnailResolution||'320'} onChange={(thumbnailResolution)=>updateProps({thumbnailResolution})} options={CONTEXT_IMAGE_RESOLUTION_OPTIONS.filter(item=>item.value!=='custom')}/></div><CheckboxControl label="Open main image in lightbox" checked={props.lightbox!==false} onChange={(lightbox)=>updateProps({lightbox})}/></> : <><div><Label>Alt text</Label><Select value={media.altMode} onChange={(altMode)=>updateProps({altMode})} options={[{value:'context',label:'Use Shopify / Context Alt'},{value:'custom',label:'Custom Alt Text'},{value:'decorative',label:'Decorative (Empty Alt)'}]}/></div>{media.altMode==='custom'?<VsnTextField label="Custom alt text" value={media.alt||''} onInput={(e)=>updateProps({alt:e.currentTarget.value})}/>:null}<CheckboxControl label="Open image in lightbox" checked={media.lightbox} onChange={(lightbox)=>updateProps({lightbox})}/></>}
    <div className="grid grid-cols-2 gap-2"><div><Label>Loading</Label><Select value={media.loading} onChange={(loading)=>updateProps({loading})} options={[{value:'lazy',label:'Lazy'},{value:'eager',label:'Eager'}]}/></div><div><Label>Fetch priority</Label><Select value={media.fetchPriority} onChange={(fetchPriority)=>updateProps({fetchPriority})} options={[{value:'auto',label:'Auto'},{value:'high',label:'High'},{value:'low',label:'Low'}]}/></div></div>
  </>;
}

function DataGridSettingsPanel({ type, props, updateProps }) {
  const grid = normalizeGridProps(type, props);
  const isProduct = ['product-grid','product-card'].includes(type);
  const isCollection = type==='collection-grid';
  const isSearch = type==='search-results-grid';
  const isBlog = type==='blog-article-grid' || type==='related-articles';
  const isCommerceRuntime = ['product-recommendations','recently-viewed','upsell-products'].includes(type);
  return <>
    {isProduct?<div><Label>Source</Label><Select value={grid.source} onChange={(source)=>updateProps({source})} options={PRODUCT_GRID_SOURCE_OPTIONS}/></div>:null}
    {(isProduct||isCollection)?<><VsnTextField label="Search / query" value={grid.query} placeholder="Optional title, tag, vendor…" onInput={(e)=>updateProps({query:e.currentTarget.value})}/><div><Label>Sort</Label><Select value={grid.sortBy} onChange={(sortBy)=>updateProps({sortBy})} options={GRID_SORT_OPTIONS}/></div></>:null}
    {isCommerceRuntime?<VsnTextField label="Heading" value={props.heading||''} onInput={(e)=>updateProps({heading:e.currentTarget.value})}/>:null}
    <VsnNumberField label="Items" min="1" max="50" value={grid.limit} onInput={(e)=>updateProps({limit:Math.max(1,Math.min(50,Number(e.currentTarget.value)||1))})}/>
    <div className="grid grid-cols-3 gap-2"><VsnNumberField label="Desktop" min="1" max="6" value={grid.columnsDesktop} onInput={(e)=>updateProps({columnsDesktop:Math.max(1,Number(e.currentTarget.value)||1),columns:Math.max(1,Number(e.currentTarget.value)||1)})}/><VsnNumberField label="Tablet" min="1" max="4" value={grid.columnsTablet} onInput={(e)=>updateProps({columnsTablet:Math.max(1,Number(e.currentTarget.value)||1)})}/><VsnNumberField label="Mobile" min="1" max="2" value={grid.columnsMobile} onInput={(e)=>updateProps({columnsMobile:Math.max(1,Number(e.currentTarget.value)||1)})}/></div>
    <VsnNumberField label="Gap" min="0" max="120" value={grid.gap} onInput={(e)=>updateProps({gap:Math.max(0,Number(e.currentTarget.value)||0)})}/>
    <div><Label>Image ratio</Label><Select value={grid.imageRatio} onChange={(imageRatio)=>updateProps({imageRatio})} options={[{value:'original',label:'Original'},{value:'square',label:'Square'},{value:'portrait',label:'Portrait 4:5'},{value:'landscape',label:'Landscape 4:3'}]}/></div>
    <div className="grid grid-cols-2 gap-2"><CheckboxControl label="Show image" checked={grid.showImage} onChange={(showImage)=>updateProps({showImage})}/><CheckboxControl label="Show title" checked={grid.showTitle} onChange={(showTitle)=>updateProps({showTitle})}/>{(isProduct||isSearch||isCommerceRuntime)?<CheckboxControl label="Show price" checked={grid.showPrice} onChange={(showPrice)=>updateProps({showPrice})}/>:null}{isProduct?<CheckboxControl label="Show vendor" checked={grid.showVendor} onChange={(showVendor)=>updateProps({showVendor})}/>:null}{isCollection?<CheckboxControl label="Show product count" checked={grid.showCount} onChange={(showCount)=>updateProps({showCount})}/>:null}{isSearch?<><CheckboxControl label="Show content type" checked={grid.showType} onChange={(showType)=>updateProps({showType})}/><CheckboxControl label="Show excerpt" checked={grid.showExcerpt} onChange={(showExcerpt)=>updateProps({showExcerpt})}/></>:null}{isBlog?<><CheckboxControl label="Show excerpt" checked={grid.showExcerpt} onChange={(showExcerpt)=>updateProps({showExcerpt})}/><CheckboxControl label="Show author" checked={grid.showAuthor} onChange={(showAuthor)=>updateProps({showAuthor})}/><CheckboxControl label="Show date" checked={grid.showDate} onChange={(showDate)=>updateProps({showDate})}/></>:null}</div>
    <VsnTextField label="Empty state" value={grid.emptyText} onInput={(e)=>updateProps({emptyText:e.currentTarget.value})}/>
  </>;
}


function ComponentInstancePanel({ element, components = [], usage = {}, onUpdate, onSaveVariant, onUpdateMaster }) {
  const props = element?.props || {};
  const item = components.find((entry)=>String(entry.id)===String(props.componentId||''));
  const definition = componentDefinitionFromLibraryItem(item);
  const patchProps = (patch)=>onUpdate?.(element.id,{props:{...props,...patch}});
  const setValue=(name,value)=>patchProps({propValues:{...(props.propValues||{}),[name]:value}});
  const resetValue=(name)=>{const next={...(props.propValues||{})};delete next[name];patchProps({propValues:next});};
  const resetAll=()=>patchProps({variantId:'default',propValues:{},overrides:{},activeSlot:definition?.slots?.[0]?.name||'content'});
  return <SectionHeader title="Component / Variants">
    <div><Label>Component</Label><Select value={props.componentId||''} onChange={(componentId)=>patchProps({componentId,variantId:'default',propValues:{},overrides:{},activeSlot:'content'})} options={[{value:'',label:'Select component'},...components.map((entry)=>({value:entry.id,label:entry.title}))]}/></div>
    {!definition?<p className="text-[10px] leading-4 text-[#8c9196]">Choose a component definition from the Library. Component instances stay linked to the master.</p>:<>
      <div className="rounded-lg bg-[#f6f6f7] px-2.5 py-2 text-[10px] text-[#6d7175]"><strong>{definition.name}</strong><div>Master v{definition.version} · used {Number(usage?.[props.componentId]?.count||0)} time{Number(usage?.[props.componentId]?.count||0)===1?'':'s'} across {Number(usage?.[props.componentId]?.pages||0)} page{Number(usage?.[props.componentId]?.pages||0)===1?'':'s'}</div></div>
      <div><Label>Variant</Label><Select value={props.variantId||'default'} onChange={(variantId)=>patchProps({variantId})} options={definition.variants.map((variant)=>({value:variant.id,label:variant.name}))}/></div>
      {definition.props.length?<div className="space-y-2"><Label>Named Props</Label>{definition.props.map((prop)=>{const value=componentPropValue(element,definition,prop);const overridden=Object.prototype.hasOwnProperty.call(props.propValues||{},prop.name);return <div key={prop.name} className="rounded-lg border border-[#e3e3e3] p-2"><div className="mb-1 flex items-center justify-between"><span className="text-[10px] font-medium text-[#4a4a4a]">{prop.label}</span>{overridden?<VsnButton type="button" variant="plain" size="slim" onClick={()=>resetValue(prop.name)}>Reset</VsnButton>:<span className="text-[9px] text-[#8c9196]">Master</span>}</div>{prop.type==='boolean'?<CheckboxControl label={prop.label} checked={Boolean(value)} onChange={(next)=>setValue(prop.name,next)}/>:prop.type==='color'?<ColorInput value={value||'#000000'} onChange={(next)=>setValue(prop.name,next)}/>:prop.type==='number'?<VsnNumberField label={prop.label} labelAccessibilityVisibility="exclusive" value={value??''} onInput={(event)=>setValue(prop.name,Number(event.currentTarget.value)||0)}/>:<VsnTextField label={prop.label} labelAccessibilityVisibility="exclusive" value={value??''} onInput={(event)=>setValue(prop.name,event.currentTarget.value)}/>}</div>})}</div>:<p className="text-[10px] text-[#8c9196]">No named props were discovered in this master.</p>}
      {definition.slots.length?<div><Label>Slot</Label><Select value={props.activeSlot||definition.slots[0].name} onChange={(activeSlot)=>patchProps({activeSlot})} options={definition.slots.map((slot)=>({value:slot.name,label:slot.label}))}/><p className="mt-1 text-[10px] text-[#8c9196]">Drop child widgets into the component instance to override this slot. Empty instance slots use the master content.</p></div>:null}
      <div className="grid grid-cols-2 gap-2"><VsnButton type="button" onClick={resetAll}>Reset to Master</VsnButton><VsnButton type="button" variant="primary" onClick={()=>{const name=window.prompt('Variant name','New Variant');if(name?.trim())onSaveVariant?.(item,name.trim(),props.propValues||{},props.overrides||{});}}>Save as Variant</VsnButton></div>
      <VsnButton type="button" className="w-full" onClick={()=>{if(window.confirm('Update master defaults from this instance? This propagates to linked instances that do not override those props.'))onUpdateMaster?.(item,props.propValues||{});}}>Update Master Defaults</VsnButton>
      {definition.variants.length>1?<div><Label>Variant Canvas</Label><div className="grid grid-cols-2 gap-2">{definition.variants.map((variant)=>{const previewInstance={...element,props:{...props,variantId:variant.id,propValues:{}}};const resolved=resolveComponentInstance(previewInstance,components);return <button type="button" key={variant.id} onClick={()=>patchProps({variantId:variant.id})} className={`overflow-hidden rounded-lg border text-left ${String(props.variantId||'default')===variant.id?'border-[#008060]':'border-[#e3e3e3]'}`}><div className="h-24 overflow-hidden bg-white p-1 pointer-events-none">{resolved?.root?<div style={{transform:'scale(.45)',transformOrigin:'top left',width:'220%'}}><PreviewRenderer elements={[resolved.root]} componentDefinitions={components}/></div>:null}</div><div className="border-t px-2 py-1 text-[9px] font-medium">{variant.name}</div></button>})}</div></div>:null}
    </>}
  </SectionHeader>;
}
export default function PropertiesPanel({ selectedElement, onUpdate, onDelete, activeTab, onTabChange, globalStyles = {}, onGlobalStylesChange, deviceMode = "desktop", reusableSections = [], libraryItems = [], componentDefinitions = [], componentUsage = {}, bindingContext = {}, onApplyLibraryStyle, onSaveCurrentStyle, onUnlinkGlobalSection, onSaveComponentVariant, onUpdateComponentMaster, width = 256, hideTabs = false }) {
  const styles = selectedElement?.styles ?? {};
  const props =
    selectedElement?.props ?? {};
  const capabilities = getWidgetCapabilities(selectedElement?.type);
  const interactions = normalizeElementInteractions(selectedElement?.interactions);
  const updateInteraction = (patch) => {
    if (!selectedElement) return;
    onUpdate(selectedElement.id, { interactions: mergeElementInteractions(selectedElement.interactions, patch) });
  };
  const [stylePresetId, setStylePresetId] = useState("");
  const [stickyDiagnostic, setStickyDiagnostic] = useState("");
  const stylePresets = libraryItems.filter((item) => item.kind === "style");

  useEffect(() => {
    if (!selectedElement?.id || !interactions.sticky || typeof document === "undefined") {
      setStickyDiagnostic("");
      return undefined;
    }
    const read = () => {
      const nodes = Array.from(document.querySelectorAll("[data-vsn-id]"));
      const target = nodes.find((node) => node.getAttribute("data-vsn-id") === String(selectedElement.id));
      setStickyDiagnostic(target?.getAttribute("data-vsn-sticky-diagnostic") || "");
    };
    read();
    const timer = window.setInterval(read, 800);
    return () => window.clearInterval(timer);
  }, [selectedElement?.id, interactions.sticky, interactions.stickyBoundary, interactions.stickyCustomTarget]);

  const updateProp = (
    key,
    value,
  ) => {
    if (!selectedElement) {
      return;
    }

    onUpdate(selectedElement.id, {
      props: {
        ...props,
        [key]: value,
      },
    });
  };
  const updateProps = (patch = {}) => {
    if (!selectedElement || !patch || typeof patch !== "object") return;
    onUpdate(selectedElement.id, { props: { ...props, ...patch } });
  };
  const updateStyle = (section, key, value) => {
    if (!selectedElement)
      return;
    onUpdate(selectedElement.id, {
      styles: {
        ...styles,
        [section]: { ...(styles[section] ?? {}), [key]: value },
      },
    });
  };

  const responsive = selectedElement?.responsive ?? {};
  const deviceResponsive = responsive?.[deviceMode] ?? {};
  const updateResponsiveStyle = (section, key, value) => {
    if (!selectedElement) return;
    onUpdate(selectedElement.id, {
      responsive: {
        ...responsive,
        [deviceMode]: {
          ...deviceResponsive,
          styles: {
            ...(deviceResponsive.styles || {}),
            [section]: {
              ...(deviceResponsive.styles?.[section] || {}),
              [key]: value,
            },
          },
        },
      },
    });
  };

  const updateResponsiveProp = (key, value) => {
    if (!selectedElement) return;
    onUpdate(selectedElement.id, {
      responsive: {
        ...responsive,
        [deviceMode]: {
          ...deviceResponsive,
          props: { ...(deviceResponsive.props || {}), [key]: value },
        },
      },
    });
  };
  return (<div className="vsn-properties-panel" style={{ width }}>
    {!hideTabs ? <div className="vsn-inspector-tabs">
      {['content', 'style', 'advanced'].map(tab => (<button type="button" key={tab.charAt(0).toUpperCase()+tab.slice(1)} onClick={() => onTabChange(tab)} className={activeTab === tab ? 'is-active' : ''}>{tab.charAt(0).toUpperCase()+tab.slice(1)}</button>))}
    </div> : null}

    {!selectedElement ? (<div className="flex-1 overflow-y-auto">
      <div className="px-4 py-3 border-b border-[#f1f1f1] bg-[#fafafa]">
        <p className="text-xs font-semibold text-[#1a1a1a]">Global Styles</p>
        <p className="text-[10px] text-[#8a8a8a] mt-1">Page-wide defaults. Select an element to edit that element instead.</p>
      </div>
      <SectionHeader title="Colors">
        <div><Label>Primary</Label><ColorInput value={globalStyles.primaryColor || "#95BF47"} onChange={(value) => onGlobalStylesChange?.({ primaryColor: value })} /></div>
        <div><Label>Text</Label><ColorInput value={globalStyles.textColor || "#1a1a1a"} onChange={(value) => onGlobalStylesChange?.({ textColor: value })} /></div>
        <div><Label>Background</Label><ColorInput value={globalStyles.backgroundColor || "#ffffff"} onChange={(value) => onGlobalStylesChange?.({ backgroundColor: value })} /></div>
      </SectionHeader>
      <SectionHeader title="Typography">
        <FontFamilyControl label="Body font family" value={globalStyles.fontFamily || "Inter, system-ui, sans-serif"} onChange={(fontFamily)=>onGlobalStylesChange?.({fontFamily})} />
        <FontFamilyControl label="Heading font family" value={globalStyles.headingFontFamily || "inherit"} onChange={(headingFontFamily)=>onGlobalStylesChange?.({headingFontFamily})} />
      </SectionHeader>
      <SectionHeader title="Motion Defaults"><MotionLibrarySelect label="Page motion preset" value={globalStyles.motionPresetId || ""} onChange={(motionPresetId)=>onGlobalStylesChange?.({motionPresetId})} onPreset={(preset)=>onGlobalStylesChange?.({motionPresetId:preset?.id||"",motionPresetTimeline:preset?.timeline||null})} /><div><Label>Reduced motion</Label><Select value={globalStyles.motionReducedMode || "system"} onChange={(motionReducedMode)=>onGlobalStylesChange?.({motionReducedMode})} options={[{value:"system",label:"Follow visitor preference"},{value:"reduce",label:"Prefer reduced motion"},{value:"full",label:"Allow full motion"}]} /></div><p className="text-[10px] leading-4 text-[#8c9196]">Saved Motion Library presets can be applied from any element's Advanced → Animation & Interaction panel. This page default is available there as a one-click preset.</p></SectionHeader>
      <SectionHeader title="Buttons">
        <div><Label>Background</Label><ColorInput value={globalStyles.buttonBackground || "#1a1a1a"} onChange={(value) => onGlobalStylesChange?.({ buttonBackground: value })} /></div>
        <div><Label>Text</Label><ColorInput value={globalStyles.buttonTextColor || "#ffffff"} onChange={(value) => onGlobalStylesChange?.({ buttonTextColor: value })} /></div>
        <div><Label>Radius</Label><VsnTextField label="Button radius" labelAccessibilityVisibility="exclusive" value={globalStyles.buttonRadius || "8px"} onInput={(e) => onGlobalStylesChange?.({ buttonRadius: e.currentTarget.value })} /></div>
      </SectionHeader>
      <SectionHeader title="Design Tokens">
        <div className="grid grid-cols-2 gap-2"><div><Label>Secondary</Label><ColorInput value={globalStyles.secondaryColor || "#6d7175"} onChange={(value)=>onGlobalStylesChange?.({secondaryColor:value})}/></div><div><Label>Accent</Label><ColorInput value={globalStyles.accentColor || "#95BF47"} onChange={(value)=>onGlobalStylesChange?.({accentColor:value})}/></div></div>
        <div className="grid grid-cols-2 gap-2"><div><Label>Surface</Label><ColorInput value={globalStyles.surfaceColor || "#ffffff"} onChange={(value)=>onGlobalStylesChange?.({surfaceColor:value})}/></div><div><Label>Muted</Label><ColorInput value={globalStyles.mutedSurfaceColor || "#f6f6f7"} onChange={(value)=>onGlobalStylesChange?.({mutedSurfaceColor:value})}/></div></div>
        <div><Label>Border</Label><ColorInput value={globalStyles.borderColor || "#e3e3e3"} onChange={(value)=>onGlobalStylesChange?.({borderColor:value})}/></div>
        <div className="grid grid-cols-3 gap-2"><div><Label>Radius S</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={globalStyles.radiusSm || "6px"} onInput={(e)=>onGlobalStylesChange?.({radiusSm:e.currentTarget.value})} className="w-full px-2 py-1.5 text-xs border rounded-lg"/></div><div><Label>Radius M</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={globalStyles.radiusMd || "12px"} onInput={(e)=>onGlobalStylesChange?.({radiusMd:e.currentTarget.value})} className="w-full px-2 py-1.5 text-xs border rounded-lg"/></div><div><Label>Radius L</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={globalStyles.radiusLg || "20px"} onInput={(e)=>onGlobalStylesChange?.({radiusLg:e.currentTarget.value})} className="w-full px-2 py-1.5 text-xs border rounded-lg"/></div></div>
        <div className="grid grid-cols-2 gap-2"><div><Label>Spacing base (px)</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  min="1" max="16" value={globalStyles.spacingBase ?? 4} onInput={(e)=>onGlobalStylesChange?.({spacingBase:Number(e.currentTarget.value)||4})} className="w-full px-2 py-1.5 text-xs border rounded-lg"/></div><div><Label>Heading scale</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  min="1" max="2" step="0.05" value={globalStyles.headingScale ?? 1.25} onInput={(e)=>onGlobalStylesChange?.({headingScale:Number(e.currentTarget.value)||1.25})} className="w-full px-2 py-1.5 text-xs border rounded-lg"/></div></div>
      </SectionHeader>
      <SectionHeader title="Forms">
        <div className="grid grid-cols-2 gap-2"><div><Label>Background</Label><ColorInput value={globalStyles.formBackground || "#ffffff"} onChange={(value)=>onGlobalStylesChange?.({formBackground:value})}/></div><div><Label>Text</Label><ColorInput value={globalStyles.formTextColor || "#202223"} onChange={(value)=>onGlobalStylesChange?.({formTextColor:value})}/></div></div>
        <div className="grid grid-cols-2 gap-2"><div><Label>Border</Label><ColorInput value={globalStyles.formBorderColor || "#c9cccf"} onChange={(value)=>onGlobalStylesChange?.({formBorderColor:value})}/></div><div><Label>Radius</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={globalStyles.formRadius || "8px"} onInput={(e)=>onGlobalStylesChange?.({formRadius:e.currentTarget.value})} className="w-full px-2 py-1.5 text-xs border rounded-lg"/></div></div>
      </SectionHeader>
      <SectionHeader title="Shadows">
        <div><Label>Small</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={globalStyles.shadowSm || ""} onInput={(e)=>onGlobalStylesChange?.({shadowSm:e.currentTarget.value})} className="w-full px-2 py-1.5 text-xs border rounded-lg"/></div>
        <div><Label>Medium</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={globalStyles.shadowMd || ""} onInput={(e)=>onGlobalStylesChange?.({shadowMd:e.currentTarget.value})} className="w-full px-2 py-1.5 text-xs border rounded-lg"/></div>
        <div><Label>Large</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={globalStyles.shadowLg || ""} onInput={(e)=>onGlobalStylesChange?.({shadowLg:e.currentTarget.value})} className="w-full px-2 py-1.5 text-xs border rounded-lg"/></div>
      </SectionHeader>
      <SectionHeader title="Layout">
        <div><Label>Container Max Width</Label><VsnTextField label="Container max width" labelAccessibilityVisibility="exclusive" value={globalStyles.containerMaxWidth || "1200px"} onInput={(e) => onGlobalStylesChange?.({ containerMaxWidth: e.currentTarget.value })} /></div>
      </SectionHeader>
      <SectionHeader title="Global Lightbox">
        <CheckboxControl label="Enable lightbox" checked={globalStyles.lightboxEnabled !== false} onChange={(lightboxEnabled)=>onGlobalStylesChange?.({lightboxEnabled})} />
        <div className="grid grid-cols-2 gap-2"><div><Label>Backdrop</Label><ColorInput value={globalStyles.lightboxBackdrop || "#000000"} onChange={(lightboxBackdrop)=>onGlobalStylesChange?.({lightboxBackdrop})}/></div><div><Label>Opacity (%)</Label><VsnNumberField label="Opacity" labelAccessibilityVisibility="exclusive" min="0" max="100" value={Math.round(Number(globalStyles.lightboxBackdropOpacity ?? .86)*100)} onInput={(e)=>onGlobalStylesChange?.({lightboxBackdropOpacity:Math.max(0,Math.min(1,(Number(e.currentTarget.value)||0)/100))})}/></div></div>
        <div className="grid grid-cols-2 gap-2"><div><Label>Max width (vw)</Label><VsnNumberField label="Max width" labelAccessibilityVisibility="exclusive" min="40" max="100" value={globalStyles.lightboxMaxWidth ?? 96} onInput={(e)=>onGlobalStylesChange?.({lightboxMaxWidth:Math.max(40,Math.min(100,Number(e.currentTarget.value)||96))})}/></div><div><Label>Max height (vh)</Label><VsnNumberField label="Max height" labelAccessibilityVisibility="exclusive" min="40" max="100" value={globalStyles.lightboxMaxHeight ?? 92} onInput={(e)=>onGlobalStylesChange?.({lightboxMaxHeight:Math.max(40,Math.min(100,Number(e.currentTarget.value)||92))})}/></div></div>
        <div><Label>Animation</Label><Select value={globalStyles.lightboxAnimation || "fade"} onChange={(lightboxAnimation)=>onGlobalStylesChange?.({lightboxAnimation})} options={[{value:"none",label:"None"},{value:"fade",label:"Fade"},{value:"zoom",label:"Zoom"}]}/></div>
        <CheckboxControl label="Show close button" checked={globalStyles.lightboxShowClose !== false} onChange={(lightboxShowClose)=>onGlobalStylesChange?.({lightboxShowClose})} />
        <CheckboxControl label="Close on backdrop click" checked={globalStyles.lightboxCloseOnBackdrop !== false} onChange={(lightboxCloseOnBackdrop)=>onGlobalStylesChange?.({lightboxCloseOnBackdrop})} />
        <CheckboxControl label="Close with Escape" checked={globalStyles.lightboxCloseOnEscape !== false} onChange={(lightboxCloseOnEscape)=>onGlobalStylesChange?.({lightboxCloseOnEscape})} />
      </SectionHeader>
      <BreakpointControls globalStyles={globalStyles} onChange={onGlobalStylesChange} />
    </div>) : (<div className="flex-1 overflow-y-auto">
      {/* Element info */}
      <div className="px-4 py-3 border-b border-[#f1f1f1] bg-[#fafafa]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#95BF47]/10 rounded-lg flex items-center justify-center">
            <span className="text-[#95BF47] text-xs font-bold">{selectedElement.type[0].toUpperCase()}</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#1a1a1a]">{selectedElement.label}</p>
            <p className="text-[10px] text-[#a8a8a8]">{selectedElement.type}</p>
          </div>
        </div>
      </div>

      {activeTab === "style" && (
        <SectionHeader title="Saved Styles">
          <div><Label>Style preset</Label><VsnSelect label="Style preset" labelAccessibilityVisibility="exclusive" value={stylePresetId} onChange={(e)=>setStylePresetId(e.currentTarget.value)}><VsnOption value="">Choose saved style</VsnOption>{stylePresets.map((item)=><VsnOption key={item.id} value={item.id}>{item.title}</VsnOption>)}</VsnSelect></div>
          <div className="grid grid-cols-2 gap-2"><VsnButton type="button" disabled={!stylePresetId} onClick={()=>onApplyLibraryStyle?.(stylePresets.find((item)=>item.id===stylePresetId))} className="rounded-lg border border-[#d9d9d9] bg-white px-3 py-2 text-xs font-medium disabled:opacity-40 hover:bg-[#f6f6f7]">Apply style</VsnButton><VsnButton type="button" onClick={()=>onSaveCurrentStyle?.()} className="rounded-lg bg-[#202223] px-3 py-2 text-xs font-medium text-white hover:bg-black">Save current</VsnButton></div>
          <p className="text-[10px] leading-4 text-[#8c9196]">Saved styles apply only visual settings, never widget content.</p>
        </SectionHeader>
      )}

      {activeTab === "style" && (
        <WidgetSpecificStyleControls
          type={selectedElement.type}
          value={styles.widget || {}}
          onChange={(widget) => onUpdate(selectedElement.id, { styles: { ...styles, widget } })}
        />
      )}

      {activeTab === "content" ? <div data-vsn-control-group="content">
      {selectedElement.type === "component-instance" ? <ComponentInstancePanel element={selectedElement} components={componentDefinitions} usage={componentUsage} onUpdate={onUpdate} onSaveVariant={onSaveComponentVariant} onUpdateMaster={onUpdateComponentMaster} /> : null}

      {activeTab === "content" ? <SdkControlPanel element={selectedElement} onUpdate={onUpdate} /> : null}

      {selectedElement.type === "global-section" && (
        <SectionHeader title="Reusable Section">
          <div>
            <Label>Global section</Label>
            <Select
              value={props.sectionId || ""}
              onChange={(value) => updateProp("sectionId", value)}
              options={[{ value: "", label: "Select a reusable section" }, ...reusableSections.map((item) => ({ value: item.id, label: `${item.title}${item.status !== "published" ? " (draft)" : ""}` }))]}
            />
          </div>
          <p className="text-[10px] leading-4 text-[#8c9196]">Published reusable sections stay linked and update everywhere. Unlink to create a local copy.</p>
          <VsnButton type="button" disabled={!props.sectionId} onClick={() => onUnlinkGlobalSection?.(selectedElement.id)} className="w-full rounded-lg border border-[#d9d9d9] bg-white px-3 py-2 text-xs font-medium disabled:opacity-40">Unlink / Make Local Copy</VsnButton>
        </SectionHeader>
      )}

      {selectedElement.type === "navigation-menu" && (
        <SectionHeader title="Navigation">
          <StructuredItemsPanel type="navigation-menu" props={props} updateProps={updateProps} />
          <div><Label>Mobile button label</Label><VsnTextField label="Mobile button label" labelAccessibilityVisibility="exclusive" value={props.mobileLabel || "Menu"} onInput={(e) => updateProp("mobileLabel", e.currentTarget.value)} /></div>
          <CheckboxControl label="Mobile collapsible menu" checked={props.mobileMenu !== false} onChange={(value) => updateProp("mobileMenu", value)} />
          <div><Label>Alignment</Label><Select value={props.alignment || "right"} onChange={(value) => updateProp("alignment", value)} options={[{value:"left",label:"Left"},{value:"center",label:"Center"},{value:"right",label:"Right"}]} /></div>
        </SectionHeader>
      )}

      {["faq","testimonials","logo-cloud","stats","team-grid","gallery-grid","marquee","tabs","product-tabs","size-guide","shipping-info","stock-progress","trust-badges","recently-viewed","related-collections","upsell-products","sticky-add-to-cart","announcement-bar","mega-menu","header-search","cart-icon","account-link","customer-name","customer-login","customer-logout","customer-orders-link","customer-addresses-link","localization-switcher"].includes(selectedElement.type) && (
        <SectionHeader title="Widget Content">
          {supportsStructuredItems(selectedElement.type) ? <StructuredItemsPanel type={selectedElement.type} props={props} updateProps={updateProps} /> : null}
          {selectedElement.type === "gallery-grid" && <GallerySettingsPanel props={props} updateProps={updateProps} />}
          {selectedElement.type === "marquee" && <><div><Label>Marquee text</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.text || ""} onInput={(e)=>updateProp("text",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Speed (seconds)</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  min="8" max="90" value={props.speed ?? 24} onInput={(e)=>updateProp("speed",Number(e.currentTarget.value)||24)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></>}
          {selectedElement.type === "product-tabs" && <><div><Label>Shipping text</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.shippingText || ""} onInput={(e)=>updateProp("shippingText",e.currentTarget.value)} className="min-h-20 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Returns text</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.returnsText || ""} onInput={(e)=>updateProp("returnsText",e.currentTarget.value)} className="min-h-20 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></>}
          {selectedElement.type === "size-guide" && <><div><Label>Button text</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.buttonText || "Size guide"} onInput={(e)=>updateProp("buttonText",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Content</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.content || ""} onInput={(e)=>updateProp("content",e.currentTarget.value)} className="min-h-28 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></>}
          {selectedElement.type === "shipping-info" && <><div><Label>Heading</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.heading || "Shipping"} onInput={(e)=>updateProp("heading",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Text</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.text || ""} onInput={(e)=>updateProp("text",e.currentTarget.value)} className="min-h-20 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></>}
          {selectedElement.type === "stock-progress" && <><div><Label>Label</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.label || "Hurry, low stock"} onInput={(e)=>updateProp("label",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div className="grid grid-cols-2 gap-2"><div><Label>Max</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  min="1" value={props.max ?? 10} onInput={(e)=>updateProp("max",Number(e.currentTarget.value)||10)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Preview stock</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  min="0" value={props.fallbackStock ?? 5} onInput={(e)=>updateProp("fallbackStock",Number(e.currentTarget.value)||0)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></div></>}
          
          {selectedElement.type === "sticky-add-to-cart" && <div><Label>Button text</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.text || "Add to cart"} onInput={(e)=>updateProp("text",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div>}
          {selectedElement.type === "announcement-bar" && <><div><Label>Text</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.text || ""} onInput={(e)=>updateProp("text",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Link</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.url || ""} onInput={(e)=>updateProp("url",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></>}
          {selectedElement.type === "mega-menu" && <><div><Label>Trigger label</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.label || "Shop"} onInput={(e)=>updateProp("label",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Featured label</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.featuredTitle || "Featured"} onInput={(e)=>updateProp("featuredTitle",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></>}
          {selectedElement.type === "header-search" && <><div><Label>Placeholder</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.placeholder || "Search products"} onInput={(e)=>updateProp("placeholder",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Button label</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.buttonLabel || "Search"} onInput={(e)=>updateProp("buttonLabel",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></>}
          {selectedElement.type === "cart-icon" && <><div><Label>Label</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.label || "Cart"} onInput={(e)=>updateProp("label",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><CheckboxControl label="Show cart count" checked={props.showCount !== false} onChange={(v)=>updateProp("showCount",v)} /></>}
          {selectedElement.type === "account-link" && <><div><Label>Label</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.label || "Account"} onInput={(e)=>updateProp("label",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>URL</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.url || "/account"} onInput={(e)=>updateProp("url",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></>}
          {selectedElement.type === "customer-name" && <><div><Label>Prefix</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.prefix || "Hello, "} onInput={(e)=>updateProp("prefix",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Logged-out text</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.loggedOutText || "Guest"} onInput={(e)=>updateProp("loggedOutText",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></>}
          {selectedElement.type === "announcement-bar" && <><div><Label>Text</Label><VsnTextField label="Announcement text" labelAccessibilityVisibility="exclusive" value={props.text || ""} onInput={(e)=>updateProp("text",e.currentTarget.value)} /></div><div><Label>Link URL</Label><VsnTextField label="Link URL" labelAccessibilityVisibility="exclusive" value={props.url || ""} onInput={(e)=>updateProp("url",e.currentTarget.value)} /></div><CheckboxControl label="Dismissible" checked={props.dismissible === true} onChange={(v)=>updateProp("dismissible",v)} /></>}
          {selectedElement.type === "mega-menu" && <><div><Label>Menu label</Label><VsnTextField label="Menu label" labelAccessibilityVisibility="exclusive" value={props.label || "Shop"} onInput={(e)=>updateProp("label",e.currentTarget.value)} /></div><div><Label>Featured title</Label><VsnTextField label="Featured title" labelAccessibilityVisibility="exclusive" value={props.featuredTitle || ""} onInput={(e)=>updateProp("featuredTitle",e.currentTarget.value)} /></div><div><Label>Featured URL</Label><VsnTextField label="Featured URL" labelAccessibilityVisibility="exclusive" value={props.featuredUrl || ""} onInput={(e)=>updateProp("featuredUrl",e.currentTarget.value)} /></div></>}
          {selectedElement.type === "localization-switcher" && <><div className="grid grid-cols-2 gap-2"><div><Label>Country label</Label><VsnTextField label="Country label" labelAccessibilityVisibility="exclusive" value={props.countryLabel || "Country"} onInput={(e)=>updateProp("countryLabel",e.currentTarget.value)} /></div><div><Label>Language label</Label><VsnTextField label="Language label" labelAccessibilityVisibility="exclusive" value={props.languageLabel || "Language"} onInput={(e)=>updateProp("languageLabel",e.currentTarget.value)} /></div></div><div className="grid grid-cols-2 gap-2"><CheckboxControl label="Show country" checked={props.showCountry !== false} onChange={(v)=>updateProp("showCountry",v)} /><CheckboxControl label="Show language" checked={props.showLanguage !== false} onChange={(v)=>updateProp("showLanguage",v)} /></div></>}
          {["customer-login","customer-logout","customer-orders-link","customer-addresses-link"].includes(selectedElement.type) && <><div><Label>Label</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.label || "Account"} onInput={(e)=>updateProp("label",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>URL</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.url || "/account"} onInput={(e)=>updateProp("url",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div>{selectedElement.type === "customer-login" && <CheckboxControl label="Hide when customer is logged in" checked={props.hideWhenLoggedIn !== false} onChange={(v)=>updateProp("hideWhenLoggedIn",v)} />}{["customer-logout","customer-orders-link","customer-addresses-link"].includes(selectedElement.type) && <CheckboxControl label="Hide when customer is logged out" checked={props.hideWhenLoggedOut !== false} onChange={(v)=>updateProp("hideWhenLoggedOut",v)} />}</>}
          {selectedElement.type === "localization-switcher" && <><div><Label>Countries (CODE|Label)</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.countriesText || ""} onInput={(e)=>updateProp("countriesText",e.currentTarget.value)} className="min-h-24 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Languages (CODE|Label)</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.languagesText || ""} onInput={(e)=>updateProp("languagesText",e.currentTarget.value)} className="min-h-24 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><CheckboxControl label="Show country" checked={props.showCountry !== false} onChange={(v)=>updateProp("showCountry",v)} /><CheckboxControl label="Show language" checked={props.showLanguage !== false} onChange={(v)=>updateProp("showLanguage",v)} /></>}
        </SectionHeader>
      )}

      {["contact-form", "newsletter-form", "product-inquiry-form"].includes(selectedElement.type) && (
        <SectionHeader title="Form">
          <div><Label>Heading</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.heading || ""} onInput={(e) => updateProp("heading", e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div>
          <div><Label>Submit button</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.submitText || "Submit"} onInput={(e) => updateProp("submitText", e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div>
          <div><Label>Success message</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.successText || "Thanks."} onInput={(e) => updateProp("successText", e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div>
          <div><Label>Error message</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.errorText || "Please try again."} onInput={(e) => updateProp("errorText", e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div>
          {selectedElement.type !== "newsletter-form" && <CheckboxControl label="Show phone field" checked={props.showPhone !== false} onChange={(value) => updateProp("showPhone", value)} />}
        </SectionHeader>
      )}

      {["breadcrumbs","icon-list","icon-box","image-box","accordion","toggle","carousel","slides","testimonials-carousel","social-icons","map","progress-bar","counter","pricing-table","timeline","data-table","menu-anchor","form-builder","product-media","inventory-status","collection-filters","collection-sorting","collection-pagination","cart-drawer","countdown","video","slider","product-grid","product-card","collection-grid","html","liquid"].includes(selectedElement.type) && (
        <SectionHeader title="Widget Settings">
          {supportsStructuredItems(selectedElement.type) ? <StructuredItemsPanel type={selectedElement.type} props={props} updateProps={updateProps} /> : null}
          {selectedElement.type === "breadcrumbs" && <div><Label>Separator</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.separator || "/"} onInput={(e)=>updateProp("separator",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div>}
          {selectedElement.type === "icon-box" && <><div><Label>Icon</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.icon || "★"} onInput={(e)=>updateProp("icon",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Heading</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.heading || ""} onInput={(e)=>updateProp("heading",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Text</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.text || ""} onInput={(e)=>updateProp("text",e.currentTarget.value)} className="min-h-20 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Link</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.url || "#"} onInput={(e)=>updateProp("url",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></>}
          {selectedElement.type === "image-box" && <><MediaControl label="Image" value={props.media?.url?props.media:(props.src?{url:props.src}:{})} onChange={(value)=>updateProps({media:typeof value === "string" ? {url:value} : (value||{}),src:typeof value === "string" ? value : value?.url || ""})} /><div><Label>Resolution</Label><Select value={props.resolution||"original"} onChange={(resolution)=>updateProp("resolution",resolution)} options={CONTEXT_IMAGE_RESOLUTION_OPTIONS}/></div>{props.resolution==="custom"?<div className="grid grid-cols-2 gap-2"><VsnNumberField label="Width" min="1" max="5760" value={props.customWidth||""} onInput={(e)=>updateProp("customWidth",e.currentTarget.value)}/><VsnNumberField label="Height" min="1" max="5760" value={props.customHeight||""} onInput={(e)=>updateProp("customHeight",e.currentTarget.value)}/></div>:null}<div><Label>Heading</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.heading || ""} onInput={(e)=>updateProp("heading",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Text</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.text || ""} onInput={(e)=>updateProp("text",e.currentTarget.value)} className="min-h-20 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Link</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.url || "#"} onInput={(e)=>updateProp("url",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></>}
          {selectedElement.type === "toggle" && <><div><Label>Title</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.title || ""} onInput={(e)=>updateProp("title",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Content</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.content || ""} onInput={(e)=>updateProp("content",e.currentTarget.value)} className="min-h-24 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><CheckboxControl label="Open by default" checked={props.open === true} onChange={(v)=>updateProp("open",v)} /></>}
          {isNestedSliderType(selectedElement.type) ? <SliderSettingsPanel selectedElement={selectedElement} props={props} onUpdate={onUpdate} nestedType={selectedElement.type} /> : null}
          {selectedElement.type === "social-icons" && <CheckboxControl label="Open links in new tab" checked={props.openNew !== false} onChange={(v)=>updateProp("openNew",v)} />}
          {selectedElement.type === "map" && <><div><Label>Location / Search query</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.query || "Dubai, UAE"} onInput={(e)=>updateProp("query",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div className="grid grid-cols-2 gap-2"><div><Label>Zoom</Label><VsnNumberField label="Zoom" labelAccessibilityVisibility="exclusive" min="1" max="20" value={props.zoom ?? 14} onInput={(e)=>updateProp("zoom",Math.max(1,Math.min(20,Number(e.currentTarget.value)||14)))} /></div><div><Label>Height</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  min="160" max="900" value={props.height ?? 360} onInput={(e)=>updateProp("height",Number(e.currentTarget.value)||360)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></div><p className="mt-1 text-[10px] leading-4 text-[#6d7175]">Published maps use the global Google Maps API key from Dashboard → Settings → Google Maps.</p></>}
          {selectedElement.type === "progress-bar" && <><div><Label>Label</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.label || "Progress"} onInput={(e)=>updateProp("label",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><VsnUnitField label="Value" value={String(props.value ?? 72)} unit="%" onInput={(event)=>updateProp("value",Math.max(0, Math.min(100, Number(event.currentTarget.value || 0))))} /><CheckboxControl label="Show percentage" checked={props.showValue !== false} onChange={(v)=>updateProp("showValue",v)} /></>}
          {selectedElement.type === "counter" && <><div className="grid grid-cols-2 gap-2"><div><Label>Start</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  value={props.start ?? 0} onInput={(e)=>updateProp("start",Number(e.currentTarget.value)||0)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>End</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  value={props.end ?? 100} onInput={(e)=>updateProp("end",Number(e.currentTarget.value)||0)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></div><div><Label>Animation duration (ms)</Label><VsnNumberField label="Duration" labelAccessibilityVisibility="exclusive" min="100" max="10000" value={props.duration ?? 1200} onInput={(e)=>updateProp("duration",Math.max(100,Number(e.currentTarget.value)||1200))} /></div><div className="grid grid-cols-2 gap-2"><div><Label>Prefix</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.prefix || ""} onInput={(e)=>updateProp("prefix",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Suffix</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.suffix || ""} onInput={(e)=>updateProp("suffix",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></div></>}
          {selectedElement.type === "pricing-table" && <><div><Label>Plan title</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.title || ""} onInput={(e)=>updateProp("title",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div className="grid grid-cols-2 gap-2"><div><Label>Price</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.price || ""} onInput={(e)=>updateProp("price",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Period</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.period || ""} onInput={(e)=>updateProp("period",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></div><div><Label>Features (one per line)</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.featuresText || ""} onInput={(e)=>updateProp("featuresText",e.currentTarget.value)} className="min-h-24 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Button text</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.buttonText || ""} onInput={(e)=>updateProp("buttonText",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Button URL</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.buttonUrl || "#"} onInput={(e)=>updateProp("buttonUrl",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><CheckboxControl label="Featured plan" checked={props.featured === true} onChange={(v)=>updateProp("featured",v)} /></>}
          {selectedElement.type === "data-table" && <><div><Label>Headers (use |)</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.headersText || ""} onInput={(e)=>updateProp("headersText",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Rows (one per line, use |)</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.rowsText || ""} onInput={(e)=>updateProp("rowsText",e.currentTarget.value)} className="min-h-28 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><CheckboxControl label="Striped rows" checked={props.striped !== false} onChange={(v)=>updateProp("striped",v)} /></>}
          {selectedElement.type === "menu-anchor" && <div><Label>Anchor ID</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.anchorId || "section-anchor"} onInput={(e)=>updateProp("anchorId",e.currentTarget.value.replace(/[^a-zA-Z0-9_-]/g,"-"))} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div>}
          {selectedElement.type === "breadcrumbs" && <CheckboxControl label="Show Home item" checked={props.showHome !== false} onChange={(showHome)=>updateProp("showHome",showHome)} />}
          {selectedElement.type === "form-builder" && <><div><Label>Form name / key</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.formKey || "contact"} onInput={(e)=>updateProp("formKey",e.currentTarget.value.replace(/[^a-zA-Z0-9_-]/g,"-"))} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Heading</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.heading || ""} onInput={(e)=>updateProp("heading",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Fields</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.fieldsText || ""} onInput={(e)=>updateProp("fieldsText",e.currentTarget.value)} className="min-h-48 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs font-mono" /><p className="mt-1 text-[10px] leading-4 text-[#8a8a8a]">type | name | label | placeholder | required | option1,option2 | step. Types: text, email, tel, number, textarea, select, radio, checkbox, file, rating, date, time, hidden, consent.</p></div><CheckboxControl label="Multi-step form" checked={props.multiStep === true} onChange={(v)=>updateProp("multiStep",v)} /><CheckboxControl label="Show labels" checked={props.showLabels !== false} onChange={(v)=>updateProp("showLabels",v)} /><CheckboxControl label="Multiple file upload" checked={props.fileMultiple !== false} onChange={(v)=>updateProp("fileMultiple",v)} /><div><Label>File accept</Label><VsnTextField label="File accept" labelAccessibilityVisibility="exclusive" value={props.fileAccept || "image/*,.pdf"} onInput={(e)=>updateProp("fileAccept",e.currentTarget.value)} placeholder="image/*,.pdf" /></div><div><Label>Conditional rules</Label><VsnTextArea label="Conditional rules" labelAccessibilityVisibility="exclusive" value={props.conditionalRulesText || ""} onInput={(e)=>updateProp("conditionalRulesText",e.currentTarget.value)} className="min-h-20 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs font-mono" /><p className="mt-1 text-[10px] text-[#8a8a8a]">source|equals/not-equals/contains|value|target. One rule per line.</p></div><div><Label>Validation rules</Label><VsnTextArea label="Validation rules" labelAccessibilityVisibility="exclusive" value={props.validationRulesText || ""} onInput={(e)=>updateProp("validationRulesText",e.currentTarget.value)} className="min-h-20 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs font-mono" /><p className="mt-1 text-[10px] text-[#8a8a8a]">field|minLength/maxLength/min/max/pattern|value|message</p></div><div><Label>Calculated fields</Label><VsnTextArea label="Calculated fields" labelAccessibilityVisibility="exclusive" value={props.calculationsText || ""} onInput={(e)=>updateProp("calculationsText",e.currentTarget.value)} className="min-h-16 w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs font-mono" /><p className="mt-1 text-[10px] text-[#8a8a8a]">target|fieldA*fieldB or fieldA+fieldB</p></div><div className="grid grid-cols-2 gap-2"><CheckboxControl label="Query prefill" checked={props.prefillQuery !== false} onChange={(v)=>updateProp("prefillQuery",v)} /><CheckboxControl label="Customer prefill" checked={props.prefillCustomer !== false} onChange={(v)=>updateProp("prefillCustomer",v)} /><CheckboxControl label="Product prefill" checked={props.prefillProduct !== false} onChange={(v)=>updateProp("prefillProduct",v)} /></div><div><Label>CAPTCHA</Label><Select value={props.captchaMode || "none"} onChange={(v)=>updateProp("captchaMode",v)} options={[{value:"none",label:"Honeypot only"},{value:"turnstile",label:"Cloudflare Turnstile"},{value:"hcaptcha",label:"hCaptcha"},{value:"recaptcha-v2",label:"Google reCAPTCHA v2"},{value:"recaptcha-v3",label:"Google reCAPTCHA v3"}]} /></div>{props.captchaMode === "turnstile" && <div><Label>Turnstile site key</Label><VsnTextField label="Turnstile site key" labelAccessibilityVisibility="exclusive" value={props.turnstileSiteKey || ""} onInput={(e)=>updateProp("turnstileSiteKey",e.currentTarget.value)} /></div>}{props.captchaMode === "hcaptcha" && <div><Label>hCaptcha site key</Label><VsnTextField label="hCaptcha site key" labelAccessibilityVisibility="exclusive" value={props.hcaptchaSiteKey || ""} onInput={(e)=>updateProp("hcaptchaSiteKey",e.currentTarget.value)} /></div>}{props.captchaMode === "recaptcha-v3" && <><div><Label>reCAPTCHA v3 score threshold</Label><VsnNumberField label="Score threshold" labelAccessibilityVisibility="exclusive" min="0" max="1" step="0.1" value={props.recaptchaV3Threshold ?? 0.5} onInput={(e)=>updateProp("recaptchaV3Threshold",Math.max(0,Math.min(1,Number(e.currentTarget.value)||0)))} /></div><div><Label>reCAPTCHA v3 action</Label><VsnTextField label="Action" labelAccessibilityVisibility="exclusive" value={props.recaptchaV3Action || "form_submit"} onInput={(e)=>updateProp("recaptchaV3Action",e.currentTarget.value)} /></div></>}{["recaptcha-v2","recaptcha-v3"].includes(props.captchaMode) && <p className="mt-1 text-[10px] leading-4 text-[#6d7175]">Google reCAPTCHA site and secret keys are managed in Forms Settings. Secrets are never stored in the page JSON.</p>}<div><Label>Success action</Label><Select value={props.successAction || "message"} onChange={(v)=>updateProp("successAction",v)} options={[{value:"message",label:"Message"},{value:"redirect",label:"Redirect"},{value:"popup-close",label:"Close popup/floating"},{value:"custom-event",label:"Custom event"},{value:"coupon",label:"Apply coupon"}]} /></div>{props.successAction === "redirect" && <VsnTextField label="Redirect URL" value={props.redirectUrl || ""} onInput={(e)=>updateProp("redirectUrl",e.currentTarget.value)} />}{props.successAction === "custom-event" && <VsnTextField label="Event name" value={props.customEventName || "vsn:form-success"} onInput={(e)=>updateProp("customEventName",e.currentTarget.value)} />}{props.successAction === "coupon" && <VsnTextField label="Coupon code" value={props.couponCode || ""} onInput={(e)=>updateProp("couponCode",e.currentTarget.value)} />}{props.multiStep === true && <div className="grid grid-cols-2 gap-2"><div><Label>Previous button</Label><VsnTextField label="Previous button" labelAccessibilityVisibility="exclusive" value={props.previousText || "Back"} onInput={(e)=>updateProp("previousText",e.currentTarget.value)} /></div><div><Label>Next button</Label><VsnTextField label="Next button" labelAccessibilityVisibility="exclusive" value={props.nextText || "Next"} onInput={(e)=>updateProp("nextText",e.currentTarget.value)} /></div></div>}<div><Label>Submit button</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.submitText || "Submit"} onInput={(e)=>updateProp("submitText",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Success message</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.successText || ""} onInput={(e)=>updateProp("successText",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Error message</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.errorText || ""} onInput={(e)=>updateProp("errorText",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div></>}
          {selectedElement.type === "inventory-status" && <><div><Label>In stock text</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.inStockText || "In stock"} onInput={(e)=>updateProp("inStockText",e.currentTarget.value)} /></div><div><Label>Low stock text</Label><VsnTextField label="Low stock text" labelAccessibilityVisibility="exclusive" value={props.lowStockText || "Low stock"} onInput={(e)=>updateProp("lowStockText",e.currentTarget.value)} /></div><div><Label>Sold out text</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.soldOutText || "Sold out"} onInput={(e)=>updateProp("soldOutText",e.currentTarget.value)} /></div><div><Label>Low stock threshold</Label><VsnNumberField label="Low stock threshold" labelAccessibilityVisibility="exclusive" min="1" max="999" value={props.lowThreshold ?? 5} onInput={(e)=>updateProp("lowThreshold",Math.max(1,Number(e.currentTarget.value)||5))} /></div></>}
          {selectedElement.type === "collection-filters" && <><div><Label>Label</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.label || "Filters"} onInput={(e)=>updateProp("label",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><CheckboxControl label="Availability" checked={props.showAvailability !== false} onChange={(v)=>updateProp("showAvailability",v)} /><CheckboxControl label="Price" checked={props.showPrice !== false} onChange={(v)=>updateProp("showPrice",v)} /><CheckboxControl label="Vendor" checked={props.showVendor !== false} onChange={(v)=>updateProp("showVendor",v)} /><CheckboxControl label="Product type" checked={props.showProductType !== false} onChange={(v)=>updateProp("showProductType",v)} /><div><Label>Clear filters text</Label><VsnTextField label="Clear filters text" labelAccessibilityVisibility="exclusive" value={props.clearText || "Clear"} onInput={(e)=>updateProp("clearText",e.currentTarget.value)} /></div></>}
          {selectedElement.type === "collection-sorting" && <><div><Label>Label</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.label || "Sort by"} onInput={(e)=>updateProp("label",e.currentTarget.value)} className="w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs" /></div><div><Label>Default sort</Label><Select value={props.defaultSort || "featured"} onChange={(v)=>updateProp("defaultSort",v)} options={[{value:"featured",label:"Featured"},{value:"price-ascending",label:"Price low → high"},{value:"price-descending",label:"Price high → low"},{value:"title-ascending",label:"A → Z"},{value:"title-descending",label:"Z → A"}]} /></div></>}
          {selectedElement.type === "collection-pagination" && <><div><Label>Mode</Label><Select value={props.mode || "load-more"} onChange={(v)=>updateProp("mode",v)} options={[{value:"load-more",label:"Load more"},{value:"pages",label:"Previous / Next"}]} /></div>{(props.mode || "load-more") === "load-more" ? <div><Label>Button text</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.buttonText || "Load more"} onInput={(e)=>updateProp("buttonText",e.currentTarget.value)} /></div> : <div className="grid grid-cols-2 gap-2"><div><Label>Previous</Label><VsnTextField label="Previous" labelAccessibilityVisibility="exclusive" value={props.previousText || "Previous"} onInput={(e)=>updateProp("previousText",e.currentTarget.value)} /></div><div><Label>Next</Label><VsnTextField label="Next" labelAccessibilityVisibility="exclusive" value={props.nextText || "Next"} onInput={(e)=>updateProp("nextText",e.currentTarget.value)} /></div></div>}</>}
          {selectedElement.type === "cart-drawer" && <><div><Label>Heading</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.heading || "Your cart"} onInput={(e)=>updateProp("heading",e.currentTarget.value)} /></div><div><Label>Empty text</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.emptyText || "Your cart is empty"} onInput={(e)=>updateProp("emptyText",e.currentTarget.value)} /></div><div className="grid grid-cols-2 gap-2"><div><Label>View cart</Label><VsnTextField label="View cart" labelAccessibilityVisibility="exclusive" value={props.viewCartText || "View cart"} onInput={(e)=>updateProp("viewCartText",e.currentTarget.value)} /></div><div><Label>Checkout</Label><VsnTextField label="Checkout" labelAccessibilityVisibility="exclusive" value={props.checkoutText || "Checkout"} onInput={(e)=>updateProp("checkoutText",e.currentTarget.value)} /></div></div></>}
          {selectedElement.type === "countdown" && <><VsnTextField label="End date/time" value={props.endDate || ""} placeholder="YYYY-MM-DDTHH:mm" onInput={(event)=>updateProp("endDate",event.currentTarget.value || "")} /><VsnTextField label="Expired text" value={props.expiredText || "Offer ended"} onInput={(event)=>updateProp("expiredText",event.currentTarget.value)} /><div className="grid grid-cols-2 gap-2"><CheckboxControl label="Days" checked={props.showDays !== false} onChange={(v)=>updateProp("showDays",v)} /><CheckboxControl label="Hours" checked={props.showHours !== false} onChange={(v)=>updateProp("showHours",v)} /><CheckboxControl label="Minutes" checked={props.showMinutes !== false} onChange={(v)=>updateProp("showMinutes",v)} /><CheckboxControl label="Seconds" checked={props.showSeconds !== false} onChange={(v)=>updateProp("showSeconds",v)} /></div></>}
          {selectedElement.type === "video" && <VideoSettingsPanel props={props} updateProps={updateProps} />}
          {selectedElement.type === "slider" && <SliderSettingsPanel selectedElement={selectedElement} props={props} onUpdate={onUpdate} />}
          {selectedElement.type === "html" && <><div><Label>Render Mode</Label><Select value={props.mode || "html"} onChange={(v)=>updateProp("mode",v)} options={[{value:"html",label:"Custom HTML"},{value:"theme-section",label:"Shopify Theme Section Bridge"}]} /></div>{(props.mode || "html") === "theme-section" ? <><div><Label>Theme section ID</Label><VsnTextField label="Theme section ID" labelAccessibilityVisibility="exclusive" value={props.themeSectionId || ""} placeholder="Example: template--123456789__main" onInput={(e)=>updateProp("themeSectionId",e.currentTarget.value)} /></div><p className="text-[10px] leading-4 text-[#6d7175]">Renders an existing section instance from the current Shopify JSON template through the Section Rendering API. If that section contains third-party app blocks, they render with the section.</p></> : <div><Label>HTML</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.code || props.html || props.content || ""} onInput={(e)=>updateProp("code",e.currentTarget.value)} className="min-h-48 w-full rounded-lg border border-[#e3e3e3] bg-[#111] px-2.5 py-2 text-xs font-mono text-white" /></div>}</>}
          {selectedElement.type === "liquid" && <div><Label>Liquid</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.code || props.liquid || props.content || ""} onInput={(e)=>updateProp("code",e.currentTarget.value)} className="min-h-48 w-full rounded-lg border border-[#e3e3e3] bg-[#111] px-2.5 py-2 text-xs font-mono text-white" /></div>}
        </SectionHeader>
      )}

      {selectedElement.type === "loop" && (
        <SectionHeader title="Loop Query & Repeater">
          <LoopQuerySettingsPanel props={props} updateProps={updateProps} />
        </SectionHeader>
      )}

      {["collection-image","product-image","article-featured-image"].includes(selectedElement.type) && (
        <SectionHeader title="Media Source & Resolution">
          <ContextImageSettingsPanel props={props} updateProps={updateProps} />
        </SectionHeader>
      )}

      {["product-media","product-gallery"].includes(selectedElement.type) && (
        <SectionHeader title="Media Gallery">
          <ContextImageSettingsPanel props={props} updateProps={updateProps} gallery />
        </SectionHeader>
      )}

      {["product-grid","product-card","collection-grid","product-recommendations","recently-viewed","upsell-products"].includes(selectedElement.type) && (
        <SectionHeader title="Data & Grid Settings">
          <DataGridSettingsPanel type={selectedElement.type} props={props} updateProps={updateProps} />
        </SectionHeader>
      )}

      {["search-results-grid", "blog-article-grid", "related-articles"].includes(selectedElement.type) && (
        <SectionHeader title="Grid & Card Settings">
          <DataGridSettingsPanel type={selectedElement.type} props={props} updateProps={updateProps} />
        </SectionHeader>
      )}

      {["search-query-title","search-result-count","search-results-grid","blog-title","blog-description","blog-article-grid","article-title","article-featured-image","article-content","article-author","article-date","article-tags","article-navigation","related-articles"].includes(selectedElement.type) && (
          <SectionHeader title="Dynamic Content">
            {["search-query-title","blog-title","blog-description","article-title","article-content"].includes(selectedElement.type) && <div><Label>Fallback text / prefix</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.fallbackText ?? props.prefix ?? ""} onInput={(e)=> selectedElement.type==="search-query-title" ? updateProp("prefix",e.currentTarget.value) : updateProp("fallbackText",e.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div>}
            
            {selectedElement.type === "article-author" && <div><Label>Prefix</Label><VsnTextField label="Author prefix" labelAccessibilityVisibility="exclusive" value={props.prefix ?? "By "} onInput={(e)=>updateProp("prefix",e.currentTarget.value)} /></div>}
            {selectedElement.type === "article-date" && <div><Label>Date format</Label><Select value={props.format || "long"} onChange={(v)=>updateProp("format",v)} options={[{value:"long",label:"January 5, 2026"},{value:"medium",label:"Jan 5, 2026"},{value:"short",label:"1/5/2026"},{value:"iso",label:"2026-01-05"}]} /></div>}
            {selectedElement.type === "article-tags" && <><div><Label>Prefix</Label><VsnTextField label="Tags prefix" labelAccessibilityVisibility="exclusive" value={props.prefix || ""} onInput={(e)=>updateProp("prefix",e.currentTarget.value)} /></div><div><Label>Separator</Label><VsnTextField label="Tag separator" labelAccessibilityVisibility="exclusive" value={props.separator || " · "} onInput={(e)=>updateProp("separator",e.currentTarget.value)} /></div></>}
            {selectedElement.type === "article-navigation" && <div className="grid grid-cols-2 gap-2"><div><Label>Previous text</Label><VsnTextField label="Previous text" labelAccessibilityVisibility="exclusive" value={props.previousText || "Previous article"} onInput={(e)=>updateProp("previousText",e.currentTarget.value)} /></div><div><Label>Next text</Label><VsnTextField label="Next text" labelAccessibilityVisibility="exclusive" value={props.nextText || "Next article"} onInput={(e)=>updateProp("nextText",e.currentTarget.value)} /></div></div>}
            {selectedElement.type === "search-result-count" && <div className="grid grid-cols-2 gap-2"><div><Label>Singular</Label><VsnTextField label="Singular" labelAccessibilityVisibility="exclusive" value={props.singularText || "result"} onInput={(e)=>updateProp("singularText",e.currentTarget.value)} /></div><div><Label>Plural</Label><VsnTextField label="Plural" labelAccessibilityVisibility="exclusive" value={props.pluralText || "results"} onInput={(e)=>updateProp("pluralText",e.currentTarget.value)} /></div></div>}
            {selectedElement.type==="related-articles" && <><div><Label>Heading</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.heading ?? "Related articles"} onInput={(e)=>updateProp("heading",e.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div><div><Label>Items</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  min="1" max="8" value={props.limit ?? 3} onInput={(e)=>updateProp("limit",Number(e.currentTarget.value)||1)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div></>}
          </SectionHeader>
        )}

      </div> : null}

      {activeTab === 'style' && (<>
        {selectedElement.type === "collection-product-grid" && (
          <>
            <SectionHeader title="Grid">
              <div>
                <Label>Grid Gap</Label>

                <NumberInput
                  value={
                    styles.grid?.gap ?? "24"
                  }
                  onChange={(value) =>
                    updateStyle(
                      "grid",
                      "gap",
                      value,
                    )
                  }
                  unit="px"
                  placeholder="24"
                />
              </div>
            </SectionHeader>

            <SectionHeader title="Product Card">
              <div>
                <Label>Background Color</Label>

                <ColorInput
                  value={
                    styles.card
                      ?.backgroundColor ||
                    "#ffffff"
                  }
                  onChange={(value) =>
                    updateStyle(
                      "card",
                      "backgroundColor",
                      value,
                    )
                  }
                />
              </div>

              <div>
                <Label>Border Color</Label>

                <ColorInput
                  value={
                    styles.card
                      ?.borderColor ||
                    "#e5e5e5"
                  }
                  onChange={(value) =>
                    updateStyle(
                      "card",
                      "borderColor",
                      value,
                    )
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Border Width</Label>

                  <NumberInput
                    value={
                      styles.card
                        ?.borderWidth ??
                      "1"
                    }
                    onChange={(value) =>
                      updateStyle(
                        "card",
                        "borderWidth",
                        value,
                      )
                    }
                    unit="px"
                  />
                </div>

                <div>
                  <Label>Border Radius</Label>

                  <NumberInput
                    value={
                      styles.card
                        ?.borderRadius ??
                      "12"
                    }
                    onChange={(value) =>
                      updateStyle(
                        "card",
                        "borderRadius",
                        value,
                      )
                    }
                    unit="px"
                  />
                </div>
              </div>

              <div>
                <Label>Card Padding</Label>

                <NumberInput
                  value={
                    styles.card?.padding ??
                    "12"
                  }
                  onChange={(value) =>
                    updateStyle(
                      "card",
                      "padding",
                      value,
                    )
                  }
                  unit="px"
                />
              </div>
            </SectionHeader>

            <SectionHeader title="Load More Button">
              <div>
                <Label>Background Color</Label>
                <ColorInput
                  value={
                    styles.loadMoreButton?.backgroundColor ||
                    "#1a1a1a"
                  }
                  onChange={(value) =>
                    updateStyle(
                      "loadMoreButton",
                      "backgroundColor",
                      value,
                    )
                  }
                />
              </div>

              <div>
                <Label>Text Color</Label>
                <ColorInput
                  value={
                    styles.loadMoreButton?.color ||
                    "#ffffff"
                  }
                  onChange={(value) =>
                    updateStyle(
                      "loadMoreButton",
                      "color",
                      value,
                    )
                  }
                />
              </div>

              <div>
                <Label>Border Color</Label>
                <ColorInput
                  value={
                    styles.loadMoreButton?.borderColor ||
                    "#1a1a1a"
                  }
                  onChange={(value) =>
                    updateStyle(
                      "loadMoreButton",
                      "borderColor",
                      value,
                    )
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Border Width</Label>
                  <NumberInput
                    value={
                      styles.loadMoreButton?.borderWidth ??
                      "0"
                    }
                    onChange={(value) =>
                      updateStyle(
                        "loadMoreButton",
                        "borderWidth",
                        value,
                      )
                    }
                    unit="px"
                  />
                </div>

                <div>
                  <Label>Border Radius</Label>
                  <NumberInput
                    value={
                      styles.loadMoreButton?.borderRadius ??
                      "8"
                    }
                    onChange={(value) =>
                      updateStyle(
                        "loadMoreButton",
                        "borderRadius",
                        value,
                      )
                    }
                    unit="px"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Padding Y</Label>
                  <NumberInput
                    value={
                      styles.loadMoreButton?.paddingY ??
                      "12"
                    }
                    onChange={(value) =>
                      updateStyle(
                        "loadMoreButton",
                        "paddingY",
                        value,
                      )
                    }
                    unit="px"
                  />
                </div>

                <div>
                  <Label>Padding X</Label>
                  <NumberInput
                    value={
                      styles.loadMoreButton?.paddingX ??
                      "22"
                    }
                    onChange={(value) =>
                      updateStyle(
                        "loadMoreButton",
                        "paddingX",
                        value,
                      )
                    }
                    unit="px"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Font Size</Label>
                  <NumberInput
                    value={
                      styles.loadMoreButton?.fontSize ??
                      "14"
                    }
                    onChange={(value) =>
                      updateStyle(
                        "loadMoreButton",
                        "fontSize",
                        value,
                      )
                    }
                    unit="px"
                  />
                </div>

                <div>
                  <Label>Font Weight</Label>
                  <Select
                    value={String(
                      styles.loadMoreButton?.fontWeight ||
                      "600",
                    )}
                    onChange={(value) =>
                      updateStyle(
                        "loadMoreButton",
                        "fontWeight",
                        value,
                      )
                    }
                    options={[
                      { label: "400", value: "400" },
                      { label: "500", value: "500" },
                      { label: "600", value: "600" },
                      { label: "700", value: "700" },
                      { label: "800", value: "800" },
                    ]}
                  />
                </div>
              </div>

              <div>
                <Label>Top Margin</Label>
                <NumberInput
                  value={
                    styles.loadMoreButton?.marginTop ??
                    "24"
                  }
                  onChange={(value) =>
                    updateStyle(
                      "loadMoreButton",
                      "marginTop",
                      value,
                    )
                  }
                  unit="px"
                />
              </div>
            </SectionHeader>
          </>
        )}
        {selectedElement.type === "collection-product-grid" && (<>
        <SectionHeader title="Product Title">
          <div>
            <Label>Font Size</Label>

            <NumberInput
              value={
                styles.titleTypography
                  ?.fontSize ?? "16"
              }
              onChange={(value) =>
                updateStyle(
                  "titleTypography",
                  "fontSize",
                  value,
                )
              }
              unit="px"
            />
          </div>

          <div>
            <Label>Font Weight</Label>

            <Select
              value={
                String(
                  styles.titleTypography
                    ?.fontWeight || "600",
                )
              }
              onChange={(value) =>
                updateStyle(
                  "titleTypography",
                  "fontWeight",
                  value,
                )
              }
              options={[
                { label: "400", value: "400" },
                { label: "500", value: "500" },
                { label: "600", value: "600" },
                { label: "700", value: "700" },
              ]}
            />
          </div>

          <div>
            <Label>Color</Label>

            <ColorInput
              value={
                styles.titleTypography
                  ?.color || "#1a1a1a"
              }
              onChange={(value) =>
                updateStyle(
                  "titleTypography",
                  "color",
                  value,
                )
              }
            />
          </div>

          <div>
            <Label>Line Height</Label>

            <NumberInput
              value={
                styles.titleTypography
                  ?.lineHeight ?? "1.4"
              }
              onChange={(value) =>
                updateStyle(
                  "titleTypography",
                  "lineHeight",
                  value,
                )
              }
              unit=""
            />
          </div>
        </SectionHeader>
        <SectionHeader title="Product Price">
          <div>
            <Label>Font Size</Label>

            <NumberInput
              value={
                styles.priceTypography
                  ?.fontSize ?? "15"
              }
              onChange={(value) =>
                updateStyle(
                  "priceTypography",
                  "fontSize",
                  value,
                )
              }
              unit="px"
            />
          </div>

          <div>
            <Label>Font Weight</Label>

            <Select
              value={
                String(
                  styles.priceTypography
                    ?.fontWeight || "600",
                )
              }
              onChange={(value) =>
                updateStyle(
                  "priceTypography",
                  "fontWeight",
                  value,
                )
              }
              options={[
                { label: "400", value: "400" },
                { label: "500", value: "500" },
                { label: "600", value: "600" },
                { label: "700", value: "700" },
              ]}
            />
          </div>

          <div>
            <Label>Color</Label>

            <ColorInput
              value={
                styles.priceTypography
                  ?.color || "#1a1a1a"
              }
              onChange={(value) =>
                updateStyle(
                  "priceTypography",
                  "color",
                  value,
                )
              }
            />
          </div>
        </SectionHeader>
        <SectionHeader title="Compare Price">
          <div>
            <Label>Font Size</Label>

            <NumberInput
              value={
                styles.comparePriceTypography
                  ?.fontSize ?? "14"
              }
              onChange={(value) =>
                updateStyle(
                  "comparePriceTypography",
                  "fontSize",
                  value,
                )
              }
              unit="px"
            />
          </div>

          <div>
            <Label>Color</Label>

            <ColorInput
              value={
                styles.comparePriceTypography
                  ?.color || "#777777"
              }
              onChange={(value) =>
                updateStyle(
                  "comparePriceTypography",
                  "color",
                  value,
                )
              }
            />
          </div>
        </SectionHeader>
        </>)}
        {/* Capability-aware shared style controls */}
        {capabilities.typography ? <SectionHeader title="Typography">
          <TypographyControl
            value={styles.typography || {}}
            onChange={(next) => onUpdate(selectedElement.id, { styles: { ...styles, typography: next } })}
          />
        </SectionHeader> : null}

        {capabilities.background ? <SectionHeader title="Background">
          <BackgroundControl
            value={styles.background || { type: "color", color: "#ffffff" }}
            onChange={(next) => onUpdate(selectedElement.id, { styles: { ...styles, background: next } })}
          />
        </SectionHeader> : null}

        {capabilities.border ? <SectionHeader title="Border">
          <BorderControl
            value={styles.border || { width: "0px", style: "solid", color: "#e3e3e3", radius: "0px", sides: "all" }}
            onChange={(next) => onUpdate(selectedElement.id, { styles: { ...styles, border: next } })}
          />
        </SectionHeader> : null}

        {capabilities.spacing ? <SectionHeader title="Spacing">
          <DimensionsControl
            label="Margin"
            values={{ top: styles.spacing?.marginTop, right: styles.spacing?.marginRight, bottom: styles.spacing?.marginBottom, left: styles.spacing?.marginLeft }}
            onChange={(next) => onUpdate(selectedElement.id, { styles: { ...styles, spacing: { ...(styles.spacing || {}), marginTop: next.top, marginRight: next.right, marginBottom: next.bottom, marginLeft: next.left } } })}
          />
          <DimensionsControl
            label="Padding"
            values={{ top: styles.spacing?.paddingTop, right: styles.spacing?.paddingRight, bottom: styles.spacing?.paddingBottom, left: styles.spacing?.paddingLeft }}
            onChange={(next) => onUpdate(selectedElement.id, { styles: { ...styles, spacing: { ...(styles.spacing || {}), paddingTop: next.top, paddingRight: next.right, paddingBottom: next.bottom, paddingLeft: next.left } } })}
          />
        </SectionHeader> : null}

        {capabilities.sizing ? <SectionHeader title="Size">
          <div className="grid grid-cols-2 gap-2">
            <CssLengthControl label="Width" value={styles.size?.width || ""} defaultUnit="%" keywords={["auto","fit-content","min-content","max-content"]} placeholder="100" onChange={(v) => updateStyle("size", "width", v)} />
            <CssLengthControl label="Height" value={styles.size?.height || ""} defaultUnit="px" keywords={["auto","fit-content","min-content","max-content"]} placeholder="auto" onChange={(v) => updateStyle("size", "height", v)} />
            <CssLengthControl label="Min width" value={styles.size?.minWidth || ""} defaultUnit="px" keywords={["auto","fit-content","min-content","max-content"]} placeholder="0" onChange={(v) => updateStyle("size", "minWidth", v)} />
            <CssLengthControl label="Min height" value={styles.size?.minHeight || ""} defaultUnit="px" keywords={["auto","fit-content","min-content","max-content"]} placeholder="0" onChange={(v) => updateStyle("size", "minHeight", v)} />
            <CssLengthControl label="Max width" value={styles.size?.maxWidth || ""} defaultUnit="px" keywords={["none","fit-content","min-content","max-content"]} placeholder="none" onChange={(v) => updateStyle("size", "maxWidth", v)} />
            <CssLengthControl label="Max height" value={styles.size?.maxHeight || ""} defaultUnit="px" keywords={["none","fit-content","min-content","max-content"]} placeholder="none" onChange={(v) => updateStyle("size", "maxHeight", v)} />
          </div>
        </SectionHeader> : null}

        {capabilities.effects ? <SectionHeader title="Effects">
          {capabilities.textEffects ? <>
            <TextShadowControl value={styles.effects?.textShadow || {}} onChange={(value) => updateStyle("effects", "textShadow", value)} />
            <TextStrokeControl value={styles.effects?.textStroke || {}} onChange={(value) => updateStyle("effects", "textStroke", value)} />
          </> : null}
          <BoxShadowControl value={styles.effects?.boxShadow || {}} onChange={(value) => updateStyle("effects", "boxShadow", value)} />
          <FilterEffectsControl value={styles.effects?.filters || {}} onChange={(value) => updateStyle("effects", "filters", value)} />
          <SliderControl label="Opacity" value={Number.isFinite(parseFloat(String(styles.effects?.opacity ?? "100").replace("%", ""))) ? parseFloat(String(styles.effects?.opacity ?? "100").replace("%", "")) : 100} min={0} max={100} suffix="%" onChange={(v) => updateStyle("effects", "opacity", `${v}%`)} />
        </SectionHeader> : null}

        {(capabilities.media || capabilities.imageDimensions || capabilities.icon || capabilities.backgroundGallery) ? <SectionHeader title="Widget Media">
          {capabilities.media && selectedElement.type !== "image" ? <MediaControl
            label="Element Media"
            value={styles.advanced?.media || {}}
            onChange={(value) => updateStyle("advanced", "media", value)}
          /> : null}
          {capabilities.imageDimensions && selectedElement.type !== "image" ? <ImageDimensionsControl
            value={styles.advanced?.imageDimensions || {}}
            onChange={(value) => updateStyle("advanced", "imageDimensions", value)}
          /> : null}
          {capabilities.icon ? <IconControl
            label="Element Icon"
            value={{ ...(styles.advanced?.icon || {}), name: props.name || styles.advanced?.icon?.name }}
            onChange={(value) => {
              updateStyle("advanced", "icon", value);
              if (value?.name) updateProp("name", value.name);
            }}
          /> : null}
          {capabilities.backgroundGallery ? <GalleryControl
            label="Background Gallery"
            value={styles.advanced?.backgroundGallery || []}
            onChange={(value) => updateStyle("advanced", "backgroundGallery", value)}
            max={8}
          /> : null}
        </SectionHeader> : null}

        {capabilities.elementLink ? <SectionHeader title="Element Link">
          <UrlControl
            label="Link"
            value={styles.advanced?.link || {}}
            onChange={(value) => updateStyle("advanced", "link", value)}
          />
        </SectionHeader> : null}


      </>)}

      {activeTab === 'content' && (<div className="p-4 space-y-3">
        <div>
          <Label>Element ID</Label>
          <VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={selectedElement.id} readOnly className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg font-mono text-[#6d6d6d]" />
        </div>
        <div>
          <Label>Label</Label>
          <VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={selectedElement.label} onInput={e => onUpdate(selectedElement.id, { label: e.currentTarget.value })} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#95BF47]" />
        </div>
        {capabilities.dynamicSource ? <VsnButton type="button" onClick={() => onTabChange('advanced')} className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-[10px] font-semibold ${selectedElement.dynamicSource?.enabled && selectedElement.dynamicSource?.source ? "border-emerald-200 bg-emerald-50 text-[#6AAB1F]" : "border-[#e3e3e3] bg-white text-[#6d7175] hover:border-[#95BF47]/40 hover:text-[#6AAB1F]"}`}><span>{selectedElement.dynamicSource?.enabled && selectedElement.dynamicSource?.source ? `Dynamic: ${selectedElement.dynamicSource.source}` : "Add dynamic source"}</span><PolarisIcon type={selectedElement.dynamicSource?.enabled ? "edit" : "plus"} size="small" /></VsnButton> : null}
        {selectedElement.type === "image" && (() => {
          const imageProps = normalizeImageWidgetProps(props);
          const mediaValue = imageProps.media?.url ? imageProps.media : (imageProps.sourceType === "shopify" && imageProps.src ? { url: imageProps.src, alt: imageProps.alt || "" } : {});
          return <SectionHeader title="Image">
            <div><Label>Image Source</Label><Select value={imageProps.sourceType} onChange={(sourceType) => updateProps({ sourceType })} options={IMAGE_SOURCE_OPTIONS} /></div>

            {imageProps.sourceType === "shopify" ? <>
              <MediaControl
                label="Shopify Image"
                value={mediaValue}
                onChange={(media) => updateProps({ sourceType: "shopify", media: media || {}, src: media?.url || "" })}
              />
              {imageProps.media?.width || imageProps.media?.height ? <p className="text-[10px] leading-4 text-[#6d7175]">Original: {imageProps.media?.width || "?"} × {imageProps.media?.height || "?"} px</p> : null}
            </> : null}

            {imageProps.sourceType === "external" ? <div><Label>Image URL</Label><VsnTextField label="External image URL" labelAccessibilityVisibility="exclusive" value={imageProps.externalUrl || ""} placeholder="https://example.com/image.jpg" onInput={(event) => updateProps({ sourceType: "external", externalUrl: event.currentTarget.value, src: event.currentTarget.value })} /></div> : null}

            {imageProps.sourceType === "dynamic" ? <div className="rounded-lg border border-[#d9d9d9] bg-[#f6f6f7] p-2.5"><p className="text-[10px] leading-4 text-[#6d7175]">Bind this image field with <strong>Dynamic Bindings 2.0</strong>. Only image/media-compatible sources are shown.</p><VsnButton type="button" variant="tertiary" size="sm" onClick={() => { onUpdate(selectedElement.id,{meta:{...(selectedElement.meta||{}),dynamicFocusPath:'props.src'}}); onTabChange('advanced'); }} className="mt-2">Configure Image Binding</VsnButton></div> : null}

            <div><Label>Render Resolution</Label><Select value={imageProps.resolution} onChange={(resolution) => updateProps({ resolution })} options={IMAGE_RESOLUTION_OPTIONS} /></div>
            {imageProps.resolution === "custom" ? <div className="grid grid-cols-2 gap-2"><div><Label>Custom Width (px)</Label><VsnNumberField label="Custom image width" labelAccessibilityVisibility="exclusive" min="1" max="5760" value={imageProps.customWidth || ""} onInput={(event) => updateProps({ customWidth: event.currentTarget.value })} /></div><div><Label>Custom Height (px)</Label><VsnNumberField label="Custom image height" labelAccessibilityVisibility="exclusive" min="1" max="5760" value={imageProps.customHeight || ""} onInput={(event) => updateProps({ customHeight: event.currentTarget.value })} /></div></div> : null}
            <p className="text-[10px] leading-4 text-[#8c9196]">Shopify-hosted images request the selected CDN resolution. CSS display width/height remain available in the Style tab.</p>

            <div><Label>Alt Text</Label><Select value={imageProps.altMode} onChange={(altMode) => updateProps({ altMode })} options={[{ value: "media", label: "Use Shopify Media Alt" }, { value: "custom", label: "Custom Alt Text" }, { value: "decorative", label: "Decorative (Empty Alt)" }]} /></div>
            {imageProps.altMode === "custom" ? <VsnTextField label="Custom alt text" value={imageProps.alt || ""} placeholder="Describe the image" onInput={(event) => updateProps({ alt: event.currentTarget.value })} /> : null}

            <div><Label>Caption</Label><Select value={imageProps.captionMode} onChange={(captionMode) => updateProps({ captionMode })} options={[{ value: "none", label: "None" }, { value: "media", label: "Use Media Text" }, { value: "custom", label: "Custom Caption" }]} /></div>
            {imageProps.captionMode === "custom" ? <VsnTextField label="Image caption" value={imageProps.caption || ""} onInput={(event) => updateProps({ caption: event.currentTarget.value })} /> : null}

            <div><Label>Link</Label><Select value={imageProps.linkType} onChange={(linkType) => updateProps({ linkType, lightbox: linkType === "media" ? imageProps.lightbox : false })} options={[{ value: "none", label: "None" }, { value: "media", label: "Media File" }, { value: "custom", label: "Custom URL" }]} /></div>
            {imageProps.linkType === "custom" ? <VsnTextField label="Link URL" value={imageProps.linkUrl || ""} placeholder="https://..." onInput={(event) => updateProps({ linkUrl: event.currentTarget.value })} /> : null}
            {imageProps.linkType !== "none" ? <CheckboxControl label="Open in new tab" checked={imageProps.openNewTab === true} onChange={(openNewTab) => updateProps({ openNewTab })} /> : null}
            {imageProps.linkType === "media" ? <CheckboxControl label="Open media in lightbox" checked={imageProps.lightbox === true} onChange={(lightbox) => updateProps({ lightbox })} /> : null}

            <div className="grid grid-cols-2 gap-2"><div><Label>Loading</Label><Select value={imageProps.loading} onChange={(loading) => updateProps({ loading })} options={[{ value: "lazy", label: "Lazy" }, { value: "eager", label: "Eager" }]} /></div><div><Label>Fetch Priority</Label><Select value={imageProps.fetchPriority} onChange={(fetchPriority) => updateProps({ fetchPriority })} options={[{ value: "auto", label: "Auto" }, { value: "high", label: "High" }, { value: "low", label: "Low" }]} /></div></div>
          </SectionHeader>;
        })()}
        {["product-title", "product-price", "product-compare-price", "product-description", "product-vendor", "product-sku", "product-availability", "product-variant-selector", "product-quantity", "product-add-to-cart", "product-buy-now", "product-gallery", "product-metafield", "product-recommendations"].includes(selectedElement.type) && (
          <div className="space-y-3 border-t border-[#f1f1f1] pt-3">
            <p className="text-xs font-semibold text-[#1a1a1a]">Product Widget</p>

            {selectedElement.type === "product-title" && (<>
              <div><Label>Fallback Text</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.fallbackText ?? "Product Title"} onInput={(e) => updateProp("fallbackText", e.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div>
              <div><Label>Heading Tag</Label><Select value={props.tag || "h1"} onChange={(value) => updateProp("tag", value)} options={["h1","h2","h3","h4","h5","h6"].map((value) => ({ label: value.toUpperCase(), value }))} /></div>
            </>)}

            {selectedElement.type === "product-description" && (
              <div><Label>Fallback Text</Label><VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={props.fallbackText ?? "Product description will appear here."} onInput={(e) => updateProp("fallbackText", e.currentTarget.value)} className="min-h-20 w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div>
            )}

            {["product-price", "product-compare-price"].includes(selectedElement.type) && <div><Label>Prefix</Label><VsnTextField label="Price prefix" labelAccessibilityVisibility="exclusive" value={props.prefix || ""} onInput={(e)=>updateProp("prefix",e.currentTarget.value)} /></div>}

            {["product-vendor", "product-sku"].includes(selectedElement.type) && (
              <div><Label>Prefix</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.prefix ?? (selectedElement.type === "product-sku" ? "SKU: " : "Vendor: ")} onInput={(e) => updateProp("prefix", e.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div>
            )}

            {selectedElement.type === "product-availability" && (<>
              <div><Label>In Stock Text</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.inStockText ?? "In stock"} onInput={(e) => updateProp("inStockText", e.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div>
              <div><Label>Sold Out Text</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.soldOutText ?? "Sold out"} onInput={(e) => updateProp("soldOutText", e.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div>
            </>)}

            {selectedElement.type === "product-variant-selector" && (<><CheckboxControl label="Show label" checked={props.showLabel !== false} onChange={(v)=>updateProp("showLabel",v)} /><CheckboxControl label="Disable sold-out variants" checked={props.disableSoldOut !== false} onChange={(v)=>updateProp("disableSoldOut",v)} />
              <div><Label>Label</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.label ?? "Variant"} onInput={(e) => updateProp("label", e.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div></>
            )}

            {selectedElement.type === "product-quantity" && (<>
              <CheckboxControl label="Show label" checked={props.showLabel !== false} onChange={(v)=>updateProp("showLabel",v)} />
              <div><Label>Label</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive" value={props.label ?? "Quantity"} onInput={(e) => updateProp("label", e.currentTarget.value)} /></div>
              <div className="grid grid-cols-3 gap-2"><div><Label>Minimum</Label><VsnNumberField label="Minimum" labelAccessibilityVisibility="exclusive" min="1" value={props.min ?? 1} onInput={(e)=>updateProp("min",Math.max(1,Number(e.currentTarget.value)||1))} /></div><div><Label>Maximum</Label><VsnNumberField label="Maximum" labelAccessibilityVisibility="exclusive" min="1" value={props.max ?? 99} onInput={(e)=>updateProp("max",Math.max(Number(props.min||1),Number(e.currentTarget.value)||99))} /></div><div><Label>Step</Label><VsnNumberField label="Step" labelAccessibilityVisibility="exclusive" min="1" value={props.step ?? 1} onInput={(e)=>updateProp("step",Math.max(1,Number(e.currentTarget.value)||1))} /></div></div>
            </>)}

            {["product-add-to-cart", "product-buy-now"].includes(selectedElement.type) && (<>
              <div><Label>Button Text</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.text ?? (selectedElement.type === "product-buy-now" ? "Buy Now" : "Add to Cart")} onInput={(e) => updateProp("text", e.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div>
              <CheckboxControl label="Full Width" checked={props.fullWidth === true} onChange={(value)=>updateProp("fullWidth", value)} />
              <div className="grid grid-cols-2 gap-2"><div><Label>Border Width</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  min="0" value={props.borderWidth ?? 0} onInput={(e)=>updateProp("borderWidth", Number(e.currentTarget.value)||0)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div><div><Label>Border Color</Label><ColorGradientControl solidOnly value={{ type: "color", color: props.borderColor || "#000000" }} onChange={(next)=>updateProp("borderColor", next.color)} /></div></div>
            </>)}

            {selectedElement.type === "product-variant-selector" && (
              <div className="grid grid-cols-2 gap-2"><div><Label>Control Height</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  min="36" value={props.height ?? 44} onInput={(e)=>updateProp("height", Number(e.currentTarget.value)||44)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div><div><Label>Radius</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  min="0" value={props.borderRadius ?? 8} onInput={(e)=>updateProp("borderRadius", Number(e.currentTarget.value)||0)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div></div>
            )}

            {selectedElement.type === "product-gallery" && (<>
              <CheckboxControl label="Show Thumbnails" checked={props.showThumbnails !== false} onChange={(value)=>updateProp("showThumbnails", value)} />
              <div className="grid grid-cols-2 gap-2"><div><Label>Thumbnail Size</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  min="44" max="140" value={props.thumbnailSize ?? 76} onInput={(e)=>updateProp("thumbnailSize", Number(e.currentTarget.value)||76)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div><div><Label>Thumbnail Gap</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  min="0" max="40" value={props.thumbnailGap ?? 10} onInput={(e)=>updateProp("thumbnailGap", Number(e.currentTarget.value)||0)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div></div>
            </>)}

            {selectedElement.type === "product-metafield" && (<>
              <div><Label>Namespace</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.namespace ?? "custom"} onInput={(e)=>updateProp("namespace", e.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div>
              <div><Label>Key</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.key ?? ""} onInput={(e)=>updateProp("key", e.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div>
              <div><Label>Label</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.label ?? ""} onInput={(e)=>updateProp("label", e.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div>
            </>)}


          </div>
        )}

        {["search-query-title","search-result-count","search-results-grid","blog-title","blog-description","blog-article-grid","article-title","article-featured-image","article-content","article-author","article-date","article-tags","article-navigation","related-articles"].includes(selectedElement.type) && (
          <SectionHeader title="Dynamic Content">
            {["search-query-title","blog-title","blog-description","article-title","article-content"].includes(selectedElement.type) && <div><Label>Fallback text / prefix</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.fallbackText ?? props.prefix ?? ""} onInput={(e)=> selectedElement.type==="search-query-title" ? updateProp("prefix",e.currentTarget.value) : updateProp("fallbackText",e.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div>}
            
            {selectedElement.type === "article-author" && <div><Label>Prefix</Label><VsnTextField label="Author prefix" labelAccessibilityVisibility="exclusive" value={props.prefix ?? "By "} onInput={(e)=>updateProp("prefix",e.currentTarget.value)} /></div>}
            {selectedElement.type === "article-date" && <div><Label>Date format</Label><Select value={props.format || "long"} onChange={(v)=>updateProp("format",v)} options={[{value:"long",label:"January 5, 2026"},{value:"medium",label:"Jan 5, 2026"},{value:"short",label:"1/5/2026"},{value:"iso",label:"2026-01-05"}]} /></div>}
            {selectedElement.type === "article-tags" && <><div><Label>Prefix</Label><VsnTextField label="Tags prefix" labelAccessibilityVisibility="exclusive" value={props.prefix || ""} onInput={(e)=>updateProp("prefix",e.currentTarget.value)} /></div><div><Label>Separator</Label><VsnTextField label="Tag separator" labelAccessibilityVisibility="exclusive" value={props.separator || " · "} onInput={(e)=>updateProp("separator",e.currentTarget.value)} /></div></>}
            {selectedElement.type === "article-navigation" && <div className="grid grid-cols-2 gap-2"><div><Label>Previous text</Label><VsnTextField label="Previous text" labelAccessibilityVisibility="exclusive" value={props.previousText || "Previous article"} onInput={(e)=>updateProp("previousText",e.currentTarget.value)} /></div><div><Label>Next text</Label><VsnTextField label="Next text" labelAccessibilityVisibility="exclusive" value={props.nextText || "Next article"} onInput={(e)=>updateProp("nextText",e.currentTarget.value)} /></div></div>}
            {selectedElement.type === "search-result-count" && <div className="grid grid-cols-2 gap-2"><div><Label>Singular</Label><VsnTextField label="Singular" labelAccessibilityVisibility="exclusive" value={props.singularText || "result"} onInput={(e)=>updateProp("singularText",e.currentTarget.value)} /></div><div><Label>Plural</Label><VsnTextField label="Plural" labelAccessibilityVisibility="exclusive" value={props.pluralText || "results"} onInput={(e)=>updateProp("pluralText",e.currentTarget.value)} /></div></div>}
            {selectedElement.type==="related-articles" && <><div><Label>Heading</Label><VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.heading ?? "Related articles"} onInput={(e)=>updateProp("heading",e.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div><div><Label>Items</Label><VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"  min="1" max="8" value={props.limit ?? 3} onInput={(e)=>updateProp("limit",Number(e.currentTarget.value)||1)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg" /></div></>}
          </SectionHeader>
        )}

        {selectedElement.type === "collection-product-grid" && (
          <>
            <div className="pt-2">
              <p className="text-xs font-semibold text-[#1a1a1a]">
                Product Grid Settings
              </p>

              <p className="mt-1 text-[11px] text-[#8c9196]">
                Control products, columns and visible
                product information.
              </p>
            </div>

            <div>
              <Label>Sort Products</Label>

              <Select
                value={props.sortBy || "featured"}
                onChange={(value) =>
                  updateProp("sortBy", value)
                }
                options={[
                  { label: "Featured / Collection order", value: "featured" },
                  { label: "Newest", value: "newest" },
                  { label: "Oldest", value: "oldest" },
                  { label: "Price: Low to High", value: "price-asc" },
                  { label: "Price: High to Low", value: "price-desc" },
                  { label: "Title: A-Z", value: "title-asc" },
                  { label: "Title: Z-A", value: "title-desc" },
                ]}
              />
            </div>

            <div className="pt-3 border-t border-[#f1f1f1]">
              <p className="text-xs font-semibold text-[#1a1a1a]">Product Filters</p>
              <p className="mt-1 text-[11px] text-[#8c9196]">Filters apply to products currently loaded in the grid. Load More keeps adding filterable products.</p>
            </div>

            <CheckboxControl label="Enable Filters" checked={props.filtersEnabled === true} onChange={(value) => updateProp("filtersEnabled", value)} />

            {props.filtersEnabled === true && (
              <>
                <CheckboxControl label="Availability Filter" checked={props.filterAvailabilityEnabled !== false} onChange={(value) => updateProp("filterAvailabilityEnabled", value)} />
                <CheckboxControl label="Price Filter" checked={props.filterPriceEnabled !== false} onChange={(value) => updateProp("filterPriceEnabled", value)} />
                <CheckboxControl label="Vendor Filter" checked={props.filterVendorEnabled !== false} onChange={(value) => updateProp("filterVendorEnabled", value)} />
                <CheckboxControl label="Product Type Filter" checked={props.filterProductTypeEnabled !== false} onChange={(value) => updateProp("filterProductTypeEnabled", value)} />

                <div>
                  <Label>Filter Heading</Label>
                  <VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.filterLabel ?? "Filter products"} onInput={(event) => updateProp("filterLabel", event.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#95BF47]" />
                </div>

                <div>
                  <Label>Clear Button Text</Label>
                  <VsnTextField label="Value" labelAccessibilityVisibility="exclusive"  value={props.clearFiltersText ?? "Clear filters"} onInput={(event) => updateProp("clearFiltersText", event.currentTarget.value)} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#95BF47]" />
                </div>
              </>
            )}

            <div>
              <Label>Products Per Page</Label>

              <VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"
                
                min="1"
                max="24"
                value={props.limit ?? 8}
                onInput={(event) =>
                  updateProp(
                    "limit",
                    Math.max(
                      1,
                      Math.min(
                        24,
                        Number(
                          event.currentTarget.value,
                        ) || 1,
                      ),
                    ),
                  )
                }
                className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#95BF47]"
              />
            </div>

            <div>
              <Label>Desktop Columns</Label>

              <VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"
                
                min="1"
                max="6"
                value={
                  props.columnsDesktop ?? 4
                }
                onInput={(event) =>
                  updateProp(
                    "columnsDesktop",
                    Math.max(
                      1,
                      Math.min(
                        6,
                        Number(
                          event.currentTarget.value,
                        ) || 1,
                      ),
                    ),
                  )
                }
                className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#95BF47]"
              />
            </div>

            <div>
              <Label>Tablet Columns</Label>

              <VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"
                
                min="1"
                max="4"
                value={
                  props.columnsTablet ?? 2
                }
                onInput={(event) =>
                  updateProp(
                    "columnsTablet",
                    Math.max(
                      1,
                      Math.min(
                        4,
                        Number(
                          event.currentTarget.value,
                        ) || 1,
                      ),
                    ),
                  )
                }
                className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#95BF47]"
              />
            </div>

            <div>
              <Label>Mobile Columns</Label>

              <VsnNumberField label="Value" labelAccessibilityVisibility="exclusive"
                
                min="1"
                max="2"
                value={
                  props.columnsMobile ?? 1
                }
                onInput={(event) =>
                  updateProp(
                    "columnsMobile",
                    Math.max(
                      1,
                      Math.min(
                        2,
                        Number(
                          event.currentTarget.value,
                        ) || 1,
                      ),
                    ),
                  )
                }
                className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#95BF47]"
              />
            </div>

            <div className="space-y-2 pt-2">
              <CheckboxControl
                label="Show Image"
                checked={
                  props.showImage !== false
                }
                onChange={(value) =>
                  updateProp(
                    "showImage",
                    value,
                  )
                }
              />

              <CheckboxControl
                label="Show Title"
                checked={
                  props.showTitle !== false
                }
                onChange={(value) =>
                  updateProp(
                    "showTitle",
                    value,
                  )
                }
              />

              <CheckboxControl
                label="Show Price"
                checked={
                  props.showPrice !== false
                }
                onChange={(value) =>
                  updateProp(
                    "showPrice",
                    value,
                  )
                }
              />

              <CheckboxControl
                label="Show Compare Price"
                checked={
                  props.showCompareAtPrice !==
                  false
                }
                onChange={(value) =>
                  updateProp(
                    "showCompareAtPrice",
                    value,
                  )
                }
              />
            </div>


            <div className="pt-3 border-t border-[#f1f1f1]">
              <p className="text-xs font-semibold text-[#1a1a1a]">
                Load More
              </p>
            </div>

            <CheckboxControl
              label="Enable Load More"
              checked={
                props.loadMoreEnabled !== false
              }
              onChange={(value) =>
                updateProp(
                  "loadMoreEnabled",
                  value,
                )
              }
            />

            <div>
              <Label>Button Text</Label>
              <VsnTextField label="Value" labelAccessibilityVisibility="exclusive"
                
                value={
                  props.loadMoreText ??
                  "Load More"
                }
                onInput={(event) =>
                  updateProp(
                    "loadMoreText",
                    event.currentTarget.value,
                  )
                }
                className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#95BF47]"
              />
            </div>

            <div>
              <Label>Loading Text</Label>
              <VsnTextField label="Value" labelAccessibilityVisibility="exclusive"
                
                value={
                  props.loadMoreLoadingText ??
                  "Loading..."
                }
                onInput={(event) =>
                  updateProp(
                    "loadMoreLoadingText",
                    event.currentTarget.value,
                  )
                }
                className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#95BF47]"
              />
            </div>

            <div>
              <Label>Button Alignment</Label>
              <Select
                value={
                  props.loadMoreAlignment ||
                  "center"
                }
                onChange={(value) =>
                  updateProp(
                    "loadMoreAlignment",
                    value,
                  )
                }
                options={[
                  { label: "Left", value: "left" },
                  { label: "Center", value: "center" },
                  { label: "Right", value: "right" },
                ]}
              />
            </div>

            <div>
              <Label>Image Ratio</Label>

              <Select
                value={
                  props.imageRatio || "square"
                }
                onChange={(value) =>
                  updateProp(
                    "imageRatio",
                    value,
                  )
                }
                options={[
                  {
                    label: "Square 1:1",
                    value: "square",
                  },
                  {
                    label: "Portrait 4:5",
                    value: "portrait",
                  },
                  {
                    label: "Landscape 4:3",
                    value: "landscape",
                  },
                  {
                    label: "Wide 16:9",
                    value: "wide",
                  },
                  {
                    label: "Natural",
                    value: "natural",
                  },
                ]}
              />
            </div>

            <div>
              <Label>Image Fit</Label>

              <Select
                value={
                  styles.image?.objectFit ||
                  "cover"
                }
                onChange={(value) =>
                  updateStyle(
                    "image",
                    "objectFit",
                    value,
                  )
                }
                options={[
                  { label: "Cover", value: "cover" },
                  { label: "Contain", value: "contain" },
                  { label: "Fill", value: "fill" },
                ]}
              />
            </div>
          </>
        )}
        {selectedElement.type === 'heading' || selectedElement.type === 'text' ? (<div>
          <Label>Text Content</Label>
          <VsnTextArea label="Value" labelAccessibilityVisibility="exclusive" value={selectedElement.props.text ?? ''} onInput={e => onUpdate(selectedElement.id, { props: { text: e.currentTarget.value } })} rows={4} className="w-full px-2.5 py-1.5 text-xs bg-[#f6f6f7] border border-[#e3e3e3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#95BF47] resize-none" />
          {dynamicFieldsForWidget(selectedElement.type).some((field)=>field.path==='props.text') ? <VsnButton type="button" onClick={() => { onUpdate(selectedElement.id,{meta:{...(selectedElement.meta||{}),dynamicFocusPath:'props.text'}}); onTabChange('advanced'); }} className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[#6AAB1F]"><span aria-hidden="true">⚡</span> Dynamic content</VsnButton> : null}
        </div>) : null}
      </div>)}

      {activeTab === 'advanced' && selectedElement && (
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {dynamicFieldsForWidget(selectedElement.type).length ? <DynamicBindingsPanel element={selectedElement} onUpdate={onUpdate} context={bindingContext} /> : null}
          {selectedElement.dynamicSource?.enabled ? <DynamicSourcePanel element={selectedElement} onUpdate={onUpdate} /> : null}
          {capabilities.conditions ? <ConditionsBuilder element={selectedElement} onUpdate={onUpdate} /> : null}
          {capabilities.responsive ? <ResponsivePanel element={selectedElement} deviceMode={deviceMode} onUpdate={onUpdate} capabilities={capabilities} globalStyles={globalStyles} /> : null}
          <AdvancedLayoutPanel element={selectedElement} onUpdate={onUpdate} capabilities={capabilities} />
          {capabilities.stateStyles ? <StateStylesPanel element={selectedElement} onUpdate={onUpdate} capabilities={capabilities} /> : null}
          {capabilities.animations ? <SectionHeader title="Animation & Interaction">
            <div><Label>Entrance animation</Label><Select value={interactions.entrance} onChange={(value)=>updateInteraction({entrance:value})} options={["none","fade-up","fade-in","slide-left","slide-right","zoom-in"]} /></div>
            <div><Label>Hover animation preset</Label><Select value={interactions.hover} onChange={(value)=>updateInteraction({hover:value})} options={["none","lift","scale","fade"]} /></div>
            <CheckboxControl label="Sticky element" checked={interactions.sticky} onChange={(value)=>updateInteraction({sticky:value})} />
            {interactions.sticky ? <div className="space-y-2 rounded-lg border border-[#e3e3e3] bg-[#fafafa] p-2.5">
              <div>
                <Label>Keep sticky within</Label>
                <Select
                  value={interactions.stickyBoundary}
                  onChange={(value)=>updateInteraction({stickyBoundary:value})}
                  options={[
                    { label: "Parent Container", value: "parent" },
                    { label: "Column", value: "column" },
                    { label: "Section", value: "section" },
                    { label: "Page", value: "page" },
                    { label: "Custom Ancestor", value: "custom" },
                  ]}
                />
              </div>
              {interactions.stickyBoundary === "custom" ? <TextControl label="Custom ancestor element ID" value={interactions.stickyCustomTarget} placeholder="Paste an ancestor VSN element ID" onChange={(value)=>updateInteraction({stickyCustomTarget:value})} /> : null}
              <div className="grid grid-cols-2 gap-2">
                <NumberControl label="Top offset" value={interactions.stickyOffset} min={0} max={1000} unit="px" onChange={(value)=>updateInteraction({stickyOffset:value})} />
                <NumberControl label="End offset" value={interactions.stickyEndOffset} min={0} max={1000} unit="px" onChange={(value)=>updateInteraction({stickyEndOffset:value})} />
              </div>
              <NumberControl label="Z-index" value={interactions.stickyZIndex} min={-1} max={2147483000} onChange={(value)=>updateInteraction({stickyZIndex:value})} />
              <div>
                <Label>Enable on devices</Label>
                <div className="space-y-1">
                  <CheckboxControl label="Desktop" checked={interactions.stickyDesktop} onChange={(value)=>updateInteraction({stickyDesktop:value})} />
                  <CheckboxControl label="Tablet" checked={interactions.stickyTablet} onChange={(value)=>updateInteraction({stickyTablet:value})} />
                  <CheckboxControl label="Mobile" checked={interactions.stickyMobile} onChange={(value)=>updateInteraction({stickyMobile:value})} />
                </div>
              </div>
              <p className="text-[10px] leading-4 text-[#6d7175]">Sticky movement is clamped to the selected VSN ancestor. Parent overflow/transform conflicts are checked in the canvas.</p>
              {stickyDiagnostic ? <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] leading-4 text-amber-800">{stickyDiagnostic}</div> : null}
            </div> : null}
            <CheckboxControl label="Parallax" checked={interactions.parallax} onChange={(value)=>updateInteraction({parallax:value})} />
            <div className="mt-3 border-t border-[#e3e3e3] pt-3"><InteractionTimelinePanel value={interactions} elementId={selectedElement.id} onChange={updateInteraction} globalMotionTimeline={globalStyles.motionPresetTimeline || null} /></div>
          </SectionHeader> : null}
          {capabilities.cssVariables ? <SectionHeader title="CSS Variables">
            <RepeaterControl
              label="Variables"
              value={styles.advanced?.cssVariables || []}
              onChange={(value) => updateStyle("advanced", "cssVariables", value)}
              createItem={(index) => ({ label: `Variable #${index + 1}`, name: "--custom-var", value: "" })}
              renderItem={(item, index, setItem) => (<>
                <TextControl label="Variable name" value={item.name || ""} placeholder="--custom-var" onChange={(value) => setItem({ ...item, label: value || `Variable #${index + 1}`, name: value })} />
                <TextControl label="Value" value={item.value || ""} placeholder="10px / #fff / etc" onChange={(value) => setItem({ ...item, value })} />
              </>)}
            />
          </SectionHeader> : null}
          {capabilities.customCode ? <>
            <SectionHeader title="Custom CSS">
              <CustomCssControl value={styles.advanced?.customCss || ""} onChange={(value) => updateStyle("advanced", "customCss", value)} />
            </SectionHeader>
            <SectionHeader title="Custom JavaScript">
              <CustomJsControl value={styles.advanced?.customJs || ""} onChange={(value) => updateStyle("advanced", "customJs", value)} />
            </SectionHeader>
          </> : null}
        </div>
      )}

      <div className="p-4 border-t border-[#f1f1f1]">
        <VsnButton onClick={() => onDelete?.(selectedElement.id)} className="w-full py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Delete element</VsnButton>
      </div>
    </div>)}
  </div>);
}
