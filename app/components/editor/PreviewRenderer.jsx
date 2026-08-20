import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ContentPolarisIcon } from "../ui/PolarisIcon";
import { globalCssVariables } from '../../builder/globalDesign';
import CustomJsRuntime from "./CustomJsRuntime";
import { buildNodeStyle } from "../../builder/styleEngine";
import { buildStyleBundleCss } from "../../builder/stylePipeline.js";
import { normalizeImageWidgetProps, resolveImageSource, buildImageRenderUrl, imageResolutionDimensions, imageAltText, imageCaptionText, imageLinkHref } from "../../builder/imageWidget.js";
import { normalizeGalleryWidgetProps, galleryAspectRatio } from "../../builder/galleryWidget.js";
import { normalizeVideoWidgetProps, videoEmbedUrl } from "../../builder/videoWidget.js";
import { normalizeSliderProps } from "../../builder/sliderWidget.js";
import { isNestedSliderType, normalizeNestedSliderProps } from "../../builder/nestedCarouselWidget.js";
import { normalizeStructuredItems } from "../../builder/structuredItems.js";
import { applyDynamicBindings } from "../../builder/dynamicBindings.js";
import { normalizeContextImageProps, contextImageUrl, contextImageAlt } from "../../builder/contextMediaWidget.js";
import { normalizeGridProps, gridImageRatio } from "../../builder/dataGridWidget.js";
import { applyQueryFilters, normalizeLoopItem, normalizeQueryDefinition } from "../../builder/queryBuilder.js";
import { resolveComponentInstance } from "../../builder/componentSystem.js";
import { normalizeElementInteractions } from "../../builder/interactionSchema.js";
import { setupInteractionRuntime } from "../../builder/interactionRuntime.js";
import { getVsnEditorRenderer, reportVsnSdkError } from "../../sdk/registry.js";
import SdkWidgetView, { renderSdkEditorValue } from "./SdkWidgetView.jsx";
import { parseVisualTemplate, scopeVisualTemplateCss, visualTemplateTreeToDescriptor } from "../../builder/visualTemplate.js";
import { getSize, getSpacing } from "./previewStyleUtils.js";

const normalizeStyles = buildNodeStyle;
const LoopPreviewContext = createContext(null);
const ComponentLibraryContext = createContext([]);
const ComponentStackContext = createContext([]);
const StaticPreviewContext = createContext(false);
const WidgetTemplateContext = createContext({});

function collectPreviewMotionEntries(nodes = [], componentDefinitions = [], stack = []) {
	const rows = [];
	for (const node of Array.isArray(nodes) ? nodes : []) {
		if (!node || typeof node !== "object") continue;
		const interactions = normalizeElementInteractions(node.interactions);
		const slot = String(node.meta?.__vsnComponentSlotName || "");
		if (interactions.timelines?.length || slot) rows.push({ id:String(node.id||""), interactions:interactions.timelines?.length ? interactions : null, slot });
		if (node.type === "component-instance") {
			const componentId = String(node.props?.componentId || "");
			if (componentId && !stack.includes(componentId)) {
				const resolved = resolveComponentInstance(node, componentDefinitions);
				if (resolved?.root) rows.push(...collectPreviewMotionEntries([resolved.root], componentDefinitions, [...stack, componentId]));
			}
		} else rows.push(...collectPreviewMotionEntries(node.children || [], componentDefinitions, stack));
	}
	return rows;
}

function getContent(settings = {}) {
	return settings.content &&
		typeof settings.content === "object"
		? settings.content
		: settings;
}

function getStyle(settings = {}) {
	return settings.style &&
		typeof settings.style === "object"
		? settings.style
		: settings;
}

function formatProductMoney(money, fallback = "") {
	if (money && typeof money === "object" && money.amount != null) {
		try {
			return new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: money.currencyCode || "USD",
			}).format(Number(money.amount));
		} catch {
			return `${money.amount} ${money.currencyCode || ""}`.trim();
		}
	}
	return money != null && money !== "" ? String(money) : fallback;
}




function GalleryPreviewWidget({ node }) {
  const props = normalizeGalleryWidgetProps(node.props || {});
  const ratio = galleryAspectRatio(props.imageRatio, props.customRatioWidth, props.customRatioHeight);
  const imageStyle = {width:"100%",display:"block",height:ratio==="auto"?"auto":undefined,aspectRatio:ratio==="auto"?undefined:ratio,objectFit:props.objectFit,objectPosition:props.objectPosition,borderRadius:node.styles?.image?.borderRadius||"10px"};
  const renderItem=(item,index)=>{const image=<img className="vsn-gallery-item vsn-content-media" src={item.previewUrl||item.url} alt={item.alt||""} loading="lazy" style={imageStyle}/>;let content=image;if(props.clickAction==="lightbox")content=<a href={item.url} data-vsn-lightbox="1" data-vsn-lightbox-src={item.url} data-vsn-lightbox-alt={item.alt||""} onClick={(e)=>e.preventDefault()}>{image}</a>;else if(props.clickAction==="link"&&item.linkUrl)content=<a href={item.linkUrl} target={props.openLinksNewTab?"_blank":undefined} rel={props.openLinksNewTab?"noopener noreferrer":undefined} onClick={(e)=>e.preventDefault()}>{image}</a>;return <figure className="vsn-gallery-item-wrap vsn-content-item" key={item.id||index} style={{margin:0,minWidth:0}}>{content}{props.showCaptions&&item.caption?<figcaption style={{fontSize:12,marginTop:6,color:"#6d7175"}}>{item.caption}</figcaption>:null}</figure>};
  if(props.layout==="masonry") return <div className="vsn-gallery-grid is-masonry" style={{columnCount:props.columnsDesktop,columnGap:`${props.gap}px`,"--vsn-gallery-cols-tablet":props.columnsTablet,"--vsn-gallery-cols-mobile":props.columnsMobile}}>{props.galleryItems.map((item,index)=><div key={item.id||index} style={{breakInside:"avoid",marginBottom:props.rowGap}}>{renderItem(item,index)}</div>)}</div>;
  if(props.layout==="justified") return <div className="vsn-gallery-grid is-justified" style={{display:"flex",flexWrap:"wrap",gap:`${props.rowGap}px ${props.gap}px`,"--vsn-gallery-cols-tablet":props.columnsTablet,"--vsn-gallery-cols-mobile":props.columnsMobile}}>{props.galleryItems.map((item,index)=><div key={item.id||index} style={{flex:`1 1 calc(${100/props.columnsDesktop}% - ${props.gap}px)`,minWidth:120}}>{renderItem(item,index)}</div>)}</div>;
  return <div className="vsn-gallery-grid" style={{display:"grid",gridTemplateColumns:`repeat(${props.columnsDesktop},minmax(0,1fr))`,columnGap:props.gap,rowGap:props.rowGap,"--vsn-gallery-cols-tablet":props.columnsTablet,"--vsn-gallery-cols-mobile":props.columnsMobile}}>{props.galleryItems.map(renderItem)}</div>;
}

function VideoPreviewWidget({ node }) {
  const props=normalizeVideoWidgetProps(node.props||{}); const [playing,setPlaying]=useState(props.autoplay); const videoRef=useRef(null);
  useEffect(()=>{const video=videoRef.current;if(!video)return;video.volume=Math.max(0,Math.min(1,props.defaultVolume/100));if(props.startTime&&Number.isFinite(props.startTime))try{video.currentTime=props.startTime}catch{} if(props.autoplay)video.play().catch(()=>{});},[props.defaultVolume,props.startTime,props.autoplay,props.url]);
  if(!props.url)return <div style={{aspectRatio:"16/9",background:"#111",color:"#fff",display:"grid",placeItems:"center",borderRadius:12}}>Choose or paste a video</div>;
  const poster=props.posterEnabled?String(props.poster?.previewUrl||props.poster?.url||""):""; const embed=videoEmbedUrl(props,playing);
  const shell={position:"relative",width:"100%",aspectRatio:"16 / 9",background:"#111",borderRadius:12,overflow:"hidden"};
  const overlay=!playing&&props.showPlayIcon?<button type="button" aria-label="Play video" onClick={()=>setPlaying(true)} style={{position:"absolute",inset:0,border:0,background:poster?"transparent":"rgba(0,0,0,.18)",display:"grid",placeItems:"center",cursor:"pointer"}}><span style={{width:props.playIconSize,height:props.playIconSize,borderRadius:999,display:"grid",placeItems:"center",background:"rgba(0,0,0,.68)",color:"#fff",fontSize:Math.round(props.playIconSize*.42)}}>{props.playIcon?.source==="svg-file"&&props.playIcon?.url?<img src={props.playIcon.url} alt="" style={{width:"46%",height:"46%",objectFit:"contain"}}/>:(props.playIcon?.glyph||"▶")}</span></button>:null;
  if(["youtube","vimeo","dailymotion"].includes(props.provider)){return <div style={shell}>{poster&&!playing?<img src={poster} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:embed?<iframe title="Video" src={embed} loading={props.lazyLoad?"lazy":"eager"} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen style={{width:"100%",height:"100%",border:0}}/>:null}{overlay}</div>}
  return <div style={shell}>{poster&&!playing?<img src={poster} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<video ref={videoRef} src={props.url} muted={props.muted} loop={props.loop} controls={props.controls} playsInline={props.playsInline} preload={props.preload} autoPlay={props.autoplay||playing} onTimeUpdate={(e)=>{if(props.endTime>0&&e.currentTarget.currentTime>=props.endTime){if(props.loop){e.currentTarget.currentTime=props.startTime||0;e.currentTarget.play().catch(()=>{});}else e.currentTarget.pause();}}} style={{width:"100%",height:"100%",objectFit:"cover"}}/>}{overlay}</div>;
}

function SliderPreviewWidget({ node, previewCollection, previewProduct, previewBlog, previewArticle, previewSearch, reusableSections }) {
  const settings=isNestedSliderType(node.type)?normalizeNestedSliderProps(node.type,node.props||{}):normalizeSliderProps(node.props||{}); const slides=Array.isArray(node.children)?node.children:[]; const [index,setIndex]=useState(0); const [paused,setPaused]=useState(false); const count=slides.length;
  useEffect(()=>{if(index>=count)setIndex(Math.max(0,count-1));},[count,index]);
  useEffect(()=>{if(!settings.autoplay||paused||count<=1)return;const timer=setInterval(()=>setIndex((current)=>{if(current>=count-1){if(settings.loop||settings.rewind)return 0;return settings.stopOnLastSlide?current:0;}return current+1;}),settings.autoplayDelay);return()=>clearInterval(timer);},[settings.autoplay,settings.autoplayDelay,settings.loop,settings.rewind,settings.stopOnLastSlide,paused,count]);
  if(!count)return <div style={{padding:30,border:"1px dashed #ccc",borderRadius:12,textAlign:"center"}}>Add slides in Widget Settings.</div>;
  const go=(next)=>{let target=next;if(settings.loop||settings.rewind){target=(target+count)%count}else target=Math.max(0,Math.min(count-1,target));setIndex(target);if(settings.pauseOnInteraction)setPaused(true);};
  const per=Math.max(1,settings.slidesDesktop); const width=100/per; const renderSlide=(slide)=>slide.type==="container"&&(slide.props?.__sliderSlide||slide.props?.__nestedSliderItem)?(slide.children||[]).map((child)=><RenderNode key={child.id} node={child} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections}/>):<RenderNode node={slide} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections}/>;
  return <div className="vsn-slider" tabIndex={settings.keyboard?0:undefined} onKeyDown={(e)=>{if(!settings.keyboard)return;if(e.key==="ArrowRight")go(index+1);if(e.key==="ArrowLeft")go(index-1);}} onMouseEnter={()=>settings.pauseOnHover&&setPaused(true)} onMouseLeave={()=>settings.pauseOnHover&&setPaused(false)} style={{position:"relative",overflow:"hidden",padding:`0 ${settings.edgePadding}px`}}><div className="vsn-slider-track" style={{display:"flex",gap:settings.gap,transition:`transform ${settings.speed}ms ease`,transform:`translateX(calc(-${index} * (${width}% + ${settings.gap/per}px)))`,alignItems:settings.equalHeight?"stretch":"flex-start"}}>{slides.map((slide,i)=><div className="vsn-slider-slide" key={slide.id||i} style={{flex:`0 0 calc(${width}% - ${settings.gap*(per-1)/per}px)`,minWidth:0}}>{renderSlide(slide)}</div>)}</div>{settings.navigation&&count>1?<><button type="button" aria-label="Previous slide" onClick={()=>go(index-1)} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",zIndex:2,border:"1px solid #ddd",background:"#fff",borderRadius:999,width:36,height:36}}>{settings.previousIcon}</button><button type="button" aria-label="Next slide" onClick={()=>go(index+1)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",zIndex:2,border:"1px solid #ddd",background:"#fff",borderRadius:999,width:36,height:36}}>{settings.nextIcon}</button></>:null}{settings.pagination==="dots"?<div style={{display:"flex",justifyContent:"center",gap:6,marginTop:10}}>{slides.map((_,i)=><button type="button" key={i} aria-label={`Go to slide ${i+1}`} onClick={()=>go(i)} style={{width:8,height:8,padding:0,border:0,borderRadius:999,background:i===index?"#111":"#ccc"}}/>)}</div>:settings.pagination==="fraction"?<div style={{textAlign:"center",fontSize:12,marginTop:8}}>{index+1} / {count}</div>:settings.pagination==="progress"?<div style={{height:3,background:"#eee",marginTop:8}}><div style={{height:"100%",width:`${((index+1)/count)*100}%`,background:"#111",transition:"width .2s"}}/></div>:null}</div>;
}

const NESTED_PREVIEW_CONTRACT_TYPES = ["carousel", "slides", "testimonials-carousel"];
const PHASE10_WIDGET_TYPES = new Set([
  "breadcrumbs","icon-list","icon-box","image-box","accordion","toggle","social-icons","map","progress-bar","counter","pricing-table","timeline","data-table","menu-anchor","form-builder","product-media","inventory-status","collection-filters","collection-sorting","collection-pagination","cart-drawer","countdown","product-grid","product-card","collection-grid","html","liquid"
]);

function phase10Rows(value, fields = 3) {
  return String(value || "").split(/\r?\n/).map((line) => line.split("|").map((x) => x.trim()).slice(0, fields)).filter((row) => row.some(Boolean));
}

function parseFormFieldRows(value) {
  return String(value || "").split(/\r?\n/).map((line, index) => {
    const [type="text", name=`field_${index+1}`, label="Field", placeholder="", required="", options="", step="1"] = line.split("|").map((x)=>String(x||"").trim());
    return { type:type.toLowerCase(), name, label, placeholder, required:/^(required|true|1|yes)$/i.test(required), options:options.split(",").map((x)=>x.trim()).filter(Boolean), step:Math.max(1, Number(step)||1) };
  }).filter((field)=>field.name && field.type);
}

function Phase10PreviewWidget({ node, previewProduct }) {
  const p=node.props||{}; const t=node.type; const gap=node.styles?.grid?.gap||node.styles?.spacing?.gap||"14px";
  if(t==="breadcrumbs"){const items=normalizeStructuredItems(t,p).filter((_,i)=>p.showHome!==false||i>0);return <nav aria-label="Breadcrumb" style={{display:"flex",gap,flexWrap:"wrap"}}>{items.map((item,i)=><span key={item.id||i}>{i>0?<span style={{marginRight:gap}}>{p.separator||"/"}</span>:null}<a href={item.url||"#"} style={{color:"inherit"}}>{item.label}</a></span>)}</nav>;}
  if(t==="icon-list"){const items=normalizeStructuredItems(t,p);return <ul style={{display:"grid",gap,listStyle:"none",padding:0,margin:0}}>{items.map((item,i)=><li key={item.id||i} style={{display:"flex",gap:8,alignItems:"center"}}><span>{item.icon||"•"}</span>{item.url?<a href={item.url} style={{color:"inherit"}}>{item.label}</a>:<span>{item.label}</span>}</li>)}</ul>;}
  if(t==="icon-box") return <a href={p.url||"#"} style={{display:"block",color:"inherit",textDecoration:"none",border:"1px solid #e5e5e5",borderRadius:12,padding:18}}><div style={{fontSize:30}}>{p.icon||"★"}</div><strong style={{display:"block",marginTop:8}}>{p.heading}</strong><div style={{marginTop:6,color:"#666"}}>{p.text}</div></a>;
  if(t==="image-box") return <a className="vsn-image-box vsn-content-item" href={p.url||"#"} style={{display:"block",color:"inherit",textDecoration:"none"}}>{p.src?<img className="vsn-content-media" src={p.src} alt={p.alt||p.heading||""} style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:12}}/>:<div className="vsn-content-media" style={{aspectRatio:"4/3",background:"#f2f2f2",borderRadius:12}}/>}<strong className="vsn-content-title" style={{display:"block",marginTop:10}}>{p.heading}</strong><div className="vsn-content-body" style={{color:"#666"}}>{p.text}</div></a>;
  if(t==="accordion"){const items=normalizeStructuredItems(t,p);return <div style={{display:"grid",gap}}>{items.map((item,i)=><details key={item.id||i} open={p.firstOpen!==false&&i===0} style={{border:"1px solid #e5e5e5",borderRadius:10,padding:12}}><summary style={{fontWeight:600}}>{item.title}</summary><div style={{paddingTop:8}}>{item.content}</div></details>)}</div>;}
  if(t==="toggle") return <details open={!!p.open} style={{border:"1px solid #e5e5e5",borderRadius:10,padding:12}}><summary style={{fontWeight:600}}>{p.title}</summary><div style={{paddingTop:8}}>{p.content}</div></details>;
  if(t==="social-icons"){const items=normalizeStructuredItems(t,p);return <div style={{display:"flex",gap,flexWrap:"wrap"}}>{items.map((item,i)=><a key={item.id||i} href={item.url||"#"} target={p.openNew===false?undefined:"_blank"} rel="noreferrer" title={item.label} style={{width:38,height:38,border:"1px solid #ddd",borderRadius:999,display:"grid",placeItems:"center",textDecoration:"none",color:"inherit"}}>{item.icon||item.label?.slice(0,2)}</a>)}</div>;}
  if(t==="map") return <div style={{height:Number(p.height)||360,border:"1px solid #e5e5e5",borderRadius:12,display:"grid",placeItems:"center",background:"#f6f6f7"}}>Map: {p.query||"Location"} · Zoom {p.zoom||14}</div>;
  if(t==="progress-bar"){const v=Math.max(0,Math.min(100,Number(p.value)||0));return <div><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span>{p.label}</span>{p.showValue!==false?<span>{v}%</span>:null}</div><div style={{height:9,background:"#eee",borderRadius:99,overflow:"hidden"}}><div style={{width:`${v}%`,height:"100%",background:"#008060"}}/></div></div>}
  if(t==="counter") return <div style={{fontSize:42,fontWeight:700}}>{p.prefix}{p.end??100}{p.suffix}</div>;
  if(t==="pricing-table") return <div style={{border:p.featured?"2px solid #008060":"1px solid #e5e5e5",borderRadius:14,padding:22}}><h3>{p.title}</h3><div style={{fontSize:34,fontWeight:700}}>{p.price}<span style={{fontSize:14,fontWeight:400,color:"#666"}}>{p.period}</span></div><ul>{String(p.featuresText||"").split(/\r?\n/).filter(Boolean).map((x,i)=><li key={i}>{x}</li>)}</ul><a href={p.buttonUrl||"#"} style={{display:"inline-block",padding:"10px 14px",background:"#111",color:"#fff",borderRadius:8,textDecoration:"none"}}>{p.buttonText||"Choose plan"}</a></div>;
  if(t==="timeline"){const items=normalizeStructuredItems(t,p);return <div style={{display:"grid",gap}}>{items.map((item,i)=><div key={item.id||i} style={{display:"grid",gridTemplateColumns:"90px 1fr",gap:14,borderLeft:"2px solid #ddd",paddingLeft:14}}><strong>{item.eyebrow}</strong><div><b>{item.title}</b><div style={{color:"#666"}}>{item.description}</div></div></div>)}</div>;}
  if(t==="data-table"){const headers=String(p.headersText||"").split("|");const data=phase10Rows(p.rowsText,headers.length||3);return <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{headers.map((h,i)=><th key={i} style={{textAlign:"left",padding:10,borderBottom:"1px solid #ddd"}}>{h}</th>)}</tr></thead><tbody>{data.map((row,i)=><tr key={i}>{headers.map((_,j)=><td key={j} style={{padding:10,borderBottom:"1px solid #eee"}}>{row[j]||""}</td>)}</tr>)}</tbody></table></div>}
  if(t==="menu-anchor") return <div id={String(p.anchorId||"section-anchor").replace(/[^a-zA-Z0-9_-]/g,"-")} style={{height:1}} />;
  if(t==="form-builder"){const fields=parseFormFieldRows(p.fieldsText);const firstStep=Math.min(...fields.map(f=>f.step),1);return <form onSubmit={(e)=>e.preventDefault()} style={{display:"grid",gap,maxWidth:680}}><strong style={{fontSize:20}}>{p.heading}</strong>{fields.filter(f=>!p.multiStep||f.step===firstStep).map((f,i)=><label key={`${f.name}-${i}`} style={{display:"grid",gap:5}}>{p.showLabels!==false&&f.type!=="hidden"?<span style={{fontSize:13,fontWeight:600}}>{f.label}{f.required?" *":""}</span>:null}{["textarea"].includes(f.type)?<textarea placeholder={f.placeholder} style={{minHeight:90,padding:9,border:"1px solid #ddd",borderRadius:8}}/>:["select"].includes(f.type)?<select style={{padding:9,border:"1px solid #ddd",borderRadius:8}}>{f.options.map((o,optionIndex)=><option key={`${o}-${optionIndex}`}>{o}</option>)}</select>:["radio","checkbox","consent"].includes(f.type)?<span>{f.options.length?f.options.join(" · "):f.label}</span>:<input type={f.type==="rating"?"number":f.type} min={f.type==="rating"?1:undefined} max={f.type==="rating"?5:undefined} placeholder={f.placeholder} style={{padding:9,border:"1px solid #ddd",borderRadius:8}}/>}</label>)}<div style={{display:"flex",gap:8}}>{p.multiStep?<button type="button">{p.previousText||"Back"}</button>:null}{p.multiStep?<button type="button">{p.nextText||"Next"}</button>:null}<button type="submit" style={{padding:"11px 16px",border:0,borderRadius:8,background:"#111",color:"white",fontWeight:600}}>{p.submitText||"Submit"}</button></div></form>}
  if(t==="product-media") return <div style={{width:"100%"}}>{previewProduct?.featuredImage?.url?<img src={previewProduct.featuredImage.url} alt={previewProduct.title||"Product"} style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:12}}/>:<div style={{aspectRatio:"1",background:"#f2f2f2",borderRadius:12}}/>}</div>;
  if(t==="inventory-status"){const variants=previewProduct?.variants?.nodes||[];const available=variants.some((variant)=>variant?.availableForSale);const qty=variants.reduce((sum,variant)=>sum+(Number.isFinite(Number(variant?.inventoryQuantity))?Math.max(0,Number(variant.inventoryQuantity)):0),0);const threshold=Math.max(1,Number(p.lowThreshold||5));const low=available&&qty>0&&qty<=threshold;return <span style={{fontWeight:600}}>{!available?(p.soldOutText||"Sold out"):low?(p.lowStockText||"Low stock"):(p.inStockText||"In stock")}</span>;}
  if(t==="collection-filters") return <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button">{p.label||"Filters"}</button>{p.showAvailability!==false&&<button type="button">Availability</button>}{p.showPrice!==false&&<button type="button">Price</button>}{p.showVendor!==false&&<button type="button">Vendor</button>}</div>;
  if(t==="collection-sorting") return <label>{p.label||"Sort by"} <select defaultValue={p.defaultSort||"featured"}><option value="featured">Featured</option><option value="price-ascending">Price: low to high</option><option value="price-descending">Price: high to low</option><option value="title-ascending">A–Z</option></select></label>;
  if(t==="collection-pagination") return <div style={{display:"flex",gap:8}}><button type="button">{p.mode==="pages"?(p.previousText||"Previous"):(p.buttonText||"Load more")}</button>{p.mode==="pages"&&<button type="button">{p.nextText||"Next"}</button>}</div>;
  if(t==="cart-drawer") return <div style={{border:"1px solid #e5e5e5",borderRadius:12,padding:18}}><strong>{p.heading||"Your cart"}</strong><div style={{padding:"18px 0",color:"#666"}}>{p.emptyText||"Your cart is empty"}</div><div style={{display:"flex",gap:8}}><button type="button">{p.viewCartText||"View cart"}</button><button type="button">{p.checkoutText||"Checkout"}</button></div></div>;
  if(t==="countdown") { const units=[["Days",7,p.showDays!==false],["Hours",12,p.showHours!==false],["Minutes",34,p.showMinutes!==false],["Seconds",56,p.showSeconds!==false]]; return <div style={{display:"flex",gap:8}}>{units.filter(([, ,show])=>show).map(([x,v])=><div key={x} style={{border:"1px solid #eee",borderRadius:10,padding:10,textAlign:"center"}}><b>{v}</b><div style={{fontSize:11}}>{x}</div></div>)}</div>; }
  if(t==="product-grid"||t==="product-card"||t==="collection-grid"){const g=normalizeGridProps(t,p);return <div style={{display:"grid",gridTemplateColumns:`repeat(${t==="product-card"?1:g.columnsDesktop},minmax(0,1fr))`,gap:g.gap}}>{Array.from({length:t==="product-card"?1:Math.min(g.limit,6)}).map((_,i)=><div key={i} style={{border:"1px solid #eee",borderRadius:10,padding:10}}>{g.showImage?<div style={{aspectRatio:gridImageRatio(g.imageRatio),background:"#f2f2f2",borderRadius:8}}/>:null}{g.showTitle?<strong style={{display:"block",marginTop:8}}>{t==="collection-grid"?`Collection ${i+1}`:`Product ${i+1}`}</strong>:null}{t!=="collection-grid"&&g.showPrice?<span style={{fontSize:12,color:"#666"}}>$49.00</span>:null}</div>)}</div>;}
  if(t==="html" && p.mode==="theme-section") return <div style={{padding:16,border:"1px dashed #8c9196",borderRadius:10,background:"#f6f6f7"}}><strong>Shopify Theme Section Bridge</strong><div style={{fontSize:12,marginTop:4}}>{p.themeSectionId||"Enter a theme section ID."}</div></div>;
  if(t==="html") return <pre style={{whiteSpace:"pre-wrap",padding:12,background:"#f6f6f7",borderRadius:8}}>{p.code||p.html||p.content||"<div>Custom HTML</div>"}</pre>;
  if(t==="liquid") return <pre style={{whiteSpace:"pre-wrap",padding:12,background:"#f6f6f7",borderRadius:8}}>{p.code||p.liquid||p.content||"{{ product.title }}"}</pre>;
  return null;
}

const EXTENDED_WIDGET_TYPES = new Set(["faq","testimonials","logo-cloud","stats","team-grid","marquee","tabs","product-tabs","size-guide","shipping-info","stock-progress","trust-badges","recently-viewed","related-collections","upsell-products","sticky-add-to-cart","announcement-bar","mega-menu","header-search","cart-icon","account-link","customer-name","customer-login","customer-logout","customer-orders-link","customer-addresses-link","localization-switcher"]);

function rows(value) { return String(value || "").split(/\r?\n/).map((line) => line.split("|").map((x) => x.trim())).filter((r) => r.some(Boolean)); }

function ExtendedPreviewWidget({ node, previewProduct }) {
  const p = node.props || {}; const st = normalizeStyles(node.styles || {}); const type = node.type;
  const gap = node.styles?.grid?.gap || node.styles?.spacing?.gap || "16px";
  if (type === "faq"){const items=normalizeStructuredItems(type,p);return <div style={{display:"grid",gap}}>{items.map((item,i)=><details key={item.id||i} style={{border:"1px solid #e5e5e5",borderRadius:10,padding:"14px 16px"}}><summary style={{fontWeight:600}}>{item.question}</summary><div style={{paddingTop:10,color:"#555"}}>{item.answer}</div></details>)}</div>;}
  if (type === "testimonials"){const items=normalizeStructuredItems(type,p);return <div style={{display:"grid",gridTemplateColumns:`repeat(${p.columns||3},minmax(0,1fr))`,gap}}>{items.map((item,i)=><blockquote key={item.id||i} style={{margin:0,border:"1px solid #e5e5e5",borderRadius:12,padding:18}}>“{item.quote}”<footer style={{marginTop:10,color:"#666",fontSize:13}}>{item.name}{item.role?` · ${item.role}`:""}</footer></blockquote>)}</div>;}
  if (type === "logo-cloud"){const items=normalizeStructuredItems(type,p);return <div style={{display:"flex",gap,flexWrap:"wrap",justifyContent:"center",...st}}>{items.map((item,i)=><a href={item.url||undefined} className="vsn-logo-item vsn-content-item" key={item.id||i} style={{padding:"10px 16px",border:"1px solid #eee",borderRadius:999,fontWeight:600,color:"inherit",textDecoration:"none"}}>{item.imageUrl?<img src={item.imageUrl} alt={item.label||""} style={{height:32,maxWidth:120,objectFit:"contain"}}/>:item.label}</a>)}</div>;}
  if (type === "stats"){const items=normalizeStructuredItems(type,p);return <div style={{display:"grid",gridTemplateColumns:`repeat(${p.columns||4},minmax(0,1fr))`,gap}}>{items.map((item,i)=><div key={item.id||i} style={{textAlign:"center",padding:18,border:"1px solid #eee",borderRadius:12}}><strong style={{fontSize:28,display:"block"}}>{item.value}</strong><span style={{fontSize:13,color:"#666"}}>{item.label}</span></div>)}</div>;}
  if (type === "team-grid"){const items=normalizeStructuredItems(type,p);return <div style={{display:"grid",gridTemplateColumns:`repeat(${p.columns||3},minmax(0,1fr))`,gap}}>{items.map((item,i)=><div className="vsn-team-card vsn-content-item" key={item.id||i} style={{padding:18,border:"1px solid #eee",borderRadius:12}}>{item.imageUrl?<img className="vsn-content-media" src={item.imageUrl} alt={item.name||""} style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:10,marginBottom:10}}/>:<div className="vsn-content-media" style={{aspectRatio:"1",background:"#f2f2f2",borderRadius:10,marginBottom:10}}/>}<strong className="vsn-content-title">{item.name}</strong><div className="vsn-content-meta" style={{fontSize:13,color:"#666"}}>{item.role}</div></div>)}</div>;}
  if (type === "gallery-grid") return <div style={{display:"grid",gridTemplateColumns:`repeat(${p.columnsDesktop||4},minmax(0,1fr))`,gap}}>{String(p.imagesText||"").split(/\r?\n/).filter(Boolean).map((src,i)=><img className="vsn-gallery-item vsn-content-item vsn-content-media" key={i} src={src} alt="" style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:10}}/>)}</div>;
  if (type === "marquee") return <div style={{overflow:"hidden",whiteSpace:"nowrap",padding:"10px 0",background:node.styles?.background?.color||"#111",color:node.styles?.typography?.color||"#fff",fontWeight:600}}>{p.text} {p.text}</div>;
  if (type === "tabs" || type === "product-tabs") { const items=type==="tabs"?normalizeStructuredItems("tabs",p).map(item=>[item.label,item.content]):[[p.descriptionLabel||"Description",previewProduct?.description||"Product description"],[p.shippingLabel||"Shipping",p.shippingText],[p.returnsLabel||"Returns",p.returnsText]]; return <div><div style={{display:"flex",gap:8,borderBottom:"1px solid #eee"}}>{items.map(([l],i)=><button type="button" key={i} style={{border:0,background:"transparent",padding:10,fontWeight:600}}>{l}</button>)}</div><div style={{padding:"16px 0"}}>{items[0]?.[1]}</div></div>; }
  if (type === "size-guide") return <details style={{border:"1px solid #eee",borderRadius:10,padding:14}}><summary style={{fontWeight:600}}>{p.buttonText||"Size guide"}</summary><h4>{p.heading||"Size guide"}</h4><div>{p.content}</div></details>;
  if (type === "shipping-info") return <div style={st}><strong>{p.heading||"Shipping"}</strong><div>{p.text}</div></div>;
  if (type === "stock-progress") { const max=Number(p.max||10), cur=Math.min(max,Number(p.fallbackStock||5)); return <div><div style={{fontSize:13,fontWeight:600,marginBottom:7}}>{p.label}</div><div style={{height:7,background:"#eee",borderRadius:99,overflow:"hidden"}}><span style={{display:"block",width:`${(cur/max)*100}%`,height:"100%",background:"#008060"}}/></div></div>; }
  if (type === "trust-badges"){const items=normalizeStructuredItems(type,p);return <div style={{display:"grid",gridTemplateColumns:`repeat(${p.columns||3},minmax(0,1fr))`,gap}}>{items.map((item,k)=><div key={item.id||k} style={{padding:12,border:"1px solid #eee",borderRadius:10,textAlign:"center"}}><div>{item.icon}</div><strong style={{fontSize:12}}>{item.label}</strong></div>)}</div>;}
  if (["recently-viewed","upsell-products"].includes(type)) return <section><h3>{p.heading|| (type==="recently-viewed"?"Recently viewed":"Complete your order")}</h3><div style={{display:"grid",gridTemplateColumns:`repeat(${p.columns||4},minmax(0,1fr))`,gap:18}}>{Array.from({length:Math.min(Number(p.limit||4),4)}).map((_,i)=><div key={i} style={{border:"1px solid #eee",borderRadius:10,padding:10}}><div style={{aspectRatio:"1",background:"#f3f3f3",borderRadius:8}}/><div style={{marginTop:8,fontWeight:600}}>Product</div></div>)}</div></section>;
  if (type === "related-collections"){const items=normalizeStructuredItems(type,p);return <section><h3>{p.heading||"Related collections"}</h3><div style={{display:"grid",gridTemplateColumns:`repeat(${p.columns||3},1fr)`,gap}}>{items.map((item,i)=><a href={item.url||"#"} key={item.id||i} style={{padding:18,border:"1px solid #eee",borderRadius:12,fontWeight:600,color:"inherit",textDecoration:"none"}}>{item.imageUrl?<img src={item.imageUrl} alt={item.label||""} style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:8,marginBottom:8}}/>:null}{item.label}</a>)}</div></section>;}
  if (type === "sticky-add-to-cart") return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:12,border:"1px solid #eee",background:"#fff"}}><strong>{previewProduct?.title||"Product"}</strong><button type="button" style={{background:"#111",color:"#fff",border:0,borderRadius:8,padding:"10px 16px"}}>{p.text||"Add to cart"}</button></div>;
  if (type === "announcement-bar") return <div style={{position:"relative",textAlign:"center",padding:9,background:node.styles?.background?.color||"#111",color:node.styles?.typography?.color||"#fff",fontWeight:600}}>{p.text}{p.dismissible?<span style={{position:"absolute",right:10}}>×</span>:null}</div>;
  if (type === "mega-menu"){const items=normalizeStructuredItems(type,p);return <div style={st}><strong>{p.label||"Shop"} ▾</strong><div style={{marginTop:8,padding:12,border:"1px solid #eee",borderRadius:10}}>{items.map((item,i)=><div key={item.id||i}>{item.label}</div>)}</div></div>;}
  if (type === "header-search") return <form onSubmit={(e)=>e.preventDefault()} style={{display:"flex",gap:6}}><input placeholder={p.placeholder||"Search products"} style={{padding:8,border:"1px solid #ddd",borderRadius:8}}/><button type="submit">{p.buttonLabel||"Search"}</button></form>;
  if (type === "cart-icon") return <button type="button">{p.label||"Cart"}{p.showCount===false?"":" (0)"}</button>;
  if (type === "account-link") return <a className="vsn-customer-link vsn-account-link" href={p.url||"/account"}>{p.label||"Account"}</a>;
  if (type === "customer-name") return <span className="vsn-customer-name"><span className="vsn-customer-prefix">{p.prefix||"Hello, "}</span><span className="vsn-customer-name-value">{p.loggedOutText||"Customer"}</span></span>;
  if (["customer-login","customer-logout","customer-orders-link","customer-addresses-link"].includes(type)) return <a className="vsn-customer-link" href={p.url||"/account"}>{p.label||"Account"}</a>;
  if (type === "localization-switcher") return <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{p.showCountry!==false&&<select><option>{p.countryLabel||"Country"}</option></select>}{p.showLanguage!==false&&<select><option>{p.languageLabel||"Language"}</option></select>}<button type="button">Apply</button></div>;
  return null;
}

function previewReadPath(source, path) {
	if (!source || !path) return undefined;
	return String(path).split(".").reduce((value, key) => value == null ? undefined : value[key], source);
}

function previewApplyDynamic(node, context = {}) {
	const dynamic = node?.dynamicSource;
	if (!dynamic?.enabled || !dynamic.source) return node;
	let value;
	if (dynamic.source === "product.metafield") value = context.previewProduct?.metafields?.nodes?.find((item)=>item.namespace===(dynamic.namespace||"custom") && item.key===dynamic.key)?.value;
	else if (dynamic.source === "product.price") value = context.previewProduct?.priceRangeV2?.minVariantPrice?.amount;
	else if (dynamic.source === "query.search") value = context.previewSearch?.query;
	else if (dynamic.source === "metaobject.field") value = dynamic.fallback || "Metaobject field preview";
	else value = previewReadPath({product:context.previewProduct,collection:context.previewCollection,article:context.previewArticle,blog:context.previewBlog,search:context.previewSearch,customer:{name:"Customer",email:"customer@example.com"}},dynamic.source);
	if (value == null || value === "") value = dynamic.fallback;
	if (value == null || value === "") return node;
	const props = {...(node.props||{})};
	if ((dynamic.target||"text") === "src") props.src=String(value); else if (dynamic.target === "url") props.url=String(value); else props.text=String(value);
	return {...node,props};
}


function previewLoopItems(query, context = {}) {
  const q = normalizeQueryDefinition(query);
  let raw = [];
  if (q.source === "products") raw = context.previewCollection?.products?.nodes || (context.previewProduct ? [context.previewProduct] : [{id:"p1",title:"Product One",handle:"product-one",featuredImage:{url:"/vsn-stock/fashion.svg",altText:"Product"},priceRangeV2:{minVariantPrice:{amount:"29",currencyCode:"USD"}}},{id:"p2",title:"Product Two",handle:"product-two",featuredImage:{url:"/vsn-stock/arrivals.svg",altText:"Product"},priceRangeV2:{minVariantPrice:{amount:"49",currencyCode:"USD"}}}]);
  else if (q.source === "collections") raw = context.previewCollection ? [context.previewCollection] : [{id:"c1",title:"Collection One",handle:"collection-one",image:{url:"/vsn-stock/fashion.svg",altText:"Collection"}},{id:"c2",title:"Collection Two",handle:"collection-two",image:{url:"/vsn-stock/arrivals.svg",altText:"Collection"}}];
  else if (q.source === "articles") raw = context.previewBlog?.articles?.nodes || (context.previewArticle ? [context.previewArticle] : [{id:"a1",title:"Article One",handle:"article-one",excerpt:"Article excerpt",publishedAt:new Date().toISOString(),image:{url:"/vsn-stock/office.svg",altText:"Article"}}]);
  else if (q.source === "blogs") raw = context.previewBlog ? [context.previewBlog] : [{id:"b1",title:"Journal",handle:"journal"}];
  else if (q.source === "search") raw = context.previewSearch?.products || [];
  else if (q.source === "metaobjects") raw = [{id:"m1",displayName:q.metaobjectType?`${q.metaobjectType} item`:"Metaobject item",handle:"sample",type:q.metaobjectType||"metaobject",fields:[{key:"title",value:"Metaobject item"}]}];
  else if (q.source === "sdk-provider") raw = [{id:"sdk1",title:q.providerId?`SDK · ${q.providerId}`:"SDK provider item",description:"Live provider data renders in Preview/Storefront."},{id:"sdk2",title:"Provider preview item",description:"Configure provider input in Query Builder."}];
  else raw = [{id:"r1",title:"Referenced item",description:`${q.metafieldNamespace}.${q.metafieldKey||"field"}`}];
  return applyQueryFilters(raw.map((item)=>normalizeLoopItem(item,q.source)),q).slice(0,Math.min(6,q.limit));
}

function LoopPreviewWidget({ node, previewCollection, previewProduct, previewBlog, previewArticle, previewSearch, reusableSections }) {
  const query = normalizeQueryDefinition(node.props?.query || {});
  const items = previewLoopItems(query,{previewCollection,previewProduct,previewBlog,previewArticle,previewSearch});
  const template=(node.children||[]).find((child)=>child?.props?.__loopItem)||node.children?.[0];
  const columns=Math.max(1,Number(node.props?.columnsDesktop||4));
  const gap=Math.max(0,Number(node.props?.gap||20));
  if(!template) return <div data-vsn-loop-empty="1">Loop Item template is missing.</div>;
  return <div className="vsn-loop-preview" style={{display:"grid",gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`,gap}}>{items.length?items.map((item,index)=><LoopPreviewContext.Provider key={item.id||index} value={item}><RenderNode node={template} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections}/></LoopPreviewContext.Provider>):<div style={{gridColumn:"1/-1"}}>{query.emptyText}</div>}</div>;
}


function RenderNodeCore({
	node,
	previewCollection,
	previewProduct,
	previewBlog = null,
	previewArticle = null,
	previewSearch = null,
	reusableSections = [],
}) {
	const loopContext = useContext(LoopPreviewContext);
	const componentLibrary = useContext(ComponentLibraryContext);
	const componentStack = useContext(ComponentStackContext);
	const staticPreview = useContext(StaticPreviewContext);
	if (!node || node?.meta?.hidden === true) {
		return null;
	}
	node = previewApplyDynamic(node, { previewCollection, previewProduct, previewBlog, previewArticle, previewSearch });
	node = applyDynamicBindings(node, { loop: loopContext, product: previewProduct, collection: previewCollection, blog: previewBlog, article: previewArticle, search: previewSearch, customer: { name: "Customer", email: "customer@example.com" } });

	const settings = node.settings || {};

	/*
	 * New builder format:
	 * node.props
	 *
	 * Old saved pages:
	 * node.settings
	 *
	 * Dono support rahenge.
	 */
	const content =
		node.props &&
			typeof node.props === "object"
			? node.props
			: getContent(settings);

	/*
	 * New builder styles:
	 * node.styles
	 *
	 * Old saved styles:
	 * node.settings.style
	 */
	const rawStyles =
		node.styles &&
			typeof node.styles === "object"
			? node.styles
			: getStyle(settings);

	const style =
		normalizeStyles(rawStyles);

	const children =
		Array.isArray(node.children)
			? node.children
			: [];

	if (getVsnEditorRenderer(node.type)) return <SdkWidgetView node={node} context={{previewCollection,previewProduct,previewBlog,previewArticle,previewSearch,loop:loopContext,reusableSections}} style={style} staticPreview={staticPreview}/>;

	if (node.type === "component-instance") {
		const componentId = String(node.props?.componentId || "");
		if (componentId && componentStack.includes(componentId)) return <div data-vsn-id={node.id} style={{...style,padding:"16px",border:"1px dashed #d72c0d",color:"#8a1f0d"}}>Circular component dependency blocked.</div>;
		const resolved = resolveComponentInstance(node, componentLibrary);
		if (!resolved?.root) return <div data-vsn-id={node.id} style={{...style,padding:"16px",border:"1px dashed #d9d9d9"}}>Choose a component.</div>;
		return <ComponentStackContext.Provider value={[...componentStack, componentId]}><div data-vsn-id={node.id} data-vsn-component-id={componentId} data-vsn-component-version={resolved.masterVersion} style={style}><RenderNode node={resolved.root} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections}/></div></ComponentStackContext.Provider>;
	}
	if (node.type === "loop") return <div data-vsn-id={node.id} style={style}><LoopPreviewWidget node={node} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections} /></div>;
	if (node.type === "gallery-grid") return <div data-vsn-id={node.id} style={style}><GalleryPreviewWidget node={node} /></div>;
	if (node.type === "video") return <div data-vsn-id={node.id} style={style}><VideoPreviewWidget node={node} /></div>;
	if (node.type === "slider" || isNestedSliderType(node.type)) return <div data-vsn-id={node.id} style={style}><SliderPreviewWidget node={node} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections} /></div>;
	if (PHASE10_WIDGET_TYPES.has(node.type)) return <div data-vsn-id={node.id} style={style}><Phase10PreviewWidget node={node} previewProduct={previewProduct} /></div>;
	switch (node.type) {
		case "faq": case "testimonials": case "logo-cloud": case "stats": case "team-grid": case "gallery-grid": case "marquee": case "tabs": case "product-tabs": case "size-guide": case "shipping-info": case "stock-progress": case "trust-badges": case "recently-viewed": case "related-collections": case "upsell-products": case "sticky-add-to-cart": case "announcement-bar": case "mega-menu": case "header-search": case "cart-icon": case "account-link": case "customer-name": case "customer-login": case "customer-logout": case "customer-orders-link": case "customer-addresses-link": case "localization-switcher":
			return <div data-vsn-id={node.id} style={style}><ExtendedPreviewWidget node={node} previewProduct={previewProduct} /></div>;
		case "global-section": {
			const section = reusableSections.find((item) => item.id === content.sectionId);
			const nodes = Array.isArray(section?.content) ? section.content.filter((item) => !["global-styles", "template-settings"].includes(item?.type)) : [];
			if (!section) return <div data-vsn-id={node.id} style={{padding:"20px",border:"1px dashed #d9d9d9"}}>Choose a reusable section.</div>;
			return <section data-vsn-id={node.id}>{nodes.map((child) => <RenderNode key={child.id} node={child} previewCollection={previewCollection} previewProduct={previewProduct} previewBlog={previewBlog} previewArticle={previewArticle} previewSearch={previewSearch} reusableSections={reusableSections} />)}</section>;
		}
		case "navigation-menu": {
			const items = normalizeStructuredItems("navigation-menu", content).filter((item)=>item.label);
			return <nav data-vsn-id={node.id} style={{display:"flex",gap:rawStyles?.spacing?.gap||"22px",justifyContent:content.alignment==="left"?"flex-start":content.alignment==="center"?"center":"flex-end",flexWrap:"wrap",...style}}>{items.map((item)=><a key={`${item.label}-${item.url}`} href={item.url} style={{color:"inherit",textDecoration:"none"}}>{item.label}</a>)}</nav>;
		}
		case "contact-form":
		case "newsletter-form":
		case "product-inquiry-form": {
			const newsletter = node.type === "newsletter-form";
			const inquiry = node.type === "product-inquiry-form";
			return <form data-vsn-id={node.id} onSubmit={(e)=>e.preventDefault()} style={{display:"grid",gap:rawStyles?.spacing?.gap||"12px",...style}}><strong>{content.heading || (newsletter ? "Join our newsletter" : inquiry ? "Product inquiry" : "Contact us")}</strong>{!newsletter&&<input placeholder="Name" style={{padding:"10px",border:"1px solid #d9d9d9",borderRadius:"8px"}}/>}{newsletter?<input type="email" placeholder={content.placeholder||"Email address"} style={{padding:"10px",border:"1px solid #d9d9d9",borderRadius:"8px"}}/>:<><input type="email" placeholder="Email" style={{padding:"10px",border:"1px solid #d9d9d9",borderRadius:"8px"}}/>{content.showPhone!==false&&<input placeholder="Phone" style={{padding:"10px",border:"1px solid #d9d9d9",borderRadius:"8px"}}/>}<textarea placeholder={inquiry?"How can we help with this product?":"Message"} style={{minHeight:"96px",padding:"10px",border:"1px solid #d9d9d9",borderRadius:"8px"}}/></>}<button type="submit" style={{padding:"11px 16px",border:0,borderRadius:"8px",background:"#1a1a1a",color:"white",fontWeight:600}}>{content.submitText || (newsletter ? "Subscribe" : "Send")}</button></form>;
		}
		case "container":
		case "section":
		case "banner":
			return (
				<div
					data-vsn-id={node.id}
					style={{
						display: "flex",
						flexDirection:
							style.flexDirection ||
							style.direction ||
							"column",
						alignItems:
							style.alignItems || "stretch",
						justifyContent:
							style.justifyContent || "flex-start",
						gap: getSize(style.gap, "0px"),
						width: getSize(
							style.width,
							"100%",
						),
						minHeight: getSize(
							style.minHeight,
							"auto",
						),
						maxWidth: getSize(
							style.maxWidth,
							"none",
						),
						margin: getSpacing(style.margin),
						padding: getSpacing(style.padding),
						backgroundColor:
							style.backgroundColor ||
							"transparent",
						borderRadius: getSize(
							style.borderRadius,
							"0px",
						),
					}}
				>
					{children.map((child) => (
						<RenderNode
							key={child.id}
							node={child}
							previewCollection={previewCollection}
							previewProduct={previewProduct}
					previewBlog={previewBlog}
					previewArticle={previewArticle}
					previewSearch={previewSearch}
					reusableSections={reusableSections}
						/>
					))}
				</div>
			);

		case "columns":
			return (
				<div
					data-vsn-id={node.id}
					style={{
						display: "grid",
						gridTemplateColumns: `repeat(${settings.columns ||
							style.columns ||
							Math.max(children.length, 2)
							}, minmax(0, 1fr))`,
						gap: getSize(style.gap, "20px"),
						width: "100%",
					}}
				>
					{children.map((child) => (
						<RenderNode
							key={child.id}
							node={child}
							previewCollection={previewCollection}
							previewProduct={previewProduct}
					previewBlog={previewBlog}
					previewArticle={previewArticle}
					previewSearch={previewSearch}
					reusableSections={reusableSections}
						/>
					))}
				</div>
			);

		case "heading": {
			const Tag =
				content.tag ||
				settings.tag ||
				settings.headingTag ||
				"h2";

			return (
				<Tag
					data-vsn-id={node.id}
					style={{
						margin: getSpacing(style.margin),
						padding: getSpacing(style.padding),
						color:
							style.color ||
							style.textColor ||
							"#1a1a1a",
						fontSize: getSize(
							style.fontSize,
							"32px",
						),
						fontWeight:
							style.fontWeight || 700,
						fontFamily:
							style.fontFamily,
						fontStyle:
							style.fontStyle || "normal",
						lineHeight: getSize(
							style.lineHeight,
							"1.2",
						),
						letterSpacing: getSize(
							style.letterSpacing,
							"0px",
						),
						textAlign:
							style.textAlign || "left",
						textTransform:
							style.textTransform || "none",
					}}
				>
					{content.text ||
						settings.text ||
						"Heading"}
				</Tag>
			);
		}

		case "search-query-title": { const q=previewSearch?.query||"shirt"; return <h1 data-vsn-id={node.id} className="vsn-search-query-title" style={style}><span className="vsn-search-query-prefix">{content.prefix||"Search results for"}</span> <span className="vsn-search-query-value">“{q}”</span></h1>; }
		case "search-result-count": { const count=previewSearch?.products?.length||0; return <div data-vsn-id={node.id} className="vsn-search-result-count" style={style}><span className="vsn-search-count-value">{count}</span> <span className="vsn-search-count-label">{count===1?(content.singularText||"result"):(content.pluralText||"results")}</span></div>; }
		case "search-results-grid": {
			const items=previewSearch?.products||[];
			const grid=normalizeGridProps("search-results-grid",content);
			const rawGap=rawStyles?.grid?.gap;
			const gap=rawGap == null || rawGap === "" ? `${grid.gap}px` : (typeof rawGap === "number" ? `${rawGap}px` : rawGap);
			return <div data-vsn-id={node.id} className="vsn-search-results-grid" style={{display:"grid",gridTemplateColumns:`repeat(${grid.columnsDesktop||4},minmax(0,1fr))`,gap}}>{items.length?items.map((item)=><article key={item.id} className="vsn-search-card" style={{border:"1px solid #e5e5e5",borderRadius:"12px",padding:"14px"}}><a href={item.url||"#"} onClick={(e)=>e.preventDefault()} style={{color:"inherit",textDecoration:"none"}}>{item.featuredImage?.url&&<img className="vsn-search-card-media" src={item.featuredImage.url} alt={item.featuredImage.altText||item.title}/>}<div className="vsn-search-type">Product</div><h3 className="vsn-search-card-title">{item.title}</h3><p className="vsn-search-card-excerpt">{item.description||"Search result excerpt"}</p></a></article>):<div className="vsn-search-empty">{content.emptyText||"No results found."}</div>}</div>;
		}
		case "blog-title": return <h1 data-vsn-id={node.id} style={style}>{previewBlog?.title||content.fallbackText||"Blog"}</h1>;
		case "blog-description": return <p data-vsn-id={node.id} style={style}>{content.fallbackText||"Latest stories and updates."}</p>;
		case "blog-article-grid": { const items=previewBlog?.articles?.nodes||previewBlog?.articles||[]; return <div data-vsn-id={node.id} className="vsn-blog-article-grid" style={{display:"grid",gridTemplateColumns:`repeat(${content.columnsDesktop||3},minmax(0,1fr))`,gap:rawStyles?.grid?.gap||"24px"}}>{items.length?items.map((item)=><article key={item.id||item.handle} className="vsn-article-card"><a href="#" onClick={(e)=>e.preventDefault()}><h3 className="vsn-article-card-title">{item.title}</h3><div className="vsn-article-card-meta"><span className="vsn-article-card-date">Publish date</span></div><p className="vsn-article-card-excerpt">{item.excerpt||"Article excerpt"}</p></a></article>):<div>{content.emptyText||"No articles found."}</div>}</div>; }
		case "article-title": return <h1 data-vsn-id={node.id} style={style}>{previewArticle?.title||content.fallbackText||"Article title"}</h1>;
		case "article-featured-image": { const src=previewArticle?.image?.url||content.fallbackSrc; return src?<img data-vsn-id={node.id} src={src} alt={previewArticle?.image?.altText||previewArticle?.title||content.alt||"Article"} style={{...style,width:"100%",objectFit:"cover"}}/>:null; }
		case "article-content": return <div data-vsn-id={node.id} style={style}>{previewArticle?.excerpt||content.fallbackText||"Article content will appear here."}</div>;
		case "article-author": return <div data-vsn-id={node.id} className="vsn-article-meta vsn-article-author" style={style}>{content.prefix||"By "}{previewArticle?.author?.name||previewArticle?.author||"Author"}</div>;
		case "article-date": { const d=previewArticle?.publishedAt?new Date(previewArticle.publishedAt):null; const text=d?(content.format==="iso"?d.toISOString().slice(0,10):d.toLocaleDateString("en-US",content.format==="short"?{year:"numeric",month:"numeric",day:"numeric"}:content.format==="medium"?{year:"numeric",month:"short",day:"numeric"}:{year:"numeric",month:"long",day:"numeric"})):"Publish date"; return <div data-vsn-id={node.id} className="vsn-article-meta vsn-article-date" style={style}>{text}</div>; }
		case "article-tags": return <div data-vsn-id={node.id} className="vsn-article-meta vsn-article-tags" style={style}>{content.prefix?<span className="vsn-article-tags-prefix">{content.prefix}</span>:null}{(previewArticle?.tags||["Tag"]).map((tag,i,arr)=><span className="vsn-article-tag" key={`${tag}-${i}`}>{tag}{i<arr.length-1?(content.separator||" · "):""}</span>)}</div>;
		case "article-navigation": return <nav data-vsn-id={node.id} className="vsn-article-navigation" style={{display:"flex",justifyContent:"space-between",...style}}><a className="vsn-article-nav-prev" href="#" onClick={(e)=>e.preventDefault()}>← {content.previousText||"Previous article"}</a><a className="vsn-article-nav-next" href="#" onClick={(e)=>e.preventDefault()}>{content.nextText||"Next article"} →</a></nav>;
		case "related-articles": return <section data-vsn-id={node.id} className="vsn-related-articles" style={style}><h2 className="vsn-related-articles-heading">{content.heading||"Related articles"}</h2><div className="vsn-related-articles-grid"><article className="vsn-article-card"><h3 className="vsn-article-card-title">Related article</h3><p className="vsn-article-card-excerpt">Article excerpt</p></article></div></section>;

		case "collection-title": {
			const Tag =
				content.tag || "h1";

			return (
				<Tag
					data-vsn-id={node.id}
					style={{
						margin: 0,

						color:
							style.color ||
							style.textColor ||
							"#1a1a1a",

						fontSize: getSize(
							style.fontSize,
							"42px",
						),

						fontWeight:
							style.fontWeight || 700,

						fontFamily:
							style.fontFamily,

						fontStyle:
							style.fontStyle ||
							"normal",

						lineHeight: getSize(
							style.lineHeight,
							"1.2",
						),

						letterSpacing: getSize(
							style.letterSpacing,
							"0px",
						),

						textAlign:
							style.textAlign ||
							"left",

						textTransform:
							style.textTransform ||
							"none",

						marginTop:
							style.marginTop,

						marginRight:
							style.marginRight,

						marginBottom:
							style.marginBottom,

						marginLeft:
							style.marginLeft,

						paddingTop:
							style.paddingTop,

						paddingRight:
							style.paddingRight,

						paddingBottom:
							style.paddingBottom,

						paddingLeft:
							style.paddingLeft,
					}}
				>
					{previewCollection?.title ||
						content.fallbackText ||
						"Summer Collection"}
				</Tag>
			);
		}

		case "text":
		case "paragraph":
			return (
				<div
					data-vsn-id={node.id}
					style={{
						margin: getSpacing(style.margin),
						padding: getSpacing(style.padding),
						color:
							style.color ||
							style.textColor ||
							"#4a4a4a",
						fontSize: getSize(
							style.fontSize,
							"16px",
						),
						fontWeight:
							style.fontWeight || 400,
						fontFamily:
							style.fontFamily,
						fontStyle:
							style.fontStyle || "normal",
						letterSpacing: getSize(
							style.letterSpacing,
							"0px",
						),
						lineHeight: getSize(
							style.lineHeight,
							"1.6",
						),
						textAlign:
							style.textAlign || "left",
						whiteSpace: "pre-wrap",
					}}
				>
					{content.text ||
						content.content ||
						settings.text ||
						""}
				</div>
			);

		case "collection-description":
			return (
				<div
					data-vsn-id={node.id}
					style={{
						margin: 0,

						color:
							style.color ||
							style.textColor ||
							"#4a4a4a",

						fontSize: getSize(
							style.fontSize,
							"16px",
						),

						fontWeight:
							style.fontWeight ||
							400,

						fontFamily:
							style.fontFamily,

						lineHeight: getSize(
							style.lineHeight,
							"1.6",
						),

						letterSpacing: getSize(
							style.letterSpacing,
							"0px",
						),

						textAlign:
							style.textAlign ||
							"left",

						whiteSpace: "pre-wrap",

						marginTop:
							style.marginTop,

						marginRight:
							style.marginRight,

						marginBottom:
							style.marginBottom,

						marginLeft:
							style.marginLeft,

						paddingTop:
							style.paddingTop,

						paddingRight:
							style.paddingRight,

						paddingBottom:
							style.paddingBottom,

						paddingLeft:
							style.paddingLeft,
					}}
				>
					{previewCollection?.description ||
						content.fallbackText ||
						"Collection description"}
				</div>
			);
		case "collection-product-count": {
			const count =
				Number(
					previewCollection
						?.productsCount
						?.count ?? 0,
				);

			const singularText =
				content.singularText || "product";

			const pluralText =
				content.pluralText || "products";

			const label =
				count === 1
					? singularText
					: pluralText;

			return (
				<div
					data-vsn-id={node.id}
					style={{
						...style,
						margin: 0,
					}}
				>
					{content.prefix || ""}
					{count} {label}
				</div>
			);
		}
		case "collection-product-grid": {
			const products = Array.isArray(previewCollection?.products?.nodes)
				? previewCollection.products.nodes
				: [];
			const limit = Math.max(1, Math.min(24, Number(content.limit || 8)));
			const placeholderCount = Math.min(limit, Math.max(1, Number(content.columnsDesktop || content.columns || 4)));
			const items = products.length ? products.slice(0, limit) : Array.from({ length: placeholderCount }, (_, index) => ({
				id: `placeholder-${index}`,
				title: `Product ${index + 1}`,
				featuredImage: null,
				priceRangeV2: { minVariantPrice: { amount: "0.00", currencyCode: "USD" } },
				compareAtPriceRange: { minVariantCompareAtPrice: null },
			}));
			const columns = Math.max(1, Math.min(6, Number(content.columnsDesktop || content.columns || 4)));
			const card = rawStyles?.card || {};
			const image = rawStyles?.image || {};
			const titleTypography = rawStyles?.titleTypography || {};
			const priceTypography = rawStyles?.priceTypography || {};
			const comparePriceTypography = rawStyles?.comparePriceTypography || {};
			const loadMoreButton = rawStyles?.loadMoreButton || {};
			const imageRatio = {
				square: "1 / 1",
				portrait: "4 / 5",
				landscape: "4 / 3",
				wide: "16 / 9",
				natural: "auto",
			}[content.imageRatio || "square"] || "1 / 1";
			const loadMoreAlign = content.loadMoreAlignment === "left"
				? "flex-start"
				: content.loadMoreAlignment === "right"
					? "flex-end"
					: "center";

			return (
				<>
					<div
						data-vsn-id={node.id}
						className="vsn-collection-product-grid"
						style={{
							...style,
							display: "grid",
							gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
							gap: getSize(rawStyles?.grid?.gap, "24px"),
							width: "100%",
						}}
					>
						{items.map((product, index) => {
							const price = formatProductMoney(product?.priceRangeV2?.minVariantPrice, "$0.00");
							const compare = formatProductMoney(product?.compareAtPriceRange?.minVariantCompareAtPrice, "");
							return (
								<article
									key={product?.id || index}
									className="vsn-product-card"
									style={{
										backgroundColor: card.backgroundColor || "#ffffff",
										border: `${getSize(card.borderWidth, "1px")} solid ${card.borderColor || "#e5e5e5"}`,
										borderRadius: getSize(card.borderRadius, "12px"),
										padding: getSize(card.padding, "12px"),
										overflow: "hidden",
									}}
								>
									{content.showImage === false ? null : product?.featuredImage?.url ? (
										<img
											src={product.featuredImage.url}
											alt={product.featuredImage.altText || product.title || ""}
											style={{
												display: "block",
												width: "100%",
												aspectRatio: imageRatio === "auto" ? undefined : imageRatio,
												height: imageRatio === "auto" ? "auto" : undefined,
												objectFit: image.objectFit || "cover",
												borderRadius: getSize(image.borderRadius, "8px"),
											}}
										/>
									) : (
										<div style={{ aspectRatio: imageRatio === "auto" ? "1 / 1" : imageRatio, background: "#f3f3f3", borderRadius: getSize(image.borderRadius, "8px") }} />
									)}

									{content.showTitle === false ? null : (
										<strong
											className="vsn-product-card-title vsn-card-title"
											style={{
												display: "block",
												marginTop: "12px",
												fontSize: getSize(titleTypography.fontSize, "16px"),
												fontWeight: titleTypography.fontWeight || "600",
												color: titleTypography.color || "#1a1a1a",
												lineHeight: titleTypography.lineHeight || "1.4",
												textAlign: titleTypography.textAlign || "left",
											}}
										>
											{product?.title || "Product"}
										</strong>
									)}

									{content.showPrice === false ? null : (
										<div className="vsn-product-price-row vsn-card-price-row" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
											<span
												className="vsn-product-card-price vsn-card-price"
												style={{
													fontSize: getSize(priceTypography.fontSize, "15px"),
													fontWeight: priceTypography.fontWeight || "600",
													color: priceTypography.color || "#1a1a1a",
													lineHeight: priceTypography.lineHeight || "1.4",
													textAlign: priceTypography.textAlign || "left",
												}}
											>
												{price}
											</span>
											{content.showCompareAtPrice === false || !compare ? null : (
												<span
													className="vsn-product-card-compare-price vsn-card-compare-price"
													style={{
														fontSize: getSize(comparePriceTypography.fontSize, "14px"),
														fontWeight: comparePriceTypography.fontWeight || "400",
														color: comparePriceTypography.color || "#777777",
														lineHeight: comparePriceTypography.lineHeight || "1.4",
														textAlign: comparePriceTypography.textAlign || "left",
														textDecoration: "line-through",
														opacity: 0.55,
													}}
												>
													{compare}
												</span>
											)}
										</div>
									)}
								</article>
							);
						})}
					</div>

					{content.loadMoreEnabled !== false && (
						<div
							className="vsn-load-more-wrap"
							style={{
								display: "flex",
								justifyContent: loadMoreAlign,
								width: "100%",
								marginTop: getSize(loadMoreButton.marginTop, "24px"),
							}}
						>
							<button
								type="button"
								className="vsn-load-more-button"
								onClick={(event) => event.preventDefault()}
								style={{
									appearance: "none",
									backgroundColor: loadMoreButton.backgroundColor || "#1a1a1a",
									color: loadMoreButton.color || "#ffffff",
									borderStyle: "solid",
									borderColor: loadMoreButton.borderColor || "#1a1a1a",
									borderWidth: getSize(loadMoreButton.borderWidth, "0px"),
									borderRadius: getSize(loadMoreButton.borderRadius, "8px"),
									padding: `${getSize(loadMoreButton.paddingY, "12px")} ${getSize(loadMoreButton.paddingX, "22px")}`,
									fontSize: getSize(loadMoreButton.fontSize, "14px"),
									fontWeight: loadMoreButton.fontWeight || "600",
									lineHeight: "1.2",
									cursor: "default",
								}}
							>
								{content.loadMoreText || "Load More"}
							</button>
						</div>
					)}
				</>
			);
		}

		case "product-title": {
			const Tag = content.tag || "h1";
			return <Tag data-vsn-id={node.id} style={style}>{previewProduct?.title || content.fallbackText || "Product Title"}</Tag>;
		}

		case "product-image": {
			const source = previewProduct?.featuredImage?.url || content.fallbackSrc || "/vsn-stock/fashion.svg";
			return <img data-vsn-id={node.id} src={source} alt={previewProduct?.featuredImage?.altText || previewProduct?.title || content.alt || "Product image"} style={{ ...style, display: "block", width: getSize(style.width, "100%"), height: getSize(style.height, "auto"), objectFit: style.objectFit || "cover" }} />;
		}

		case "product-gallery": {
			const images = previewProduct?.images?.nodes || [];
			const main = previewProduct?.featuredImage || images[0];
			return <div data-vsn-id={node.id} style={style}><img src={main?.url || "/vsn-stock/fashion.svg"} alt={main?.altText || previewProduct?.title || "Product"} style={{display:"block",width:"100%",height:getSize(style.height,"560px"),objectFit:style.objectFit || "cover",borderRadius:getSize(style.borderRadius,"12px")}} />{content.showThumbnails !== false && <div style={{display:"flex",gap:Number(content.thumbnailGap || 10),marginTop:12,flexWrap:"wrap"}}>{images.slice(0,8).map((image,imageIndex)=><img key={`${image.url||"image"}-${imageIndex}`} src={image.url} alt={image.altText || ""} style={{width:Number(content.thumbnailSize || 76),height:Number(content.thumbnailSize || 76),objectFit:"cover",borderRadius:8,border:"1px solid #ddd"}} />)}</div>}</div>;
		}

		case "product-price": {
			const value = formatProductMoney(previewProduct?.priceRangeV2?.minVariantPrice, formatProductMoney(previewProduct?.variants?.nodes?.[0]?.price, "$0.00"));
			return <div data-vsn-id={node.id} style={style}>{content.prefix || ""}{value}</div>;
		}

		case "product-compare-price": {
			const value = formatProductMoney(previewProduct?.compareAtPriceRange?.minVariantCompareAtPrice, formatProductMoney(previewProduct?.variants?.nodes?.[0]?.compareAtPrice, ""));
			return value ? <div data-vsn-id={node.id} style={{ ...style, textDecoration: "line-through" }}>{content.prefix || ""}{value}</div> : null;
		}

		case "product-description":
			return <div data-vsn-id={node.id} style={{ ...style, whiteSpace: "pre-wrap" }}>{previewProduct?.description || content.fallbackText || "Product description"}</div>;

		case "product-vendor":
			return <div data-vsn-id={node.id} style={style}>{content.prefix ?? "Vendor: "}{previewProduct?.vendor || "Vendor"}</div>;

		case "product-sku":
			return <div data-vsn-id={node.id} style={style}>{content.prefix ?? "SKU: "}{previewProduct?.variants?.nodes?.[0]?.sku || "—"}</div>;

		case "product-availability": {
			const available = previewProduct?.variants?.nodes?.some((variant) => variant.availableForSale) ?? true;
			return <div data-vsn-id={node.id} className="vsn-product-availability" data-vsn-stock-state={available ? "in-stock" : "sold-out"} style={style}>{available ? (content.inStockText || "In stock") : (content.soldOutText || "Sold out")}</div>;
		}

		case "product-variant-selector": {
			const variants = previewProduct?.variants?.nodes || [];
			return <label data-vsn-id={node.id} style={{ display: "grid", gap: "6px", ...style }}>{content.showLabel===false?null:<span>{content.label || "Variant"}</span>}<select defaultValue={variants[0]?.id || ""} style={{ minHeight: `${Number(content.height||44)}px`, border: "1px solid #d9d9d9", borderRadius: `${Number(content.borderRadius||8)}px`, padding: "8px 10px", background: "white" }}>{variants.length ? variants.map((variant) => <option key={variant.id} value={variant.id} disabled={content.disableSoldOut!==false&&variant.availableForSale===false}>{variant.title}{variant.availableForSale===false?" — Sold out":""}</option>) : <option>Default</option>}</select></label>;
		}

		case "product-quantity":
			return <label data-vsn-id={node.id} style={{ display: "grid", gap: "6px", ...style }}>{content.showLabel===false?null:<span>{content.label || "Quantity"}</span>}<input type="number" min={Number(content.min||1)} max={Number(content.max||99)} step={Number(content.step||1)} defaultValue={Number(content.min||1)} style={{ width: `${Number(content.width||110)}px`, minHeight: `${Number(content.height||44)}px`, border: "1px solid #d9d9d9", borderRadius: `${Number(content.borderRadius||8)}px`, padding: "8px 10px" }} /></label>;

		case "product-add-to-cart":
		case "product-buy-now":
			return <button type="button" data-vsn-id={node.id} style={{ ...style, width: content.fullWidth ? "100%" : "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", border: style.border || "none" }}>{content.text || (node.type === "product-buy-now" ? "Buy Now" : "Add to Cart")}</button>;

		case "product-metafield": {
			const field = previewProduct?.metafields?.nodes?.find((item)=>item.namespace === (content.namespace || "custom") && item.key === (content.key || ""));
			return <div data-vsn-id={node.id} style={style}>{content.label ? <strong>{content.label} </strong> : null}{field?.value || content.emptyText || "Metafield value"}</div>;
		}

		case "product-recommendations": {
			return <section data-vsn-id={node.id} style={style}><h2 style={{fontSize:24,marginBottom:16}}>{content.heading || "You may also like"}</h2><div style={{color:"#777"}}>Recommendations load on storefront.</div></section>;
		}

		case "icon":
			return <span data-vsn-id={node.id} style={{ ...style, display: "inline-flex" }}><ContentPolarisIcon name={content.name || "star"} size="base" /></span>;

		case "button":
			return (
				<a
					data-vsn-id={node.id}
					href={
						content.url ||
						content.link ||
						settings.url ||
						"#"
					}
					style={{
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						margin: getSpacing(style.margin),
						padding: getSpacing(
							style.padding,
							12,
						),
						color:
							style.color ||
							style.textColor ||
							"#ffffff",
						backgroundColor:
							style.backgroundColor ||
							"#008060",
						borderRadius: getSize(
							style.borderRadius,
							"8px",
						),
						fontSize: getSize(
							style.fontSize,
							"14px",
						),
						textDecoration: "none",
					}}
				>
					{content.text ||
						content.label ||
						settings.text ||
						"Button"}
				</a>
			);

		case "image": {
			const imageProps = normalizeImageWidgetProps(content || settings || {});
			const media = imageProps.media && typeof imageProps.media === "object" ? imageProps.media : {};
			const originalSource = resolveImageSource(imageProps, rawStyles?.advanced || {});
			const source = buildImageRenderUrl(originalSource, imageProps, media);
			if (!source) return null;

			const renderDimensions = imageResolutionDimensions(imageProps, media);
			const legacyDimensions = rawStyles?.advanced?.imageDimensions || {};
			const dimensionUnit = legacyDimensions.unit === "auto" ? "" : (legacyDimensions.unit || "px");
			const imageNode = (
				<img
					data-vsn-id={node.id}
					src={source}
					alt={imageAltText(imageProps, media)}
					width={renderDimensions.width || undefined}
					height={renderDimensions.height || undefined}
					loading={imageProps.loading}
					fetchPriority={imageProps.fetchPriority}
					decoding="async"
					className="vsn-image-widget"
					style={{
						display: "block",
						width: legacyDimensions.width ? `${legacyDimensions.width}${dimensionUnit}` : getSize(style.width, "100%"),
						height: legacyDimensions.height ? `${legacyDimensions.height}${dimensionUnit}` : getSize(style.height, "auto"),
						objectFit: legacyDimensions.fit || style.objectFit || "cover",
						objectPosition: legacyDimensions.position || style.objectPosition || "center center",
						borderRadius: getSize(style.borderRadius, "0px"),
					}}
				/>
			);
			const href = imageLinkHref(imageProps, originalSource);
			const linkedImage = href ? <a href={href} target={imageProps.openNewTab ? "_blank" : undefined} rel={imageProps.openNewTab ? "noopener noreferrer" : undefined} data-vsn-lightbox={imageProps.lightbox && imageProps.linkType === "media" ? "1" : undefined} onClick={(event) => event.preventDefault()} style={{ display: "inline-block", maxWidth: "100%" }}>{imageNode}</a> : imageNode;
			const caption = imageCaptionText(imageProps, media);
			return caption ? <figure className="vsn-image-figure" style={{ margin: 0 }}>{linkedImage}<figcaption className="vsn-image-caption" style={{ marginTop: 8, fontSize: 13, color: "#6d7175" }}>{caption}</figcaption></figure> : linkedImage;
		}
		case "collection-image": {
			const source =
				previewCollection?.image?.url ||
				content.fallbackSrc ||
				"/vsn-stock/seasonal.svg";

			return (
				<img
					data-vsn-id={node.id}
					src={source}
					alt={
						previewCollection?.image?.altText ||
						previewCollection?.title ||
						content.alt ||
						"Collection preview"
					}
					style={{
						display: "block",

						width: getSize(
							style.width,
							"100%",
						),

						height: getSize(
							style.height,
							"420px",
						),

						objectFit:
							style.objectFit ||
							"cover",

						objectPosition:
							style.objectPosition ||
							"center",

						borderRadius: getSize(
							style.borderRadius,
							"0px",
						),

						marginTop:
							style.marginTop,

						marginRight:
							style.marginRight,

						marginBottom:
							style.marginBottom,

						marginLeft:
							style.marginLeft,

						opacity:
							style.opacity,

						boxShadow:
							style.boxShadow,
					}}
				/>
			);
		}

		case "spacer":
			return (
				<div
					data-vsn-id={node.id}
					style={{
						height: getSize(
							style.height ||
							settings.height,
							"30px",
						),
					}}
				/>
			);

		case "divider":
			return (
				<hr
					data-vsn-id={node.id}
					style={{
						border: 0,
						borderTop: `${getSize(
							style.thickness,
							"1px",
						)} solid ${style.color || "#e3e3e3"
							}`,
						margin: getSpacing(
							style.margin,
							16,
						),
					}}
				/>
			);

		default:
			return children.length > 0 ? (
				<>
					{children.map((child) => (
						<RenderNode
							key={child.id}
							node={child}
							previewCollection={previewCollection}
							previewProduct={previewProduct}
					previewBlog={previewBlog}
					previewArticle={previewArticle}
					previewSearch={previewSearch}
					reusableSections={reusableSections}
						/>
					))}
				</>
			) : null;
	}
}

function RenderNode(props) {
  const templates=useContext(WidgetTemplateContext); const template=templates?.[props.node?.type];
  const base=<RenderNodeCore {...props}/>; if(!template?.enabled||!template?.html)return base;
  try { const descriptor=visualTemplateTreeToDescriptor(parseVisualTemplate(template.html),{props:props.node?.props||{},slot:base,templateKey:props.node.type}); const css=scopeVisualTemplateCss(template.css||"",props.node.type); return <>{css?<style>{css}</style>:null}{renderSdkEditorValue(descriptor,`template-${props.node?.id||props.node?.type}`)}</>; }
  catch(error){reportVsnSdkError("widget.template",props.node?.type||"unknown",error);return base;}
}

export default function PreviewRenderer({
	elements = [],
	previewCollection = null,
	previewProduct = null,
	previewBlog = null,
	previewArticle = null,
	previewSearch = null,
	reusableSections = [],
	componentDefinitions = [],
	globalStyles = {},
	staticPreview = false,
	widgetTemplates = {},
	customWidgetCss = "",
}) {
	const previewRootRef = useRef(null);
	useEffect(() => {
		if (staticPreview) return undefined;
		const root = previewRootRef.current;
		if (!root) return undefined;
		for (const row of collectPreviewMotionEntries(elements, componentDefinitions)) {
			if (!row.id) continue;
			const target = Array.from(root.querySelectorAll("[data-vsn-id]")).find((el)=>el.getAttribute("data-vsn-id")===row.id);
			if (target && row.slot) target.setAttribute("data-vsn-component-slot", row.slot);
			if (target && row.interactions) target.setAttribute("data-vsn-motion", JSON.stringify({schemaVersion:row.interactions.schemaVersion||4,timelines:row.interactions.timelines}));
		}
		return setupInteractionRuntime(root);
	}, [elements, componentDefinitions, staticPreview]);
	return (
		<>
		<style
		dangerouslySetInnerHTML={{
			__html: `${customWidgetCss ? `${customWidgetCss}\n` : ""}.vsn-preview-root h1,.vsn-preview-root h2,.vsn-preview-root h3,.vsn-preview-root h4,.vsn-preview-root h5,.vsn-preview-root h6{font-family:var(--vsn-preview-heading-font,inherit);}\n${buildStyleBundleCss(
				[elements, ...reusableSections.map((section) => Array.isArray(section?.content) ? section.content : [])],
				globalStyles,
				{ includeBase: false, includeResponsive: true, importantResponsive: true },
			).replace(/<\/style/gi, "<\\/style")}`,
		}}
	/>
		<StaticPreviewContext.Provider value={staticPreview}>
		<WidgetTemplateContext.Provider value={widgetTemplates}>
		<ComponentLibraryContext.Provider value={componentDefinitions}>
		<main
			ref={previewRootRef}
			className="w-full vsn-preview-root"
			style={{
				background: globalStyles.backgroundColor || "#ffffff",
				color: globalStyles.textColor || "#1a1a1a",
				fontFamily: globalStyles.fontFamily || "Inter, system-ui, sans-serif",
				"--vsn-preview-heading-font": globalStyles.headingFontFamily || "inherit",
				...globalCssVariables(globalStyles),
				minHeight: "100vh",
			}}
		>
			{staticPreview ? null : <CustomJsRuntime rootRef={previewRootRef} elements={elements} mode="preview" />}
			{elements.map((element) => (
				<RenderNode
					key={element.id}
					node={element}
					previewCollection={previewCollection}
					previewProduct={previewProduct}
					previewBlog={previewBlog}
					previewArticle={previewArticle}
					previewSearch={previewSearch}
					reusableSections={reusableSections}
				/>
			))}
		</main>
		</ComponentLibraryContext.Provider>
		</WidgetTemplateContext.Provider>
		</StaticPreviewContext.Provider>
		</>
	);
}