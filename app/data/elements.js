export const ELEMENT_CATEGORIES = [
    { id: 'basic', label: 'Basic' },
    { id: 'layout', label: 'Layout' },
    { id: 'media', label: 'Media' },
    { id: 'content', label: 'Content' },
    { id: 'commerce', label: 'Commerce' },
    { id: 'advanced', label: 'Advanced' },
    { id: 'forms', label: 'Forms' },
];
export const ELEMENTS = [
    // Basic
    { id: 'heading', type: 'heading', label: 'Heading', icon: 'H', category: 'basic' },
    { id: 'text', type: 'text', label: 'Text', icon: 'T', category: 'basic' },
    { id: 'button', type: 'button', label: 'Button', icon: '⬭', category: 'basic' },
    { id: 'icon', type: 'icon', label: 'Icon', icon: '★', category: 'basic' },
    { id: 'divider', type: 'divider', label: 'Divider', icon: '―', category: 'basic' },
    { id: 'spacer', type: 'spacer', label: 'Spacer', icon: '↕', category: 'basic' },
    // Layout
    { id: 'container', type: 'container', label: 'Container', icon: '⬜', category: 'layout' },
    { id: 'columns', type: 'columns', label: 'Columns', icon: '⬚', category: 'layout' },
    { id: 'banner', type: 'banner', label: 'Banner', icon: '▬', category: 'layout' },
    { id: 'section', type: 'section', label: 'Section', icon: '▭', category: 'layout' },
    { id: 'loop', type: 'loop', label: 'Loop / Query', icon: '∞', category: 'layout' },
    // Media
    { id: 'image', type: 'image', label: 'Image', icon: '🖼', category: 'media' },
    { id: 'video', type: 'video', label: 'Video', icon: '▶', category: 'media' },
    { id: 'slider', type: 'slider', label: 'Slider', icon: '⟷', category: 'media' },
    // Expanded content library
    { id: 'breadcrumbs', type: 'breadcrumbs', label: 'Breadcrumbs', icon: 'BR', category: 'content' },
    { id: 'icon-list', type: 'icon-list', label: 'Icon List', icon: 'IL', category: 'content' },
    { id: 'icon-box', type: 'icon-box', label: 'Icon Box', icon: 'IB', category: 'content' },
    { id: 'image-box', type: 'image-box', label: 'Image Box', icon: 'IM', category: 'content' },
    { id: 'accordion', type: 'accordion', label: 'Accordion', icon: 'AC', category: 'content' },
    { id: 'toggle', type: 'toggle', label: 'Toggle', icon: 'TG', category: 'content' },
    { id: 'carousel', type: 'carousel', label: 'Carousel', icon: 'CR', category: 'media' },
    { id: 'slides', type: 'slides', label: 'Slides', icon: 'SL', category: 'media' },
    { id: 'testimonials-carousel', type: 'testimonials-carousel', label: 'Testimonials Carousel', icon: 'TC', category: 'content' },
    { id: 'social-icons', type: 'social-icons', label: 'Social Icons', icon: 'SI', category: 'content' },
    { id: 'map', type: 'map', label: 'Map', icon: 'MP', category: 'media' },
    { id: 'progress-bar', type: 'progress-bar', label: 'Progress Bar', icon: 'PB', category: 'content' },
    { id: 'counter', type: 'counter', label: 'Counter', icon: 'CN', category: 'content' },
    { id: 'pricing-table', type: 'pricing-table', label: 'Pricing Table', icon: 'PR', category: 'content' },
    { id: 'timeline', type: 'timeline', label: 'Timeline', icon: 'TL', category: 'content' },
    { id: 'data-table', type: 'data-table', label: 'Table', icon: 'TB', category: 'content' },
    { id: 'menu-anchor', type: 'menu-anchor', label: 'Menu Anchor', icon: '#', category: 'advanced' },
    { id: 'form-builder', type: 'form-builder', label: 'Form Builder', icon: 'FM', category: 'forms' },

    // Commerce
    { id: 'product-grid', type: 'product-grid', label: 'Product Grid', icon: '⊞', category: 'commerce' },
    { id: 'product-card', type: 'product-card', label: 'Product Card', icon: '🛍', category: 'commerce' },
    { id: 'collection-grid', type: 'collection-grid', label: 'Collection Grid', icon: '◫', category: 'commerce' },
    {
        id: 'collection-title',
        type: 'collection-title',
        label: 'Collection Title',
        icon: 'CT',
        category: 'commerce',
    },
    {
        id: 'collection-description',
        type: 'collection-description',
        label: 'Collection Description',
        icon: 'CD',
        category: 'commerce',
    },
    {
        id: 'collection-image',
        type: 'collection-image',
        label: 'Collection Image',
        icon: 'CI',
        category: 'commerce',
    },
    {
        id: "collection-product-count",
        type: "collection-product-count",
        label: "Collection Product Count",
        icon: "CC",
        category: "commerce",
    },
    {
        id: "collection-product-grid",
        type: "collection-product-grid",
        label: "Collection Product Grid",
        icon: "PG",
        category: "commerce",
    },
    { id: "product-title", type: "product-title", label: "Product Title", icon: "PT", category: "commerce" },
    { id: "product-image", type: "product-image", label: "Product Image", icon: "PI", category: "commerce" },
    { id: "product-gallery", type: "product-gallery", label: "Product Gallery", icon: "PI", category: "commerce" },
    { id: "product-price", type: "product-price", label: "Product Price", icon: "PP", category: "commerce" },
    { id: "product-compare-price", type: "product-compare-price", label: "Compare Price", icon: "CP", category: "commerce" },
    { id: "product-description", type: "product-description", label: "Product Description", icon: "PD", category: "commerce" },
    { id: "product-vendor", type: "product-vendor", label: "Product Vendor", icon: "PV", category: "commerce" },
    { id: "product-sku", type: "product-sku", label: "Product SKU", icon: "PS", category: "commerce" },
    { id: "product-availability", type: "product-availability", label: "Availability", icon: "PA", category: "commerce" },
    { id: "product-variant-selector", type: "product-variant-selector", label: "Variant Selector", icon: "VS", category: "commerce" },
    { id: "product-quantity", type: "product-quantity", label: "Quantity", icon: "Q", category: "commerce" },
    { id: "product-add-to-cart", type: "product-add-to-cart", label: "Add to Cart", icon: "AC", category: "commerce" },
    { id: "product-buy-now", type: "product-buy-now", label: "Buy Now", icon: "BN", category: "commerce" },
    { id: "product-metafield", type: "product-metafield", label: "Product Metafield", icon: "PV", category: "commerce" },
    { id: "product-recommendations", type: "product-recommendations", label: "Recommendations", icon: "PG", category: "commerce" },

    { id: 'product-media', type: 'product-media', label: 'Product Media', icon: 'PM', category: 'commerce' },
    { id: 'inventory-status', type: 'inventory-status', label: 'Inventory Status', icon: 'IS', category: 'commerce' },
    { id: 'collection-filters', type: 'collection-filters', label: 'Collection Filters', icon: 'CF', category: 'commerce' },
    { id: 'collection-sorting', type: 'collection-sorting', label: 'Collection Sorting', icon: 'CS', category: 'commerce' },
    { id: 'collection-pagination', type: 'collection-pagination', label: 'Collection Pagination', icon: 'PG', category: 'commerce' },
    { id: 'cart-drawer', type: 'cart-drawer', label: 'Cart Drawer', icon: 'CD', category: 'commerce' },

    // Search / Blog / Article
    { id: "search-query-title", type: "search-query-title", label: "Search Query Title", icon: "SQ", category: "commerce" },
    { id: "search-result-count", type: "search-result-count", label: "Search Result Count", icon: "SC", category: "commerce" },
    { id: "search-results-grid", type: "search-results-grid", label: "Search Results Grid", icon: "SR", category: "commerce" },
    { id: "blog-title", type: "blog-title", label: "Blog Title", icon: "BT", category: "commerce" },
    { id: "blog-description", type: "blog-description", label: "Blog Description", icon: "BD", category: "commerce" },
    { id: "blog-article-grid", type: "blog-article-grid", label: "Blog Article Grid", icon: "BG", category: "commerce" },
    { id: "article-title", type: "article-title", label: "Article Title", icon: "AT", category: "commerce" },
    { id: "article-featured-image", type: "article-featured-image", label: "Article Image", icon: "AI", category: "commerce" },
    { id: "article-content", type: "article-content", label: "Article Content", icon: "AC", category: "commerce" },
    { id: "article-author", type: "article-author", label: "Article Author", icon: "AA", category: "commerce" },
    { id: "article-date", type: "article-date", label: "Article Date", icon: "AD", category: "commerce" },
    { id: "article-tags", type: "article-tags", label: "Article Tags", icon: "AG", category: "commerce" },
    { id: "article-navigation", type: "article-navigation", label: "Article Navigation", icon: "AN", category: "commerce" },
    { id: "related-articles", type: "related-articles", label: "Related Articles", icon: "RA", category: "commerce" },

    { id: 'global-section', type: 'global-section', label: 'Reusable Global Section', icon: '∞', category: 'layout' },
    { id: 'navigation-menu', type: 'navigation-menu', label: 'Navigation Menu', icon: '☰', category: 'content' },
    { id: 'contact-form', type: 'contact-form', label: 'Contact Form', icon: '✉', category: 'advanced' },
    { id: 'newsletter-form', type: 'newsletter-form', label: 'Newsletter Form', icon: '@', category: 'advanced' },
    { id: 'product-inquiry-form', type: 'product-inquiry-form', label: 'Product Inquiry Form', icon: '?', category: 'advanced' },
    { id: 'faq', type: 'faq', label: 'FAQ', icon: 'Q', category: 'content' },
    { id: 'testimonials', type: 'testimonials', label: 'Testimonials', icon: '★', category: 'content' },
    { id: 'logo-cloud', type: 'logo-cloud', label: 'Logo Cloud', icon: '◫', category: 'content' },
    { id: 'stats', type: 'stats', label: 'Stats', icon: '#', category: 'content' },
    { id: 'team-grid', type: 'team-grid', label: 'Team', icon: 'T', category: 'content' },
    { id: 'gallery-grid', type: 'gallery-grid', label: 'Gallery', icon: '🖼', category: 'media' },
    { id: 'marquee', type: 'marquee', label: 'Marquee', icon: '⟷', category: 'content' },
    { id: 'tabs', type: 'tabs', label: 'Tabs', icon: '⊞', category: 'content' },

    { id: 'product-tabs', type: 'product-tabs', label: 'Product Tabs', icon: '⊞', category: 'commerce' },
    { id: 'size-guide', type: 'size-guide', label: 'Size Guide', icon: '↔', category: 'commerce' },
    { id: 'shipping-info', type: 'shipping-info', label: 'Shipping Info', icon: '🚚', category: 'commerce' },
    { id: 'stock-progress', type: 'stock-progress', label: 'Stock Progress', icon: '▰', category: 'commerce' },
    { id: 'trust-badges', type: 'trust-badges', label: 'Trust Badges', icon: '✓', category: 'commerce' },
    { id: 'recently-viewed', type: 'recently-viewed', label: 'Recently Viewed', icon: '◷', category: 'commerce' },
    { id: 'related-collections', type: 'related-collections', label: 'Related Collections', icon: '◫', category: 'commerce' },
    { id: 'upsell-products', type: 'upsell-products', label: 'Upsell Products', icon: '+', category: 'commerce' },
    { id: 'sticky-add-to-cart', type: 'sticky-add-to-cart', label: 'Sticky Add to Cart', icon: '🛍', category: 'commerce' },

    { id: 'announcement-bar', type: 'announcement-bar', label: 'Announcement Bar', icon: '―', category: 'content' },
    { id: 'mega-menu', type: 'mega-menu', label: 'Mega Menu', icon: '☰', category: 'content' },
    { id: 'header-search', type: 'header-search', label: 'Header Search', icon: 'SQ', category: 'content' },
    { id: 'cart-icon', type: 'cart-icon', label: 'Cart Icon', icon: '🛍', category: 'content' },
    { id: 'account-link', type: 'account-link', label: 'Account Link', icon: '👤', category: 'content' },
    { id: 'customer-name', type: 'customer-name', label: 'Customer Name', icon: '👤', category: 'content' },
    { id: 'customer-login', type: 'customer-login', label: 'Customer Login', icon: '↪', category: 'content' },
    { id: 'customer-logout', type: 'customer-logout', label: 'Customer Logout', icon: '↩', category: 'content' },
    { id: 'customer-orders-link', type: 'customer-orders-link', label: 'Customer Orders', icon: '☷', category: 'content' },
    { id: 'customer-addresses-link', type: 'customer-addresses-link', label: 'Customer Addresses', icon: '⌂', category: 'content' },
    { id: 'localization-switcher', type: 'localization-switcher', label: 'Markets / Localization', icon: '◎', category: 'content' },
    { id: 'countdown', type: 'countdown', label: 'Countdown', icon: '⏱', category: 'commerce' },
    // Advanced
    { id: 'html', type: 'html', label: 'Custom HTML', icon: '</>', category: 'advanced' },
    { id: 'liquid', type: 'liquid', label: 'Liquid', icon: '{%}', category: 'advanced' },
];
export const INITIAL_CANVAS_ELEMENTS = [
    {
        id: 'el-1',
        type: 'banner',
        label: 'Hero Banner',
        props: {},
        styles: {
            background: { type: 'color', color: '#f6f6f7' },
            spacing: { paddingTop: '80px', paddingBottom: '80px', paddingLeft: '48px', paddingRight: '48px' },
        },
        children: [
            {
                id: 'el-1-1',
                type: 'heading',
                label: 'Heading',
                props: { text: 'Summer Collection 2026' },
                styles: {
                    typography: { fontSize: '48px', fontWeight: '700', color: '#1a1a1a' },
                },
            },
            {
                id: 'el-1-2',
                type: 'text',
                label: 'Text',
                props: { text: 'Discover our curated selection of premium summer essentials. Free shipping on orders over $75.' },
                styles: {
                    typography: { fontSize: '18px', fontWeight: '400', color: '#6d6d6d' },
                    spacing: { marginTop: '16px' },
                },
            },
            {
                id: 'el-1-3',
                type: 'button',
                label: 'Button',
                props: { text: 'Shop Now', variant: 'primary' },
                styles: {
                    spacing: { marginTop: '32px' },
                },
            },
        ],
    },
    {
        id: 'el-2',
        type: 'product-grid',
        label: 'Product Grid',
        props: { columns: 3, title: 'Featured Products' },
        styles: {
            spacing: { paddingTop: '64px', paddingBottom: '64px', paddingLeft: '48px', paddingRight: '48px' },
        },
        children: [],
    },
];


export const PRODUCT_TEMPLATE_ELEMENTS = [
  {
    id: "product-layout",
    type: "columns",
    label: "Product Layout",
    props: { columns: 2 },
    styles: { spacing: { paddingTop: "48px", paddingRight: "48px", paddingBottom: "48px", paddingLeft: "48px" }, gap: "40px" },
    children: [
      { id: "product-main-gallery", type: "product-gallery", label: "Product Gallery", props: { thumbnailPosition: "bottom", showThumbnails: true, thumbnailSize: 76, thumbnailGap: 10 }, styles: { size: { width: "100%", height: "560px" }, border: { radius: "12px" }, objectFit: "cover" }, children: [] },
      {
        id: "product-info",
        type: "container",
        label: "Product Info",
        props: {},
        styles: { flexDirection: "column", gap: "16px" },
        children: [
          { id: "product-vendor", type: "product-vendor", label: "Product Vendor", props: { prefix: "" }, styles: { typography: { fontSize: "13px", color: "#666666", textTransform: "uppercase" } }, children: [] },
          { id: "product-title", type: "product-title", label: "Product Title", props: { tag: "h1", fallbackText: "Product Title" }, styles: { typography: { fontSize: "42px", fontWeight: "700", color: "#1a1a1a", lineHeight: "1.15" } }, children: [] },
          { id: "product-prices", type: "container", label: "Product Prices", props: {}, styles: { flexDirection: "row", gap: "10px", alignItems: "center" }, children: [
            { id: "product-price", type: "product-price", label: "Product Price", props: {}, styles: { typography: { fontSize: "24px", fontWeight: "700", color: "#1a1a1a" } }, children: [] },
            { id: "product-compare", type: "product-compare-price", label: "Compare Price", props: {}, styles: { typography: { fontSize: "18px", color: "#777777" } }, children: [] }
          ] },
          { id: "product-availability", type: "product-availability", label: "Availability", props: { inStockText: "In stock", soldOutText: "Sold out" }, styles: { typography: { fontSize: "14px", fontWeight: "600", color: "#1a1a1a" } }, children: [] },
          { id: "product-description", type: "product-description", label: "Product Description", props: { fallbackText: "Product description will appear here." }, styles: { typography: { fontSize: "16px", color: "#4a4a4a", lineHeight: "1.6" } }, children: [] },
          { id: "product-variant", type: "product-variant-selector", label: "Variant Selector", props: { label: "Variant" }, styles: {}, children: [] },
          { id: "product-quantity", type: "product-quantity", label: "Quantity", props: { label: "Quantity", min: 1 }, styles: {}, children: [] },
          { id: "product-cart", type: "product-add-to-cart", label: "Add to Cart", props: { text: "Add to Cart" }, styles: { typography: { fontSize: "16px", fontWeight: "600", color: "#ffffff" }, background: { type: "color", color: "#1a1a1a" }, border: { radius: "8px" }, spacing: { paddingTop: "14px", paddingRight: "22px", paddingBottom: "14px", paddingLeft: "22px" } }, children: [] },
          { id: "product-buy", type: "product-buy-now", label: "Buy Now", props: { text: "Buy Now" }, styles: { typography: { fontSize: "16px", fontWeight: "600", color: "#ffffff" }, background: { type: "color", color: "#008060" }, border: { radius: "8px" }, spacing: { paddingTop: "14px", paddingRight: "22px", paddingBottom: "14px", paddingLeft: "22px" } }, children: [] },
          { id: "product-sku", type: "product-sku", label: "Product SKU", props: { prefix: "SKU: " }, styles: { typography: { fontSize: "13px", color: "#777777" } }, children: [] }
        ]
      }
    ]
  },
  { id: "product-recommendations", type: "product-recommendations", label: "Product Recommendations", props: { heading: "You may also like", limit: 4, columns: 4, showPrice: true }, styles: { spacing: { marginTop: "40px", marginRight: "48px", marginBottom: "48px", marginLeft: "48px" } }, children: [] }
];


export const SEARCH_TEMPLATE_ELEMENTS = [
  { id: "search-wrap", type: "section", label: "Search Results", props: {}, styles: { spacing: { paddingTop: "48px", paddingRight: "48px", paddingBottom: "64px", paddingLeft: "48px" } }, children: [
    { id: "search-title", type: "search-query-title", label: "Search Query Title", props: { prefix: "Search results for" }, styles: { typography: { fontSize: "38px", fontWeight: "700" } }, children: [] },
    { id: "search-count", type: "search-result-count", label: "Search Result Count", props: {}, styles: { spacing: { marginTop: "8px", marginBottom: "24px" } }, children: [] },
    { id: "search-grid", type: "search-results-grid", label: "Search Results Grid", props: { limit: 12, columnsDesktop: 4, columnsTablet: 2, columnsMobile: 1 }, styles: { grid: { gap: "24px" } }, children: [] },
  ] },
];

export const BLOG_TEMPLATE_ELEMENTS = [
  { id: "blog-wrap", type: "section", label: "Blog", props: {}, styles: { spacing: { paddingTop: "48px", paddingRight: "48px", paddingBottom: "64px", paddingLeft: "48px" } }, children: [
    { id: "blog-title", type: "blog-title", label: "Blog Title", props: { tag: "h1" }, styles: { typography: { fontSize: "42px", fontWeight: "700" } }, children: [] },
    { id: "blog-description", type: "blog-description", label: "Blog Description", props: {}, styles: { spacing: { marginTop: "10px", marginBottom: "28px" } }, children: [] },
    { id: "blog-grid", type: "blog-article-grid", label: "Blog Article Grid", props: { limit: 12, columnsDesktop: 3, columnsTablet: 2, columnsMobile: 1 }, styles: { grid: { gap: "24px" } }, children: [] },
  ] },
];

export const ARTICLE_TEMPLATE_ELEMENTS = [
  { id: "article-wrap", type: "section", label: "Article", props: {}, styles: { size: { maxWidth: "900px" }, spacing: { paddingTop: "48px", paddingRight: "32px", paddingBottom: "64px", paddingLeft: "32px" } }, children: [
    { id: "article-title", type: "article-title", label: "Article Title", props: { tag: "h1" }, styles: { typography: { fontSize: "46px", fontWeight: "700" } }, children: [] },
    { id: "article-meta", type: "container", label: "Article Meta", props: {}, styles: { flexDirection: "row", gap: "12px", spacing: { marginTop: "12px", marginBottom: "24px" } }, children: [
      { id: "article-author", type: "article-author", label: "Article Author", props: { prefix: "By " }, styles: {}, children: [] },
      { id: "article-date", type: "article-date", label: "Article Date", props: {}, styles: {}, children: [] },
    ] },
    { id: "article-image", type: "article-featured-image", label: "Article Image", props: {}, styles: { size: { width: "100%", height: "520px" }, border: { radius: "12px" } }, children: [] },
    { id: "article-content", type: "article-content", label: "Article Content", props: {}, styles: { spacing: { marginTop: "28px" }, typography: { fontSize: "17px", lineHeight: "1.75" } }, children: [] },
    { id: "article-tags", type: "article-tags", label: "Article Tags", props: {}, styles: { spacing: { marginTop: "28px" } }, children: [] },
    { id: "article-nav", type: "article-navigation", label: "Article Navigation", props: {}, styles: { spacing: { marginTop: "40px" } }, children: [] },
    { id: "related-articles", type: "related-articles", label: "Related Articles", props: { heading: "Related articles", limit: 3, columns: 3 }, styles: { spacing: { marginTop: "48px" } }, children: [] },
  ] },
];
