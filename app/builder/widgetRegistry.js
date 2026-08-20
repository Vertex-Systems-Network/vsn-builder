import { DEFAULT_ELEMENT_INTERACTIONS } from "./interactionSchema.js";
import { createSliderSlide } from "./sliderWidget.js";
import { createNestedCarouselItems, isNestedSliderType, nestedSliderDefaults } from "./nestedCarouselWidget.js";
import { createLoopItemTemplate, normalizeQueryDefinition } from "./queryBuilder.js";
import { connectLegacyWidgetRegistry } from "../sdk/registry.js";
import { ensureBuiltinSdkPlugins } from "../sdk/builtinPlugins.js";
/* 
* Widget name
* Widget children accepted or not
* default properties
* default styling
*/
const base = (label, acceptsChildren, props = {}, styles = {}) => ({ label, acceptsChildren, props, styles });

export const widgetRegistry = {
  container: base('Container', true, {}, { spacing: { paddingTop: '40px', paddingRight: '40px', paddingBottom: '40px', paddingLeft: '40px' }, border: { width: '1px', style: 'dashed', color: '#d1d1d1', radius: '12px' } }),
  section: base('Section', true, {}, { spacing: { paddingTop: '60px', paddingRight: '48px', paddingBottom: '60px', paddingLeft: '48px' } }),
  "global-section": base("Reusable Global Section", false, { sectionId: "" }, { spacing: { marginTop: "0px", marginRight: "0px", marginBottom: "0px", marginLeft: "0px" } }),
  "component-instance": base("Component Instance", true, { componentId: "", variantId: "default", propValues: {}, overrides: {}, activeSlot: "content", masterVersion: 0 }, { spacing: { marginTop: "0px", marginRight: "0px", marginBottom: "0px", marginLeft: "0px" } }),
  "navigation-menu": base("Navigation Menu", false, { items: [], itemsText: "Home|/\nShop|/collections/all\nContact|/pages/contact", mobileLabel: "Menu", mobileMenu: true, alignment: "right" }, { typography: { fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }, spacing: { gap: "22px" } }),
  "contact-form": base("Contact Form", false, { heading: "Contact us", submitText: "Send message", successText: "Thanks. Your message has been received.", errorText: "Please check the form and try again.", showPhone: true }, { spacing: { gap: "12px" } }),
  "newsletter-form": base("Newsletter Form", false, { heading: "Join our newsletter", placeholder: "Email address", submitText: "Subscribe", successText: "Thanks for subscribing.", errorText: "Please enter a valid email address." }, { spacing: { gap: "10px" } }),
  "product-inquiry-form": base("Product Inquiry Form", false, { heading: "Product inquiry", submitText: "Send inquiry", successText: "Thanks. Your inquiry has been received.", errorText: "Please check the form and try again.", showPhone: true }, { spacing: { gap: "12px" } }),

  banner: base('Banner', true, {}, { background: { type: 'color', color: '#f6f6f7' }, spacing: { paddingTop: '60px', paddingRight: '48px', paddingBottom: '60px', paddingLeft: '48px' } }),
  heading: base('Heading', false, { text: 'New Heading', tag: 'h2' }, { typography: { fontSize: '32px', fontWeight: '700', color: '#1a1a1a', lineHeight: '1.2' } }),
  text: base('Text', false, { text: 'Add your text content here.' }, { typography: { fontSize: '16px', color: '#4a4a4a', lineHeight: '1.6' } }),
  button: base('Button', false, { text: 'Click me', url: '#', variant: 'primary' }),
  image: base('Image', false, {
    sourceType: 'shopify',
    src: '',
    media: {},
    externalUrl: '',
    resolution: 'original',
    customWidth: '',
    customHeight: '',
    altMode: 'custom',
    alt: 'Image',
    captionMode: 'none',
    caption: '',
    linkType: 'none',
    linkUrl: '',
    openNewTab: false,
    lightbox: false,
    loading: 'lazy',
    fetchPriority: 'auto',
  }, { size: { width: '100%', height: 'auto' }, objectFit: 'cover' }),
  icon: base('Icon', false, { name: 'star' }, { typography: { fontSize: '24px', color: '#1a1a1a' }, spacing: { marginRight: '8px' } }),
  divider: base('Divider', false),
  spacer: base('Spacer', false, { height: '60px' }),
  video: base('Video', false, { sourceType: 'auto', url: '', videoMedia: {}, startTime: 0, endTime: 0, autoplay: false, muted: false, loop: false, controls: true, playsInline: true, defaultVolume: 100, preload: 'metadata', lazyLoad: true, posterEnabled: false, poster: {}, showPlayIcon: true, playIcon: { source: 'library', name: 'play', polarisType: 'play' }, playIconSize: 64 }),
  columns: base('Columns', true, { columns: 2 }),
  slider: base('Slider', true, { direction: 'horizontal', slidesDesktop: 1, slidesTablet: 1, slidesMobile: 1, gap: 16, edgePadding: 0, autoHeight: true, equalHeight: false, centered: false, effect: 'slide', speed: 450, autoplay: false, autoplayDelay: 4500, pauseOnHover: true, pauseOnInteraction: true, stopOnLastSlide: false, loop: false, rewind: true, navigation: true, previousIcon: '‹', nextIcon: '›', pagination: 'dots', swipe: true, keyboard: true }),
  loop: base('Loop / Query', true, { query: normalizeQueryDefinition({ source: 'products', limit: 8 }), columnsDesktop: 4, columnsTablet: 2, columnsMobile: 1, gap: 20 }, { spacing: { paddingTop: '24px', paddingRight: '0px', paddingBottom: '24px', paddingLeft: '0px' } }),
  'product-grid': base('Product Grid', false, { title: 'Products', source: 'all-products', query: '', sortBy: 'featured', limit: 12, columns: 4, columnsDesktop: 4, columnsTablet: 2, columnsMobile: 1, gap: 18, showImage: true, showTitle: true, showPrice: true, showVendor: false, imageRatio: 'square', emptyText: 'No products found.' }, { spacing: { paddingTop: '48px', paddingRight: '48px', paddingBottom: '48px', paddingLeft: '48px' } }),
  "collection-product-grid": base(
    "Collection Product Grid",
    false,
    {
      limit: 8,
      sortBy: "featured",

      filtersEnabled: true,
      filterAvailabilityEnabled: true,
      filterPriceEnabled: true,
      filterVendorEnabled: true,
      filterProductTypeEnabled: true,
      filterLabel: "Filter products",
      clearFiltersText: "Clear filters",

      columnsDesktop: 4,
      columnsTablet: 2,
      columnsMobile: 1,

      showImage: true,
      showTitle: true,
      showPrice: true,
      showCompareAtPrice: true,

      imageRatio: "square",
      emptyText:
        "No products found in this collection.",

      loadMoreEnabled: true,
      loadMoreText: "Load More",
      loadMoreLoadingText: "Loading...",
      loadMoreAlignment: "center",
    },
    {
      spacing: {
        paddingTop: "0px",
        paddingRight: "0px",
        paddingBottom: "0px",
        paddingLeft: "0px",
        marginTop: "24px",
        marginRight: "0px",
        marginBottom: "24px",
        marginLeft: "0px",
      },

      grid: {
        gap: "24px",
      },

      card: {
        backgroundColor: "#ffffff",
        borderRadius: "12px",
        borderWidth: "1px",
        borderColor: "#e5e5e5",
        padding: "12px",
      },

      image: {
        borderRadius: "8px",
        objectFit: "cover",
      },

      titleTypography: {
        fontSize: "16px",
        fontWeight: "600",
        color: "#1a1a1a",
        lineHeight: "1.4",
        textAlign: "left",
      },

      priceTypography: {
        fontSize: "15px",
        fontWeight: "600",
        color: "#1a1a1a",
        lineHeight: "1.4",
      },

      comparePriceTypography: {
        fontSize: "14px",
        fontWeight: "400",
        color: "#777777",
        lineHeight: "1.4",
      },

      loadMoreButton: {
        backgroundColor: "#1a1a1a",
        color: "#ffffff",
        borderColor: "#1a1a1a",
        borderWidth: "0px",
        borderRadius: "8px",
        paddingY: "12px",
        paddingX: "22px",
        fontSize: "14px",
        fontWeight: "600",
        marginTop: "24px",
      },
    },
  ),
  'product-card': base('Product Card', false, { source: 'all-products', query: '', sortBy: 'featured', limit: 1, columnsDesktop: 1, columnsTablet: 1, columnsMobile: 1, gap: 0, showImage: true, showTitle: true, showPrice: true, showVendor: false, imageRatio: 'square', emptyText: 'No product found.' }),
  'collection-grid': base('Collection Grid', false, { query: '', sortBy: 'featured', limit: 12, columns: 3, columnsDesktop: 3, columnsTablet: 2, columnsMobile: 1, gap: 18, showImage: true, showTitle: true, showCount: true, imageRatio: 'landscape', emptyText: 'No collections found.' }),
  'collection-title': base(
    'Collection Title',
    false,
    {
      fallbackText: 'Collection Title',
      tag: 'h1',
    },
    {
      typography: {
        fontSize: '42px',
        fontWeight: '700',
        color: '#1a1a1a',
        lineHeight: '1.2',
        textAlign: 'left',
      },
    },
  ),

  'collection-description': base(
    'Collection Description',
    false,
    {
      fallbackText:
        'Collection description will appear here.',
    },
    {
      typography: {
        fontSize: '16px',
        fontWeight: '400',
        color: '#4a4a4a',
        lineHeight: '1.6',
        textAlign: 'left',
      },
    },
  ),

  'collection-image': base(
    'Collection Image',
    false,
    {
      fallbackSrc: '', fallbackMedia: {}, resolution: 'original', customWidth: '', customHeight: '', altMode: 'context', alt: 'Collection image', loading: 'lazy', fetchPriority: 'auto', lightbox: false,
    },
    {
      size: {
        width: '100%',
        height: '420px',
      },
      border: {
        radius: '12px',
      },
      objectFit: 'cover',
    },
  ),
  "collection-product-count": base(
    "Collection Product Count",
    false,
    {
      prefix: "",
      singularText: "product",
      pluralText: "products",
    },
    {
      typography: {
        fontSize: "16px",
        fontWeight: "400",
        color: "#666666",
        lineHeight: "1.4",
        textAlign: "left",
      },
    },
  ),
  "product-title": base(
    "Product Title",
    false,
    { fallbackText: "Product Title", tag: "h1" },
    { typography: { fontSize: "42px", fontWeight: "700", color: "#1a1a1a", lineHeight: "1.2", textAlign: "left" } },
  ),
  "product-image": base(
    "Product Image",
    false,
    { fallbackSrc: "", fallbackMedia: {}, resolution: "original", customWidth: "", customHeight: "", altMode: "context", alt: "Product image", loading: "lazy", fetchPriority: "auto", lightbox: false },
    { size: { width: "100%", height: "560px" }, border: { radius: "12px" }, objectFit: "cover" },
  ),
  "product-gallery": base(
    "Product Gallery",
    false,
    { thumbnailPosition: "bottom", showThumbnails: true, thumbnailSize: 76, thumbnailGap: 10, resolution: "original", customWidth: "", customHeight: "", thumbnailResolution: "320", lightbox: true, loading: "lazy", fetchPriority: "auto" },
    { size: { width: "100%", height: "560px" }, border: { radius: "12px" }, objectFit: "cover" },
  ),
  "product-price": base(
    "Product Price",
    false,
    { prefix: "" },
    { typography: { fontSize: "24px", fontWeight: "700", color: "#1a1a1a", lineHeight: "1.3" } },
  ),
  "product-compare-price": base(
    "Compare Price",
    false,
    { prefix: "" },
    { typography: { fontSize: "18px", fontWeight: "400", color: "#777777", lineHeight: "1.3", textDecoration: "line-through" } },
  ),
  "product-description": base(
    "Product Description",
    false,
    { fallbackText: "Product description will appear here." },
    { typography: { fontSize: "16px", fontWeight: "400", color: "#4a4a4a", lineHeight: "1.6" } },
  ),
  "product-vendor": base("Product Vendor", false, { prefix: "Vendor: " }, { typography: { fontSize: "14px", color: "#666666" } }),
  "product-sku": base("Product SKU", false, { prefix: "SKU: " }, { typography: { fontSize: "14px", color: "#666666" } }),
  "product-availability": base("Availability", false, { inStockText: "In stock", soldOutText: "Sold out" }, { typography: { fontSize: "14px", fontWeight: "600", color: "#1a1a1a" } }),
  "product-variant-selector": base("Variant Selector", false, { label: "Variant", showLabel: true, height: 44, borderRadius: 8, disableSoldOut: true }, { spacing: { marginTop: "12px", marginBottom: "12px" } }),
  "product-quantity": base("Quantity", false, { label: "Quantity", showLabel: true, min: 1, max: 99, step: 1, width: 110, height: 44, borderRadius: 8 }, { spacing: { marginTop: "12px", marginBottom: "12px" } }),
  "product-add-to-cart": base("Add to Cart", false, { text: "Add to Cart" }, { typography: { fontSize: "16px", fontWeight: "600", color: "#ffffff" }, background: { type: "color", color: "#1a1a1a" }, border: { radius: "8px" }, spacing: { paddingTop: "14px", paddingRight: "22px", paddingBottom: "14px", paddingLeft: "22px" } }),
  "product-buy-now": base("Buy Now", false, { text: "Buy Now" }, { typography: { fontSize: "16px", fontWeight: "600", color: "#ffffff" }, background: { type: "color", color: "#008060" }, border: { radius: "8px" }, spacing: { paddingTop: "14px", paddingRight: "22px", paddingBottom: "14px", paddingLeft: "22px" } }),
  "product-metafield": base("Product Metafield", false, { namespace: "custom", key: "", label: "", emptyText: "" }, { typography: { fontSize: "14px", color: "#4a4a4a" } }),
  "product-recommendations": base("Product Recommendations", false, { heading: "You may also like", limit: 4, columns: 4, columnsDesktop: 4, columnsTablet: 2, columnsMobile: 1, gap: 18, showImage: true, showTitle: true, showPrice: true, imageRatio: "square", emptyText: "No recommendations found." }, { spacing: { marginTop: "40px" } }),

  // Phase 10: expanded content/widget library
  "breadcrumbs": base("Breadcrumbs", false, { items: [], itemsText: "Home|/\nCatalog|/collections/all\nCurrent page|#", separator: "/", showHome: true }, { typography: { fontSize: "14px", color: "#666666" }, spacing: { gap: "8px" } }),
  "icon-list": base("Icon List", false, { items: [], itemsText: "✓|Fast delivery|#\n✓|Secure checkout|#\n✓|Easy returns|#" }, { typography: { fontSize: "15px", color: "#1a1a1a" }, spacing: { gap: "10px" } }),
  "icon-box": base("Icon Box", false, { icon: "★", heading: "Feature title", text: "Describe this feature or benefit.", url: "#" }, { spacing: { paddingTop: "20px", paddingRight: "20px", paddingBottom: "20px", paddingLeft: "20px" }, border: { width: "1px", style: "solid", color: "#e5e5e5", radius: "12px" } }),
  "image-box": base("Image Box", false, { src: "", media: {}, resolution: "original", customWidth: "", customHeight: "", altMode: "custom", alt: "", heading: "Image box", text: "Add supporting copy here.", url: "#", loading: "lazy", fetchPriority: "auto" }, { border: { radius: "12px" } }),
  "accordion": base("Accordion", false, { items: [], itemsText: "Question one|Answer one\nQuestion two|Answer two\nQuestion three|Answer three", firstOpen: true }, { spacing: { gap: "10px" } }),
  "toggle": base("Toggle", false, { title: "Toggle title", content: "Toggle content", open: false }, {}),
  "carousel": base("Carousel", true, { ...nestedSliderDefaults("carousel") }, {}),
  "slides": base("Slides", true, { ...nestedSliderDefaults("slides"), height: 420 }, {}),
  "testimonials-carousel": base("Testimonials Carousel", true, { ...nestedSliderDefaults("testimonials-carousel") }, {}),
  "social-icons": base("Social Icons", false, { items: [], itemsText: "Instagram|https://instagram.com|IG\nFacebook|https://facebook.com|FB\nLinkedIn|https://linkedin.com|IN", openNew: true }, { spacing: { gap: "10px" } }),
  "map": base("Map", false, { query: "Dubai, UAE", zoom: 14, height: 360 }, {}),
  "progress-bar": base("Progress Bar", false, { label: "Progress", value: 72, showValue: true }, {}),
  "counter": base("Counter", false, { start: 0, end: 100, prefix: "", suffix: "+", duration: 1200 }, { typography: { fontSize: "42px", fontWeight: "700", color: "#1a1a1a" } }),
  "pricing-table": base("Pricing Table", false, { title: "Professional", price: "$99", period: "/ month", featuresText: "Feature one\nFeature two\nFeature three", buttonText: "Choose plan", buttonUrl: "#", featured: false }, {}),
  "timeline": base("Timeline", false, { items: [], itemsText: "2024|Milestone title|Description\n2025|Next milestone|Description\n2026|Current milestone|Description" }, {}),
  "data-table": base("Table", false, { headersText: "Feature|Starter|Pro", rowsText: "Projects|3|Unlimited\nSupport|Email|Priority\nStorage|5 GB|50 GB", striped: true }, {}),
  "menu-anchor": base("Menu Anchor", false, { anchorId: "section-anchor" }, {}),
  "form-builder": base("Form Builder", false, {
      heading: "Contact us",
      formKey: "contact",
      fieldsText: "text|name|Name|Your name|required||1\nemail|email|Email|you@example.com|required||1\ntel|phone|Phone|Phone number|||1\ntextarea|message|Message|How can we help?|required||1\nconsent|consent|I agree to the privacy policy||required||1",
      submitText: "Submit", nextText: "Next", previousText: "Back", successText: "Thanks. Your submission has been received.", errorText: "Please check the form and try again.", multiStep: false, showLabels: true,
      fileMultiple: true, fileAccept: "image/*,.pdf", conditionalRulesText: "", validationRulesText: "", calculationsText: "", prefillQuery: true, prefillCustomer: true, prefillProduct: true, captchaMode: "none", turnstileSiteKey: "", hcaptchaSiteKey: "", recaptchaV3Threshold: 0.5, recaptchaV3Action: "form_submit", successAction: "message", redirectUrl: "", customEventName: "vsn:form-success", couponCode: ""
    }, { spacing: { gap: "12px" }, size: { maxWidth: "680px" } }),

  // Phase 10: additional Shopify commerce widgets
  "product-media": base("Product Media", false, { mode: "gallery", showThumbnails: true, thumbnailPosition: "bottom", thumbnailSize: 76, thumbnailGap: 10, resolution: "original", customWidth: "", customHeight: "", thumbnailResolution: "320", lightbox: true, loading: "lazy", fetchPriority: "auto" }, { size: { width: "100%", height: "560px" }, border: { radius: "12px" }, objectFit: "cover" }),
  "inventory-status": base("Inventory Status", false, { inStockText: "In stock", lowStockText: "Low stock", soldOutText: "Sold out", lowThreshold: 5 }, { typography: { fontSize: "14px", fontWeight: "600", color: "#1a1a1a" } }),
  "collection-filters": base("Collection Filters", false, { showAvailability: true, showPrice: true, showVendor: true, showProductType: true, label: "Filters", clearText: "Clear" }, {}),
  "collection-sorting": base("Collection Sorting", false, { label: "Sort by", defaultSort: "featured" }, {}),
  "collection-pagination": base("Collection Pagination", false, { mode: "load-more", buttonText: "Load more", previousText: "Previous", nextText: "Next" }, {}),
  "cart-drawer": base("Cart Drawer", false, { heading: "Your cart", emptyText: "Your cart is empty", checkoutText: "Checkout", viewCartText: "View cart" }, {}),

  // Search template widgets
  "search-query-title": base("Search Query Title", false, { prefix: "Search results for", emptyText: "Search" }, { typography: { fontSize: "38px", fontWeight: "700", color: "#1a1a1a", lineHeight: "1.2" } }),
  "search-result-count": base("Search Result Count", false, { singularText: "result", pluralText: "results" }, { typography: { fontSize: "15px", color: "#666666" } }),
  "search-results-grid": base("Search Results Grid", false, { limit: 12, columnsDesktop: 4, columnsTablet: 2, columnsMobile: 1, gap: 18, showImage: true, showTitle: true, showType: true, showExcerpt: true, imageRatio: "square", emptyText: "No results found." }, { grid: { gap: "24px" }, card: { backgroundColor: "#ffffff", borderColor: "#e5e5e5", borderWidth: "1px", borderRadius: "12px", padding: "14px" } }),

  // Blog template widgets
  "blog-title": base("Blog Title", false, { fallbackText: "Blog", tag: "h1" }, { typography: { fontSize: "42px", fontWeight: "700", color: "#1a1a1a", lineHeight: "1.2" } }),
  "blog-description": base("Blog Description", false, { fallbackText: "Latest stories and updates." }, { typography: { fontSize: "16px", color: "#4a4a4a", lineHeight: "1.6" } }),
  "blog-article-grid": base("Blog Article Grid", false, { limit: 12, columnsDesktop: 3, columnsTablet: 2, columnsMobile: 1, gap: 18, showImage: true, showTitle: true, showAuthor: true, showDate: true, showExcerpt: true, imageRatio: "landscape", emptyText: "No articles found." }, { grid: { gap: "24px" }, card: { backgroundColor: "#ffffff", borderColor: "#e5e5e5", borderWidth: "1px", borderRadius: "12px", padding: "14px" } }),

  // Article template widgets
  "article-title": base("Article Title", false, { fallbackText: "Article title", tag: "h1" }, { typography: { fontSize: "46px", fontWeight: "700", color: "#1a1a1a", lineHeight: "1.15" } }),
  "article-featured-image": base("Article Featured Image", false, { fallbackSrc: "", fallbackMedia: {}, resolution: "original", customWidth: "", customHeight: "", altMode: "context", alt: "Article featured image", loading: "lazy", fetchPriority: "auto", lightbox: false }, { size: { width: "100%", height: "520px" }, border: { radius: "12px" }, objectFit: "cover" }),
  "article-content": base("Article Content", false, { fallbackText: "Article content will appear here." }, { typography: { fontSize: "17px", color: "#333333", lineHeight: "1.75" } }),
  "article-author": base("Article Author", false, { prefix: "By " }, { typography: { fontSize: "14px", color: "#666666" } }),
  "article-date": base("Article Date", false, { format: "long" }, { typography: { fontSize: "14px", color: "#666666" } }),
  "article-tags": base("Article Tags", false, { prefix: "", separator: " · " }, { typography: { fontSize: "14px", color: "#666666" } }),
  "article-navigation": base("Article Navigation", false, { previousText: "Previous article", nextText: "Next article" }, { spacing: { marginTop: "40px" } }),
  "related-articles": base("Related Articles", false, { heading: "Related articles", limit: 3, columns: 3, columnsDesktop: 3, columnsTablet: 2, columnsMobile: 1, gap: 18, showImage: true, showTitle: true, showDate: true, showExcerpt: true, imageRatio: "landscape", emptyText: "No related articles." }, { spacing: { marginTop: "48px" } }),

  // Prebuilt content / section widgets
  faq: base("FAQ", false, { items: [], itemsText: "Question one?|Answer one.\nQuestion two?|Answer two." }, { spacing: { gap: "10px" } }),
  testimonials: base("Testimonials", false, { items: [], itemsText: "Excellent experience.|Alex\nBeautiful quality.|Jordan", columns: 3 }, { grid: { gap: "18px" } }),
  "logo-cloud": base("Logo Cloud", false, { items: [], itemsText: "Brand One\nBrand Two\nBrand Three\nBrand Four" }, { grid: { gap: "24px" } }),
  stats: base("Stats", false, { items: [], itemsText: "10K+|Customers\n25|Countries\n4.9/5|Rating\n98%|Satisfaction", columns: 4 }, { grid: { gap: "18px" } }),
  "team-grid": base("Team Grid", false, { items: [], itemsText: "Alex Morgan|Founder\nJordan Lee|Creative Director\nSam Patel|Operations", columns: 3 }, { grid: { gap: "18px" } }),
  "gallery-grid": base("Gallery Grid", false, { galleryItems: [], imagesText: "", layout: "grid", columnsDesktop: 4, columnsTablet: 2, columnsMobile: 1, gap: 12, rowGap: 12, imageRatio: "square", customRatioWidth: 1, customRatioHeight: 1, objectFit: "cover", objectPosition: "center center", clickAction: "lightbox", showCaptions: false, openLinksNewTab: false }, { grid: { gap: "12px" }, image: { borderRadius: "10px" } }),
  marquee: base("Marquee", false, { text: "FREE SHIPPING • NEW ARRIVALS • PREMIUM QUALITY • ", speed: 24 }, { typography: { fontSize: "14px", fontWeight: "600", color: "#ffffff" }, background: { type: "color", color: "#111111" }, spacing: { paddingTop: "10px", paddingBottom: "10px" } }),
  tabs: base("Tabs", false, { items: [], itemsText: "Overview|Overview content.\nDetails|Detailed information.\nShipping|Shipping information." }, { spacing: { gap: "10px" } }),

  // Advanced commerce widgets
  "product-tabs": base("Product Tabs", false, { descriptionLabel: "Description", shippingLabel: "Shipping", shippingText: "Shipping information goes here.", returnsLabel: "Returns", returnsText: "Return policy information goes here." }, { spacing: { marginTop: "20px" } }),
  "size-guide": base("Size Guide", false, { buttonText: "Size guide", heading: "Size guide", content: "Add your size guide measurements here." }, { spacing: { marginTop: "10px" } }),
  "shipping-info": base("Shipping Info", false, { heading: "Shipping", text: "Calculated at checkout. Delivery times vary by destination." }, { typography: { fontSize: "14px", color: "#555555" } }),
  "stock-progress": base("Stock Progress", false, { label: "Hurry, low stock", max: 10, fallbackStock: 5 }, { spacing: { marginTop: "12px" } }),
  "trust-badges": base("Trust Badges", false, { items: [], itemsText: "✓|Secure checkout\n↩|Easy returns\n🚚|Fast shipping", columns: 3 }, { grid: { gap: "10px" } }),
  "recently-viewed": base("Recently Viewed", false, { heading: "Recently viewed", limit: 4, columns: 4, columnsDesktop: 4, columnsTablet: 2, columnsMobile: 1, gap: 18, showImage: true, showTitle: true, showPrice: true, imageRatio: "square", emptyText: "No recently viewed products." }, { spacing: { marginTop: "40px" } }),
  "related-collections": base("Related Collections", false, { heading: "Shop related collections", items: [], itemsText: "All products|/collections/all" , columns: 3, columnsDesktop: 3, columnsTablet: 2, columnsMobile: 1, gap: 18, showImage: true, showTitle: true, imageRatio: "landscape" }, { grid: { gap: "18px" } }),
  "upsell-products": base("Upsell Products", false, { heading: "Complete your order", limit: 3, columns: 3, columnsDesktop: 3, columnsTablet: 2, columnsMobile: 1, gap: 18, showImage: true, showTitle: true, showPrice: true, imageRatio: "square", emptyText: "No upsell products." }, { spacing: { marginTop: "24px" } }),
  "sticky-add-to-cart": base("Sticky Add to Cart", false, { text: "Add to cart", showPrice: true }, { background: { type: "color", color: "#ffffff" }, border: { width: "1px", color: "#e5e5e5" } }),

  // Header / navigation widgets
  "announcement-bar": base("Announcement Bar", false, { text: "Free shipping on orders over $75", url: "", dismissible: false }, { typography: { fontSize: "13px", fontWeight: "600", color: "#ffffff", textAlign: "center" }, background: { type: "color", color: "#111111" }, spacing: { paddingTop: "9px", paddingBottom: "9px" } }),
  "mega-menu": base("Mega Menu", false, { label: "Shop", items: [], itemsText: "New arrivals|/collections/all\nBest sellers|/collections/all\nAccessories|/collections/all", featuredTitle: "Featured", featuredUrl: "/collections/all" }, { typography: { fontSize: "14px", fontWeight: "600", color: "#1a1a1a" } }),
  "header-search": base("Header Search", false, { placeholder: "Search products", buttonLabel: "Search" }, {}),
  "cart-icon": base("Cart Icon", false, { label: "Cart", showCount: true }, { typography: { fontSize: "14px", fontWeight: "600", color: "#1a1a1a" } }),
  "account-link": base("Account Link", false, { label: "Account", url: "/account" }, { typography: { fontSize: "14px", fontWeight: "600", color: "#1a1a1a" } }),
  "customer-name": base("Customer Name", false, { prefix: "Hello, ", loggedOutText: "Guest" }, { typography: { fontSize: "14px", fontWeight: "600", color: "#1a1a1a" } }),
  "customer-login": base("Customer Login", false, { label: "Log in", url: "/account/login", hideWhenLoggedIn: true }, { typography: { fontSize: "14px", fontWeight: "600", color: "#1a1a1a" } }),
  "customer-logout": base("Customer Logout", false, { label: "Log out", url: "/account/logout", hideWhenLoggedOut: true }, { typography: { fontSize: "14px", fontWeight: "600", color: "#1a1a1a" } }),
  "customer-orders-link": base("Customer Orders", false, { label: "My orders", url: "/account", hideWhenLoggedOut: true }, { typography: { fontSize: "14px", fontWeight: "600", color: "#1a1a1a" } }),
  "customer-addresses-link": base("Customer Addresses", false, { label: "My addresses", url: "/account/addresses", hideWhenLoggedOut: true }, { typography: { fontSize: "14px", fontWeight: "600", color: "#1a1a1a" } }),
  "localization-switcher": base("Markets / Localization", false, { countryLabel: "Country", languageLabel: "Language", countriesText: "US|United States\nGB|United Kingdom\nCA|Canada\nAU|Australia", languagesText: "en|English\nfr|Français\nde|Deutsch", showCountry: true, showLanguage: true }, { typography: { fontSize: "13px", color: "#1a1a1a" }, spacing: { gap: "8px" } }),

  countdown: base('Countdown', false, { endDate: '', expiredText: 'Offer ended', showDays: true, showHours: true, showMinutes: true, showSeconds: true }),
  html: base('HTML Block', false, { mode: 'html', code: '<div>Your HTML</div>', themeSectionId: '' }),
  liquid: base('Liquid Block', false, { code: '{{ product.title }}' }),
};


function registerSdkWidgetIntoLegacyRegistry(id, definition) {
  if (!id || !definition) return;
  widgetRegistry[id] = { ...definition };
}

connectLegacyWidgetRegistry(registerSdkWidgetIntoLegacyRegistry);
ensureBuiltinSdkPlugins();

export function createWidget(type) {
  const definition = widgetRegistry[type];
  if (!definition) throw new Error(`Unknown widget type: ${type}`);
  return {
    id: `el-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
    type,
    label: definition.label,
    props: structuredClone(definition.props ?? {}),
    styles: structuredClone(definition.styles ?? {}),
    interactions: structuredClone(DEFAULT_ELEMENT_INTERACTIONS),
    children: type === "slider" ? [createSliderSlide(0), createSliderSlide(1), createSliderSlide(2)] : type === "loop" ? [createLoopItemTemplate()] : isNestedSliderType(type) ? createNestedCarouselItems(type, 3) : [],
  };
}

export function acceptsChildren(type) {
  return Boolean(widgetRegistry[type]?.acceptsChildren);
}
