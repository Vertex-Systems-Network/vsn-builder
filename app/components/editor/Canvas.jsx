import { Component, createContext, memo, useContext, useEffect, useRef, useState } from 'react';
import SectionInserter from './SectionInserter';
import { acceptsChildren } from '../../builder/widgetRegistry';
import { globalCssVariables } from '../../builder/globalDesign';
import { ContentPolarisIcon } from '../ui/PolarisIcon';
import CustomJsRuntime from './CustomJsRuntime';
import { buildNodeStyle } from '../../builder/styleEngine';
import { applyResponsiveNode, applyResponsiveTree, buildStyleBundleCss } from '../../builder/stylePipeline.js';
import { interactionEditorStyle, normalizeElementInteractions, isStickyEnabledForDevice, calculateBoundedStickyShift } from '../../builder/interactionSchema.js';
import { setupInteractionRuntime } from '../../builder/interactionRuntime.js';
import { normalizeImageWidgetProps, resolveImageSource, buildImageRenderUrl, imageResolutionDimensions, imageAltText, imageCaptionText, imageLinkHref } from '../../builder/imageWidget.js';
import { normalizeGalleryWidgetProps, galleryAspectRatio, galleryColumnsForDevice } from '../../builder/galleryWidget.js';
import { normalizeVideoWidgetProps, videoEmbedUrl } from '../../builder/videoWidget.js';
import { normalizeSliderProps, sliderSlidesForDevice } from '../../builder/sliderWidget.js';
import { isNestedSliderType, normalizeNestedSliderProps, nestedItemNoun } from '../../builder/nestedCarouselWidget.js';
import { normalizeStructuredItems } from '../../builder/structuredItems.js';
import { applyDynamicBindings } from '../../builder/dynamicBindings.js';
import { normalizeContextImageProps, contextImageUrl, contextImageAlt } from '../../builder/contextMediaWidget.js';
import { normalizeGridProps, gridImageRatio } from '../../builder/dataGridWidget.js';
import { applyQueryFilters, normalizeLoopItem, normalizeQueryDefinition, queryCostEstimate } from '../../builder/queryBuilder.js';
import { resolveComponentInstance } from '../../builder/componentSystem.js';
import { getVsnEditorRenderer } from '../../sdk/registry.js';
import SdkWidgetView, { renderSdkEditorValue } from './SdkWidgetView.jsx';
import { parseVisualTemplate, scopeVisualTemplateCss, visualTemplateTreeToDescriptor } from '../../builder/visualTemplate.js';
import { SAMPLE_COLLECTION_PRODUCTS } from './canvasSamples.js';

const PREVIEW_WIDTHS = { desktop: '100%', tablet: '768px', mobile: '390px' };
const LoopItemContext = createContext(null);
const ComponentLibraryContext = createContext([]);
const ComponentStackContext = createContext([]);
const ResponsiveConfigContext = createContext({});
const WidgetTemplateContext = createContext({});

const cssFromStyles = buildNodeStyle;
function sampleLoopItems(query, context = {}) {
  const q = normalizeQueryDefinition(query);
  let raw = [];
  if (q.source === "products") raw = context.previewCollection?.products?.nodes || (context.previewProduct ? [context.previewProduct] : SAMPLE_COLLECTION_PRODUCTS.map((item, index)=>({id:item.id,title:item.title,handle:`sample-${index+1}`,featuredImage:{url:item.image,altText:item.title},priceRangeV2:{minVariantPrice:{amount:String(29+index*10),currencyCode:"USD"}}})));
  else if (q.source === "collections") raw = context.previewCollection ? [context.previewCollection] : [{id:"collection-1",title:"Summer Collection",handle:"summer",description:"Featured collection",image:{url:"/vsn-stock/fashion.svg",altText:"Collection"}},{id:"collection-2",title:"New Arrivals",handle:"new-arrivals",description:"Latest products",image:{url:"/vsn-stock/arrivals.svg",altText:"Collection"}}];
  else if (q.source === "articles") raw = context.previewBlog?.articles?.nodes || (context.previewArticle ? [context.previewArticle] : [{id:"article-1",title:"Journal story",handle:"journal-story",excerpt:"Article excerpt",publishedAt:new Date().toISOString(),image:{url:"/vsn-stock/office.svg",altText:"Article"}}]);
  else if (q.source === "blogs") raw = context.previewBlog ? [context.previewBlog] : [{id:"blog-1",title:"Journal",handle:"journal",description:"Stories and updates"}];
  else if (q.source === "search") raw = context.previewSearch?.products || [];
  else if (q.source === "metaobjects") raw = [{id:"metaobject-1",displayName:q.metaobjectType ? `${q.metaobjectType} item` : "Metaobject item",handle:"sample-entry",type:q.metaobjectType||"metaobject",fields:[{key:"title",value:"Metaobject item"}]}];
  else raw = [{id:"reference-1",title:"Referenced item",handle:"reference",description:`${q.metafieldNamespace}.${q.metafieldKey || "field"}`}];
  return applyQueryFilters(raw.map((item)=>normalizeLoopItem(item,q.source)),q).slice(0,Math.min(q.limit,6));
}

function LoopCanvasWidget({ node, selectedId, onSelect, onDrop, onRequestAddChild, onMoveNode, previewCollection, previewProduct, previewBlog, previewArticle, previewSearch, reusableSections, previewMode }) {
  const query = normalizeQueryDefinition(node.props?.query || {});
  const items = sampleLoopItems(query,{previewCollection,previewProduct,previewBlog,previewArticle,previewSearch});
  const template = (node.children || []).find((child)=>child?.props?.__loopItem) || node.children?.[0];
  const columns = previewMode === "mobile" ? Number(node.props?.columnsMobile||1) : previewMode === "tablet" ? Number(node.props?.columnsTablet||2) : Number(node.props?.columnsDesktop||4);
  const gap = Math.max(0,Number(node.props?.gap||20));
  const cost = queryCostEstimate(query);
  if (!template) return <div className="rounded-xl border border-dashed border-[#b7bdc1] bg-[#fafbfb] p-8 text-center text-xs text-[#6d7175]"><strong>Loop Item template is missing.</strong><div className="mt-2">Add a child container and mark it as the Loop Item template.</div><DropZone parentId={node.id} onDrop={onDrop} onAdd={onRequestAddChild}/></div>;
  return <div>
    <div className="mb-2 flex items-center justify-between rounded-lg bg-[#f6f6f7] px-2.5 py-1.5 text-[10px] text-[#6d7175]"><span>{query.source} · {items.length} preview item{items.length===1?"":"s"}</span><span className={cost.level === "high" ? "text-[#b42318]" : cost.level === "medium" ? "text-[#916a00]" : "text-[#008060]"}>Query cost: {cost.level}</span></div>
    <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.max(1,columns)},minmax(0,1fr))`,gap}}>
      {items.length ? items.map((item,index)=><LoopItemContext.Provider key={item.id || index} value={item}><div data-vsn-loop-preview-item={index} className="relative"><RenderNode node={template} parentId={node.id} selectedId={selectedId} onSelect={onSelect} onDrop={onDrop} onRequestAddChild={onRequestAddChild} onMoveNode={onMoveNode} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections} previewMode={previewMode}/></div></LoopItemContext.Provider>) : <div className="col-span-full rounded-lg border border-dashed border-[#d9d9d9] p-6 text-center text-xs text-[#6d7175]">{query.emptyText}</div>}
    </div>
    <div className="mt-2 rounded-lg border border-dashed border-[#d9d9d9] bg-white p-2 text-[10px] text-[#6d7175]">Edit the first Loop Item template below. Its structure repeats for every query result.</div>
    <div className="mt-2 opacity-80"><RenderNode node={template} parentId={node.id} selectedId={selectedId} onSelect={onSelect} onDrop={onDrop} onRequestAddChild={onRequestAddChild} onMoveNode={onMoveNode} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections} previewMode={previewMode}/></div>
  </div>;
}

function DropZone({ parentId, beforeId = null, afterId = null, onDrop, onAdd, compact = false }) {
  const [active, setActive] = useState(false);
  return (
    <div
      className={`${compact ? 'h-6' : 'h-7'} group relative flex items-center justify-center transition-all`}
      onDragEnter={(event) => { event.preventDefault(); event.stopPropagation(); setActive(true); }}
      onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = event.dataTransfer.getData('vsnNodeId') ? 'move' : 'copy'; setActive(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActive(false); }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setActive(false);
        const type = event.dataTransfer.getData('elementType');
        const nodeId = event.dataTransfer.getData('vsnNodeId');
        if (nodeId) onDrop?.({ nodeId, parentId, beforeId, afterId, mode: 'move' });
        else if (type) onDrop?.({ type, parentId, beforeId, afterId, mode: 'create' });
      }}
    >
      <div className={`pointer-events-none absolute left-0 right-0 h-0.5 rounded-full transition-all ${active ? 'bg-[#008060] opacity-100 shadow-[0_0_0_3px_rgba(0,128,96,.12)]' : 'bg-[#008060] opacity-20 group-hover:opacity-45'}`} />
      {!active ? <button type="button" data-vsn-add-child="1" aria-label="Add widget here" data-tooltip="Add widget here" onMouseDown={(event)=>{event.preventDefault();event.stopPropagation();}} onClick={(event)=>{event.preventDefault();event.stopPropagation();onAdd?.({parentId,beforeId,afterId});}} className="relative z-10 grid h-5 w-5 place-items-center rounded-full border border-[#b7bdc1] bg-white text-[14px] font-semibold leading-none text-[#008060] shadow-sm transition hover:border-[#008060] hover:bg-[#eaf7f2]">+</button> : null}
      {active ? <span className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#008060] px-2 py-0.5 text-[9px] font-semibold text-white shadow">Drop here</span> : null}
    </div>
  );
}


function GalleryCanvasWidget({ node, previewMode = "desktop" }) {
  const props = normalizeGalleryWidgetProps(node.props || {});
  const columns = galleryColumnsForDevice(props, previewMode);
  const ratio = galleryAspectRatio(props.imageRatio, props.customRatioWidth, props.customRatioHeight);
  const imageStyle = { width: "100%", height: ratio === "auto" ? "auto" : undefined, aspectRatio: ratio === "auto" ? undefined : ratio, objectFit: props.objectFit, objectPosition: props.objectPosition, borderRadius: node.styles?.image?.borderRadius || "10px", display: "block" };
  const items = props.galleryItems;
  if (!items.length) return <div className="rounded-lg border border-dashed border-[#c9cccf] bg-[#fafbfb] p-8 text-center text-xs text-[#6d7175]">Choose images in Gallery settings.</div>;
  if (props.layout === "masonry") return <div style={{columnCount:columns,columnGap:`${props.gap}px`}}>{items.map((item,index)=><figure key={item.id||index} style={{breakInside:"avoid",margin:`0 0 ${props.rowGap}px`}}><img src={item.previewUrl||item.url} alt={item.alt||""} style={{...imageStyle,aspectRatio:undefined,height:"auto"}}/>{props.showCaptions&&item.caption?<figcaption style={{fontSize:12,marginTop:6,color:"#6d7175"}}>{item.caption}</figcaption>:null}</figure>)}</div>;
  if (props.layout === "justified") return <div style={{display:"flex",flexWrap:"wrap",gap:`${props.rowGap}px ${props.gap}px`}}>{items.map((item,index)=><figure key={item.id||index} style={{flex:`1 1 calc(${100/columns}% - ${props.gap}px)`,minWidth:120,margin:0}}><img src={item.previewUrl||item.url} alt={item.alt||""} style={imageStyle}/>{props.showCaptions&&item.caption?<figcaption style={{fontSize:12,marginTop:6,color:"#6d7175"}}>{item.caption}</figcaption>:null}</figure>)}</div>;
  return <div style={{display:"grid",gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`,columnGap:`${props.gap}px`,rowGap:`${props.rowGap}px`}}>{items.map((item,index)=><figure key={item.id||index} style={{margin:0,minWidth:0}}><img src={item.previewUrl||item.url} alt={item.alt||""} style={imageStyle}/>{props.showCaptions&&item.caption?<figcaption style={{fontSize:12,marginTop:6,color:"#6d7175"}}>{item.caption}</figcaption>:null}</figure>)}</div>;
}

function VideoCanvasWidget({ node }) {
  const props = normalizeVideoWidgetProps(node.props || {});
  const poster = props.posterEnabled ? String(props.poster?.previewUrl || props.poster?.url || "") : "";
  const embed = videoEmbedUrl({...props,autoplay:false}, false);
  const frameStyle = {width:"100%",aspectRatio:"16 / 9",border:0,borderRadius:12,background:"#111",display:"block"};
  if (!props.url) return <div style={{...frameStyle,color:"#fff",display:"grid",placeItems:"center"}}>Choose or paste a video</div>;
  if (poster) return <div style={{...frameStyle,position:"relative",overflow:"hidden"}}><img src={poster} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>{props.showPlayIcon?<span style={{position:"absolute",inset:"50% auto auto 50%",transform:"translate(-50%,-50%)",width:props.playIconSize,height:props.playIconSize,borderRadius:999,display:"grid",placeItems:"center",background:"rgba(0,0,0,.68)",color:"#fff",fontSize:Math.round(props.playIconSize*.42)}}>{props.playIcon?.source==="svg-file"&&props.playIcon?.url?<img src={props.playIcon.url} alt="" style={{width:"46%",height:"46%",objectFit:"contain"}}/>:(props.playIcon?.glyph||"▶")}</span>:null}</div>;
  if (["youtube","vimeo","dailymotion"].includes(props.provider) && embed) return <iframe title="Video preview" src={embed} loading="lazy" allow="autoplay; fullscreen; picture-in-picture" style={frameStyle}/>;
  return <video src={props.url} muted={props.muted} loop={props.loop} controls={props.controls} playsInline={props.playsInline} preload={props.preload} style={frameStyle}/>;
}

function SliderCanvasWidget({ node, selectedId, onSelect, onDrop, onRequestAddChild, onMoveNode, previewCollection, previewProduct, previewBlog, previewArticle, previewSearch, reusableSections, previewMode }) {
  const slides = Array.isArray(node.children) ? node.children : [];
  const [active, setActive] = useState(0);
  useEffect(()=>{ if(active >= slides.length) setActive(Math.max(0,slides.length-1)); },[slides.length,active]);
  const nested = isNestedSliderType(node.type);
  const settings = nested ? normalizeNestedSliderProps(node.type, node.props || {}) : normalizeSliderProps(node.props || {});
  const noun = nested ? nestedItemNoun(node.type) : 'Slide';
  const visible = sliderSlidesForDevice(settings, previewMode);
  const slide = slides[active];
  return <div className="vsn-slider-editor" style={{border:"1px solid #e3e3e3",borderRadius:12,overflow:"hidden",background:"#fff"}}>
    <div style={{display:"flex",gap:6,padding:8,borderBottom:"1px solid #e3e3e3",overflowX:"auto",background:"#f6f6f7"}}>{slides.map((item,index)=><button type="button" key={item.id} onClick={(event)=>{event.stopPropagation();setActive(index);onSelect?.(node.id,event);}} style={{whiteSpace:"nowrap",border:index===active?"1px solid #008060":"1px solid #d9d9d9",background:index===active?"#eaf7f2":"#fff",borderRadius:7,padding:"6px 9px",fontSize:11,fontWeight:600}}>{item.props?.slideLabel||item.label||`${noun} ${index+1}`}</button>)}</div>
    <div style={{padding:settings.edgePadding,position:"relative",minHeight:260}}>{slide ? <div style={{minHeight:240,border:"1px dashed #b7bdc1",borderRadius:10,padding:10,background:"#fafbfb"}}>{slide.type === "container" && (slide.props?.__sliderSlide || slide.props?.__nestedSliderItem) ? <>{(slide.children||[]).map((child)=><div key={child.id}><DropZone parentId={slide.id} beforeId={child.id} onDrop={onDrop} onAdd={onRequestAddChild} compact/><RenderNode node={child} parentId={slide.id} selectedId={selectedId} onSelect={onSelect} onDrop={onDrop} onRequestAddChild={onRequestAddChild} onMoveNode={onMoveNode} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections} previewMode={previewMode}/></div>)}<DropZone parentId={slide.id} beforeId={null} onDrop={onDrop} onAdd={onRequestAddChild}/>{!(slide.children||[]).length?<div style={{minHeight:150,display:"grid",placeItems:"center",textAlign:"center",color:"#6d7175",pointerEvents:"none"}}><div><div style={{fontSize:34,lineHeight:1}}>＋</div><strong style={{display:"block",fontSize:12,marginTop:6}}>Add any widget</strong><span title="Drag a widget into this slide" style={{fontSize:10}}>Drag a widget into this {nested ? noun.toLowerCase() : "slide"}</span></div></div>:null}</> : <RenderNode node={slide} parentId={node.id} selectedId={selectedId} onSelect={onSelect} onDrop={onDrop} onRequestAddChild={onRequestAddChild} onMoveNode={onMoveNode} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections} previewMode={previewMode}/>}</div> : <div style={{minHeight:220,display:"grid",placeItems:"center",color:"#6d7175"}}>Add an item from Widget Settings.</div>}<div style={{position:"absolute",right:10,bottom:8,fontSize:10,color:"#8c9196"}}>{visible} visible · {settings.direction}</div></div>
  </div>;
}

function ProductGrid({ columns = 3, title = 'Products' }) {
  return (
    <div>
      <h3 className="text-2xl font-bold mb-5">{title}</h3>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns * 2 }).map((_, index) => (
          <div key={index} className="border border-[#e3e3e3] rounded-xl overflow-hidden">
            <div className="aspect-square bg-[#f1f1f1]" />
            <div className="p-3"><p className="text-sm font-medium">Shopify product</p><p className="text-sm font-semibold text-[#008060]">$49.00</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getImageAspectRatio(
  ratio,
) {
  switch (ratio) {
    case "portrait":
      return "4 / 5";

    case "landscape":
      return "4 / 3";

    case "wide":
      return "16 / 9";

    case "natural":
      return "auto";

    case "square":
    default:
      return "1 / 1";
  }
}

function editorCssSize(
  value,
  fallback,
) {
  const finalValue =
    value ?? fallback;

  if (
    typeof finalValue === "number" ||
    /^-?\d+(\.\d+)?$/.test(
      String(finalValue),
    )
  ) {
    return `${finalValue}px`;
  }

  return finalValue;
}

function previewProductPrice(product) {
  const raw =
    product?.priceRangeV2?.minVariantPrice?.amount ??
    product?.price?.amount ??
    product?.price ??
    0;

  const numeric = Number(
    String(raw).replace(/[^0-9.-]/g, ""),
  );

  return Number.isFinite(numeric) ? numeric : 0;
}

function sortPreviewProducts(products, sortBy) {
  const list = Array.isArray(products)
    ? [...products]
    : [];

  switch (sortBy) {
    case "newest":
      return list.sort(
        (a, b) =>
          new Date(b?.createdAt || 0) -
          new Date(a?.createdAt || 0),
      );

    case "oldest":
      return list.sort(
        (a, b) =>
          new Date(a?.createdAt || 0) -
          new Date(b?.createdAt || 0),
      );

    case "price-asc":
      return list.sort(
        (a, b) =>
          previewProductPrice(a) -
          previewProductPrice(b),
      );

    case "price-desc":
      return list.sort(
        (a, b) =>
          previewProductPrice(b) -
          previewProductPrice(a),
      );

    case "title-asc":
      return list.sort((a, b) =>
        String(a?.title || "").localeCompare(
          String(b?.title || ""),
        ),
      );

    case "title-desc":
      return list.sort((a, b) =>
        String(b?.title || "").localeCompare(
          String(a?.title || ""),
        ),
      );

    default:
      return list;
  }
}

function formatPreviewMoney(
  money,
) {
  if (!money?.amount) {
    return "";
  }

  try {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency:
          money.currencyCode ||
          "USD",
      },
    ).format(
      Number(money.amount),
    );
  } catch {
    return `${money.amount} ${money.currencyCode || ""
      }`;
  }
}

const SAMPLE_COLLECTION_IMAGE = "/vsn-stock/seasonal.svg";




const PHASE10_CANVAS_TYPES = new Set(["breadcrumbs","icon-list","icon-box","image-box","accordion","toggle","social-icons","map","progress-bar","counter","pricing-table","timeline","data-table","menu-anchor","form-builder","product-media","inventory-status","collection-filters","collection-sorting","collection-pagination","cart-drawer","countdown","product-grid","product-card","collection-grid","html","liquid"]);
function phase10CanvasRows(value,n=3){return String(value||"").split(/\r?\n/).map(l=>l.split("|").map(x=>x.trim()).slice(0,n)).filter(r=>r.some(Boolean));}
function Phase10CanvasWidget({node,previewProduct}){const p=node.props||{},t=node.type,gap=node.styles?.spacing?.gap||node.styles?.grid?.gap||"12px";
 if(t==="breadcrumbs"){const items=normalizeStructuredItems(t,p).filter((_,i)=>p.showHome!==false||i>0);return <div style={{display:"flex",gap,flexWrap:"wrap"}}>{items.map((item,i)=><span key={item.id||i}>{i?`${p.separator||"/"} `:""}{item.label}</span>)}</div>;}
 if(t==="icon-list"){const items=normalizeStructuredItems(t,p);return <div style={{display:"grid",gap}}>{items.map((item,i)=><div key={item.id||i}>{item.icon||"•"} {item.label}</div>)}</div>;}
 if(t==="icon-box")return <div style={{border:"1px solid #eee",borderRadius:10,padding:14}}><div style={{fontSize:28}}>{p.icon||"★"}</div><b>{p.heading}</b><div>{p.text}</div></div>;
 if(t==="image-box")return <div>{p.src?<img src={p.src} alt="" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:10}}/>:<div style={{aspectRatio:"4/3",background:"#eee",borderRadius:10}}/>}<b>{p.heading}</b><div>{p.text}</div></div>;
 if(t==="accordion"||t==="toggle"){const rows=t==="toggle"?[{id:"toggle",title:p.title,content:p.content}]:normalizeStructuredItems("accordion",p);return <div style={{display:"grid",gap}}>{rows.map((item,i)=><details key={item.id||i} open={i===0} style={{border:"1px solid #eee",borderRadius:10,padding:10}}><summary>{item.title}</summary><div>{item.content}</div></details>)}</div>}
 
 if(t==="social-icons"){const items=normalizeStructuredItems(t,p);return <div style={{display:"flex",gap}}>{items.map((item,i)=><span key={item.id||i} style={{width:34,height:34,border:"1px solid #ddd",borderRadius:99,display:"grid",placeItems:"center"}}>{item.icon||item.label?.slice(0,2)}</span>)}</div>;}
 if(t==="map")return <div style={{height:Number(p.height||360),background:"#f3f3f3",display:"grid",placeItems:"center",borderRadius:10}}>Map: {p.query} · Zoom {p.zoom||14}</div>;
 if(t==="progress-bar")return <div><b>{p.label} {p.showValue!==false?`${p.value||0}%`:""}</b><div style={{height:8,background:"#eee",borderRadius:99}}><div style={{height:"100%",width:`${Math.max(0,Math.min(100,Number(p.value)||0))}%`,background:"#008060",borderRadius:99}}/></div></div>;
 if(t==="counter")return <div style={{fontSize:36,fontWeight:700}}>{p.prefix}{p.end??100}{p.suffix}</div>;
 if(t==="pricing-table")return <div style={{border:"1px solid #eee",borderRadius:12,padding:16}}><h3>{p.title}</h3><b style={{fontSize:28}}>{p.price}</b><div>{String(p.featuresText||"").split(/\r?\n/).join(" · ")}</div><button type="button">{p.buttonText}</button></div>;
 if(t==="timeline"){const items=normalizeStructuredItems(t,p);return <div style={{display:"grid",gap}}>{items.map((item,i)=><div key={item.id||i}><b>{item.eyebrow} — {item.title}</b><div>{item.description}</div></div>)}</div>;}
 if(t==="data-table")return <div style={{border:"1px solid #eee",padding:10,borderRadius:8}}>Table · {String(p.headersText||"").replaceAll("|"," · ")}</div>;
 if(t==="menu-anchor")return <div style={{fontSize:11,color:"#777"}}>Anchor #{p.anchorId||"section-anchor"}</div>;
 if(t==="form-builder")return <div style={{display:"grid",gap}}><b>{p.heading}</b>{String(p.fieldsText||"").split(/\r?\n/).filter(Boolean).slice(0,6).map((line,i)=>{const [type,,label,placeholder]=line.split("|");return <label key={i} style={{fontSize:12}}>{label}<input disabled placeholder={placeholder} type={["email","number","date","time"].includes(type)?type:"text"} style={{display:"block",width:"100%",padding:8,border:"1px solid #ddd",borderRadius:7}}/></label>})}<div style={{display:"flex",gap:8}}>{p.multiStep&&<button type="button">{p.previousText||"Back"}</button>}{p.multiStep&&<button type="button">{p.nextText||"Next"}</button>}<button type="button">{p.submitText||"Submit"}</button></div></div>;
 if(t==="product-media"){const mp=normalizeContextImageProps(p);const media=previewProduct?.featuredImage||previewProduct?.media?.nodes?.[0]?.image||{};const src=contextImageUrl(media,mp);return src?<img src={src} alt={contextImageAlt(media,mp,previewProduct?.title||"Product image")} loading={mp.loading} fetchPriority={mp.fetchPriority} style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:10}}/>:<div style={{aspectRatio:"1",background:"#eee",borderRadius:10}}/>;}
 if(t==="inventory-status"){const variants=previewProduct?.variants?.nodes||[];const available=variants.some((variant)=>variant?.availableForSale);const qty=variants.reduce((sum,variant)=>sum+(Number.isFinite(Number(variant?.inventoryQuantity))?Math.max(0,Number(variant.inventoryQuantity)):0),0);const threshold=Math.max(1,Number(p.lowThreshold||5));const low=available&&qty>0&&qty<=threshold;return <b>{!available?(p.soldOutText||"Sold out"):low?(p.lowStockText||"Low stock"):(p.inStockText||"In stock")}</b>;}
 if(t==="collection-filters")return <div><button type="button">{p.label||"Filters"}</button> <button type="button">Availability</button> <button type="button">Price</button></div>;
 if(t==="collection-sorting")return <select><option>{p.label||"Sort by"}: Featured</option></select>;
 if(t==="collection-pagination")return p.mode==="pages"?<div style={{display:"flex",gap:8}}><button type="button">{p.previousText||"Previous"}</button><button type="button">{p.nextText||"Next"}</button></div>:<button type="button">{p.buttonText||"Load more"}</button>;
 if(t==="cart-drawer")return <div style={{border:"1px solid #eee",borderRadius:10,padding:14}}><b>{p.heading||"Your cart"}</b><div>{p.emptyText}</div><div style={{display:"flex",gap:8,marginTop:10}}><button type="button">{p.viewCartText||"View cart"}</button><button type="button">{p.checkoutText||"Checkout"}</button></div></div>;
 if(t==="countdown")return <div>{p.showDays===false?null:<span>07d </span>}{p.showHours===false?null:<span>12h </span>}{p.showMinutes===false?null:<span>34m </span>}{p.showSeconds===false?null:<span>56s</span>}</div>;
 if(t==="product-grid"||t==="product-card"||t==="collection-grid"){const g=normalizeGridProps(t,p);const columns=t==="product-card"?1:(previewProduct?.__previewMode==="mobile"?g.columnsMobile:g.columnsDesktop);const count=t==="product-card"?1:Math.min(g.limit,6);return <div style={{display:"grid",gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`,gap:g.gap}}>{Array.from({length:count},(_,i)=><div key={i} style={{border:"1px solid #eee",borderRadius:8,padding:8}}>{g.showImage?<div style={{aspectRatio:gridImageRatio(g.imageRatio),background:"#f2f2f2",borderRadius:7}}/>:null}{g.showTitle?<strong style={{display:"block",marginTop:8}}>{t==="collection-grid"?`Collection ${i+1}`:`Product ${i+1}`}</strong>:null}{t!=="collection-grid"&&g.showPrice?<span style={{fontSize:12,color:"#6d7175"}}>$49.00</span>:null}</div>)}</div>;}
 if(t==="html"||t==="liquid")return <pre style={{whiteSpace:"pre-wrap",fontSize:11,background:"#f6f6f7",padding:8}}>{p.code||p.html||p.liquid||p.content||t}</pre>;
 return null;}

const EXTENDED_CANVAS_TYPES = new Set(["faq","testimonials","logo-cloud","stats","team-grid","marquee","tabs","product-tabs","size-guide","shipping-info","stock-progress","trust-badges","recently-viewed","related-collections","upsell-products","sticky-add-to-cart","announcement-bar","mega-menu","header-search","cart-icon","account-link","customer-name","customer-login","customer-logout","customer-orders-link","customer-addresses-link","localization-switcher"]);
function canvasRows(value){return String(value||"").split(/\r?\n/).map((line)=>line.split("|").map((x)=>x.trim())).filter((r)=>r.some(Boolean));}
function ExtendedCanvasWidget({node,previewProduct}){ const p=node.props||{}, t=node.type, gap=node.styles?.grid?.gap||node.styles?.spacing?.gap||"14px";
 if(t==="faq"){const items=normalizeStructuredItems(t,p);return <div style={{display:"grid",gap}}>{items.map((item,i)=><details key={item.id||i} open={i===0} style={{border:"1px solid #ddd",borderRadius:10,padding:12}}><summary>{item.question}</summary><div>{item.answer}</div></details>)}</div>;}
 if(t==="testimonials"){const items=normalizeStructuredItems(t,p);return <div style={{display:"grid",gridTemplateColumns:`repeat(${p.columns||3},1fr)`,gap}}>{items.map((item,i)=><div key={item.id||i} style={{border:"1px solid #eee",borderRadius:10,padding:14}}>“{item.quote}”<div style={{color:"#777",marginTop:8}}>{item.name}{item.role?` · ${item.role}`:""}</div></div>)}</div>;}
 if(t==="logo-cloud"){const items=normalizeStructuredItems(t,p);return <div style={{display:"flex",gap,flexWrap:"wrap"}}>{items.map((item,i)=><span key={item.id||i} style={{padding:"8px 12px",border:"1px solid #eee",borderRadius:99}}>{item.imageUrl?<img src={item.imageUrl} alt={item.label||""} style={{height:28,maxWidth:100,objectFit:"contain"}}/>:item.label}</span>)}</div>;}
 if(t==="stats"){const items=normalizeStructuredItems(t,p);return <div style={{display:"grid",gridTemplateColumns:`repeat(${p.columns||4},1fr)`,gap}}>{items.map((item,i)=><div key={item.id||i} style={{textAlign:"center",padding:14,border:"1px solid #eee",borderRadius:10}}><b style={{fontSize:24}}>{item.value}</b><div>{item.label}</div></div>)}</div>;}
 if(t==="team-grid"){const items=normalizeStructuredItems(t,p);return <div style={{display:"grid",gridTemplateColumns:`repeat(${p.columns||3},1fr)`,gap}}>{items.map((item,i)=><div key={item.id||i} style={{padding:14,border:"1px solid #eee",borderRadius:10}}>{item.imageUrl?<img src={item.imageUrl} alt={item.name||""} style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:8}}/>:<div style={{aspectRatio:"1",background:"#eee",borderRadius:8}}/>}<b>{item.name}</b><div>{item.role}</div></div>)}</div>;}
 if(t==="gallery-grid")return <div style={{display:"grid",gridTemplateColumns:`repeat(${p.columnsDesktop||4},1fr)`,gap}}>{String(p.imagesText||"").split(/\r?\n/).filter(Boolean).map((src,i)=><img key={i} src={src} alt="" style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:8}}/>)}</div>;
 if(t==="marquee")return <div style={{padding:10,background:node.styles?.background?.color||"#111",color:node.styles?.typography?.color||"#fff",whiteSpace:"nowrap",overflow:"hidden"}}>{p.text} {p.text}</div>;
 if(t==="tabs"||t==="product-tabs"){const items=t==="tabs"?normalizeStructuredItems("tabs",p).map(item=>[item.label,item.content]):[[p.descriptionLabel||"Description",previewProduct?.description||"Product description"],[p.shippingLabel||"Shipping",p.shippingText],[p.returnsLabel||"Returns",p.returnsText]];return <div><div style={{display:"flex",gap:6,borderBottom:"1px solid #eee"}}>{items.map(([l],i)=><button type="button" key={i}>{l}</button>)}</div><div style={{padding:12}}>{items[0]?.[1]}</div></div>}
 if(t==="size-guide")return <details open style={{border:"1px solid #eee",borderRadius:10,padding:12}}><summary>{p.buttonText||"Size guide"}</summary><div>{p.content}</div></details>;
 if(t==="shipping-info")return <div><b>{p.heading||"Shipping"}</b><div>{p.text}</div></div>;
 if(t==="stock-progress")return <div><b>{p.label}</b><div style={{height:7,background:"#eee",borderRadius:99,marginTop:6}}><div style={{height:"100%",width:"50%",background:"#008060",borderRadius:99}}/></div></div>;
 if(t==="trust-badges"){const items=normalizeStructuredItems(t,p);return <div style={{display:"grid",gridTemplateColumns:`repeat(${p.columns||3},1fr)`,gap}}>{items.map((item,k)=><div key={item.id||k} style={{padding:10,border:"1px solid #eee",borderRadius:8,textAlign:"center"}}>{item.icon}<div>{item.label}</div></div>)}</div>;}
 if(["recently-viewed","upsell-products"].includes(t))return <div><h3>{p.heading}</h3><div style={{display:"grid",gridTemplateColumns:`repeat(${p.columns||4},1fr)`,gap}}>{[1,2,3].map(i=><div key={i} style={{border:"1px solid #eee",padding:8,borderRadius:8}}><div style={{aspectRatio:"1",background:"#eee"}}/>Product</div>)}</div></div>;
 if(t==="related-collections")return <div><h3>{p.heading}</h3>{canvasRows(p.itemsText).map(([l],i)=><div key={i}>{l}</div>)}</div>;
 if(t==="sticky-add-to-cart")return <div style={{display:"flex",justifyContent:"space-between",padding:12,border:"1px solid #ddd"}}><b>{previewProduct?.title||"Product"}</b><button type="button">{p.text||"Add to cart"}</button></div>;
 if(t==="announcement-bar")return <div style={{position:"relative",textAlign:"center",padding:9,background:node.styles?.background?.color||"#111",color:node.styles?.typography?.color||"#fff"}}>{p.text}{p.dismissible?<span style={{position:"absolute",right:10}}>×</span>:null}</div>;
 if(t==="mega-menu"){const items=normalizeStructuredItems(t,p);return <div><b>{p.label||"Shop"} ▾</b><div style={{padding:8,border:"1px solid #eee"}}>{items.map((item,i)=><div key={item.id||i}>{item.label}</div>)}</div></div>;}
 if(t==="header-search")return <div style={{display:"flex",gap:4}}><input placeholder={p.placeholder}/><button type="button">{p.buttonLabel}</button></div>;
 if(t==="cart-icon")return <button type="button">{p.label||"Cart"} (0)</button>;
 if(t==="account-link")return <span>{p.label||"Account"}</span>;
 if(t==="customer-name")return <span>{p.prefix||"Hello, "}{p.loggedOutText||"Customer"}</span>;
 if(t==="customer-login"||t==="customer-logout"||t==="customer-orders-link"||t==="customer-addresses-link")return <span>{p.label||"Account"}</span>;
 if(t==="localization-switcher")return <div style={{display:"flex",gap:6}}>{p.showCountry===false?null:<label>{p.countryLabel||"Country"} <select><option>United States</option></select></label>}{p.showLanguage===false?null:<label>{p.languageLabel||"Language"} <select><option>English</option></select></label>}</div>;
 return null; }

function readPreviewPath(source, path) {
  if (!source || !path) return undefined;
  return String(path).split(".").reduce((value, key) => value == null ? undefined : value[key], source);
}

function applyPreviewDynamicSource(node, context = {}) {
  const dynamic = node?.dynamicSource;
  if (!dynamic?.enabled || !dynamic.source) return node;
  let value;
  if (dynamic.source === "product.price") value = context.previewProduct?.priceRangeV2?.minVariantPrice ? formatPreviewMoney(context.previewProduct.priceRangeV2.minVariantPrice) : undefined;
  else if (dynamic.source === "product.metafield") value = context.previewProduct?.metafields?.nodes?.find((item)=>item.namespace===(dynamic.namespace||"custom") && item.key===dynamic.key)?.value;
  else if (dynamic.source === "query.search") value = context.previewSearch?.query || dynamic.fallback;
  else if (dynamic.source === "metaobject.field") value = dynamic.fallback || "Metaobject field preview";
  else {
    const source = { product: context.previewProduct, collection: context.previewCollection, article: context.previewArticle, blog: context.previewBlog, search: context.previewSearch, customer: { name: "Customer", email: "customer@example.com" } };
    value = readPreviewPath(source, dynamic.source);
  }
  if (value == null || value === "") value = dynamic.fallback;
  if (value == null || value === "") return node;
  const props = { ...(node.props || {}) };
  const target = dynamic.target || "text";
  if (target === "src") props.src = String(value);
  else if (target === "url") props.url = String(value);
  else props.text = String(value);
  return { ...node, props };
}

function previewConditionRuleMatches(rule = {}, context = {}) {
  const name = rule.rule || "always";
  const value = String(rule.value || "").toLowerCase();
  const product = context.previewProduct || {};
  const collection = context.previewCollection || {};
  if (name === "always") return true;
  if (name === "product-available") return product.availableForSale === true;
  if (name === "product-sold-out") return product.availableForSale === false;
  if (name === "product-vendor") return String(product.vendor || "").toLowerCase() === value;
  if (name === "product-type") return String(product.productType || "").toLowerCase() === value;
  if (name === "product-tag") return (product.tags || []).some((tag)=>String(tag).toLowerCase()===value);
  if (name === "collection-handle") return String(collection.handle || "").toLowerCase() === value;
  if (name === "cart-empty") return Number(context.cartItemCount || 0) <= 0;
  if (name === "cart-has-items") return Number(context.cartItemCount || 0) > 0;
  if (name === "cart-items-min") return Number(context.cartItemCount || 0) >= Math.max(0, Number(rule.value || 0));
  if (name === "product-inventory-min") return Number(product.inventoryQuantity ?? product.totalInventory ?? 0) >= Number(rule.value || 0);
  if (name === "product-inventory-max") return Number(product.inventoryQuantity ?? product.totalInventory ?? 0) <= Number(rule.value || 0);
  if (name === "device-mobile") return context.previewMode === "mobile";
  if (name === "device-tablet") return context.previewMode === "tablet";
  if (name === "device-desktop") return context.previewMode === "desktop";
  if (name === "date-after") return !rule.value || Date.now() >= new Date(rule.value).getTime();
  if (name === "date-before") return !rule.value || Date.now() <= new Date(rule.value).getTime();
  return true;
}
function previewConditionsMatch(node, context = {}) {
  const c = node?.conditions;
  if (!c?.enabled) return true;
  if (c.preview === "show") return true;
  if (c.preview === "hide") return false;
  if (Array.isArray(c.groups) && c.groups.length) {
    const groups = c.groups.map((group)=>{
      const results=(group.rules||[]).map((rule)=>previewConditionRuleMatches(rule,context));
      return String(group.operator||"AND").toUpperCase()==="OR"?results.some(Boolean):results.every(Boolean);
    });
    return String(c.operator||"AND").toUpperCase()==="OR"?groups.some(Boolean):groups.every(Boolean);
  }
  return previewConditionRuleMatches(c,context);
}

function stickyBoundaryElement(element, root) {
  const mode = element?.dataset?.vsnStickyBoundary || "parent";
  const ancestor = (selector) => element?.parentElement?.closest?.(selector) || null;
  if (mode === "column") return ancestor("[data-vsn-column-cell='1']") || ancestor("[data-vsn-node-type='columns']") || ancestor("[data-vsn-node-type]") || root.querySelector?.("[data-vsn-page-boundary='1']") || root;
  if (mode === "section") return ancestor("[data-vsn-node-type='section']") || ancestor("[data-vsn-node-type]") || root.querySelector?.("[data-vsn-page-boundary='1']") || root;
  if (mode === "page") return root.querySelector?.("[data-vsn-page-boundary='1']") || root;
  if (mode === "custom") {
    const wanted = String(element?.dataset?.vsnStickyTarget || "").trim();
    if (wanted) {
      const match = Array.from(root.querySelectorAll?.("[data-vsn-id]") || []).find((node) => node.getAttribute("data-vsn-id") === wanted);
      if (match && match.contains(element)) return match;
    }
  }
  return ancestor("[data-vsn-node-type]") || root.querySelector?.("[data-vsn-page-boundary='1']") || root;
}

function stickyDiagnosticMessage(element, boundary) {
  const messages = [];
  const requested = element?.dataset?.vsnStickyBoundary || "parent";
  if (requested === "custom") {
    const wanted = String(element?.dataset?.vsnStickyTarget || "").trim();
    if (!wanted) messages.push("Custom ancestor ID is empty; Parent Container is being used.");
    else if (boundary?.getAttribute?.("data-vsn-id") !== wanted) messages.push("Custom sticky boundary must be an ancestor of this element; Parent Container is being used.");
  }
  let current = element?.parentElement;
  while (current && current !== boundary?.parentElement) {
    const style = globalThis.getComputedStyle?.(current);
    if (style) {
      const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
      if (/hidden|clip/i.test(overflow)) { messages.push("An ancestor clips overflow, so sticky content can be visually clipped."); break; }
      if (style.transform && style.transform !== "none") { messages.push("An ancestor uses transform; verify the sticky result at this breakpoint."); break; }
    }
    if (current === boundary) break;
    current = current.parentElement;
  }
  return Array.from(new Set(messages)).join(" ");
}

function updateBoundedSticky(root) {
  if (!root?.getBoundingClientRect) return;
  let rootRect;
  try { rootRect = root.getBoundingClientRect(); } catch { return; }
  root.querySelectorAll?.("[data-vsn-sticky-element='1']").forEach((element) => {
    try {
      if (!element?.isConnected || element.dataset.vsnStickyActive === "0") {
        element?.style?.setProperty?.("--vsn-editor-sticky-y", "0px");
        element?.removeAttribute?.("data-vsn-sticky-diagnostic");
        return;
      }
      const boundary = stickyBoundaryElement(element, root);
      if (!boundary || boundary === element || !boundary.getBoundingClientRect) return;
      const currentShift = Number.parseFloat(element.style.getPropertyValue("--vsn-editor-sticky-y")) || 0;
      const parallaxShift = Number.parseFloat(element.style.getPropertyValue("--vsn-editor-parallax-source")) || 0;
      const rect = element.getBoundingClientRect();
      const naturalTop = rect.top - currentShift - parallaxShift;
      const naturalBottom = naturalTop + rect.height;
      const boundaryRect = boundary.getBoundingClientRect();
      const topOffset = Math.max(0, Number(element.dataset.vsnStickyOffset || 12) || 0);
      const endOffset = Math.max(0, Number(element.dataset.vsnStickyEndOffset || 0) || 0);
      const shift = calculateBoundedStickyShift({ viewportTop: rootRect.top, naturalTop, naturalBottom, boundaryBottom: boundaryRect.bottom, topOffset, endOffset });
      element.style.setProperty("--vsn-editor-sticky-y", `${Number.isFinite(shift) ? shift : 0}px`);
      const diagnostic = stickyDiagnosticMessage(element, boundary);
      if (diagnostic) element.setAttribute("data-vsn-sticky-diagnostic", diagnostic);
      else element.removeAttribute("data-vsn-sticky-diagnostic");
    } catch (error) {
      element?.style?.setProperty?.("--vsn-editor-sticky-y", "0px");
      element?.setAttribute?.("data-vsn-sticky-diagnostic", "Sticky preview recovered from an editor runtime error.");
      console.warn("VSN sticky preview recovered:", error);
    }
  });
}

function RenderNode({
  node,
  parentId = null,
  selectedId,
  onSelect,
  onDrop,
  onRequestAddChild,
  onMoveNode,
  previewCollection,
  previewProduct,
  previewBlog,
  previewArticle,
  previewSearch,
  reusableSections = [],
  previewMode = "desktop",
}) {
  const loopContext = useContext(LoopItemContext);
  const componentLibrary = useContext(ComponentLibraryContext);
  const componentStack = useContext(ComponentStackContext);
  const responsiveConfig = useContext(ResponsiveConfigContext);
  const widgetTemplates = useContext(WidgetTemplateContext);
  if (node?.meta?.hidden === true) return null;
  node = applyPreviewDynamicSource(node, { previewCollection, previewProduct, previewBlog, previewArticle, previewSearch });
  node = applyDynamicBindings(node, { loop: loopContext, product: previewProduct, collection: previewCollection, blog: previewBlog, article: previewArticle, search: previewSearch, customer: { name: "Customer", email: "customer@example.com" } });
  node = applyResponsiveNode(node, previewMode, responsiveConfig);
  const selected = selectedId === node.id;
  const [dropPosition, setDropPosition] = useState("");
  const dragFrameRef = useRef(0);
  const pendingDropPositionRef = useRef("");
  const style = cssFromStyles(node.styles);
  const interactions = normalizeElementInteractions(node.interactions);
  const stickyActive = isStickyEnabledForDevice(interactions, previewMode);
  const interactionStyle = interactionEditorStyle(interactions, { stickyActive });
  const select = (event) => { event.stopPropagation(); onSelect(node.id, event); };
  const conditionMatches = previewConditionsMatch(node, { previewCollection, previewProduct, previewBlog, previewArticle, previewSearch, previewMode });
  const conditionPreviewClass = node.conditions?.enabled && !conditionMatches ? 'opacity-30 grayscale-[.3]' : '';
  const className = `canvas-element relative ${selected ? 'selected' : ''} ${node.meta?.locked ? 'opacity-80' : ''} ${conditionPreviewClass}`;
  let content;

  if (getVsnEditorRenderer(node.type)) {
    content=<SdkWidgetView node={node} context={{previewCollection,previewProduct,previewBlog,previewArticle,previewSearch,loop:loopContext,reusableSections}} style={style}/>;
  } else if (node.type === "component-instance") {
    const componentId = String(node.props?.componentId || "");
    if (componentId && componentStack.includes(componentId)) {
      content = <div className="rounded-lg border border-dashed border-[#d72c0d] bg-[#fff4f2] p-6 text-center text-xs text-[#8a1f0d]">Circular component dependency blocked.</div>;
    } else {
      const resolved = resolveComponentInstance(node, componentLibrary);
      content = resolved?.root ? <ComponentStackContext.Provider value={[...componentStack, componentId]}><div data-vsn-component-master-version={resolved.masterVersion} style={{...style,border:selected?"1px solid #008060":"1px dashed transparent",borderRadius:"8px"}}><RenderNode node={resolved.root} parentId={node.id} selectedId={selectedId} onSelect={(id,event)=>onSelect(node.id,event)} onDrop={onDrop} onRequestAddChild={onRequestAddChild} onMoveNode={onMoveNode} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections} previewMode={previewMode}/><DropZone parentId={node.id} beforeId={null} onDrop={onDrop} onAdd={onRequestAddChild}/></div></ComponentStackContext.Provider> : <div className="rounded-lg border border-dashed border-[#c9cccf] bg-[#fafbfb] p-6 text-center text-xs text-[#6d7175]">Choose a component in Properties.</div>;
    }
  } else if (node.type === "loop") {
    content = <LoopCanvasWidget node={node} selectedId={selectedId} onSelect={onSelect} onDrop={onDrop} onRequestAddChild={onRequestAddChild} onMoveNode={onMoveNode} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections} previewMode={previewMode} />;
  } else if (node.type === "gallery-grid") {
    content = <GalleryCanvasWidget node={node} previewMode={previewMode} />;
  } else if (node.type === "video") {
    content = <VideoCanvasWidget node={node} />;
  } else if (node.type === "slider" || isNestedSliderType(node.type)) {
    content = <SliderCanvasWidget node={node} selectedId={selectedId} onSelect={onSelect} onDrop={onDrop} onRequestAddChild={onRequestAddChild} onMoveNode={onMoveNode} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections} previewMode={previewMode} />;
  } else if (PHASE10_CANVAS_TYPES.has(node.type)) {
    content = <Phase10CanvasWidget node={node} previewProduct={previewProduct} />;
  } else if (EXTENDED_CANVAS_TYPES.has(node.type)) {
    content = <ExtendedCanvasWidget node={node} previewProduct={previewProduct} />;
  } else if (node.type === "global-section") {
    const section = reusableSections.find((item) => item.id === node.props?.sectionId);
    const sectionNodes = Array.isArray(section?.content) ? section.content.filter((item) => !["global-styles", "template-settings"].includes(item?.type)) : [];
    content = section ? (
      <div style={{ ...style, border: selected ? "1px solid #008060" : "1px dashed #d9d9d9", borderRadius: "8px" }}>
        {sectionNodes.map((child) => <RenderNode key={child.id} node={child} parentId={node.id} selectedId={selectedId} onSelect={() => onSelect(node.id)} onDrop={onDrop} onRequestAddChild={onRequestAddChild} onMoveNode={onMoveNode} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections} previewMode={previewMode} />)}
      </div>
    ) : <div className="rounded-lg border border-dashed border-[#c9cccf] bg-[#fafbfb] p-6 text-center text-xs text-[#6d7175]">Choose a reusable section in Properties.</div>;
  } else if (node.type === "navigation-menu") {
    const items = normalizeStructuredItems("navigation-menu", node.props || {}).filter((item)=>item.label);
    content = <nav style={{ ...style, display: "flex", gap: node.styles?.spacing?.gap || "22px", justifyContent: node.props.alignment === "left" ? "flex-start" : node.props.alignment === "center" ? "center" : "flex-end", flexWrap: "wrap" }}>{items.map((item) => <a key={`${item.label}-${item.url}`} href={item.url} onClick={(e) => e.preventDefault()} style={{ color: "inherit", textDecoration: "none" }}>{item.label}</a>)}</nav>;
  } else if (["contact-form", "newsletter-form", "product-inquiry-form"].includes(node.type)) {
    const newsletter = node.type === "newsletter-form";
    const inquiry = node.type === "product-inquiry-form";
    content = <form onSubmit={(e) => e.preventDefault()} style={{ ...style, display: "grid", gap: node.styles?.spacing?.gap || "12px" }}><strong>{node.props.heading || (newsletter ? "Join our newsletter" : inquiry ? "Product inquiry" : "Contact us")}</strong>{!newsletter && <input placeholder="Name" className="rounded-lg border border-[#d9d9d9] px-3 py-2" />}{newsletter ? <input type="email" placeholder={node.props.placeholder || "Email address"} className="rounded-lg border border-[#d9d9d9] px-3 py-2" /> : <><input type="email" placeholder="Email" className="rounded-lg border border-[#d9d9d9] px-3 py-2" />{node.props.showPhone !== false && <input placeholder="Phone" className="rounded-lg border border-[#d9d9d9] px-3 py-2" />}<textarea placeholder={inquiry ? "How can we help with this product?" : "Message"} className="min-h-24 rounded-lg border border-[#d9d9d9] px-3 py-2" /></>}<button type="submit" className="rounded-lg bg-[#1a1a1a] px-4 py-2.5 text-sm font-semibold text-white">{node.props.submitText || (newsletter ? "Subscribe" : "Send")}</button></form>;
  } else if (node.type === 'heading') {
    const Tag = node.props.tag || 'h2';
    content = <Tag style={style}>{node.props.text || 'New heading'}</Tag>;
  } else if (node.type === 'collection-title') {
    const Tag = node.props.tag || 'h1';

    content = (
      <Tag style={style}>
        {previewCollection?.title ||
          node.props.fallbackText ||
          "Summer Collection"}
      </Tag>
    );
  } else if (node.type === "search-query-title") {
    const q = previewSearch?.query || "shirt"; content = <h1 style={style}>{node.props.prefix || "Search results for"} “{q}”</h1>;
  } else if (node.type === "search-result-count") {
    const count = previewSearch?.products?.length || 0; content = <div style={style}>{count} {count === 1 ? (node.props.singularText || "result") : (node.props.pluralText || "results")}</div>;
  } else if (node.type === "search-results-grid") {
    const items = (previewSearch?.products || []).slice(0,normalizeGridProps("search-results-grid",node.props).limit); const g=normalizeGridProps("search-results-grid",node.props); const cols=previewMode==="mobile"?g.columnsMobile:previewMode==="tablet"?g.columnsTablet:g.columnsDesktop; content = <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`,gap:g.gap}}>{items.length?items.map((item)=><div key={item.id} style={{border:"1px solid #e5e5e5",borderRadius:"12px",padding:"14px"}}>{item.featuredImage?.url&&<img src={item.featuredImage.url} alt={item.featuredImage.altText||item.title} style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:"8px"}}/>}<strong>{item.title}</strong></div>):<div>{node.props.emptyText||"No results found."}</div>}</div>;
  } else if (node.type === "blog-title") { content = <h1 style={style}>{previewBlog?.title || node.props.fallbackText || "Blog"}</h1>;
  } else if (node.type === "blog-description") { content = <p style={style}>{node.props.fallbackText || "Latest stories and updates."}</p>;
  } else if (node.type === "blog-article-grid") {
    const g=normalizeGridProps("blog-article-grid",node.props); const items=(previewBlog?.articles?.nodes||[]).slice(0,g.limit); const cols=previewMode==="mobile"?g.columnsMobile:previewMode==="tablet"?g.columnsTablet:g.columnsDesktop; content=<div style={{display:"grid",gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`,gap:g.gap}}>{items.length?items.map((item)=><article key={item.id} style={{border:"1px solid #e5e5e5",borderRadius:"12px",padding:"14px"}}>{item.image?.url&&<img src={item.image.url} alt={item.image.altText||item.title} style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:"8px"}}/>}<h3>{item.title}</h3><p>{item.excerpt||""}</p></article>):<div>{node.props.emptyText||"No articles found."}</div>}</div>;
  } else if (node.type === "article-title") { content=<h1 style={style}>{previewArticle?.title||node.props.fallbackText||"Article title"}</h1>;
  } else if (node.type === "article-featured-image") { const mp=normalizeContextImageProps(node.props||{}); const media=previewArticle?.image||{}; const src=contextImageUrl(media,mp); content=src?<img src={src} alt={contextImageAlt(media,mp,previewArticle?.title||"Article")} loading={mp.loading} fetchPriority={mp.fetchPriority} style={{...style,width:"100%",objectFit:"cover"}}/>:<div style={{...style,minHeight:"240px",background:"#f3f3f3"}}/>;
  } else if (node.type === "article-content") { content=<div style={style}>{previewArticle?.excerpt||node.props.fallbackText||"Article content will appear here."}</div>;
  } else if (node.type === "article-author") { content=<div style={style}>{node.props.prefix||"By "}{previewArticle?.author?.name||"Author"}</div>;
  } else if (node.type === "article-date") { const d=previewArticle?.publishedAt?new Date(previewArticle.publishedAt):null; const formatted=d?(node.props.format==="iso"?d.toISOString().slice(0,10):d.toLocaleDateString("en-US",node.props.format==="short"?{year:"numeric",month:"numeric",day:"numeric"}:node.props.format==="medium"?{year:"numeric",month:"short",day:"numeric"}:{year:"numeric",month:"long",day:"numeric"})):"Publish date"; content=<div style={style}>{formatted}</div>;
  } else if (node.type === "article-tags") { content=<div style={style}>{node.props.prefix||""}{(previewArticle?.tags||["Tag"]).join(node.props.separator||" · ")}</div>;
  } else if (node.type === "article-navigation") { content=<div style={{display:"flex",justifyContent:"space-between",...style}}><span>← {node.props.previousText||"Previous article"}</span><span>{node.props.nextText||"Next article"} →</span></div>;
  } else if (node.type === "related-articles") { content=<section style={style}><h2>{node.props.heading||"Related articles"}</h2><div className="text-sm text-[#777]">Related article cards appear on the storefront.</div></section>;
  } else if (node.type === 'text') {
    content = <p style={style}>{node.props.text || 'Add your text content here.'}</p>;
  } else if (
    node.type === 'collection-description'
  ) {
    content = (
      <p style={style}>
        {previewCollection?.description ||
          node.props.fallbackText ||
          "Collection description"}
      </p>
    );
  } else if (
    node.type === "collection-product-count"
  ) {
    const count =
      Number(
        previewCollection
          ?.productsCount
          ?.count ?? 0,
      );

    const singularText =
      node.props.singularText || "product";

    const pluralText =
      node.props.pluralText || "products";

    const label =
      count === 1
        ? singularText
        : pluralText;

    content = (
      <div style={style}>
        {node.props.prefix || ""}
        {count} {label}
      </div>
    );
  } else if (
    node.type === "collection-product-grid"
  ) {
    const columnProp =
      node.props.columns ||
      (previewMode === "mobile"
        ? node.props.columnsMobile
        : previewMode === "tablet"
          ? node.props.columnsTablet
          : node.props.columnsDesktop);

    const columns = Math.max(
      1,
      Number(columnProp ||
        (previewMode === "mobile"
          ? 1
          : previewMode === "tablet"
            ? 2
            : 4)),
    );

    const limit =
      Number(node.props.limit || 8);

    const imageAspectRatio =
      getImageAspectRatio(
        node.props.imageRatio ||
        "square",
      );

    const realProducts =
      previewCollection?.products?.nodes ||
      [];

    const sourceProducts =
      realProducts.length > 0
        ? realProducts
        : SAMPLE_COLLECTION_PRODUCTS;

    const sortedProducts =
      sortPreviewProducts(
        sourceProducts,
        node.props.sortBy || "featured",
      );

    const products =
      sortedProducts.slice(
        0,
        Math.min(
          limit,
          sortedProducts.length,
        ),
      );

    const loadMoreAlign =
      node.props.loadMoreAlignment === "left"
        ? "flex-start"
        : node.props.loadMoreAlignment === "right"
          ? "flex-end"
          : "center";

    const previewVendors = Array.from(new Set(products.map((product) => product.vendor || "").filter(Boolean))).sort();
    const previewTypes = Array.from(new Set(products.map((product) => product.productType || "").filter(Boolean))).sort();

    content = (
      <>
      {node.props.filtersEnabled === true && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "12px", marginBottom: "18px", width: "100%" }}>
          <div style={{ width: "100%", fontWeight: 600 }}>{node.props.filterLabel || "Filter products"}</div>
          {node.props.filterAvailabilityEnabled !== false && (
            <label style={{ display: "grid", gap: "5px", fontSize: "12px" }}><span>Availability</span><select defaultValue="all" style={{ minHeight: "36px", border: "1px solid #d9d9d9", borderRadius: "8px", padding: "6px 9px", background: "white" }}><option value="all">All</option><option value="in-stock">In stock</option><option value="out-of-stock">Out of stock</option></select></label>
          )}
          {node.props.filterPriceEnabled !== false && (<>
            <label style={{ display: "grid", gap: "5px", fontSize: "12px" }}><span>Min price</span><input type="number" placeholder="0" style={{ width: "100px", minHeight: "36px", border: "1px solid #d9d9d9", borderRadius: "8px", padding: "6px 9px" }} /></label>
            <label style={{ display: "grid", gap: "5px", fontSize: "12px" }}><span>Max price</span><input type="number" placeholder="Any" style={{ width: "100px", minHeight: "36px", border: "1px solid #d9d9d9", borderRadius: "8px", padding: "6px 9px" }} /></label>
          </>)}
          {node.props.filterVendorEnabled !== false && (<label style={{ display: "grid", gap: "5px", fontSize: "12px" }}><span>Vendor</span><select defaultValue="" style={{ minHeight: "36px", border: "1px solid #d9d9d9", borderRadius: "8px", padding: "6px 9px", background: "white" }}><option value="">All vendors</option>{previewVendors.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}</select></label>)}
          {node.props.filterProductTypeEnabled !== false && (<label style={{ display: "grid", gap: "5px", fontSize: "12px" }}><span>Product type</span><select defaultValue="" style={{ minHeight: "36px", border: "1px solid #d9d9d9", borderRadius: "8px", padding: "6px 9px", background: "white" }}><option value="">All types</option>{previewTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>)}
          <button type="button" onClick={(event) => event.preventDefault()} style={{ minHeight: "36px", border: "1px solid #d9d9d9", borderRadius: "8px", padding: "6px 10px", background: "white" }}>{node.props.clearFiltersText || "Clear filters"}</button>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            `repeat(${columns}, minmax(0, 1fr))`,
          gap:
            node.styles?.grid?.gap ||
            "24px",
          width: "100%",
        }}
      >
        {products.map((product) => {
          const price =
            product.priceRangeV2
              ?.minVariantPrice
              ? formatPreviewMoney(
                product.priceRangeV2
                  .minVariantPrice,
              )
              : product.price;

          const compareAtPrice =
            product.compareAtPriceRange
              ?.minVariantCompareAtPrice
              ? formatPreviewMoney(
                product
                  .compareAtPriceRange
                  .minVariantCompareAtPrice,
              )
              : product.compareAtPrice;

          return (
            <div
              key={product.id}
              className="vsn-product-card"
              style={{
                backgroundColor:
                  node.styles?.card
                    ?.backgroundColor ||
                  "#ffffff",
                border: `${editorCssSize(
                  node.styles?.card
                    ?.borderWidth,
                  "1px",
                )} solid ${
                  node.styles?.card
                    ?.borderColor ||
                  "#e5e5e5"
                }`,
                borderRadius:
                  editorCssSize(
                    node.styles?.card
                      ?.borderRadius,
                    "12px",
                  ),
                padding: editorCssSize(
                  node.styles?.card
                    ?.padding,
                  "12px",
                ),
                overflow: "hidden",
              }}
            >
              {node.props.showImage !== false && (
                <img
                  src={
                    product.featuredImage?.url ||
                    product.image
                  }
                  alt={
                    product.featuredImage?.altText ||
                    product.title
                  }
                  style={{
                    display: "block",
                    width: "100%",

                    aspectRatio:
                      imageAspectRatio === "auto"
                        ? undefined
                        : imageAspectRatio,

                    height:
                      imageAspectRatio === "auto"
                        ? "auto"
                        : undefined,

                    objectFit:
                      node.styles?.image
                        ?.objectFit ||
                      "cover",

                    borderRadius:
                      editorCssSize(
                        node.styles?.image
                          ?.borderRadius,
                        "8px",
                      ),
                  }}
                />
              )}

              {node.props.showTitle !== false && (
                <div
                  className="vsn-product-card-title vsn-card-title"
                  style={{
                    marginTop: "12px",
                    fontSize: editorCssSize(
                      node.styles
                        ?.titleTypography
                        ?.fontSize,
                      "16px",
                    ),
                    fontWeight:
                      node.styles
                        ?.titleTypography
                        ?.fontWeight ||
                      "600",
                    color:
                      node.styles
                        ?.titleTypography
                        ?.color ||
                      "#1a1a1a",
                    lineHeight:
                      node.styles
                        ?.titleTypography
                        ?.lineHeight ||
                      "1.4",
                    textAlign:
                      node.styles
                        ?.titleTypography
                        ?.textAlign ||
                      "left",
                  }}
                >
                  {product.title}
                </div>
              )}

              {node.props.showPrice !== false && (
                <div
                  className="vsn-product-price-row vsn-card-price-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "6px",
                  }}
                >
                  <span
                    className="vsn-product-card-price vsn-card-price"
                    style={{
                      fontSize: editorCssSize(
                        node.styles
                          ?.priceTypography
                          ?.fontSize,
                        "15px",
                      ),
                      fontWeight:
                        node.styles
                          ?.priceTypography
                          ?.fontWeight ||
                        "600",
                      color:
                        node.styles
                          ?.priceTypography
                          ?.color ||
                        "#1a1a1a",
                    }}
                  >
                    {price}
                  </span>

                  {node.props
                    .showCompareAtPrice !==
                    false &&
                    compareAtPrice && (
                      <span
                        className="vsn-product-card-compare-price vsn-card-compare-price"
                        style={{
                          fontSize: editorCssSize(
                            node.styles
                              ?.comparePriceTypography
                              ?.fontSize,
                            "14px",
                          ),
                          color:
                            node.styles
                              ?.comparePriceTypography
                              ?.color ||
                            "#777777",
                          textDecoration:
                            "line-through",
                          opacity: 0.55,
                        }}
                      >
                        {
                          compareAtPrice
                        }
                      </span>
                    )}
                </div>
              )}

            </div>
          );
        })}
      </div>

      {node.props.loadMoreEnabled !== false && (
        <div
          style={{
            display: "flex",
            justifyContent: loadMoreAlign,
            width: "100%",
            marginTop: editorCssSize(
              node.styles?.loadMoreButton?.marginTop,
              "24px",
            ),
          }}
        >
          <button
            type="button"
            onClick={(event) =>
              event.preventDefault()
            }
            style={{
              appearance: "none",
              backgroundColor:
                node.styles?.loadMoreButton?.backgroundColor ||
                "#1a1a1a",
              color:
                node.styles?.loadMoreButton?.color ||
                "#ffffff",
              borderStyle: "solid",
              borderColor:
                node.styles?.loadMoreButton?.borderColor ||
                "#1a1a1a",
              borderWidth: editorCssSize(
                node.styles?.loadMoreButton?.borderWidth,
                "0px",
              ),
              borderRadius: editorCssSize(
                node.styles?.loadMoreButton?.borderRadius,
                "8px",
              ),
              padding: `${editorCssSize(
                node.styles?.loadMoreButton?.paddingY,
                "12px",
              )} ${editorCssSize(
                node.styles?.loadMoreButton?.paddingX,
                "22px",
              )}`,
              fontSize: editorCssSize(
                node.styles?.loadMoreButton?.fontSize,
                "14px",
              ),
              fontWeight:
                node.styles?.loadMoreButton?.fontWeight ||
                "600",
              lineHeight: "1.2",
              cursor: "default",
            }}
          >
            {node.props.loadMoreText ||
              "Load More"}
          </button>
        </div>
      )}
      </>
    );
  } else if (node.type === "product-title") {
    const Tag = node.props.tag || "h1";
    content = <Tag style={style}>{previewProduct?.title || node.props.fallbackText || "Product Title"}</Tag>;
  } else if (node.type === "product-image") {
    const src = previewProduct?.featuredImage?.url || node.props.fallbackSrc || "/vsn-stock/fashion.svg";
    content = <img src={src} alt={previewProduct?.featuredImage?.altText || previewProduct?.title || node.props.alt || "Product image"} className="w-full" style={{ ...style, objectFit: node.styles?.objectFit || "cover" }} />;
  } else if (node.type === "product-gallery") {
    const images = previewProduct?.images?.nodes || [];
    const main = previewProduct?.featuredImage || images[0];
    content = <div style={style}><img src={main?.url || "/vsn-stock/fashion.svg"} alt={main?.altText || previewProduct?.title || "Product"} style={{ width:"100%", height: editorCssSize(node.styles?.size?.height,"560px"), objectFit: node.styles?.objectFit || "cover", borderRadius: editorCssSize(node.styles?.border?.radius,"12px") }} />{node.props.showThumbnails !== false && <div style={{display:"flex",gap:Number(node.props.thumbnailGap || 10),marginTop:12,flexWrap:"wrap"}}>{images.slice(0,8).map((image)=><img key={image.url} src={image.url} alt={image.altText || ""} style={{width:Number(node.props.thumbnailSize || 76),height:Number(node.props.thumbnailSize || 76),objectFit:"cover",borderRadius:8,border:"1px solid #ddd"}} />)}</div>}</div>;
  } else if (node.type === "product-price") {
    const money = previewProduct?.priceRangeV2?.minVariantPrice;
    const firstVariant = previewProduct?.variants?.nodes?.[0];
    const value = money ? formatPreviewMoney(money) : (firstVariant?.price ? String(firstVariant.price) : "$0.00");
    content = <div style={style}>{node.props.prefix || ""}{value}</div>;
  } else if (node.type === "product-compare-price") {
    const money = previewProduct?.compareAtPriceRange?.minVariantCompareAtPrice;
    const firstVariant = previewProduct?.variants?.nodes?.[0];
    const value = money ? formatPreviewMoney(money) : (firstVariant?.compareAtPrice ? String(firstVariant.compareAtPrice) : "");
    content = value ? <div style={{ ...style, textDecoration: "line-through" }}>{node.props.prefix || ""}{value}</div> : <div style={style}>No compare-at price</div>;
  } else if (node.type === "product-description") {
    content = <div style={style}>{previewProduct?.description || node.props.fallbackText || "Product description"}</div>;
  } else if (node.type === "product-vendor") {
    content = <div style={style}>{node.props.prefix ?? "Vendor: "}{previewProduct?.vendor || "Vendor"}</div>;
  } else if (node.type === "product-sku") {
    content = <div style={style}>{node.props.prefix ?? "SKU: "}{previewProduct?.variants?.nodes?.[0]?.sku || "—"}</div>;
  } else if (node.type === "product-availability") {
    const available = previewProduct?.variants?.nodes?.some((variant) => variant.availableForSale) ?? true;
    content = <div className="vsn-product-availability" data-vsn-stock-state={available ? "in-stock" : "sold-out"} style={style}>{available ? (node.props.inStockText || "In stock") : (node.props.soldOutText || "Sold out")}</div>;
  } else if (node.type === "product-variant-selector") {
    const variants = previewProduct?.variants?.nodes || [];
    content = <label style={{ display: "grid", gap: "6px", ...style }}>{node.props.showLabel === false ? null : <span>{node.props.label || "Variant"}</span>}<select defaultValue={variants[0]?.id || ""} onClick={(e) => e.stopPropagation()} style={{ minHeight: `${Number(node.props.height || 44)}px`, border: "1px solid #d9d9d9", borderRadius: `${Number(node.props.borderRadius || 8)}px`, padding: "8px 10px", background: "white" }}>{variants.length ? variants.map((variant) => <option key={variant.id} value={variant.id} disabled={node.props.disableSoldOut !== false && variant.availableForSale === false}>{variant.title}{variant.availableForSale === false ? " — Sold out" : ""}</option>) : <option>Default</option>}</select></label>;
  } else if (node.type === "product-quantity") {
    content = <label style={{ display: "grid", gap: "6px", ...style }}>{node.props.showLabel === false ? null : <span>{node.props.label || "Quantity"}</span>}<input type="number" min={Number(node.props.min || 1)} max={Number(node.props.max || 99)} step={Number(node.props.step || 1)} defaultValue={Number(node.props.min || 1)} onClick={(e) => e.stopPropagation()} style={{ width: `${Number(node.props.width || 110)}px`, minHeight: `${Number(node.props.height || 44)}px`, border: "1px solid #d9d9d9", borderRadius: `${Number(node.props.borderRadius || 8)}px`, padding: "8px 10px" }} /></label>;
  } else if (node.type === "product-add-to-cart" || node.type === "product-buy-now") {
    const label = node.type === "product-buy-now" ? (node.props.text || "Buy Now") : (node.props.text || "Add to Cart");
    content = <button type="button" onClick={(event) => event.preventDefault()} style={{ ...style, width: node.props.fullWidth ? "100%" : "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "default" }}>{label}</button>;
  } else if (node.type === "product-metafield") {
    const field = previewProduct?.metafields?.nodes?.find((item)=>item.namespace === (node.props.namespace || "custom") && item.key === (node.props.key || ""));
    content = <div style={style}>{node.props.label ? <strong>{node.props.label} </strong> : null}{field?.value || node.props.emptyText || "Metafield value"}</div>;
  } else if (node.type === "product-recommendations") {
    const items = SAMPLE_COLLECTION_PRODUCTS.slice(0, Math.max(1, Math.min(6, Number(node.props.limit || 4))));
    content = <section style={style}><h3 style={{fontSize:24,fontWeight:700,marginBottom:16}}>{node.props.heading || "You may also like"}</h3><div style={{display:"grid",gridTemplateColumns:`repeat(${Math.max(1,Number(node.props.columns || 4))},minmax(0,1fr))`,gap:16}}>{items.map((item)=><div key={item.id}><img src={item.image} alt={item.title} style={{width:"100%",aspectRatio:"1/1",objectFit:"cover",borderRadius:8}}/><div style={{marginTop:8,fontSize:14,fontWeight:600}}>{item.title}</div>{node.props.showPrice !== false && <div style={{fontSize:13}}>{item.price}</div>}</div>)}</div></section>;
  } else if (node.type === 'button') {
    content = <a href={node.props.url || '#'} onClick={(event) => event.preventDefault()} className="inline-flex px-6 py-3 rounded-lg bg-[#008060] text-white text-sm font-semibold" style={style}>{node.props.text || 'Click me'}</a>;
  } else if (node.type === 'image') {
    const imageProps = normalizeImageWidgetProps(node.props || {});
    const media = imageProps.media && typeof imageProps.media === "object" ? imageProps.media : {};
    const originalSource = resolveImageSource(imageProps, node.styles?.advanced || {});
    const mediaSource = buildImageRenderUrl(originalSource, imageProps, media);
    const renderDimensions = imageResolutionDimensions(imageProps, media);
    const legacyDims = node.styles?.advanced?.imageDimensions || {};
    const legacyUnit = legacyDims.unit === "auto" ? "" : (legacyDims.unit || "px");
    const imageStyle = {
      ...style,
      width: legacyDims.width ? `${legacyDims.width}${legacyUnit}` : (style.width || "100%"),
      height: legacyDims.height ? `${legacyDims.height}${legacyUnit}` : (style.height || "auto"),
      objectFit: legacyDims.fit || style.objectFit || "cover",
      objectPosition: legacyDims.position || style.objectPosition || "center center",
      display: "block",
    };
    if (mediaSource) {
      const imageNode = <img src={mediaSource} alt={imageAltText(imageProps, media)} width={renderDimensions.width || undefined} height={renderDimensions.height || undefined} loading={imageProps.loading} fetchPriority={imageProps.fetchPriority} decoding="async" className="vsn-image-widget" style={imageStyle} />;
      const href = imageLinkHref(imageProps, originalSource);
      const linkedImage = href ? <a href={href} target={imageProps.openNewTab ? "_blank" : undefined} rel={imageProps.openNewTab ? "noopener noreferrer" : undefined} data-vsn-lightbox={imageProps.lightbox && imageProps.linkType === "media" ? "1" : undefined} onClick={(event) => event.preventDefault()} style={{ display: "inline-block", maxWidth: "100%" }}>{imageNode}</a> : imageNode;
      const caption = imageCaptionText(imageProps, media);
      content = caption ? <figure className="vsn-image-figure" style={{ margin: 0 }}>{linkedImage}<figcaption className="vsn-image-caption" style={{ marginTop: 8, fontSize: 13, color: "#6d7175" }}>{caption}</figcaption></figure> : linkedImage;
    } else {
      content = <div className="h-48 rounded-xl bg-[#f1f1f1] border border-dashed border-[#c8c8c8] flex items-center justify-center text-xs text-[#888]" style={style}>Choose an image</div>;
    }
  } else if (node.type === 'collection-image') {
    const mp = normalizeContextImageProps(node.props || {});
    const media = previewCollection?.image || {};
    const imageSource = contextImageUrl(media, { ...mp, fallbackSrc: mp.fallbackSrc || SAMPLE_COLLECTION_IMAGE });
    content = imageSource ? <img src={imageSource} alt={contextImageAlt(media, mp, previewCollection?.title || "Collection preview")} loading={mp.loading} fetchPriority={mp.fetchPriority} className="w-full" style={{ ...style, objectFit: 'cover' }} /> : <div style={{...style,minHeight:220,background:'#f3f3f3'}} />;
  } else if (node.type === 'product-image') {
    const mp = normalizeContextImageProps(node.props || {});
    const media = previewProduct?.featuredImage || {};
    const imageSource = contextImageUrl(media, mp);
    content = imageSource ? <img src={imageSource} alt={contextImageAlt(media, mp, previewProduct?.title || "Product image")} loading={mp.loading} fetchPriority={mp.fetchPriority} className="w-full" style={{...style,objectFit:'cover'}}/> : <div style={{...style,minHeight:220,background:'#f3f3f3'}}/>;
  } else if (node.type === 'icon') {
    content = <span style={{ ...style, display: 'inline-flex' }}><ContentPolarisIcon name={node.props.name || 'star'} size="base" /></span>;
  } else if (node.type === 'divider') {
    content = <hr style={style} />;
  } else if (node.type === 'spacer') {
    content = <div className="bg-[#fafafa] border border-dashed border-[#ddd]" style={{ ...style, height: node.props.height || '60px' }} />;
  } else if (node.type === 'product-grid') {
    content = <div style={style}><ProductGrid columns={Number(node.props.columns || 3)} title={node.props.title} /></div>;
  } else if (node.type === 'countdown') {
    content = <div className="bg-[#1a1a1a] text-white p-8 rounded-xl text-center" style={style}>02 Days&nbsp;&nbsp;14 Hours&nbsp;&nbsp;37 Mins</div>;
  } else if (node.type === 'html' && node.props?.mode === 'theme-section') {
    content = <div className="rounded-xl border border-dashed border-[#8c9196] bg-[#f6f6f7] p-5 text-xs text-[#4a4a4a]" style={style}><strong className="block">Shopify Theme Section Bridge</strong><span className="mt-1 block">{node.props?.themeSectionId || 'Enter a theme section ID in Content settings.'}</span></div>;
  } else if (node.type === 'html' || node.type === 'liquid') {
    content = <pre className="bg-[#1a1a1a] text-[#00ff9d] p-4 rounded-lg text-xs overflow-auto" style={style}>{node.props.code}</pre>;
  } else if (acceptsChildren(node.type)) {
    const childLayoutStyle = node.type === "columns"
      ? {
          ...style,
          display: "grid",
          gridTemplateColumns: node.styles?.gridTemplateColumns || node.styles?.grid?.templateColumns || `repeat(${Number(node.props?.columns || Math.max((node.children || []).length, 1))}, minmax(0, 1fr))`,
          gap: node.styles?.gap || node.styles?.grid?.gap || "20px",
        }
      : {
          ...style,
          display: "flex",
          flexDirection: node.styles?.flexDirection || "column",
          alignItems: node.styles?.alignItems || "stretch",
          justifyContent: node.styles?.justifyContent || "flex-start",
          gap: node.styles?.gap || "12px",
        };
    content = (
      <div style={childLayoutStyle} className="min-h-24">
        <div className={node.type === "columns" ? "contents" : "space-y-3"}>
          {(node.children ?? []).map((child) => (
            <div key={child.id} data-vsn-column-cell={node.type === "columns" ? "1" : undefined} className={node.type === "columns" ? "min-w-0 self-stretch" : undefined}>
              <DropZone parentId={node.id} beforeId={child.id} onDrop={onDrop} onAdd={onRequestAddChild} compact />
              <RenderNode
                node={child}
                parentId={node.id}
                selectedId={selectedId}
                onSelect={onSelect}
                onDrop={onDrop}
                onRequestAddChild={onRequestAddChild}
                onMoveNode={onMoveNode}
                previewCollection={previewCollection}
                previewProduct={previewProduct}
                previewBlog={previewBlog}
                previewArticle={previewArticle}
                previewSearch={previewSearch}
                reusableSections={reusableSections}
                previewMode={previewMode}
              />
            </div>
          ))}
          <DropZone parentId={node.id} beforeId={null} onDrop={onDrop} onAdd={onRequestAddChild} compact />
          {!(node.children ?? []).length ? <div data-vsn-empty-child-drop="1" style={{minHeight:120,display:"grid",placeItems:"center",textAlign:"center",border:"1px dashed #b7bdc1",borderRadius:10,background:"#fafbfb",color:"#6d7175",pointerEvents:"none"}}><div><div aria-hidden="true" style={{fontSize:34,lineHeight:1}}>＋</div><strong style={{display:"block",fontSize:12,marginTop:6}}>Add Widget</strong><span style={{fontSize:10}}>Drag any widget here</span></div></div> : null}
        </div>
      </div>
    );
  } else {
    content = <div className="p-6 border border-dashed border-[#d1d1d1] rounded-lg text-center text-sm" style={style}>{node.label}</div>;
  }

  const template = widgetTemplates?.[node.type];
  if (template?.enabled && template?.html) {
    try {
      const descriptor = visualTemplateTreeToDescriptor(parseVisualTemplate(template.html), { props:node.props || {}, slot:content, templateKey:node.type });
      const scopedCss = scopeVisualTemplateCss(template.css || "", node.type);
      content = <>{scopedCss ? <style>{scopedCss}</style> : null}{renderSdkEditorValue(descriptor, `canvas-template-${node.id || node.type}`)}</>;
    } catch (error) {
      console.warn(`VSN canvas template override recovered (${node.type}):`, error);
    }
  }

  return <div
    data-vsn-id={node.id}
    data-vsn-node-type={node.type}
    data-vsn-component-id={node.type === "component-instance" ? String(node.props?.componentId || "") : undefined}
    data-vsn-component-slot={node.meta?.__vsnComponentSlotName || undefined}
    data-vsn-sticky-element={interactions.sticky ? "1" : undefined}
    data-vsn-sticky-active={interactions.sticky ? (stickyActive ? "1" : "0") : undefined}
    data-vsn-sticky-boundary={interactions.sticky ? interactions.stickyBoundary : undefined}
    data-vsn-sticky-offset={interactions.sticky ? interactions.stickyOffset : undefined}
    data-vsn-sticky-end-offset={interactions.sticky ? interactions.stickyEndOffset : undefined}
    data-vsn-sticky-z-index={interactions.sticky ? interactions.stickyZIndex : undefined}
    data-vsn-sticky-target={interactions.sticky && interactions.stickyBoundary === "custom" ? interactions.stickyCustomTarget : undefined}
    data-vsn-parallax={interactions.parallax ? "1" : undefined}
    data-vsn-motion={interactions.timelines?.length ? JSON.stringify({schemaVersion:interactions.schemaVersion||4,timelines:interactions.timelines}) : undefined}
    style={interactionStyle}
    className={`${className} ${node.meta?.locked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
    onClick={select}
    draggable={!node.meta?.locked}
    onDragStart={(event) => {
      event.stopPropagation();
      if (node.meta?.locked) { event.preventDefault(); return; }
      event.dataTransfer.clearData();
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('vsnNodeId', node.id);
      event.dataTransfer.setData('vsnDragKind', 'existing-node');
      event.dataTransfer.setData('text/plain', `vsn-node:${node.id}`);
      document.documentElement.dataset.vsnDragging = "1";
      event.currentTarget?.setAttribute?.("data-vsn-dragging-node", "1");
    }}
    onDragEnd={(event) => {
      event.currentTarget?.removeAttribute?.("data-vsn-dragging-node");
      delete document.documentElement.dataset.vsnDragging;
      pendingDropPositionRef.current = "";
      if (dragFrameRef.current) cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = 0;
      setDropPosition("");
    }}
    onDragOver={(event) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = event.dataTransfer.getData('vsnNodeId') ? 'move' : 'copy';
      const rect = event.currentTarget.getBoundingClientRect();
      const y = event.clientY - rect.top;
      let position = y < rect.height * 0.24 ? 'before' : y > rect.height * 0.76 ? 'after' : 'inside';
      if (position === 'inside' && !acceptsChildren(node.type)) position = y < rect.height / 2 ? 'before' : 'after';
      pendingDropPositionRef.current = position;
      if (!dragFrameRef.current) {
        dragFrameRef.current = requestAnimationFrame(() => {
          dragFrameRef.current = 0;
          setDropPosition((current) => current === pendingDropPositionRef.current ? current : pendingDropPositionRef.current);
        });
      }
    }}
    onDragLeave={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setDropPosition('');
    }}
    onDrop={(event) => {
      event.preventDefault();
      event.stopPropagation();
      const position = dropPosition || 'after';
      setDropPosition('');
      const type = event.dataTransfer.getData('elementType');
      const nodeId = event.dataTransfer.getData('vsnNodeId');
      const destination = position === 'inside' && acceptsChildren(node.type)
        ? { parentId: node.id, beforeId: null, afterId: null }
        : position === 'before'
          ? { parentId, beforeId: node.id, afterId: null }
          : { parentId, beforeId: null, afterId: node.id };
      if (nodeId && nodeId !== node.id) onDrop?.({ nodeId, ...destination, mode: 'move' });
      else if (type) onDrop?.({ type, ...destination, mode: 'create' });
    }}
  >
    {dropPosition === 'before' ? <span className="pointer-events-none absolute -top-1 left-0 right-0 z-30 h-1 rounded-full bg-[#008060] shadow-[0_0_0_3px_rgba(0,128,96,.14)]" /> : null}
    {dropPosition === 'after' ? <span className="pointer-events-none absolute -bottom-1 left-0 right-0 z-30 h-1 rounded-full bg-[#008060] shadow-[0_0_0_3px_rgba(0,128,96,.14)]" /> : null}
    {dropPosition === 'inside' ? <span className="pointer-events-none absolute inset-0 z-30 rounded-[inherit] border-2 border-dashed border-[#008060] bg-emerald-50/20" /> : null}
    {content}
    {selected && <span className="pointer-events-none absolute -top-6 left-0 z-20 flex items-center gap-1 rounded-t bg-[#008060] px-2 py-1 text-[10px] text-white">{node.label}{node.conditions?.enabled && !conditionMatches ? ' · hidden by condition' : ''}</span>}
  </div>;
}
const MemoRenderNode = memo(RenderNode, (prev, next) => prev.node === next.node && prev.selectedId === next.selectedId && prev.previewMode === next.previewMode && prev.previewCollection === next.previewCollection && prev.previewProduct === next.previewProduct && prev.previewBlog === next.previewBlog && prev.previewArticle === next.previewArticle && prev.previewSearch === next.previewSearch && prev.reusableSections === next.reusableSections);

class CanvasRenderBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("VSN canvas render error:", error, info);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="m-8 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <strong className="block">Canvas rendering recovered from an invalid widget state.</strong>
        <span className="mt-1 block text-xs">Undo the last change or select another revision. The editor itself has not crashed.</span>
      </div>
    );
  }
}

function canvasInteractionResetKey(nodes = []) {
  const parts = [];
  const walk = (items) => {
    for (const node of Array.isArray(items) ? items : []) {
      const interaction = normalizeElementInteractions(node?.interactions);
      parts.push(`${node?.id || "node"}:${interaction.sticky ? 1 : 0}:${interaction.stickyBoundary}:${interaction.stickyOffset}:${interaction.stickyEndOffset}:${interaction.stickyZIndex}:${interaction.stickyDesktop ? 1 : 0}${interaction.stickyTablet ? 1 : 0}${interaction.stickyMobile ? 1 : 0}:${interaction.parallax ? 1 : 0}:${interaction.entrance}:${interaction.hover}:${JSON.stringify(interaction.timelines||[])}`);
      walk(node?.children);
    }
  };
  walk(nodes);
  return parts.join("|");
}

export default function Canvas({
  elements,
  selectedId,
  onSelect,
  onDrop,
  onRequestAddChild,
  onMoveNode,
  onAddStructure,
  onInsertPreset,
  onInsertReusableSection,
  libraryItems = [],
  marketplaceBrowser = {},
  onInsertLibraryItem,
  onLibraryOpen,
  onToggleLibraryFavorite,
  onOpenWidgets,
  onOpenAI,
  libraryOpenSignal = 0,
  pageTemplate = "page",
  libraryLoading = false,
  previewMode,
  previewWidth = 1440,
  onPreviewWidthChange,
  zoom = 1,
  previewCollection,
  previewProduct,
  previewBlog,
  previewArticle,
  previewSearch,
  reusableSections = [],
  componentDefinitions = [],
  globalStyles = {},
  localizationDirection = "ltr",
  localizationLocale = "",
  widgetPlatform = {},
}) {
  const resetKey = `${elements?.length || 0}:${canvasInteractionResetKey(elements)}`;
  const canvasRootRef = useRef(null);
  const autoScrollFrameRef = useRef(0);
  const spacePressedRef = useRef(false);
  const panSessionRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const root = canvasRootRef.current;
    if (!root) return undefined;
    let frame = 0;
    const updateParallax = () => {
      frame = 0;
      if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
        root.querySelectorAll?.("[data-vsn-parallax='1']").forEach((element) => element.style.setProperty("--vsn-editor-parallax-source", "0px"));
        updateBoundedSticky(root);
        return;
      }
      const rootRect = root.getBoundingClientRect();
      root.querySelectorAll?.("[data-vsn-parallax='1']").forEach((element) => {
        try {
          if (!element?.isConnected) return;
          const rect = element.getBoundingClientRect();
          const stickyShift = Number.parseFloat(element.style.getPropertyValue("--vsn-editor-sticky-y")) || 0;
          const distance = rect.top - stickyShift - rootRect.top;
          const offset = Math.max(-24, Math.min(24, -distance * 0.025));
          element.style.setProperty("--vsn-editor-parallax-source", `${Number.isFinite(offset) ? offset : 0}px`);
        } catch (error) {
          element?.style?.setProperty?.("--vsn-editor-parallax-source", "0px");
          console.warn("VSN parallax preview recovered:", error);
        }
      });
      updateBoundedSticky(root);
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(updateParallax);
    };
    root.addEventListener("scroll", schedule, { passive: true });
    globalThis.addEventListener?.("resize", schedule, { passive: true });
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (resizeObserver) resizeObserver.observe(root);
    schedule();
    return () => {
      root.removeEventListener("scroll", schedule);
      globalThis.removeEventListener?.("resize", schedule);
      resizeObserver?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [resetKey]);

  useEffect(() => {
    const root = canvasRootRef.current;
    if (!root) return undefined;
    return setupInteractionRuntime(root);
  }, [resetKey]);

  useEffect(() => {
    const down = (event) => {
      const target = event.target;
      if (target?.closest?.("input,textarea,select,[contenteditable='true']")) return;
      if (event.code === "Space") spacePressedRef.current = true;
    };
    const up = (event) => { if (event.code === "Space") spacePressedRef.current = false; };
    const blur = () => { spacePressedRef.current = false; panSessionRef.current = null; setIsPanning(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);

  const beginCanvasPan = (event) => {
    if (!spacePressedRef.current || event.button !== 0) return;
    const root = canvasRootRef.current;
    if (!root) return;
    event.preventDefault();
    event.stopPropagation();
    panSessionRef.current = { pointerId:event.pointerId, x:event.clientX, y:event.clientY, left:root.scrollLeft, top:root.scrollTop };
    try { root.setPointerCapture(event.pointerId); } catch {}
    setIsPanning(true);
  };
  const moveCanvasPan = (event) => {
    const root = canvasRootRef.current;
    const session = panSessionRef.current;
    if (!root || !session || session.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    root.scrollLeft = session.left - (event.clientX - session.x);
    root.scrollTop = session.top - (event.clientY - session.y);
  };
  const endCanvasPan = (event) => {
    const root = canvasRootRef.current;
    const session = panSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    panSessionRef.current = null;
    try { root?.releasePointerCapture(event.pointerId); } catch {}
    setIsPanning(false);
  };

  return (
    <CanvasRenderBoundary resetKey={resetKey}>
    <div
      ref={canvasRootRef}
      data-vsn-canvas-root="true"
      data-vsn-locale={localizationLocale || undefined}
      dir={localizationDirection === "rtl" ? "rtl" : "ltr"}
      className={`flex-1 bg-[#e8e8e8] overflow-auto flex flex-col items-center py-8 px-4 vsn-canvas-pan-surface ${isPanning ? "is-panning" : ""}`}
      onPointerDownCapture={beginCanvasPan}
      onPointerMoveCapture={moveCanvasPan}
      onPointerUpCapture={endCanvasPan}
      onPointerCancelCapture={endCanvasPan}
      onClick={() => { if (!isPanning) onSelect(null); }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = event.dataTransfer.getData("vsnNodeId") ? "move" : "copy";
        const rect = event.currentTarget.getBoundingClientRect();
        const edge = 72;
        const distance = event.clientY - rect.top < edge ? -18 : rect.bottom - event.clientY < edge ? 18 : 0;
        if (distance && !autoScrollFrameRef.current) {
          const target = event.currentTarget;
          autoScrollFrameRef.current = requestAnimationFrame(() => {
            autoScrollFrameRef.current = 0;
            target.scrollTop += distance;
          });
        }
      }}
      onDrop={(event) => {
        // Node/drop-zone handlers stop propagation. Reaching this handler means
        // the user dropped on free canvas space, so append at root level.
        event.preventDefault();
        event.stopPropagation();
        const type = event.dataTransfer.getData("elementType");
        const nodeId = event.dataTransfer.getData("vsnNodeId");
        if (nodeId) onDrop?.({ nodeId, parentId: null, beforeId: null, afterId: null, mode: "move" });
        else if (type) onDrop?.({ type, parentId: null, beforeId: null, afterId: null, mode: "create" });
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `${widgetPlatform.customCss ? `${widgetPlatform.customCss}\n` : ""}.vsn-canvas-page h1,.vsn-canvas-page h2,.vsn-canvas-page h3,.vsn-canvas-page h4,.vsn-canvas-page h5,.vsn-canvas-page h6{font-family:var(--vsn-canvas-heading-font,inherit);}\n${buildStyleBundleCss(
            [
              applyResponsiveTree(elements, previewMode, globalStyles),
              ...reusableSections.map((section) => applyResponsiveTree(Array.isArray(section?.content) ? section.content : [], previewMode, globalStyles)),
            ],
            globalStyles,
            { includeBase: false, includeResponsive: false },
          ).replace(/<\/style/gi, "<\\/style")}`,
        }}
      />
      <CustomJsRuntime rootRef={canvasRootRef} elements={elements} mode="canvas" />
      <ResponsiveConfigContext.Provider value={globalStyles}>
      <ComponentLibraryContext.Provider value={componentDefinitions}>
      <WidgetTemplateContext.Provider value={widgetPlatform.templates || {}}>
      <div className="vsn-canvas-scaled-shell" style={{ width: `${Math.max(240, Number(previewWidth) || 1440) * Math.max(.25, Number(zoom) || 1)}px`, minHeight: `${650 * Math.max(.25, Number(zoom) || 1)}px` }}>
        <div className="vsn-canvas-width-frame" style={{ width: `${Math.max(240, Number(previewWidth) || 1440)}px`, transform: `scale(${Math.max(.25, Number(zoom) || 1)})`, transformOrigin: "top left" }}>
        <button type="button" aria-label="Resize canvas" className="vsn-canvas-resize-handle" onPointerDown={(event)=>{event.preventDefault();event.stopPropagation();const handle=event.currentTarget;const pointerId=event.pointerId;const startX=event.clientX;const startWidth=Math.max(240,Number(previewWidth)||1440);const scale=Math.max(.25,Number(zoom)||1);try{handle.setPointerCapture(pointerId);}catch{}const move=(e)=>{if(e.pointerId!==pointerId)return;const delta=(e.clientX-startX)/scale;onPreviewWidthChange?.(Math.max(240,Math.min(2560,startWidth+delta*2)));};const up=(e)=>{if(e.pointerId!==pointerId)return;handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up);try{handle.releasePointerCapture(pointerId);}catch{}};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up);}}><span>↔</span></button>
        <div
          data-vsn-page-boundary="1"
          className="vsn-canvas-page rounded-xl shadow-lg min-h-[650px] p-6 space-y-4"
          style={{
            background: globalStyles.backgroundColor || "#ffffff",
            color: globalStyles.textColor || "#1a1a1a",
            fontFamily: globalStyles.fontFamily || "Inter, system-ui, sans-serif",
            "--vsn-canvas-heading-font": globalStyles.headingFontFamily || "inherit",
            maxWidth: globalStyles.containerMaxWidth || "1200px",
            margin: "0 auto",
            ...globalCssVariables(globalStyles),
          }}
        >
          {elements.map((node) => (
            <div key={node.id}>
              <DropZone parentId={null} beforeId={node.id} onDrop={onDrop} onAdd={onRequestAddChild} />
              <MemoRenderNode
                node={node}
                parentId={null}
                selectedId={selectedId}
                onSelect={onSelect}
                onDrop={onDrop}
                onRequestAddChild={onRequestAddChild}
                onMoveNode={onMoveNode}
                previewCollection={previewCollection}
                previewProduct={previewProduct}
                previewBlog={previewBlog}
                previewArticle={previewArticle}
                previewSearch={previewSearch}
                reusableSections={reusableSections}
                previewMode={previewMode}
              />
            </div>
          ))}
          <DropZone parentId={null} beforeId={null} onDrop={onDrop} onAdd={onRequestAddChild} />
          <SectionInserter
            reusableSections={reusableSections}
            onAddStructure={onAddStructure}
            onInsertPreset={onInsertPreset}
            onInsertReusableSection={onInsertReusableSection}
            libraryItems={libraryItems}
            {...marketplaceBrowser}
            onInsertLibraryItem={onInsertLibraryItem}
            onLibraryOpen={onLibraryOpen}
            onToggleLibraryFavorite={onToggleLibraryFavorite}
            onOpenWidgets={onOpenWidgets}
            onOpenAI={onOpenAI}
            openLibrarySignal={libraryOpenSignal}
            pageTemplate={pageTemplate}
            libraryLoading={libraryLoading}
          />
        </div>
        </div>
      </div>
      </WidgetTemplateContext.Provider>
      </ComponentLibraryContext.Provider>
      </ResponsiveConfigContext.Provider>
    </div>
    </CanvasRenderBoundary>
  );
}
