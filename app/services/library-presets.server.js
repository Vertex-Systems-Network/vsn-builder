import { SECTION_PRESETS } from "../data/sectionPresets";
import {
  INITIAL_CANVAS_ELEMENTS,
  PRODUCT_TEMPLATE_ELEMENTS,
  SEARCH_TEMPLATE_ELEMENTS,
  BLOG_TEMPLATE_ELEMENTS,
  ARTICLE_TEMPLATE_ELEMENTS,
} from "../data/elements";

function clone(value) { return structuredClone(value); }

function simpleStarter(label, widgetType = "heading") {
  return [{
    id: `starter-${widgetType}`,
    type: "section",
    label,
    props: {},
    styles: { spacing: { paddingTop: "48px", paddingRight: "32px", paddingBottom: "48px", paddingLeft: "32px" } },
    children: [{ id: `starter-${widgetType}-content`, type: widgetType, label, props: widgetType === "heading" ? { text: label } : {}, styles: {}, children: [] }],
  }];
}

export const DEFAULT_PAGE_TEMPLATES = [
  { id: "starter-page", title: "Starter Page", templateType: "page", content: INITIAL_CANVAS_ELEMENTS },
  { id: "starter-wishlist", title: "Wishlist Page", templateType: "page", content: [
    { id:"starter-wishlist-section", type:"section", label:"Wishlist", props:{}, styles:{spacing:{paddingTop:"56px",paddingRight:"32px",paddingBottom:"72px",paddingLeft:"32px"}}, children:[
      { id:"starter-wishlist-heading", type:"heading", label:"Wishlist Heading", props:{text:"My wishlist",tag:"h1"}, styles:{typography:{fontSize:"42px",fontWeight:"700"},spacing:{marginBottom:"10px"}}, children:[] },
      { id:"starter-wishlist-count", type:"wishlist-count", label:"Wishlist Count", props:{prefix:"",suffix:" saved",emptyText:"0",ariaLabel:"Wishlist items"}, styles:{spacing:{marginBottom:"28px"}}, children:[] },
      { id:"starter-wishlist-grid", type:"wishlist-grid", label:"Wishlist Grid", props:{limit:24,columnsDesktop:4,columnsTablet:2,columnsMobile:1,showImage:true,showTitle:true,showPrice:true,showRemove:true,imageRatio:"1 / 1",removeText:"Remove",soldOutText:"Sold out"}, styles:{}, children:[] },
      { id:"starter-wishlist-empty", type:"wishlist-empty-state", label:"Wishlist Empty State", props:{heading:"Your wishlist is empty",body:"Save products you love and come back to them anytime.",showButton:true,buttonText:"Continue shopping",buttonUrl:"/collections/all"}, styles:{}, children:[] },
    ] },
  ] },
  { id: "starter-index", title: "Starter Home Page", templateType: "index", content: INITIAL_CANVAS_ELEMENTS },
  { id: "starter-collection", title: "Starter Collection", templateType: "collection", content: [
    { id:"starter-collection-section", type:"section", label:"Collection", props:{}, styles:{spacing:{paddingTop:"48px",paddingRight:"40px",paddingBottom:"64px",paddingLeft:"40px"}}, children:[
      { id:"starter-collection-title", type:"collection-title", label:"Collection Title", props:{tag:"h1"}, styles:{typography:{fontSize:"42px",fontWeight:"700"}}, children:[] },
      { id:"starter-collection-description", type:"collection-description", label:"Collection Description", props:{}, styles:{spacing:{marginTop:"10px",marginBottom:"28px"}}, children:[] },
      { id:"starter-collection-grid", type:"collection-product-grid", label:"Collection Product Grid", props:{columnsDesktop:4,columnsTablet:2,columnsMobile:1,limit:12}, styles:{grid:{gap:"24px"}}, children:[] },
    ] },
  ] },
  { id: "starter-product", title: "Starter Product", templateType: "product", content: PRODUCT_TEMPLATE_ELEMENTS },
  { id: "starter-search", title: "Starter Search", templateType: "search", content: SEARCH_TEMPLATE_ELEMENTS },
  { id: "starter-blog", title: "Starter Blog", templateType: "blog", content: BLOG_TEMPLATE_ELEMENTS },
  { id: "starter-article", title: "Starter Article", templateType: "article", content: ARTICLE_TEMPLATE_ELEMENTS },
  { id: "starter-header", title: "Starter Header", templateType: "header", content: [{ id:"starter-header-wrap", type:"section", label:"Header", props:{}, styles:{spacing:{paddingTop:"18px",paddingRight:"28px",paddingBottom:"18px",paddingLeft:"28px"}}, children:[{id:"starter-header-nav",type:"navigation-menu",label:"Navigation",props:{},styles:{},children:[]}]}] },
  { id: "starter-footer", title: "Starter Footer", templateType: "footer", content: [{ id:"starter-footer-wrap", type:"section", label:"Footer", props:{}, styles:{spacing:{paddingTop:"36px",paddingRight:"28px",paddingBottom:"36px",paddingLeft:"28px"}}, children:[{id:"starter-footer-text",type:"text",label:"Footer Text",props:{text:"© Your store"},styles:{},children:[]}]}] },
  { id: "starter-section", title: "Starter Reusable Section", templateType: "section", content: simpleStarter("Reusable Section") },
  { id: "starter-cart", title: "Starter Cart", templateType: "cart", content: simpleStarter("Cart", "cart-drawer") },
  { id: "starter-404", title: "Starter 404", templateType: "404", content: simpleStarter("Page not found") },
  { id: "starter-password", title: "Starter Password Page", templateType: "password", content: simpleStarter("Coming soon") },
  { id: "starter-customer-account", title: "Starter Customer Account", templateType: "customer-account", content: simpleStarter("Customer Account", "customer-name") },
  { id: "starter-customer-login", title: "Starter Customer Login", templateType: "customer-login", content: simpleStarter("Customer Login", "customer-login") },
  { id: "starter-customer-register", title: "Starter Customer Register", templateType: "customer-register", content: simpleStarter("Create Account") },
  { id: "starter-customer-order", title: "Starter Customer Order", templateType: "customer-order", content: simpleStarter("Order Details", "customer-orders-link") },
  { id: "starter-customer-addresses", title: "Starter Customer Addresses", templateType: "customer-addresses", content: simpleStarter("Addresses", "customer-addresses-link") },
  { id: "starter-popup", title: "Starter Popup", templateType: "popup", content: [{ id:"starter-popup-section", type:"section", label:"Popup", props:{}, styles:{spacing:{paddingTop:"36px",paddingRight:"32px",paddingBottom:"36px",paddingLeft:"32px"}}, children:[{id:"starter-popup-title",type:"heading",label:"Offer title",props:{text:"A timely offer",tag:"h2"},styles:{typography:{fontSize:"34px",fontWeight:"700"}},children:[]},{id:"starter-popup-text",type:"text",label:"Offer text",props:{text:"Use this popup for a focused campaign message."},styles:{spacing:{marginTop:"10px",marginBottom:"18px"}},children:[]},{id:"starter-popup-button",type:"button",label:"CTA",props:{text:"Shop now",url:"/collections/all"},styles:{},children:[]}]}] },
  { id: "starter-modal", title: "Starter Modal", templateType: "modal", content: simpleStarter("Modal campaign") },
  { id: "starter-drawer", title: "Starter Drawer", templateType: "drawer", content: simpleStarter("Drawer campaign") },
  { id: "starter-flyout", title: "Starter Flyout", templateType: "flyout", content: simpleStarter("Flyout campaign") },
  { id: "starter-announcement-overlay", title: "Starter Announcement Overlay", templateType: "announcement-overlay", content: simpleStarter("Limited-time announcement") },
  { id: "popup-newsletter", title: "Newsletter Popup", templateType: "popup", content: [{ id:"popup-newsletter-wrap",type:"section",label:"Newsletter Popup",props:{},styles:{spacing:{paddingTop:"40px",paddingRight:"36px",paddingBottom:"40px",paddingLeft:"36px"}},children:[{id:"popup-newsletter-title",type:"heading",label:"Heading",props:{text:"Join our list",tag:"h2"},styles:{typography:{fontSize:"32px",fontWeight:"700"}},children:[]},{id:"popup-newsletter-copy",type:"text",label:"Copy",props:{text:"Get product updates, launches and offers in your inbox."},styles:{spacing:{marginTop:"10px",marginBottom:"18px"}},children:[]},{id:"popup-newsletter-form",type:"newsletter-form",label:"Newsletter form",props:{buttonText:"Subscribe"},styles:{},children:[]}]}] },
  { id: "popup-exit-offer", title: "Exit Offer Popup", templateType: "popup", content: [{ id:"popup-exit-wrap",type:"section",label:"Exit Offer",props:{},styles:{spacing:{paddingTop:"38px",paddingRight:"34px",paddingBottom:"38px",paddingLeft:"34px"}},children:[{id:"popup-exit-title",type:"heading",label:"Heading",props:{text:"Before you go",tag:"h2"},styles:{typography:{fontSize:"34px",fontWeight:"700"}},children:[]},{id:"popup-exit-copy",type:"text",label:"Copy",props:{text:"Use this space for a final incentive or important reminder."},styles:{spacing:{marginTop:"10px",marginBottom:"18px"}},children:[]},{id:"popup-exit-button",type:"button",label:"CTA",props:{text:"View offer",url:"/collections/all"},styles:{},children:[]}]}] },
  { id: "floating-contact", title: "Floating Contact CTA", templateType: "floating-element", content: [{id:"floating-contact-wrap",type:"section",label:"Floating Contact",props:{},styles:{background:{color:"#ffffff"},border:{radius:"14px"},spacing:{paddingTop:"14px",paddingRight:"16px",paddingBottom:"14px",paddingLeft:"16px"},effects:{boxShadow:"0 12px 38px rgba(0,0,0,.18)"}},children:[{id:"floating-contact-copy",type:"text",label:"Message",props:{text:"Need help? We are here."},styles:{},children:[]},{id:"floating-contact-button",type:"button",label:"CTA",props:{text:"Contact us",url:"/pages/contact"},styles:{spacing:{marginTop:"8px"}},children:[]}]}] },
  { id: "floating-promo", title: "Floating Promo Badge", templateType: "floating-element", content: [{id:"floating-promo-wrap",type:"section",label:"Floating Promo",props:{},styles:{background:{color:"#111111"},border:{radius:"999px"},spacing:{paddingTop:"10px",paddingRight:"16px",paddingBottom:"10px",paddingLeft:"16px"}},children:[{id:"floating-promo-text",type:"text",label:"Promo",props:{text:"Free shipping today"},styles:{typography:{color:"#ffffff",fontWeight:"700"}},children:[]}]}] },
];

export function getDefaultMarketplaceCatalogItems() {
  const pages = DEFAULT_PAGE_TEMPLATES.map((preset, index) => ({
    catalogId: `vsn-starter-page:${preset.id}`,
    id: `vsn-starter-page:${preset.id}`,
    version: 1,
    title: preset.title,
    kind: "page",
    templateType: preset.templateType || "page",
    category: "VSN Starter Pages",
    industry: "general",
    industryLabel: "General",
    style: "starter",
    layout: "editable",
    planTier: "free",
    colorTags: ["neutral"],
    previewImage: null,
    description: `Official VSN starter for ${String(preset.templateType || "page").replace(/[-_]+/g, " ")}. Fully editable in the builder.`,
    qualityScore: 92,
    compatibility: { minBuilderVersion: "2.5.57", schemaVersion: 1 },
    screenshot: { viewport: { width: 1440, height: 1000 }, source: "generated-preview" },
    source: "builtin",
    content: clone(preset.content || []),
    sortOrder: index,
  }));
  const sections = SECTION_PRESETS.map((preset, index) => ({
    catalogId: `vsn-starter-section:${preset.id}`,
    id: `vsn-starter-section:${preset.id}`,
    version: 1,
    title: preset.label,
    kind: "section",
    templateType: null,
    category: "VSN Starter Sections",
    industry: "general",
    industryLabel: "General",
    style: "starter",
    layout: String(preset.category || "section"),
    planTier: "free",
    colorTags: ["neutral"],
    previewImage: null,
    description: preset.description || `Official VSN ${String(preset.category || "section").replace(/[-_]+/g, " ")} starter section.`,
    qualityScore: 90,
    compatibility: { minBuilderVersion: "2.5.57", schemaVersion: 1 },
    screenshot: { viewport: { width: 1440, height: 760 }, source: "generated-preview" },
    source: "builtin",
    content: clone(preset.node),
    sortOrder: 1000 + index,
  }));
  return [...pages, ...sections];
}

export async function retireLegacyDefaultLibraryItems(db, shop) {
  // Milestone H separates merchant-owned Saved Library content from VSN supplied catalog content.
  // These rows were generated by older releases and are safe to remove because the source templates
  // now live in the immutable Marketplace catalog.
  const result = await db.builderLibraryItem.deleteMany({
    where: {
      shop,
      OR: [
        { category: "Default Sections" },
        { category: "Default Page Templates" },
      ],
    },
  });
  return result.count || 0;
}

// Backward-compatible names remain because older loaders call these guards. They now migrate legacy
// defaults out of Saved Library instead of recreating them there.
export async function ensureDefaultLibrarySections(db, shop) {
  return retireLegacyDefaultLibraryItems(db, shop);
}

export async function ensureDefaultPageTemplates(db, shop) {
  return retireLegacyDefaultLibraryItems(db, shop);
}

export async function syncDefaultLibrary(db, shop) {
  const legacyRemoved = await retireLegacyDefaultLibraryItems(db, shop);
  const marketplaceDefaults = getDefaultMarketplaceCatalogItems().length;
  return {
    legacyRemoved,
    marketplaceDefaults,
    total: legacyRemoved,
    message: legacyRemoved
      ? `${legacyRemoved} legacy default item(s) moved out of Saved Library. ${marketplaceDefaults} VSN starters are available in Marketplace.`
      : `Saved Library is clean. ${marketplaceDefaults} VSN starters are available in Marketplace.`,
  };
}

export function serializeLibraryItem(item) {
  let content = null;
  try { content = JSON.parse(item.contentJson || "null"); } catch {}
  return {
    ...item,
    content,
    parsedColorTags: (()=>{ try { return JSON.parse(item?.colorTags || "[]"); } catch { return []; } })(),
    parsedLayoutTags: (()=>{ try { return JSON.parse(item?.layoutTags || "[]"); } catch { return []; } })(),
    compatibility: (()=>{ try { return JSON.parse(item?.compatibilityJson || "{}"); } catch { return {}; } })(),
    screenshot: (()=>{ try { return JSON.parse(item?.screenshotJson || "{}"); } catch { return {}; } })(),
    isDefaultLibraryItem: item?.category === "Default Page Templates" || item?.category === "Default Sections",
  };
}
