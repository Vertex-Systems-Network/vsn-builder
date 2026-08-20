import { DEFAULT_ELEMENT_INTERACTIONS } from './interactionSchema.js';
import { normalizeSliderProps } from './sliderWidget.js';

const uid = (prefix='item') => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2,8)}`}`;

export const NESTED_SLIDER_TYPES = Object.freeze(['carousel','slides','testimonials-carousel']);

export function isNestedSliderType(type='') { return NESTED_SLIDER_TYPES.includes(type); }

export function nestedSliderDefaults(type='carousel') {
  if (type === 'slides') return { slidesDesktop:1, slidesTablet:1, slidesMobile:1, gap:0, edgePadding:0, autoHeight:false, equalHeight:true, centered:false, effect:'slide', speed:500, autoplay:false, autoplayDelay:5000, pauseOnHover:true, pauseOnInteraction:true, stopOnLastSlide:false, loop:false, rewind:true, navigation:true, previousIcon:'‹', nextIcon:'›', pagination:'dots', swipe:true, keyboard:true, direction:'horizontal' };
  if (type === 'testimonials-carousel') return { slidesDesktop:2, slidesTablet:1, slidesMobile:1, gap:18, edgePadding:0, autoHeight:true, equalHeight:true, centered:false, effect:'slide', speed:450, autoplay:false, autoplayDelay:5000, pauseOnHover:true, pauseOnInteraction:true, stopOnLastSlide:false, loop:true, rewind:true, navigation:true, previousIcon:'‹', nextIcon:'›', pagination:'dots', swipe:true, keyboard:true, direction:'horizontal' };
  return { slidesDesktop:3, slidesTablet:2, slidesMobile:1, gap:16, edgePadding:0, autoHeight:true, equalHeight:true, centered:false, effect:'slide', speed:450, autoplay:false, autoplayDelay:4500, pauseOnHover:true, pauseOnInteraction:true, stopOnLastSlide:false, loop:true, rewind:true, navigation:true, previousIcon:'‹', nextIcon:'›', pagination:'dots', swipe:true, keyboard:true, direction:'horizontal' };
}

export function normalizeNestedSliderProps(type='carousel', value={}) {
  const defaults = nestedSliderDefaults(type);
  return normalizeSliderProps({ ...defaults, ...(value || {}) });
}

export function nestedItemNoun(type='carousel') {
  if (type === 'slides') return 'Slide';
  if (type === 'testimonials-carousel') return 'Testimonial';
  return 'Item';
}

function basicWidget(type, label, props, styles={}) {
  return { id:uid(type), type, label, props:{...props}, styles:{...styles}, interactions:structuredClone(DEFAULT_ELEMENT_INTERACTIONS), children:[] };
}

export function createNestedCarouselItem(type='carousel', index=0, { withPreset=false }={}) {
  const noun = nestedItemNoun(type);
  const item = {
    id: uid(type === 'slides' ? 'slide' : 'carousel-item'),
    type: 'container',
    label: `${noun} ${index + 1}`,
    props: { __nestedSliderItem:true, nestedSliderType:type, slideLabel:`${noun} ${index + 1}` },
    styles: {
      spacing: { paddingTop:'20px', paddingRight:'20px', paddingBottom:'20px', paddingLeft:'20px' },
      size: { minHeight: type === 'slides' ? '320px' : '180px' },
    },
    interactions: structuredClone(DEFAULT_ELEMENT_INTERACTIONS),
    children: [],
  };
  if (withPreset && type === 'testimonials-carousel') {
    item.children = [
      basicWidget('text','Quote',{text:'Add customer testimonial here.'},{typography:{fontSize:'17px',lineHeight:'1.6',color:'#333333'}}),
      basicWidget('heading','Customer Name',{text:'Customer Name',tag:'h4'},{typography:{fontSize:'16px',fontWeight:'700',color:'#1a1a1a'}}),
      basicWidget('text','Role / Company',{text:'Role / Company'},{typography:{fontSize:'13px',color:'#6d7175'}}),
    ];
  }
  return item;
}

export function createNestedCarouselItems(type='carousel', count=3) {
  return Array.from({length:Math.max(1,count)}, (_,index)=>createNestedCarouselItem(type,index,{withPreset:type==='testimonials-carousel'}));
}

function cloneNode(node) {
  const next = structuredClone(node || {});
  next.id = uid(next.type || 'el');
  next.children = Array.isArray(next.children) ? next.children.map(cloneNode) : [];
  return next;
}

export function duplicateNestedCarouselItem(item, type='carousel', index=0) {
  const cloned = cloneNode(item);
  const noun = nestedItemNoun(type);
  const source = item?.props?.slideLabel || item?.label || `${noun} ${index+1}`;
  cloned.label = `${source} Copy`;
  cloned.props = { ...(cloned.props||{}), __nestedSliderItem:true, nestedSliderType:type, slideLabel:cloned.label };
  return cloned;
}
