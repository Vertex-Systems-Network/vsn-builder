const INDUSTRIES = [
  { key: "fashion", label: "Fashion", image: "/vsn-stock/fashion.svg", accent: "#111111" },
  { key: "beauty", label: "Beauty", image: "/vsn-stock/skincare.svg", accent: "#805ad5" },
  { key: "electronics", label: "Electronics", image: "/vsn-stock/watch.svg", accent: "#2563eb" },
  { key: "food", label: "Food", image: "/vsn-stock/seasonal.svg", accent: "#b45309" },
  { key: "saas", label: "SaaS", image: "/vsn-stock/office.svg", accent: "#0f766e" },
  { key: "luxury", label: "Luxury", image: "/vsn-stock/interior.svg", accent: "#6b4f2a" },
  { key: "real-estate", label: "Real Estate", image: "/vsn-stock/interior.svg", accent: "#0f4c5c" },
  { key: "single-product", label: "Single Product", image: "/vsn-stock/watch.svg", accent: "#7c2d12" },
  { key: "b2b", label: "B2B", image: "/vsn-stock/office.svg", accent: "#334155" },
  { key: "landing-cro", label: "Landing / CRO", image: "/vsn-stock/sale.svg", accent: "#9f1239" },
];

const PAGE_PATTERNS = [
  ["editorial", "Editorial Story", "editorial"],
  ["minimal", "Minimal Commerce", "centered"],
  ["bold", "Bold Launch", "split"],
  ["conversion", "Conversion First", "product-first"],
  ["story", "Brand Story", "editorial"],
  ["premium", "Premium Showcase", "split"],
  ["modern", "Modern Storefront", "grid"],
  ["soft", "Soft Collection", "centered"],
  ["dark", "Dark Campaign", "split"],
  ["catalogue", "Catalogue", "grid"],
  ["launch", "Product Launch", "product-first"],
  ["seasonal", "Seasonal Campaign", "centered"],
];

const SECTION_PATTERNS = [
  ["hero-split", "Hero · Split", "split"], ["hero-centered", "Hero · Centered", "centered"],
  ["hero-product", "Hero · Product", "product-first"], ["announcement", "Announcement", "centered"],
  ["features-3", "Features · 3 Column", "grid"], ["features-4", "Features · 4 Column", "grid"],
  ["benefits", "Benefits", "grid"], ["proof", "Social Proof", "centered"],
  ["testimonial", "Testimonial", "editorial"], ["testimonial-grid", "Testimonials · Grid", "grid"],
  ["stats", "Stats", "grid"], ["logos", "Logo Cloud", "grid"],
  ["cta", "CTA", "centered"], ["cta-split", "CTA · Split", "split"],
  ["newsletter", "Newsletter", "centered"], ["faq", "FAQ Intro", "editorial"],
  ["collection-intro", "Collection Intro", "split"], ["product-grid", "Product Grid Intro", "product-first"],
  ["category-grid", "Category Grid Intro", "grid"], ["comparison", "Comparison Intro", "grid"],
  ["story", "Story", "editorial"], ["timeline", "Timeline Intro", "editorial"],
  ["media-split", "Media Split", "split"], ["gallery", "Gallery Intro", "grid"],
  ["video", "Video Intro", "centered"], ["press", "Press Highlights", "grid"],
  ["trust", "Trust Bar", "grid"], ["shipping", "Shipping & Returns", "grid"],
  ["contact", "Contact CTA", "split"], ["lead-form", "Lead Form Intro", "split"],
  ["offer", "Offer Banner", "centered"], ["urgency", "Urgency CTA", "product-first"],
];

const PALETTES = {
  editorial: ["#111111", "#ffffff", "#eee9df"], minimal: ["#202223", "#ffffff", "#f6f6f7"],
  bold: ["#111827", "#f8fafc", "#f59e0b"], conversion: ["#0f172a", "#ffffff", "#16a34a"],
  story: ["#3f3f46", "#fafaf9", "#a16207"], premium: ["#171717", "#fafafa", "#a78bfa"],
  modern: ["#0f172a", "#ffffff", "#06b6d4"], soft: ["#52525b", "#fff7ed", "#fda4af"],
  dark: ["#f8fafc", "#111827", "#22c55e"], catalogue: ["#18181b", "#ffffff", "#71717a"],
  launch: ["#0c0a09", "#fff7ed", "#ea580c"], seasonal: ["#3f6212", "#f7fee7", "#84cc16"],
};

function id(...parts) { return parts.join("-").replace(/[^a-z0-9-]/g, ""); }

// Industry copy so every template reads like a real store, not a placeholder.
const COPY = {
  fashion: { hero: "Wardrobe pieces made to be worn for years", body: "Considered fabrics, honest pricing and fits that work on real bodies.", cta: "Shop the collection", features: [["✦", "Natural fabrics", "Linen, organic cotton and merino sourced from audited mills."], ["↺", "Free returns", "30 days to try it at home, returns are on us."], ["✂", "Tailored fits", "Patterns tested on five body types before release."], ["♻", "Repair program", "Send worn pieces back and we mend them for free."]], stats: "40K+|Happy customers\n4.8/5|Average rating\n30 days|Free returns\n12|Partner mills", quotes: "The linen shirt is the best thing I bought this year.|Amira K.\nFits perfectly and still looks new after a season.|Daniel R.\nFinally a brand that tells you where clothes are made.|Sofia L." },
  beauty: { hero: "Skincare that respects your skin barrier", body: "Clinically tested formulas with short ingredient lists and visible results.", cta: "Find your routine", features: [["◎", "Dermatologist tested", "Every formula is patch tested on sensitive skin."], ["❀", "Clean ingredients", "No fragrance, parabens or drying alcohols."], ["◷", "Results in 4 weeks", "Measured hydration and texture improvements."], ["♲", "Refillable packaging", "Glass jars with refill pouches."]], stats: "92%|Saw smoother skin\n15K+|5-star reviews\n0|Synthetic fragrance\n100%|Vegan formulas", quotes: "My redness calmed down within two weeks.|Hana M.\nThe only serum my sensitive skin tolerates.|Priya S.\nLovely textures and zero irritation.|Elena G." },
  electronics: { hero: "Smart devices built for everyday life", body: "Long battery life, seamless setup and support from real engineers.", cta: "Shop devices", features: [["⚡", "All-day battery", "Up to 48 hours on a single charge."], ["⚙", "Setup in minutes", "Pair with your phone in three taps."], ["⛨", "2-year warranty", "Repairs or replacement, no questions asked."], ["☎", "Expert support", "Talk to engineers, not scripts."]], stats: "48h|Battery life\n2 years|Warranty\n120K|Devices shipped\n4.7/5|Rating", quotes: "Setup took less than five minutes.|Marco T.\nBattery easily lasts two days of heavy use.|Jin W.\nSupport fixed my issue in one email.|Lucas P." },
  food: { hero: "Small-batch food delivered fresh", body: "Seasonal ingredients from local farms, packed the day we ship.", cta: "Order now", features: [["❦", "Farm sourced", "We work directly with 30 local growers."], ["❄", "Shipped fresh", "Insulated packaging keeps everything cold."], ["✓", "No additives", "Nothing artificial, ever."], ["♡", "Taste guarantee", "Not delicious? We refund you."]], stats: "30|Partner farms\n24h|Farm to door\n60K+|Boxes delivered\n4.9/5|Taste rating", quotes: "You can really taste the difference.|Olivia B.\nArrived cold and perfectly packed.|Tom H.\nOur weekly family favourite.|Grace N." },
  saas: { hero: "The workspace your team will actually use", body: "Plan, track and ship work in one place with automations that save hours.", cta: "Start free trial", features: [["▦", "Unified workspace", "Docs, tasks and roadmaps together."], ["⟳", "Automations", "Remove repetitive work with simple rules."], ["⛨", "Enterprise security", "SSO, audit logs and SOC 2 Type II."], ["⇄", "100+ integrations", "Connect the tools you already use."]], stats: "8K+|Teams\n6h|Saved per week\n99.99%|Uptime\nSOC 2|Certified", quotes: "We replaced four tools with one.|Nadia F., COO\nOnboarding the team took a single afternoon.|Ben C., Eng Lead\nThe automations alone paid for it.|Ines V., Ops" },
  luxury: { hero: "Crafted by hand, made to be kept", body: "Limited pieces from master artisans, finished with uncompromising detail.", cta: "Discover the collection", features: [["◆", "Hand finished", "Every piece is finished by a single artisan."], ["✉", "Private service", "A dedicated advisor for every client."], ["⌂", "Lifetime care", "Complimentary servicing for life."], ["❖", "Numbered editions", "Each piece is individually certified."]], stats: "1 of 250|Edition size\n40 hrs|Craft per piece\nLifetime|Care\n18|Countries", quotes: "An heirloom from the moment it arrived.|Charlotte D.\nThe service was impeccable.|Henri M.\nWorth every hour of craftsmanship.|Isabella R." },
  "real-estate": { hero: "Find a home that fits your next chapter", body: "Curated listings, local experts and a transparent buying process.", cta: "Browse listings", features: [["⌂", "Verified listings", "Every property is inspected by our team."], ["⚑", "Local experts", "Agents who know each neighbourhood."], ["✎", "Clear pricing", "No hidden fees at any step."], ["⧗", "Fast closing", "Average close in 21 days."]], stats: "1,200+|Homes sold\n21 days|Average close\n98%|Client satisfaction\n15|Neighbourhoods", quotes: "They found us the perfect home in three weeks.|The Patel family\nHonest advice from the first call.|Mark S.\nSmoothest purchase we have ever had.|Leah & Chris" },
  "single-product": { hero: "One product, perfected", body: "Everything we know went into a single product designed to last.", cta: "Buy now", features: [["★", "Award winning design", "Recognised for form and function."], ["⛨", "Lifetime guarantee", "If it breaks, we replace it."], ["⚖", "Thoughtful materials", "Aerospace aluminium and recycled steel."], ["⇆", "Free shipping", "Delivered free worldwide."]], stats: "25K+|Owners\n4.9/5|Rating\nLifetime|Guarantee\n60+|Countries", quotes: "I use it every single day.|Ryan O.\nBuilt like a tank, looks beautiful.|Mei L.\nThe last one I will ever need.|Tom A." },
  b2b: { hero: "Wholesale supply your business can rely on", body: "Volume pricing, net terms and a dedicated account manager.", cta: "Book a consultation", features: [["▤", "Volume pricing", "Tiered discounts from 50 units."], ["⧉", "Net 30 terms", "Flexible payment for approved buyers."], ["☏", "Account manager", "One contact for every order."], ["⛟", "Reliable logistics", "98% on-time delivery."]], stats: "2,000+|Business clients\n98%|On-time delivery\nNet 30|Payment terms\n24h|Quote turnaround", quotes: "Our reorders are effortless now.|Procurement, Northline\nPricing and terms that scale with us.|Ops, Bramble Co.\nResponsive account management.|Buyer, Halden" },
  "landing-cro": { hero: "Get results in your first 30 days", body: "A proven system with clear steps, real support and a money-back guarantee.", cta: "Claim your offer", features: [["①", "Simple start", "Set up in under ten minutes."], ["②", "Guided plan", "Daily steps that build momentum."], ["③", "Real support", "Coaches answer within an hour."], ["✓", "Risk free", "Full refund within 30 days."]], stats: "50K+|Customers\n30 days|Money-back guarantee\n4.8/5|Rating\n1h|Support response", quotes: "Saw results in the first two weeks.|Jess W.\nThe guided plan kept me consistent.|Omar K.\nBest decision I made this year.|Clara P." },
};
const FAQ = "How long does shipping take?|Most orders arrive in 2–5 business days.\nCan I return my order?|Yes, returns are free within 30 days.\nDo you ship internationally?|We ship to over 40 countries.\nHow can I contact support?|Use the contact form and we reply within one business day.";

function luminance(hex) {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function themeFor(industry, palette, dark) {
  const background = dark ? "#111827" : palette[1];
  const text = dark ? "#f8fafc" : palette[0];
  // Brand colour must stay readable on the background (light palette tints are not).
  const accent = luminance(palette[2]) > 0.45 || (dark && luminance(palette[2]) < 0.2) ? (dark ? "#22c55e" : industry.accent) : palette[2];
  const brand = dark ? accent : (luminance(accent) > 0.35 ? industry.accent : accent);
  return { background, text, muted: dark ? "#cbd5e1" : "#5c5f62", brand, surface: dark ? "#1f2937" : (palette[1] === "#ffffff" ? "#f6f6f7" : "#ffffff"), border: dark ? "#334155" : "#e5e7eb" };
}

function makeBuilder(prefix) {
  let counter = 0;
  const node = (type, label, props = {}, styles = {}, children = []) => ({ id: `${prefix}-${++counter}`, type, label, props, styles, children });
  return node;
}

function headingStack(node, copy, theme, { title, align = "left", compact = false, eyebrow, body }) {
  const typo = (extra) => ({ textAlign: align, ...extra });
  return [
    node("text", "Eyebrow", { text: String(eyebrow || "").toUpperCase() }, { typography: typo({ fontSize: "12px", fontWeight: "700", color: theme.brand, letterSpacing: "1.6px" }), spacing: { marginBottom: "12px" } }),
    node("heading", "Headline", { text: title, tag: compact ? "h2" : "h1" }, { typography: typo({ fontSize: compact ? "36px" : "52px", fontWeight: "700", color: theme.text, lineHeight: "1.08" }), spacing: { marginBottom: "16px" } }),
    node("text", "Description", { text: body || copy.body }, { typography: typo({ fontSize: "17px", color: theme.muted, lineHeight: "1.6" }), spacing: { marginBottom: "24px" } }),
  ];
}

function buttonRow(node, copy, theme, align = "left") {
  const primary = node("button", "Primary button", { text: copy.cta, url: "/collections/all", variant: "primary" }, { background: { type: "color", color: theme.brand }, typography: { color: "#ffffff", fontWeight: "700" }, border: { radius: "10px" }, spacing: { paddingTop: "14px", paddingRight: "24px", paddingBottom: "14px", paddingLeft: "24px" } });
  const secondary = node("button", "Secondary button", { text: "Learn more", url: "/pages/about", variant: "secondary" }, { background: { type: "color", color: "transparent" }, typography: { color: theme.text, fontWeight: "600" }, border: { width: "1px", style: "solid", color: theme.border, radius: "10px" }, spacing: { paddingTop: "13px", paddingRight: "22px", paddingBottom: "13px", paddingLeft: "22px" } });
  return node("container", "Buttons", {}, { layout: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "12px", justifyContent: align === "center" ? "center" : "flex-start" }, spacing: { paddingTop: "0px", paddingRight: "0px", paddingBottom: "0px", paddingLeft: "0px" }, border: { width: "0px" } }, [primary, secondary]);
}

function mediaBlock(node, theme, label = "Media") {
  // Decorative brand gradient block; merchants set a background image on it.
  return node("container", label, {}, { background: { type: "gradient", color: theme.surface, gradientAngle: 135, from: theme.brand, to: theme.surface }, size: { minHeight: "380px" }, border: { width: "0px", radius: "20px" }, spacing: { paddingTop: "0px", paddingRight: "0px", paddingBottom: "0px", paddingLeft: "0px" } });
}

function plainContainer(node, label, children, extra = {}) {
  const { spacing = {}, ...rest } = extra;
  return node("container", label, {}, { spacing: { paddingTop: "0px", paddingRight: "0px", paddingBottom: "0px", paddingLeft: "0px", ...spacing }, border: { width: "0px" }, ...rest }, children);
}

function sectionWrap(node, industry, label, theme, children, compact) {
  return node("section", label, {}, { background: { type: "color", color: theme.background }, spacing: { paddingTop: compact ? "64px" : "96px", paddingRight: "48px", paddingBottom: compact ? "64px" : "96px", paddingLeft: "48px" }, border: { radius: "0px" } }, children);
}

function makeSection({ prefix, industry, pattern, palette, compact = false, dark = false }) {
  const node = makeBuilder(prefix);
  const copy = COPY[industry.key] || COPY.fashion;
  const theme = themeFor(industry, palette, dark || pattern[0].includes("dark"));
  const key = pattern[0];
  const layout = pattern[2];
  const label = `${industry.label} ${pattern[1]}`;
  const title = key.startsWith("hero") || key === "editorial" ? copy.hero : pattern[1].replace(/ · .*/, "").replace(/ Intro$/, "");
  let children;
  const centered = (stack, extra = []) => [plainContainer(node, "Content", [...stack, ...extra], { size: { maxWidth: "760px" }, spacing: { marginLeft: "auto", marginRight: "auto" } })];

  if (["features-3", "features-4", "benefits", "proof", "trust", "shipping"].includes(key)) {
    const count = key === "features-3" || key === "proof" ? 3 : 4;
    const cards = copy.features.slice(0, count).map(([icon, heading, text]) => node("icon-box", heading, { icon, heading, text, url: "" }, { background: { type: "color", color: theme.surface }, typography: { color: theme.text }, spacing: { paddingTop: "28px", paddingRight: "24px", paddingBottom: "28px", paddingLeft: "24px" }, border: { width: "1px", style: "solid", color: theme.border, radius: "16px" } }));
    const grid = node("columns", "Feature grid", { columns: count, columnsTablet: 2, columnsMobile: 1 }, { layout: { gap: "20px" } }, cards);
    children = [...centered(headingStack(node, copy, theme, { title: key === "proof" ? `Why customers choose ${industry.label.toLowerCase()} from us` : title, align: "center", compact: true, eyebrow: industry.label })), grid];
  } else if (["testimonial", "testimonial-grid"].includes(key)) {
    children = [...centered(headingStack(node, copy, theme, { title: "Loved by our customers", align: "center", compact: true, eyebrow: "Reviews" })), node("testimonials", "Testimonials", { items: [], itemsText: copy.quotes, columns: key === "testimonial" ? 1 : 3 }, { grid: { gap: "20px" }, typography: { color: theme.text } })];
  } else if (key === "stats") {
    children = [...centered(headingStack(node, copy, theme, { title: "Results that speak for themselves", align: "center", compact: true, eyebrow: industry.label })), node("stats", "Stats", { items: [], itemsText: copy.stats, columns: 4 }, { grid: { gap: "20px" }, typography: { color: theme.text } })];
  } else if (key === "logos" || key === "press") {
    children = [...centered(headingStack(node, copy, theme, { title: key === "press" ? "As featured in" : "Trusted by leading brands", align: "center", compact: true, eyebrow: "Partners", body: "Brands and publications that work with us every day." })), node("logo-cloud", "Logo cloud", { items: [], itemsText: "Northline\nBramble & Co\nHalden\nAtlas Studio\nMeridian" }, { grid: { gap: "28px" }, typography: { color: theme.muted } })];
  } else if (key === "faq") {
    children = [...centered(headingStack(node, copy, theme, { title: "Frequently asked questions", align: "center", compact: true, eyebrow: "Support" }), [node("faq", "FAQ", { items: [], itemsText: FAQ }, { spacing: { gap: "10px" }, typography: { color: theme.text } })])];
  } else if (key === "newsletter") {
    children = centered(headingStack(node, copy, theme, { title: "Get 10% off your first order", align: "center", compact: true, eyebrow: "Newsletter", body: "New arrivals, restocks and members-only offers. No spam, unsubscribe anytime." }), [node("newsletter-form", "Newsletter form", { heading: "", placeholder: "Email address", submitText: "Subscribe", successText: "Thanks for subscribing.", errorText: "Please enter a valid email address." }, { spacing: { gap: "10px" } })]);
  } else if (key === "timeline" || key === "story") {
    children = [node("columns", "Story columns", { columns: 2, columnsTablet: 1, columnsMobile: 1 }, { layout: { gap: "48px" } }, [
      plainContainer(node, "Story text", headingStack(node, copy, theme, { title: key === "story" ? `The story behind ${industry.label.toLowerCase()} done right` : "How we got here", compact: true, eyebrow: "Our story" })),
      key === "timeline" ? node("timeline", "Timeline", { items: [], itemsText: "2019|Founded|Started in a small studio with one idea.\n2022|10,000 customers|Grew through word of mouth.\n2025|Going further|New products, same standards." }, { typography: { color: theme.text } }) : mediaBlock(node, theme),
    ])];
  } else if (key === "gallery") {
    children = [...centered(headingStack(node, copy, theme, { title: "In the wild", align: "center", compact: true, eyebrow: "Gallery" })), node("columns", "Gallery", { columns: 3, columnsTablet: 2, columnsMobile: 1 }, { layout: { gap: "16px" } }, [0, 1, 2].map((index) => mediaBlock(node, theme, `Gallery image ${index + 1}`)))];
  } else if (["contact", "lead-form"].includes(key)) {
    children = [node("columns", "Contact columns", { columns: 2, columnsTablet: 1, columnsMobile: 1 }, { layout: { gap: "48px" } }, [
      plainContainer(node, "Contact text", headingStack(node, copy, theme, { title: key === "contact" ? "Talk to our team" : "Get a tailored proposal", compact: true, eyebrow: "Contact", body: "Tell us what you need and we will get back to you within one business day." })),
      node("contact-form", "Contact form", { heading: "", submitText: key === "contact" ? "Send message" : "Request proposal", successText: "Thanks. Your message has been received.", errorText: "Please check the form and try again.", showPhone: true }, { background: { type: "color", color: theme.surface }, spacing: { gap: "12px", paddingTop: "28px", paddingRight: "28px", paddingBottom: "28px", paddingLeft: "28px" }, border: { radius: "16px" } }),
    ])];
  } else if (["announcement", "offer", "urgency"].includes(key)) {
    const strip = { ...theme, background: theme.brand, text: "#ffffff", muted: "rgba(255,255,255,.85)", brand: "#ffffff" };
    const stack = headingStack(node, copy, strip, { title: key === "urgency" ? "Last chance: offer ends soon" : "Free shipping on orders over $50", align: "center", compact: true, eyebrow: key === "announcement" ? "Announcement" : "Limited offer", body: "Use code WELCOME10 at checkout for 10% off your first order." });
    const button = node("button", "Offer button", { text: copy.cta, url: "/collections/all", variant: "primary" }, { background: { type: "color", color: "#ffffff" }, typography: { color: theme.brand, fontWeight: "700" }, border: { radius: "10px" }, spacing: { paddingTop: "14px", paddingRight: "24px", paddingBottom: "14px", paddingLeft: "24px" } });
    // Row containers so justify-content centres horizontally (a column flexbox would centre vertically).
    const row = (label, children) => plainContainer(node, label, children, { layout: { display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center" } });
    const extra = key === "urgency" ? [row("Countdown row", [node("countdown", "Countdown", { endDate: "", expiredText: "Offer ended", showDays: true, showHours: true, showMinutes: true, showSeconds: true }, { typography: { color: "#ffffff" }, spacing: { marginBottom: "20px" } })])] : [];
    return sectionWrap(node, industry, label, strip, centered(stack, [...extra, row("Button", [button])]), true);
  } else if (layout === "split" || ["media-split", "collection-intro"].includes(key)) {
    const reverse = key === "media-split" || key === "premium";
    const text = plainContainer(node, "Text column", [...headingStack(node, copy, theme, { title, compact, eyebrow: industry.label }), buttonRow(node, copy, theme)], { layout: { display: "flex", flexDirection: "column", justifyContent: "center" } });
    const media = mediaBlock(node, theme);
    children = [node("columns", "Split layout", { columns: 2, columnsTablet: 1, columnsMobile: 1 }, { layout: { gap: "56px", alignItems: "center" } }, reverse ? [media, text] : [text, media])];
  } else if (["grid", "product-first"].includes(layout) || ["product-grid", "category-grid", "comparison"].includes(key)) {
    children = [...centered(headingStack(node, copy, theme, { title: layout === "product-first" ? "Bestsellers" : title, align: "center", compact: true, eyebrow: industry.label }), [buttonRow(node, copy, theme, "center")]), node(key === "category-grid" ? "collection-grid" : "product-grid", key === "category-grid" ? "Collection grid" : "Product grid", { title: "", limit: compact ? 4 : 8, columnsDesktop: 4, columnsTablet: 2, columnsMobile: 1, gap: 20, showImage: true, showTitle: true, showPrice: true }, { spacing: { marginTop: "40px" } })];
  } else if (key === "video") {
    children = [...centered(headingStack(node, copy, theme, { title: "See it in action", align: "center", compact: true, eyebrow: "Watch" })), node("video", "Video", { url: "", autoplay: false, controls: true }, { border: { radius: "16px" } })];
  } else {
    children = centered(headingStack(node, copy, theme, { title: key === "cta" ? "Ready when you are" : title, align: "center", compact, eyebrow: industry.label }), [buttonRow(node, copy, theme, "center")]);
  }
  return sectionWrap(node, industry, label, theme, children, compact);
}

function makePageContent(industry, pattern, index) {
  const palette = PALETTES[pattern[0]] || PALETTES.minimal;
  const dark = pattern[0] === "dark";
  const root = id("market", industry.key, pattern[0], index);
  const heroLayout = pattern[2] === "centered" ? ["hero-centered", "Hero", "centered"] : pattern[2] === "grid" || pattern[2] === "product-first" ? ["hero-product", "Hero", "split"] : ["hero-split", "Hero", "split"];
  const plan = {
    editorial: [heroLayout, ["story", "Story", "editorial"], ["features-3", "Features", "grid"], ["testimonial-grid", "Reviews", "grid"], ["newsletter", "Newsletter", "centered"]],
    conversion: [heroLayout, ["trust", "Trust", "grid"], ["product-grid", "Products", "product-first"], ["testimonial-grid", "Reviews", "grid"], ["faq", "FAQ", "editorial"], ["urgency", "Offer", "product-first"]],
    catalogue: [heroLayout, ["category-grid", "Categories", "grid"], ["product-grid", "Products", "product-first"], ["shipping", "Shipping", "grid"], ["newsletter", "Newsletter", "centered"]],
  }[pattern[0]] || [heroLayout, ["features-4", "Features", "grid"], ["media-split", "Media", "split"], ["stats", "Stats", "grid"], ["testimonial-grid", "Reviews", "grid"], ["cta", "CTA", "centered"]];
  const sections = plan.map((sectionPattern, position) => makeSection({ prefix: `${root}-s${position + 1}`, industry, pattern: position === 0 ? [sectionPattern[0], pattern[1], sectionPattern[2]] : sectionPattern, palette, compact: position > 0, dark }));
  const theme = themeFor(industry, palette, dark);
  return [
    { id: `${root}-globals`, type: "global-styles", label: "Global Styles", props: { primaryColor: theme.brand, textColor: theme.text, backgroundColor: theme.background, surfaceColor: theme.surface, mutedSurfaceColor: theme.surface, borderColor: theme.border, buttonBackground: theme.brand, buttonTextColor: "#ffffff", radiusMd: "12px", radiusLg: "20px", spacingBase: 4 }, styles: {}, children: [] },
    ...sections,
  ];
}

function makeSectionContent(industry, pattern, index) {
  const palette = PALETTES[PAGE_PATTERNS[index % PAGE_PATTERNS.length][0]] || PALETTES.minimal;
  return makeSection({ prefix: id("market-section", industry.key, pattern[0], index), industry, pattern, palette, compact: false, dark: PAGE_PATTERNS[index % PAGE_PATTERNS.length][0] === "dark" });
}

function pageCategory(patternKey) {
  if (["bold", "launch", "seasonal"].includes(patternKey)) return "Campaign Pages";
  if (patternKey === "conversion") return "Landing / CRO Pages";
  if (["editorial", "story", "premium"].includes(patternKey)) return "Brand & Editorial Pages";
  return "Storefront Pages";
}

function sectionCategory(patternKey) {
  if (patternKey.startsWith("hero")) return "Hero";
  if (["announcement", "offer", "urgency"].includes(patternKey)) return "Promotional";
  if (["features-3", "features-4", "benefits", "stats", "logos", "trust", "shipping"].includes(patternKey)) return "Features & Trust";
  if (["proof", "testimonial", "testimonial-grid"].includes(patternKey)) return "Social Proof";
  if (["cta", "cta-split"].includes(patternKey)) return "CTA";
  if (["newsletter", "lead-form", "contact"].includes(patternKey)) return "Lead Capture";
  if (["collection-intro", "product-grid", "category-grid", "comparison"].includes(patternKey)) return "Commerce";
  if (["media-split", "gallery", "video"].includes(patternKey)) return "Media";
  return "Content";
}

function qualityScore(kind, index) {
  const base = kind === "page" ? 88 : 84;
  return Math.min(99, base + (index % 11));
}

function metadata({ kind, industry, style, layout, index, title, content, category }) {
  const palette = PALETTES[style] || PALETTES.minimal;
  return {
    id: id("vsn", kind, industry.key, style || layout, index),
    catalogId: id("vsn", kind, industry.key, style || layout, index),
    version: 1,
    title,
    kind,
    category: category || (kind === "page" ? "Page Templates" : "Sections"),
    industry: industry.key,
    industryLabel: industry.label,
    style,
    layout,
    planTier: index % 4 === 0 ? "pro" : "free",
    colorTags: palette,
    previewImage: industry.image,
    description: `${industry.label} ${kind === "page" ? "page template" : "section"} with editable VSN structure and responsive styling.`,
    qualityScore: qualityScore(kind, index),
    compatibility: { minBuilderVersion: "2.5.48", schemaVersion: 1, widgets: "core", shopifyOnlineStore2: true },
    screenshot: { image: industry.image, viewport: { width: 1440, height: 1000 }, generated: true },
    source: "builtin",
    content,
  };
}

export const BUILTIN_MARKETPLACE_PAGES = INDUSTRIES.flatMap((industry, industryIndex) => PAGE_PATTERNS.map((pattern, patternIndex) => {
  const index = industryIndex * PAGE_PATTERNS.length + patternIndex;
  return metadata({ kind: "page", industry, style: pattern[0], layout: pattern[2], category: pageCategory(pattern[0]), index, title: `${industry.label} · ${pattern[1]}`, content: makePageContent(industry, pattern, index) });
}));

export const BUILTIN_MARKETPLACE_SECTIONS = INDUSTRIES.flatMap((industry, industryIndex) => SECTION_PATTERNS.map((pattern, patternIndex) => {
  const index = industryIndex * SECTION_PATTERNS.length + patternIndex;
  const style = PAGE_PATTERNS[(industryIndex + patternIndex) % PAGE_PATTERNS.length][0];
  return metadata({ kind: "section", industry, style, layout: pattern[2], category: sectionCategory(pattern[0]), index, title: `${industry.label} · ${pattern[1]}`, content: makeSectionContent(industry, pattern, index) });
}));

export const BUILTIN_MARKETPLACE_CATALOG = [...BUILTIN_MARKETPLACE_PAGES, ...BUILTIN_MARKETPLACE_SECTIONS];
export const MARKETPLACE_INDUSTRIES = INDUSTRIES.map(({ key, label }) => ({ key, label }));
export const MARKETPLACE_STYLES = [...new Set(PAGE_PATTERNS.map(([key]) => key))];
export const MARKETPLACE_LAYOUTS = [...new Set([...PAGE_PATTERNS.map(([, , layout]) => layout), ...SECTION_PATTERNS.map(([, , layout]) => layout)])];
export const MARKETPLACE_COUNTS = { pages: BUILTIN_MARKETPLACE_PAGES.length, sections: BUILTIN_MARKETPLACE_SECTIONS.length, total: BUILTIN_MARKETPLACE_CATALOG.length };
