import { IMAGE_RESOLUTION_OPTIONS, buildImageRenderUrl } from './imageWidget.js';
export { IMAGE_RESOLUTION_OPTIONS };
export function normalizeContextImageProps(value={}){
  const p=value||{};
  return {...p,fallbackMedia:p.fallbackMedia&&typeof p.fallbackMedia==='object'?p.fallbackMedia:{},resolution:p.resolution||'original',customWidth:p.customWidth||'',customHeight:p.customHeight||'',altMode:['context','custom','decorative'].includes(p.altMode)?p.altMode:'context',alt:p.alt||'',loading:p.loading==='eager'?'eager':'lazy',fetchPriority:['auto','high','low'].includes(p.fetchPriority)?p.fetchPriority:'auto',lightbox:p.lightbox===true};
}
export function contextImageSource(contextMedia={},props={}){ return String(contextMedia?.url || props?.fallbackMedia?.url || props?.fallbackSrc || '').trim(); }
export function contextImageUrl(contextMedia={},props={}){ const p=normalizeContextImageProps(props); return buildImageRenderUrl(contextImageSource(contextMedia,p),p,contextMedia?.url?contextMedia:p.fallbackMedia); }
export function contextImageAlt(contextMedia={},props={},fallback=''){ const p=normalizeContextImageProps(props); if(p.altMode==='decorative')return ''; if(p.altMode==='custom')return String(p.alt||''); return String(contextMedia?.altText||contextMedia?.alt||fallback||p.alt||''); }
