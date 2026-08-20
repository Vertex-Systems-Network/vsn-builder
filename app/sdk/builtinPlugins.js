import { registerVsnPlugin } from "./registry.js";
import { vsnElement } from "./renderDescriptor.js";

let ready = false;
function spacerDefinition() {
  return {
    id: "spacer",
    label: "Spacer",
    category: "Basic",
    acceptsChildren: false,
    defaults: { props: { height: "60px" }, styles: {} },
    controls: [
      { key: "height", type: "text", label: "Height", help: "CSS length such as 60px, 4rem or clamp(...).", default: "60px" },
    ],
    capabilities: { layout: true, responsive: true, visibility: true, customCss: true },
    styleProfile: { groups: ["layout", "spacing", "responsive", "advanced"] },
    hooks: {
      save: ({ node }) => ({
        ...node,
        props: { ...(node.props || {}), height: String(node.props?.height || "60px").slice(0, 80) },
      }),
    },
  };
}

function wishlistProductContext(context = {}) {
  const loop = context.loop && (context.loop.price || context.loop.priceRangeV2 || context.loop.variants || context.loop.productType || context.loop.vendor) ? context.loop : null;
  const candidates = [loop, context.product, context.previewProduct].filter(Boolean);
  const product = candidates.find((item) => item && (item.handle || item.productHandle || item.id)) || {};
  const variants = Array.isArray(product.variants) ? product.variants : Array.isArray(product.variants?.nodes) ? product.variants.nodes : [];
  const firstVariant = variants.find((item) => item?.availableForSale !== false) || variants[0] || null;
  const productId = String(product.numericId || product.id || product.productId || '').split('/').pop();
  const variantId = String(firstVariant?.variantId || firstVariant?.id || '').split('/').pop();
  const handle = String(product.handle || product.productHandle || '').trim();
  const image = product.featuredImage?.url || product.image?.url || product.featuredImage || product.image || '';
  const priceObject = product.price || product.priceRangeV2?.minVariantPrice || firstVariant?.price || null;
  const price = typeof priceObject === 'object' ? priceObject?.amount : priceObject;
  const currency = typeof priceObject === 'object' ? priceObject?.currencyCode : '';
  return {
    productId,
    variantId,
    handle,
    title: String(product.title || 'Product'),
    url: handle ? `/products/${handle}` : '',
    image: String(image || ''),
    price: price == null ? '' : String(price),
    currency: String(currency || ''),
    available: product.availableForSale !== false && firstVariant?.availableForSale !== false,
  };
}

function wishlistButtonDefinition() {
  return {
    id: 'wishlist-button',
    label: 'Wishlist Button',
    category: 'Commerce',
    acceptsChildren: false,
    defaults: {
      props: { addText: 'Add to wishlist', removeText: 'Remove from wishlist', showIcon: true, variantMode: 'product', unavailableText: 'Product unavailable' },
      styles: {},
    },
    controls: [
      { key: 'addText', type: 'text', label: 'Add label', default: 'Add to wishlist' },
      { key: 'removeText', type: 'text', label: 'Remove label', default: 'Remove from wishlist' },
      { key: 'showIcon', type: 'toggle', label: 'Show heart icon', default: true },
      { key: 'variantMode', type: 'select', label: 'Wishlist scope', default: 'product', options: [
        { value: 'product', label: 'Product' },
        { value: 'current', label: 'Current variant' },
      ] },
      { key: 'unavailableText', type: 'text', label: 'Missing product label', default: 'Product unavailable' },
    ],
    capabilities: { typography: true, background: true, border: true, spacing: true, responsive: true, visibility: true, customCss: true },
    styleProfile: { groups: ['typography', 'background', 'border', 'spacing', 'responsive', 'advanced'] },
    renderers: {
      editor: ({ node, context }) => {
        const p = node.props || {};
        const product = wishlistProductContext(context);
        const label = product.productId || product.handle ? (p.addText || 'Add to wishlist') : (p.unavailableText || 'Product unavailable');
        return vsnElement('button', {
          type: 'button',
          disabled: !(product.productId || product.handle),
          'data-vsn-wishlist-preview': '1',
          style: { border: '1px solid #d8d8d8', borderRadius: 8, padding: '10px 14px', background: '#ffffff', color: '#202223', fontWeight: 600, cursor: 'default' },
        }, `${p.showIcon === false ? '' : '♡ '}${label}`);
      },
      storefront: ({ node, context }) => {
        const p = node.props || {};
        const product = wishlistProductContext(context);
        const available = Boolean(product.productId || product.handle);
        return vsnElement('button', {
          type: 'button',
          disabled: !available,
          className: 'vsn-wishlist-button',
          'data-vsn-wishlist-button': '1',
          'data-vsn-product-id': product.productId,
          'data-vsn-variant-id': product.variantId,
          'data-vsn-product-handle': product.handle,
          'data-vsn-product-title': product.title,
          'data-vsn-product-url': product.url,
          'data-vsn-product-image': product.image,
          'data-vsn-product-price': product.price,
          'data-vsn-product-currency': product.currency,
          'data-vsn-wishlist-add-text': p.addText || 'Add to wishlist',
          'data-vsn-wishlist-remove-text': p.removeText || 'Remove from wishlist',
          'data-vsn-wishlist-show-icon': p.showIcon === false ? '0' : '1',
          'data-vsn-wishlist-variant-mode': p.variantMode === 'current' ? 'current' : 'product',
          'aria-pressed': 'false',
          'aria-label': available ? (p.addText || 'Add to wishlist') : (p.unavailableText || 'Product unavailable'),
          style: { border: '1px solid currentColor', borderRadius: 8, padding: '10px 14px', background: 'transparent', color: 'inherit', font: 'inherit', fontWeight: 600, cursor: available ? 'pointer' : 'not-allowed' },
        }, `${p.showIcon === false ? '' : '♡ '}${available ? (p.addText || 'Add to wishlist') : (p.unavailableText || 'Product unavailable')}`);
      },
    },
    hooks: {
      save: ({ node }) => ({ ...node, props: { ...node.props, addText: String(node.props?.addText || 'Add to wishlist').slice(0, 120), removeText: String(node.props?.removeText || 'Remove from wishlist').slice(0, 120), unavailableText: String(node.props?.unavailableText || 'Product unavailable').slice(0, 120), showIcon: node.props?.showIcon !== false, variantMode: node.props?.variantMode === 'current' ? 'current' : 'product' } }),
    },
  };
}

function wishlistCountDefinition() {
  return {
    id: 'wishlist-count',
    label: 'Wishlist Count',
    category: 'Commerce',
    acceptsChildren: false,
    defaults: { props: { prefix: '', suffix: '', emptyText: '0', ariaLabel: 'Wishlist items' }, styles: {} },
    controls: [
      { key: 'prefix', type: 'text', label: 'Prefix', default: '' },
      { key: 'suffix', type: 'text', label: 'Suffix', default: '' },
      { key: 'emptyText', type: 'text', label: 'Empty value', default: '0' },
      { key: 'ariaLabel', type: 'text', label: 'Accessibility label', default: 'Wishlist items' },
    ],
    capabilities: { typography: true, spacing: true, responsive: true, visibility: true, customCss: true },
    styleProfile: { groups: ['typography', 'spacing', 'responsive', 'advanced'] },
    renderers: {
      editor: ({ node }) => { const p = node.props || {}; return vsnElement('span', { className: 'vsn-wishlist-count', 'data-vsn-wishlist-preview': '1' }, `${p.prefix || ''}${p.emptyText || '0'}${p.suffix || ''}`); },
      storefront: ({ node }) => {
        const p = node.props || {};
        return vsnElement('span', { className: 'vsn-wishlist-count', 'data-vsn-wishlist-count': '1', 'data-vsn-wishlist-prefix': p.prefix || '', 'data-vsn-wishlist-suffix': p.suffix || '', 'data-vsn-wishlist-empty': p.emptyText || '0', role: 'status', 'aria-live': 'polite', 'aria-label': p.ariaLabel || 'Wishlist items' }, `${p.prefix || ''}${p.emptyText || '0'}${p.suffix || ''}`);
      },
    },
    hooks: { save: ({ node }) => ({ ...node, props: { ...node.props, prefix: String(node.props?.prefix || '').slice(0, 60), suffix: String(node.props?.suffix || '').slice(0, 60), emptyText: String(node.props?.emptyText || '0').slice(0, 30), ariaLabel: String(node.props?.ariaLabel || 'Wishlist items').slice(0, 120) } }) },
  };
}


function wishlistGridDefinition() {
  return {
    id: 'wishlist-grid',
    label: 'Wishlist Grid',
    category: 'Commerce',
    acceptsChildren: false,
    defaults: {
      props: {
        limit: 24,
        columnsDesktop: 4,
        columnsTablet: 2,
        columnsMobile: 1,
        showImage: true,
        showTitle: true,
        showPrice: true,
        showRemove: true,
        imageRatio: '1 / 1',
        removeText: 'Remove',
        soldOutText: 'Sold out',
      },
      styles: {},
    },
    controls: [
      { key: 'limit', type: 'number', label: 'Maximum products', default: 24, min: 1, max: 48, step: 1 },
      { key: 'columnsDesktop', type: 'number', label: 'Desktop columns', default: 4, min: 1, max: 6, step: 1 },
      { key: 'columnsTablet', type: 'number', label: 'Tablet columns', default: 2, min: 1, max: 4, step: 1 },
      { key: 'columnsMobile', type: 'number', label: 'Mobile columns', default: 1, min: 1, max: 2, step: 1 },
      { key: 'showImage', type: 'toggle', label: 'Show product image', default: true },
      { key: 'showTitle', type: 'toggle', label: 'Show product title', default: true },
      { key: 'showPrice', type: 'toggle', label: 'Show product price', default: true },
      { key: 'showRemove', type: 'toggle', label: 'Show remove action', default: true },
      { key: 'imageRatio', type: 'select', label: 'Image ratio', default: '1 / 1', options: [
        { value: '1 / 1', label: 'Square (1:1)' },
        { value: '4 / 5', label: 'Portrait (4:5)' },
        { value: '3 / 4', label: 'Portrait (3:4)' },
        { value: '4 / 3', label: 'Landscape (4:3)' },
        { value: '16 / 9', label: 'Wide (16:9)' },
        { value: 'auto', label: 'Natural image ratio' },
      ] },
      { key: 'removeText', type: 'text', label: 'Remove label', default: 'Remove' },
      { key: 'soldOutText', type: 'text', label: 'Unavailable label', default: 'Sold out' },
    ],
    capabilities: { layout: true, typography: true, background: true, border: true, spacing: true, responsive: true, visibility: true, customCss: true },
    styleProfile: { groups: ['layout', 'typography', 'background', 'border', 'spacing', 'responsive', 'advanced'] },
    renderers: {
      editor: ({ node }) => {
        const p = node.props || {};
        const columns = Math.max(1, Math.min(6, Number(p.columnsDesktop || 4)));
        const cards = Array.from({ length: Math.min(4, columns) }, (_, index) => vsnElement('article', {
          key: `preview-${index}`,
          style: { display: 'grid', gap: 8, minWidth: 0 },
        }, [
          p.showImage === false ? null : vsnElement('div', { key: 'image', style: { aspectRatio: p.imageRatio || '1 / 1', borderRadius: 10, background: 'linear-gradient(135deg,#f3f4f6,#e5e7eb)' } }),
          p.showTitle === false ? null : vsnElement('strong', { key: 'title', style: { fontSize: 14 } }, `Wishlist product ${index + 1}`),
          p.showPrice === false ? null : vsnElement('span', { key: 'price', style: { fontSize: 13, opacity: .7 } }, '$99.00'),
          p.showRemove === false ? null : vsnElement('button', { key: 'remove', type: 'button', style: { justifySelf: 'start', border: 0, background: 'transparent', padding: 0, textDecoration: 'underline', cursor: 'default' } }, p.removeText || 'Remove'),
        ].filter(Boolean)));
        return vsnElement('div', { 'data-vsn-wishlist-preview': 'grid', style: { display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, columns)},minmax(0,1fr))`, gap: 18 } }, cards);
      },
      storefront: ({ node }) => {
        const p = node.props || {};
        return vsnElement('div', {
          className: 'vsn-wishlist-grid',
          'data-vsn-wishlist-grid': '1',
          'data-vsn-wishlist-limit': String(Math.max(1, Math.min(48, Number(p.limit || 24)))),
          'data-vsn-wishlist-columns-desktop': String(Math.max(1, Math.min(6, Number(p.columnsDesktop || 4)))),
          'data-vsn-wishlist-columns-tablet': String(Math.max(1, Math.min(4, Number(p.columnsTablet || 2)))),
          'data-vsn-wishlist-columns-mobile': String(Math.max(1, Math.min(2, Number(p.columnsMobile || 1)))),
          'data-vsn-wishlist-show-image': p.showImage === false ? '0' : '1',
          'data-vsn-wishlist-show-title': p.showTitle === false ? '0' : '1',
          'data-vsn-wishlist-show-price': p.showPrice === false ? '0' : '1',
          'data-vsn-wishlist-show-remove': p.showRemove === false ? '0' : '1',
          'data-vsn-wishlist-image-ratio': p.imageRatio || '1 / 1',
          'data-vsn-wishlist-remove-text': p.removeText || 'Remove',
          'data-vsn-wishlist-sold-out-text': p.soldOutText || 'Sold out',
          role: 'list',
          'aria-live': 'polite',
        });
      },
    },
    hooks: {
      save: ({ node }) => ({ ...node, props: {
        ...node.props,
        limit: Math.max(1, Math.min(48, Number(node.props?.limit || 24))),
        columnsDesktop: Math.max(1, Math.min(6, Number(node.props?.columnsDesktop || 4))),
        columnsTablet: Math.max(1, Math.min(4, Number(node.props?.columnsTablet || 2))),
        columnsMobile: Math.max(1, Math.min(2, Number(node.props?.columnsMobile || 1))),
        showImage: node.props?.showImage !== false,
        showTitle: node.props?.showTitle !== false,
        showPrice: node.props?.showPrice !== false,
        showRemove: node.props?.showRemove !== false,
        imageRatio: ['1 / 1','4 / 5','3 / 4','4 / 3','16 / 9','auto'].includes(node.props?.imageRatio) ? node.props.imageRatio : '1 / 1',
        removeText: String(node.props?.removeText || 'Remove').slice(0, 120),
        soldOutText: String(node.props?.soldOutText || 'Sold out').slice(0, 120),
      } }),
    },
  };
}

function wishlistEmptyStateDefinition() {
  return {
    id: 'wishlist-empty-state',
    label: 'Wishlist Empty State',
    category: 'Commerce',
    acceptsChildren: false,
    defaults: { props: { heading: 'Your wishlist is empty', body: 'Save products you love and come back to them anytime.', showButton: true, buttonText: 'Continue shopping', buttonUrl: '/collections/all' }, styles: {} },
    controls: [
      { key: 'heading', type: 'text', label: 'Heading', default: 'Your wishlist is empty' },
      { key: 'body', type: 'textarea', label: 'Message', default: 'Save products you love and come back to them anytime.' },
      { key: 'showButton', type: 'toggle', label: 'Show action button', default: true },
      { key: 'buttonText', type: 'text', label: 'Button label', default: 'Continue shopping' },
      { key: 'buttonUrl', type: 'url', label: 'Button link', default: '/collections/all' },
    ],
    capabilities: { typography: true, background: true, border: true, spacing: true, responsive: true, visibility: true, customCss: true },
    styleProfile: { groups: ['typography', 'background', 'border', 'spacing', 'responsive', 'advanced'] },
    renderers: {
      editor: ({ node }) => {
        const p = node.props || {};
        return vsnElement('div', { 'data-vsn-wishlist-preview': 'empty', style: { textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 10, padding: '34px 20px', border: '1px dashed #d1d5db', borderRadius: 12 } }, [
          vsnElement('strong', { key: 'heading', style: { fontSize: 22 } }, p.heading || 'Your wishlist is empty'),
          vsnElement('span', { key: 'body', style: { maxWidth: 520, opacity: .72 } }, p.body || ''),
          p.showButton === false ? null : vsnElement('span', { key: 'button', style: { marginTop: 5, display: 'inline-flex', padding: '10px 16px', borderRadius: 8, background: '#202223', color: '#fff', fontWeight: 600 } }, p.buttonText || 'Continue shopping'),
        ].filter(Boolean));
      },
      storefront: ({ node }) => {
        const p = node.props || {};
        return vsnElement('div', { className: 'vsn-wishlist-empty-state', 'data-vsn-wishlist-empty-state': '1', hidden: true }, [
          vsnElement('h2', { key: 'heading', className: 'vsn-wishlist-empty-heading' }, p.heading || 'Your wishlist is empty'),
          p.body ? vsnElement('p', { key: 'body', className: 'vsn-wishlist-empty-body' }, p.body) : null,
          p.showButton === false ? null : vsnElement('a', { key: 'button', className: 'vsn-wishlist-empty-button', href: p.buttonUrl || '/collections/all' }, p.buttonText || 'Continue shopping'),
        ].filter(Boolean));
      },
    },
    hooks: { save: ({ node }) => ({ ...node, props: { ...node.props, heading: String(node.props?.heading || 'Your wishlist is empty').slice(0, 180), body: String(node.props?.body || '').slice(0, 600), showButton: node.props?.showButton !== false, buttonText: String(node.props?.buttonText || 'Continue shopping').slice(0, 120), buttonUrl: String(node.props?.buttonUrl || '/collections/all').slice(0, 700) } }) },
  };
}

function exampleAnnouncementDefinition() {
  return {
    id: "example-announcement-card",
    label: "SDK Announcement Card",
    category: "Plugin",
    acceptsChildren: false,
    defaults: {
      props: {
        eyebrow: "SDK widget",
        title: "Built with the public VSN Widget SDK",
        body: "This widget uses shared controls, editor/storefront renderers and lifecycle hooks.",
        tone: "neutral",
        url: "",
      },
      styles: {},
    },
    controls: [
      { key: "eyebrow", type: "text", label: "Eyebrow" },
      { key: "title", type: "text", label: "Title" },
      { key: "body", type: "textarea", label: "Body" },
      { key: "tone", type: "select", label: "Tone", options: [
        { value: "neutral", label: "Neutral" },
        { value: "success", label: "Success" },
        { value: "warning", label: "Warning" },
      ] },
      { key: "url", type: "url", label: "Optional link" },
    ],
    capabilities: { background: true, border: true, spacing: true, responsive: true, visibility: true, customCss: true },
    styleProfile: { groups: ["background", "border", "spacing", "responsive", "advanced"] },
    renderers: {
      editor: ({ node }) => {
        const p = node.props || {};
        const tones = { neutral: ["#f6f6f7", "#202223"], success: ["#ecfdf3", "#067647"], warning: ["#fffaeb", "#93370d"] };
        const [background, color] = tones[p.tone] || tones.neutral;
        return vsnElement("div", {
          style: { background, color, border: "1px solid rgba(0,0,0,.08)", borderRadius: 12, padding: 18, display: "grid", gap: 7 },
        }, [
          vsnElement("span", { style: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" } }, p.eyebrow || "SDK widget"),
          vsnElement("strong", { style: { fontSize: 18 } }, p.title || "Announcement"),
          vsnElement("span", { style: { fontSize: 14, lineHeight: 1.5 } }, p.body || ""),
        ]);
      },
      storefront: ({ node }) => {
        const p = node.props || {};
        const tones = { neutral: ["#f6f6f7", "#202223"], success: ["#ecfdf3", "#067647"], warning: ["#fffaeb", "#93370d"] };
        const [background, color] = tones[p.tone] || tones.neutral;
        const tag = p.url ? "a" : "div";
        return vsnElement(tag, {
          href: p.url || undefined,
          className: "vsn-sdk-announcement",
          "data-vsn-id": node.id || "",
          style: { background, color, border: "1px solid rgba(0,0,0,.08)", borderRadius: 12, padding: 18, display: "grid", gap: 7, textDecoration: "none" },
        }, [
          vsnElement("span", { style: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" } }, p.eyebrow || "SDK widget"),
          vsnElement("strong", { style: { fontSize: 18 } }, p.title || "Announcement"),
          vsnElement("span", { style: { fontSize: 14, lineHeight: 1.5 } }, p.body || ""),
        ]);
      },
    },
    hooks: {
      mount: ({ element }) => element?.setAttribute?.("data-vsn-sdk-mounted", "1"),
      unmount: ({ element }) => element?.removeAttribute?.("data-vsn-sdk-mounted"),
      preview: ({ node }) => node,
      save: ({ node }) => ({
        ...node,
        props: {
          ...(node.props || {}),
          eyebrow: String(node.props?.eyebrow || "").slice(0, 80),
          title: String(node.props?.title || "").slice(0, 180),
          body: String(node.props?.body || "").slice(0, 600),
          url: String(node.props?.url || "").slice(0, 500),
        },
      }),
    },
  };
}

export function ensureBuiltinSdkPlugins() {
  if (ready) return;
  ready = true;
  registerVsnPlugin({
    manifest: {
      schemaVersion: 1,
      id: "vsn.core",
      name: "VSN Core SDK Adapter",
      version: "1.2.0",
      description: "Core SDK adapter for native VSN widgets, including the Wishlist M.2 commerce system.",
      compatibility: { min: "2.5.50", maxExclusive: "3.0.0" },
      permissions: ["editor:controls", "editor:preview", "storefront:render"],
      widgets: [],
    },
    setup(api) { api.registerWidget(spacerDefinition()); api.registerWidget(wishlistButtonDefinition()); api.registerWidget(wishlistCountDefinition()); api.registerWidget(wishlistGridDefinition()); api.registerWidget(wishlistEmptyStateDefinition()); },
  });
  registerVsnPlugin({
    manifest: {
      schemaVersion: 1,
      id: "vsn.example",
      name: "VSN SDK Example Widgets",
      version: "1.0.0",
      description: "Bundled developer-mode example plugin.",
      author: "VSN",
      compatibility: { min: "2.5.50", maxExclusive: "3.0.0" },
      permissions: ["editor:controls", "editor:preview", "storefront:render"],
      widgets: [],
    },
    setup(api) {
      api.registerWidget(exampleAnnouncementDefinition());
      api.registerDataProvider({
        id: "example:static-items",
        label: "Example Static Items",
        type: "example",
        description: "Deterministic SDK test provider.",
        resolve: async (_context, input = {}) => Array.from(
          { length: Math.max(1, Math.min(20, Number(input.limit || 3))) },
          (_, index) => ({ id: `example-${index + 1}`, title: `Example item ${index + 1}`, meta: "SDK data provider" }),
        ),
      });
    },
  });
}
