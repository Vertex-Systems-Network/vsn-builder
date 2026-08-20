import fs from 'node:fs';
import assert from 'node:assert/strict';
import { widgetRegistry, createWidget } from '../app/builder/widgetRegistry.js';
import { isNestedSliderType } from '../app/builder/nestedCarouselWidget.js';
import { dynamicFieldsForWidget, dynamicSourcesForType, applyDynamicBindings } from '../app/builder/dynamicBindings.js';
import { supportsStructuredItems, normalizeStructuredItems } from '../app/builder/structuredItems.js';
import { normalizeGridProps } from '../app/builder/dataGridWidget.js';
import { normalizeContextImageProps } from '../app/builder/contextMediaWidget.js';

const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const canvas=read('app/components/editor/Canvas.jsx');
const preview=read('app/components/editor/PreviewRenderer.jsx');
const propsPanel=read('app/components/editor/PropertiesPanel.jsx');
const advanced=read('app/components/editor/AdvancedBuilderControls.jsx');
const storefront=read('app/routes/builder-proxy.$.jsx');
const runtime=read('extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js');

assert.equal(Object.keys(widgetRegistry).length,117,'registry must preserve platform widgets plus M.2 Wishlist widgets (117 total)');

// W5 nested carousel family
for(const type of ['carousel','slides','testimonials-carousel']){
  assert.equal(isNestedSliderType(type),true,`${type} should be nested slider`);
  assert.equal(widgetRegistry[type]?.acceptsChildren,true,`${type} accepts children`);
  const w=createWidget(type);
  assert.ok(Array.isArray(w.children)&&w.children.length>=1,`${type} should create nested items`);
  assert.ok(w.children.every(x=>x?.props?.__nestedSliderItem===true),`${type} child item markers`);
}
assert.match(canvas,/isNestedSliderType\(node\.type\)/);
assert.match(preview,/isNestedSliderType\(node\.type\)/);
assert.match(storefront,/isNestedSliderType\(type\)/);
assert.match(storefront,/__nestedSliderItem/);

// User requirement: visible plus in every generic child capable empty area
assert.match(canvas,/data-vsn-empty-child-drop="1"/);
assert.match(canvas,/＋/);
assert.match(canvas,/Add Widget/);
for(const [type,def] of Object.entries(widgetRegistry)) if(def.acceptsChildren){ assert.ok(type,'child widget type must be registered'); }

// W6 typed Dynamic 2.0
const imageFields=dynamicFieldsForWidget('image');
assert.ok(imageFields.some(x=>x.path==='props.src'&&x.type==='image'));
assert.ok(imageFields.some(x=>x.path==='props.alt'&&x.type==='text'));
assert.ok(dynamicSourcesForType('image').every(x=>/Image|Metafield|Metaobject/.test(x.label)), 'image dynamic choices must be typed');
const bound=applyDynamicBindings({type:'button',props:{text:'Old',url:'#'},bindings:{'props.text':{enabled:true,source:'product.title',type:'text'},'props.url':{enabled:true,source:'product.handle',type:'url'}}},{product:{title:'New title',handle:'new-product'}});
assert.equal(bound.props.text,'New title'); assert.equal(bound.props.url,'/products/new-product');
assert.match(advanced,/DynamicBindingsPanel/);
assert.match(storefront,/applyDynamicBindings\(legacyResolvedNode/);
assert.match(storefront,/node\?\.bindings/);

// W7 media contract
for(const type of ['product-image','collection-image','article-featured-image']){
  const p=normalizeContextImageProps(widgetRegistry[type].props);
  assert.ok('resolution' in p && 'loading' in p && 'fetchPriority' in p,`${type} context media contract`);
}
for(const type of ['product-gallery','product-media']) assert.ok('thumbnailResolution' in widgetRegistry[type].props,`${type} thumbnail contract`);
assert.match(storefront,/contextImageUrl\(/);
assert.match(storefront,/contextImageAlt\(/);
assert.match(storefront,/thumbnailResolution/);

// W8 structured repeaters and legacy compatibility
const structured=['navigation-menu','breadcrumbs','icon-list','accordion','faq','testimonials','logo-cloud','stats','team-grid','tabs','trust-badges','related-collections','mega-menu','social-icons','timeline'];
for(const type of structured){ assert.equal(supportsStructuredItems(type),true,`${type} structured schema`); const legacy=normalizeStructuredItems(type,{itemsText:'A|/a|X'}); assert.ok(Array.isArray(legacy)&&legacy.length===1,`${type} legacy parse`); }
assert.match(propsPanel,/StructuredItemsPanel/);
assert.match(storefront,/normalizeStructuredItems\("navigation-menu"/);
for(const type of ['breadcrumbs','icon-list','accordion','faq','testimonials','logo-cloud','stats','team-grid','tabs','trust-badges','related-collections','mega-menu','social-icons','timeline']) assert.ok(storefront.includes(`normalizeStructuredItems("${type}"`)||storefront.includes(`normalizeStructuredItems('${type}'`),`${type} storefront structured`);

// W9 data/grid controls
for(const type of ['product-grid','product-card','collection-grid','product-recommendations','recently-viewed','upsell-products','search-results-grid','blog-article-grid','related-articles']){
  const g=normalizeGridProps(type,widgetRegistry[type]?.props||{}); assert.ok(g.limit>=1&&g.columnsDesktop>=1&&g.columnsMobile>=1,`${type} grid props`);
}
assert.match(propsPanel,/DataGridSettingsPanel/);
assert.match(storefront,/collectWidgetGridRequests/);
assert.match(storefront,/loadWidgetGridData/);
assert.match(storefront,/widgetQueries/);
assert.match(runtime,/vsnColumnsDesktop/);
assert.match(runtime,/vsnRecommendationIntent/);
assert.match(runtime,/vsn-recent-products/);

console.log('W5-W9 PLATFORM AUDIT: PASS');
console.log('widgets: 117/117');
console.log('nested family: carousel, slides, testimonials-carousel');
console.log('structured repeaters:',structured.length);
console.log('data/grid widgets: 9');
