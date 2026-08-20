import {
  Info, Star, Heart, Check, Plus, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ShoppingCart, User, Search,
  Grid2X2, Image, FileText, Minus, Columns3, CircleAlert, ListTree, Menu, Mail,
  CircleHelp, MapPin, SlidersHorizontal, Clock3, DollarSign, Tags, Store, Package,
  Map, Truck, Settings, RotateCcw, LogOut, ChevronRight, ChevronDown, Clipboard,
  Copy, Pencil, ExternalLink, Paintbrush, Save, Trash2, Undo2, Redo2, RefreshCw,
  Upload, X, CheckCircle2, LayoutTemplate, Blocks, Monitor, Tablet, Smartphone,
  MousePointerClick, List, AlignLeft, Heading, BarChart3, Images, ImagePlus,
  GalleryHorizontal, Film, Layers, Play, Anchor, Share2, Sparkles, UserCircle,
  Quote, Megaphone, Code2, Box, Send, Eye, EyeOff, Lock, Unlock, CalendarDays, FolderOpen, Download, Languages
} from "lucide-react";

const ICONS = {
  info: Info, star: Star, heart: Heart, check: Check, plus: Plus,
  "arrow-right": ArrowRight, "arrow-left": ArrowLeft, "arrow-up": ArrowUp, "arrow-down": ArrowDown, cart: ShoppingCart,
  profile: User, search: Search, grid: Grid2X2, image: Image, note: FileText,
  minus: Minus, reorder: Columns3, categories: Tags, "check-circle": CheckCircle2,
  menu: Menu, email: Mail, "question-circle": CircleHelp, geolocation: MapPin,
  settings: Settings, filter: SlidersHorizontal, select: MousePointerClick, calendar: CalendarDays, clock: Clock3, "cash-dollar": DollarSign, discount: Tags,
  store: Store, order: Package, truck: Truck, return: RotateCcw,
  "chevron-right": ChevronRight, "chevron-down": ChevronDown,
  clipboard: Clipboard, duplicate: Copy, edit: Pencil, external: ExternalLink,
  "paint-brush": Paintbrush, save: Save, delete: Trash2, trash: Trash2,
  undo: Undo2, redo: Redo2, refresh: RefreshCw, reset: RotateCcw,
  upload: Upload, x: X, template: LayoutTemplate, widgets: Blocks,
  navigator: ListTree, help: CircleHelp, submit: Send, button: MousePointerClick,
  desktop: Monitor, tablet: Tablet, mobile: Smartphone,
  "list-bulleted": List, list: List, warning: CircleAlert,
  heading: Heading, text: AlignLeft, chart: BarChart3, images: Images,
  "image-plus": ImagePlus, gallery: GalleryHorizontal, film: Film, layers: Layers,
  play: Play, anchor: Anchor, share: Share2, sparkles: Sparkles,
  "user-circle": UserCircle, quote: Quote, megaphone: Megaphone, map: Map,
  code: Code2, box: Box, eye: Eye, "eye-off": EyeOff, lock: Lock, unlock: Unlock, folder: FolderOpen, download: Download, language: Languages,
};

const WIDGET_ICON_TYPES = {
  heading: "heading", text: "text", button: "button", icon: "star", divider: "minus",
  spacer: "reorder", container: "grid", columns: "grid", banner: "info", section: "grid",
  image: "image", video: "film", slider: "reorder", "product-grid": "grid",
  "product-card": "order", "collection-grid": "grid", "collection-title": "categories",
  "collection-description": "note", "collection-image": "image", "collection-product-count": "categories",
  "collection-product-grid": "grid", "product-title": "order", "product-image": "image",
  "product-gallery": "image", "product-price": "cash-dollar", "product-compare-price": "discount",
  "product-description": "note", "product-vendor": "store", "product-sku": "order",
  "product-availability": "check-circle", "product-variant-selector": "categories",
  "product-quantity": "plus", "product-add-to-cart": "cart", "product-buy-now": "order",
  "product-metafield": "info", "product-recommendations": "grid", "search-query-title": "search",
  "search-result-count": "search", "search-results-grid": "grid", "blog-title": "note",
  "blog-description": "note", "blog-article-grid": "grid", "article-title": "note",
  "article-featured-image": "image", "article-content": "note", "article-author": "profile",
  "article-date": "clock", "article-tags": "categories", "article-navigation": "arrow-right",
  "related-articles": "grid", "global-section": "grid", "navigation-menu": "menu",
  "contact-form": "email", "newsletter-form": "email", "product-inquiry-form": "question-circle",
  faq: "question-circle", testimonials: "star", "logo-cloud": "grid", stats: "info",
  "team-grid": "profile", "gallery-grid": "image", marquee: "reorder", tabs: "categories",
  "product-tabs": "categories", "size-guide": "reorder", "shipping-info": "truck",
  "stock-progress": "info", "trust-badges": "check-circle", "recently-viewed": "clock",
  "related-collections": "categories", "upsell-products": "plus", "sticky-add-to-cart": "cart",
  "announcement-bar": "info", "mega-menu": "menu", "header-search": "search", "cart-icon": "cart",
  "account-link": "profile", "customer-name": "profile", "customer-login": "arrow-right",
  "customer-logout": "return", "customer-orders-link": "order", "customer-addresses-link": "geolocation",
  "localization-switcher": "geolocation", breadcrumbs: "arrow-right", "icon-list": "note",
  "icon-box": "star", "image-box": "image", accordion: "arrow-right", toggle: "arrow-right",
  carousel: "reorder", slides: "image", "testimonials-carousel": "star", "social-icons": "share",
  map: "geolocation", "progress-bar": "info", counter: "info", "pricing-table": "cash-dollar",
  timeline: "clock", "data-table": "grid", "menu-anchor": "anchor", "form-builder": "note",
  "product-media": "image", "inventory-status": "check-circle", "collection-filters": "settings",
  "collection-sorting": "reorder", "collection-pagination": "arrow-right", "cart-drawer": "cart",
  countdown: "clock", html: "code", liquid: "code",
};

const CONTENT_ICON_TYPES = { star: "star", heart: "star", check: "check", plus: "plus", "arrow-right": "arrow-right", cart: "cart", user: "profile", search: "search", info: "info", warning: "warning" };

function pxSize(size) {
  if (typeof size === "number") return size;
  return ({ small: 14, base: 16, large: 20 }[size] || 16);
}

export default function PolarisIcon({ type = "info", size = "base", tone, className = "", style }) {
  const Icon = ICONS[type] || Info;
  return <Icon size={pxSize(size)} strokeWidth={1.9} className={className} style={style} aria-hidden="true" />;
}

export function WidgetPolarisIcon({ widgetType, size = "base", className = "" }) {
  return <PolarisIcon type={WIDGET_ICON_TYPES[widgetType] || "info"} size={size} className={className} />;
}
export function ContentPolarisIcon({ name, size = "base", className = "" }) {
  return <PolarisIcon type={CONTENT_ICON_TYPES[name] || "star"} size={size} className={className} />;
}
export { WIDGET_ICON_TYPES, CONTENT_ICON_TYPES };
