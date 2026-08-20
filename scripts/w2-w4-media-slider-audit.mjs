import fs from "node:fs";
import assert from "node:assert/strict";
import { widgetRegistry, createWidget } from "../app/builder/widgetRegistry.js";
import { normalizeGalleryWidgetProps, galleryAspectRatio, galleryColumnsForDevice } from "../app/builder/galleryWidget.js";
import { detectVideoProvider, normalizeVideoWidgetProps, videoEmbedUrl } from "../app/builder/videoWidget.js";
import { normalizeSliderProps, createSliderSlide, sliderSlidesForDevice } from "../app/builder/sliderWidget.js";

assert.ok(Object.keys(widgetRegistry).length >= 110, "W2-W4 baseline widgets must remain registered");

const gallery = normalizeGalleryWidgetProps({ galleryItems:[{id:"1",url:"/a.jpg",alt:"A"}], layout:"masonry", columnsDesktop:5, columnsTablet:3, columnsMobile:1, imageRatio:"custom", customRatioWidth:3, customRatioHeight:2, clickAction:"lightbox" });
assert.equal(gallery.galleryItems.length,1);
assert.equal(galleryColumnsForDevice(gallery,"desktop"),5);
assert.equal(galleryColumnsForDevice(gallery,"tablet"),3);
assert.equal(galleryColumnsForDevice(gallery,"mobile"),1);
assert.equal(galleryAspectRatio("custom",3,2),"3 / 2");
for (const key of ["galleryItems","layout","columnsDesktop","columnsTablet","columnsMobile","gap","rowGap","imageRatio","objectFit","clickAction"]) assert.ok(Object.hasOwn(widgetRegistry["gallery-grid"].props,key),`Gallery registry missing ${key}`);

assert.equal(detectVideoProvider("https://youtu.be/abcDEF123"),"youtube");
assert.equal(detectVideoProvider("https://vimeo.com/123456"),"vimeo");
assert.equal(detectVideoProvider("https://www.dailymotion.com/video/x12345"),"dailymotion");
assert.equal(detectVideoProvider("https://cdn.example.com/video.mp4"),"direct");
const youtube = normalizeVideoWidgetProps({ sourceType:"auto", url:"https://www.youtube.com/watch?v=abcDEF123", autoplay:true, muted:false, startTime:12, loop:true });
assert.equal(youtube.provider,"youtube");
assert.equal(youtube.muted,true,"Autoplay normalization must keep browser-safe muted playback");
assert.match(videoEmbedUrl(youtube,true),/youtube\.com\/embed\/abcDEF123/);
assert.match(videoEmbedUrl(youtube,true),/autoplay=1/);
for (const key of ["sourceType","videoMedia","startTime","endTime","autoplay","muted","loop","controls","playsInline","defaultVolume","preload","posterEnabled","poster","showPlayIcon","playIcon","playIconSize"]) assert.ok(Object.hasOwn(widgetRegistry.video.props,key),`Video registry missing ${key}`);

const slider = createWidget("slider");
assert.equal(slider.children.length,3,"New Slider must start with three editable slide containers");
assert.ok(slider.children.every((item)=>item.type==="container" && item.props?.__sliderSlide===true),"Slider children must be nested slide containers");
const extra = createSliderSlide(3);
assert.equal(extra.type,"container");
const settings = normalizeSliderProps({slidesDesktop:3,slidesTablet:2,slidesMobile:1,autoplay:true,pagination:"progress",navigation:true});
assert.equal(settings.slidesDesktop,3); assert.equal(settings.pagination,"progress");
assert.equal(sliderSlidesForDevice({effect:"fade",slidesDesktop:4},"desktop"),1,"Fade mode must render one slide at a time");
for (const key of ["direction","slidesDesktop","slidesTablet","slidesMobile","gap","edgePadding","effect","speed","autoplay","autoplayDelay","loop","rewind","navigation","pagination","swipe","keyboard"]) assert.ok(Object.hasOwn(widgetRegistry.slider.props,key),`Slider registry missing ${key}`);

const properties=fs.readFileSync("app/components/editor/PropertiesPanel.jsx","utf8");
for(const label of ["Gallery Images","Desktop columns","Tablet columns","Mobile columns","Image ratio","Click action","Drag to reorder"]) assert.ok(properties.includes(label),`Gallery inspector missing ${label}`);
for(const label of ["Video source","Shopify Video","Start time (sec)","End time (sec)","Default volume","Poster Image","Play Icon","Play icon size"]) assert.ok(properties.includes(label),`Video inspector missing ${label}`);
for(const label of ["Add Slide","Direction","Edge padding","Transition speed","Autoplay delay (ms)","Infinite loop","Navigation arrows","Pagination","Swipe / drag","Keyboard navigation"]) assert.ok(properties.includes(label),`Slider inspector missing ${label}`);

const canvas=fs.readFileSync("app/components/editor/Canvas.jsx","utf8");
const preview=fs.readFileSync("app/components/editor/PreviewRenderer.jsx","utf8");
const storefront=fs.readFileSync("app/routes/builder-proxy.$.jsx","utf8");
const runtime=fs.readFileSync("extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js","utf8");
assert.ok(canvas.includes("GalleryCanvasWidget") && preview.includes("GalleryPreviewWidget") && storefront.includes("normalizeGalleryWidgetProps"),"Gallery must have Canvas/Preview/Storefront render paths");
assert.ok(storefront.includes('data-vsn-lightbox="1"'),"Gallery lightbox must use storefront lightbox runtime");
assert.ok(canvas.includes("VideoCanvasWidget") && preview.includes("VideoPreviewWidget") && storefront.includes("normalizeVideoWidgetProps"),"Video must have Canvas/Preview/Storefront render paths");
assert.ok(storefront.includes("data-vsn-video-src") && runtime.includes("vsnVideoReady"),"External video click-to-play runtime contract missing");
assert.ok(runtime.includes("video.volume = volume") && runtime.includes("video.currentTime >= end"),"Video volume/start/end runtime missing");
assert.ok(canvas.includes("props.playIcon?.glyph") && preview.includes("props.playIcon?.glyph") && storefront.includes("playIconMarkup"), "Selected Video play icon must render across Canvas/Preview/storefront");
assert.ok(canvas.includes("SliderCanvasWidget") && preview.includes("SliderPreviewWidget"),"Slider editor/preview nested renderer missing");
assert.ok(canvas.includes("Drag a widget into this slide"),"Slider Canvas must expose nested widget drop affordance");
assert.ok(storefront.includes('data-vsn-slider="1"') && runtime.includes("vsnSliderReady"),"Slider storefront runtime contract missing");
for (const attr of ["data-vsn-slider-effect", "data-vsn-slider-centered", "data-vsn-slider-auto-height", "data-vsn-slider-equal-height"]) assert.ok(storefront.includes(attr), `Slider storefront missing ${attr}`);
assert.ok(runtime.includes('effect === "fade"') && runtime.includes("syncHeights") && runtime.includes("centeredOffset"), "Slider fade/height/centered runtime settings are not wired");
assert.ok(runtime.includes("pointerdown") && runtime.includes("vsnSliderKeyboard"),"Slider swipe/keyboard runtime missing");

console.log("W2 Gallery media/layout/lightbox contract: PASS");
console.log("W3 Video provider/playback/Shopify media contract: PASS");
console.log("W4 Slider nested slide/runtime contract: PASS");
console.log("W2-W4 audit: PASS");
