import { vsnElement } from "./renderDescriptor.js";

// High-demand storefront widgets (before/after, hotspots, animated headline,
// star rating, flip box, table of contents, alert). Each one renders the same
// markup in the editor and on the storefront; interactive behaviour is added by
// the storefront runtime (vsn-page-renderer.js) and styled by vsn-page-renderer.css.
const text = (value, fallback = "", max = 400) => String(value ?? fallback).slice(0, max);
const clamp = (value, min, max, fallback) => { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };
const lines = (value, max = 24) => String(value || "").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, max);
const STOCK = "/vsn-stock/fashion.svg";
const base = { acceptsChildren: false, capabilities: { typography: true, background: true, border: true, spacing: true, responsive: true, visibility: true, customCss: true }, styleProfile: { groups: ["typography", "background", "border", "spacing", "responsive", "advanced"] } };

function beforeAfter() {
  const render = ({ node }) => {
    const p = node.props || {};
    const start = clamp(p.startPosition, 0, 100, 50);
    return vsnElement("figure", { className: "vsn-compare", "data-vsn-compare": "1", "data-vsn-compare-start": String(start), style: { position: "relative", margin: 0, overflow: "hidden", borderRadius: 12, aspectRatio: text(p.aspectRatio, "4 / 3", 20), userSelect: "none" } }, [
      vsnElement("img", { className: "vsn-compare-img", src: text(p.beforeImage, STOCK, 2000), alt: text(p.beforeLabel, "Before", 120), loading: "lazy", style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } }),
      vsnElement("img", { className: "vsn-compare-img vsn-compare-after", src: text(p.afterImage, "/vsn-stock/beauty.svg", 2000), alt: text(p.afterLabel, "After", 120), loading: "lazy", style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", clipPath: `inset(0 0 0 ${start}%)` } }),
      p.showLabels === false ? null : vsnElement("span", { className: "vsn-compare-label", style: { position: "absolute", left: 12, top: 12, padding: "4px 10px", borderRadius: 999, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 12 } }, text(p.beforeLabel, "Before", 60)),
      p.showLabels === false ? null : vsnElement("span", { className: "vsn-compare-label", style: { position: "absolute", right: 12, top: 12, padding: "4px 10px", borderRadius: 999, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 12 } }, text(p.afterLabel, "After", 60)),
      vsnElement("span", { className: "vsn-compare-handle", role: "slider", tabIndex: 0, "aria-label": "Compare images", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(start), style: { position: "absolute", top: 0, bottom: 0, left: `${start}%`, width: 3, marginLeft: -1.5, background: text(p.handleColor, "#ffffff", 40), cursor: "ew-resize", boxShadow: "0 0 0 1px rgba(0,0,0,.15)" } }),
    ].filter(Boolean));
  };
  return { ...base, id: "before-after", label: "Before / After", category: "Media",
    defaults: { props: { beforeImage: STOCK, afterImage: "/vsn-stock/beauty.svg", beforeLabel: "Before", afterLabel: "After", showLabels: true, startPosition: 50, aspectRatio: "4 / 3", handleColor: "#ffffff" }, styles: {} },
    controls: [
      { key: "beforeImage", type: "media", label: "Before image" }, { key: "afterImage", type: "media", label: "After image" },
      { key: "beforeLabel", type: "text", label: "Before label", default: "Before" }, { key: "afterLabel", type: "text", label: "After label", default: "After" },
      { key: "showLabels", type: "toggle", label: "Show labels", default: true },
      { key: "startPosition", type: "range", label: "Start position (%)", min: 0, max: 100, step: 1, default: 50 },
      { key: "aspectRatio", type: "select", label: "Aspect ratio", default: "4 / 3", options: [{ value: "1 / 1", label: "Square" }, { value: "4 / 3", label: "Landscape 4:3" }, { value: "16 / 9", label: "Wide 16:9" }, { value: "4 / 5", label: "Portrait 4:5" }] },
      { key: "handleColor", type: "color", label: "Handle color", default: "#ffffff" },
    ],
    renderers: { editor: render, storefront: render } };
}

function hotspots() {
  const points = (p) => lines(p.pointsText, 12).map((line, index) => { const [x, y, title, body, url] = line.split("|").map((part) => part.trim()); return { x: clamp(x, 0, 100, 50), y: clamp(y, 0, 100, 50), title: text(title, `Spot ${index + 1}`, 80), body: text(body, "", 240), url: text(url, "", 500) }; });
  const render = ({ node }) => {
    const p = node.props || {};
    const color = text(p.pinColor, "#625BA8", 40);
    return vsnElement("figure", { className: "vsn-hotspots", style: { position: "relative", margin: 0 } }, [
      vsnElement("img", { src: text(p.image, STOCK, 2000), alt: text(p.alt, "Shop the look", 160), loading: "lazy", style: { display: "block", width: "100%", height: "auto", borderRadius: 12 } }),
      ...points(p).map((point, index) => vsnElement("span", { key: index, className: "vsn-hotspot", tabIndex: 0, role: "button", "aria-label": point.title, style: { position: "absolute", left: `${point.x}%`, top: `${point.y}%`, transform: "translate(-50%,-50%)" } }, [
        vsnElement("span", { className: "vsn-hotspot-pin", style: { display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: "50%", background: color, color: "#fff", fontWeight: 700, boxShadow: "0 0 0 6px rgba(255,255,255,.55)" } }, "+"),
        vsnElement("span", { className: "vsn-hotspot-card", role: "tooltip", style: { position: "absolute", left: "50%", bottom: "calc(100% + 10px)", transform: "translateX(-50%)", minWidth: 180, maxWidth: 240, padding: "10px 12px", borderRadius: 10, background: "#fff", color: "#1a1a1a", boxShadow: "0 10px 30px rgba(0,0,0,.18)", fontSize: 13, zIndex: 3 } }, [
          vsnElement("strong", { style: { display: "block" } }, point.title),
          point.body ? vsnElement("span", { style: { display: "block", marginTop: 4, color: "#555" } }, point.body) : null,
          point.url ? vsnElement("a", { href: point.url, style: { display: "inline-block", marginTop: 6, color, fontWeight: 600 } }, text(p.linkText, "Shop now", 40)) : null,
        ].filter(Boolean)),
      ])),
    ]);
  };
  return { ...base, id: "image-hotspots", label: "Image Hotspots", category: "Media",
    defaults: { props: { image: STOCK, alt: "Shop the look", pointsText: "30|40|Linen shirt|Breathable and relaxed.|/collections/all\n68|62|Canvas bag|Carries everything.|/collections/all", pinColor: "#625BA8", linkText: "Shop now" }, styles: {} },
    controls: [
      { key: "image", type: "media", label: "Image" }, { key: "alt", type: "text", label: "Alt text", default: "Shop the look" },
      { key: "pointsText", type: "textarea", label: "Hotspots", help: "One per line: x% | y% | title | text | link (link optional)." },
      { key: "pinColor", type: "color", label: "Pin color", default: "#625BA8" }, { key: "linkText", type: "text", label: "Link label", default: "Shop now" },
    ],
    renderers: { editor: render, storefront: render } };
}

function animatedHeadline() {
  const words = (p) => String(p.words || "").split(/[\n,]/).map((word) => word.trim()).filter(Boolean).slice(0, 12);
  const render = ({ node }) => {
    const p = node.props || {}; const list = words(p); const first = list[0] || "amazing";
    return vsnElement("div", { className: "vsn-animated-headline", role: "heading", "aria-level": text(p.level, "2", 1), "data-vsn-rotate-words": JSON.stringify(list), "data-vsn-rotate-mode": p.mode === "fade" ? "fade" : "typing", "data-vsn-rotate-speed": String(clamp(p.speed, 800, 10000, 2500)), style: { fontSize: 40, fontWeight: 700, lineHeight: 1.2 } }, [
      p.before ? `${text(p.before, "", 160)} ` : "",
      vsnElement("span", { className: "vsn-rotate-word", style: { color: text(p.highlightColor, "#625BA8", 40), borderRight: p.mode === "fade" ? "0" : "2px solid currentColor", paddingRight: 2 } }, first),
      p.after ? ` ${text(p.after, "", 160)}` : "",
    ]);
  };
  return { ...base, id: "animated-headline", label: "Animated Headline", category: "Basic",
    defaults: { props: { before: "Made for", words: "everyday wear, slow living, real bodies", after: "", mode: "typing", speed: 2500, level: "2", highlightColor: "#625BA8" }, styles: {} },
    controls: [
      { key: "before", type: "text", label: "Before text", default: "Made for" }, { key: "words", type: "textarea", label: "Rotating words", help: "Comma or line separated." },
      { key: "after", type: "text", label: "After text", default: "" },
      { key: "mode", type: "select", label: "Animation", default: "typing", options: [{ value: "typing", label: "Typing" }, { value: "fade", label: "Fade" }] },
      { key: "speed", type: "number", label: "Word duration (ms)", min: 800, max: 10000, step: 100, default: 2500 },
      { key: "level", type: "select", label: "Heading level", default: "2", options: ["1", "2", "3", "4"].map((v) => ({ value: v, label: `H${v}` })) },
      { key: "highlightColor", type: "color", label: "Highlight color", default: "#625BA8" },
    ],
    renderers: { editor: render, storefront: render } };
}

function starRating() {
  const render = ({ node }) => {
    const p = node.props || {}; const max = clamp(p.max, 1, 10, 5); const rating = clamp(p.rating, 0, max, 4.5);
    const size = clamp(p.size, 10, 64, 20); const color = text(p.color, "#F5A623", 40); const empty = text(p.emptyColor, "#D9D9D9", 40);
    const stars = "★".repeat(max);
    return vsnElement("div", { className: "vsn-star-rating", role: "img", "aria-label": `${rating} out of ${max} stars`, style: { display: "inline-flex", alignItems: "center", gap: 8 } }, [
      vsnElement("span", { style: { position: "relative", display: "inline-block", fontSize: size, lineHeight: 1, letterSpacing: 2, color: empty } }, [
        stars,
        vsnElement("span", { "aria-hidden": "true", style: { position: "absolute", inset: 0, width: `${(rating / max) * 100}%`, overflow: "hidden", whiteSpace: "nowrap", color } }, stars),
      ]),
      p.showNumber === false ? null : vsnElement("span", { style: { fontWeight: 600 } }, `${rating}${p.label ? ` ${text(p.label, "", 80)}` : ""}`),
    ].filter(Boolean));
  };
  return { ...base, id: "star-rating", label: "Star Rating", category: "Content",
    defaults: { props: { rating: 4.5, max: 5, showNumber: true, label: "(128 reviews)", size: 20, color: "#F5A623", emptyColor: "#D9D9D9" }, styles: {} },
    controls: [
      { key: "rating", type: "number", label: "Rating", min: 0, max: 10, step: 0.1, default: 4.5 }, { key: "max", type: "number", label: "Stars", min: 1, max: 10, step: 1, default: 5 },
      { key: "showNumber", type: "toggle", label: "Show number", default: true }, { key: "label", type: "text", label: "Label", default: "(128 reviews)" },
      { key: "size", type: "range", label: "Star size (px)", min: 10, max: 64, step: 1, default: 20 },
      { key: "color", type: "color", label: "Star color", default: "#F5A623" }, { key: "emptyColor", type: "color", label: "Empty star color", default: "#D9D9D9" },
    ],
    renderers: { editor: render, storefront: render } };
}

function flipBox() {
  const face = (side, p) => {
    const front = side === "front";
    return vsnElement("div", { className: `vsn-flip-face vsn-flip-${side}`, style: { position: "absolute", inset: 0, display: "grid", alignContent: "center", gap: 10, padding: 24, textAlign: "center", borderRadius: 14, backfaceVisibility: "hidden", background: text(front ? p.frontBackground : p.backBackground, front ? "#F4F3FB" : "#625BA8", 40), color: text(front ? p.frontColor : p.backColor, front ? "#1A1A1A" : "#FFFFFF", 40), transform: front ? "none" : "rotateY(180deg)" } }, [
      front && p.icon ? vsnElement("span", { style: { fontSize: 32 } }, text(p.icon, "", 8)) : null,
      vsnElement("strong", { style: { fontSize: 20 } }, text(front ? p.frontTitle : p.backTitle, front ? "Hover me" : "Here is more", 120)),
      vsnElement("span", {}, text(front ? p.frontText : p.backText, "", 400)),
      !front && p.buttonText ? vsnElement("a", { href: text(p.buttonUrl, "#", 500), style: { justifySelf: "center", marginTop: 6, padding: "10px 18px", borderRadius: 8, background: "#fff", color: "#1a1a1a", fontWeight: 600, textDecoration: "none" } }, text(p.buttonText, "", 60)) : null,
    ].filter(Boolean));
  };
  const render = ({ node }) => {
    const p = node.props || {};
    return vsnElement("div", { className: "vsn-flip-box", tabIndex: 0, "data-vsn-flip": p.direction === "vertical" ? "vertical" : "horizontal", style: { position: "relative", minHeight: clamp(p.height, 160, 800, 280), perspective: 1000 } }, [
      vsnElement("div", { className: "vsn-flip-inner", style: { position: "absolute", inset: 0, transformStyle: "preserve-3d", transition: "transform .6s ease" } }, [face("front", p), face("back", p)]),
    ]);
  };
  return { ...base, id: "flip-box", label: "Flip Box", category: "Content",
    defaults: { props: { icon: "✦", frontTitle: "Free returns", frontText: "Hover to learn more", backTitle: "30 days, no questions", backText: "Send it back for a full refund.", buttonText: "Read policy", buttonUrl: "/policies/refund-policy", direction: "horizontal", height: 280, frontBackground: "#F4F3FB", frontColor: "#1A1A1A", backBackground: "#625BA8", backColor: "#FFFFFF" }, styles: {} },
    controls: [
      { key: "icon", type: "text", label: "Front icon / emoji", default: "✦" }, { key: "frontTitle", type: "text", label: "Front title" }, { key: "frontText", type: "textarea", label: "Front text" },
      { key: "backTitle", type: "text", label: "Back title" }, { key: "backText", type: "textarea", label: "Back text" },
      { key: "buttonText", type: "text", label: "Back button text" }, { key: "buttonUrl", type: "url", label: "Back button link" },
      { key: "direction", type: "select", label: "Flip direction", default: "horizontal", options: [{ value: "horizontal", label: "Horizontal" }, { value: "vertical", label: "Vertical" }] },
      { key: "height", type: "number", label: "Height (px)", min: 160, max: 800, step: 10, default: 280 },
      { key: "frontBackground", type: "color", label: "Front background" }, { key: "frontColor", type: "color", label: "Front text color" },
      { key: "backBackground", type: "color", label: "Back background" }, { key: "backColor", type: "color", label: "Back text color" },
    ],
    renderers: { editor: render, storefront: render } };
}

function tableOfContents() {
  const render = ({ node, context }) => {
    const p = node.props || {}; const sample = Boolean(context?.editor ?? true);
    return vsnElement("nav", { className: "vsn-toc", "aria-label": text(p.title, "Contents", 80), "data-vsn-toc": text(p.headings, "h2,h3", 40).replace(/[^h1-6,]/gi, ""), style: { padding: 18, border: "1px solid #E5E5E5", borderRadius: 12 } }, [
      vsnElement("strong", { style: { display: "block", marginBottom: 8 } }, text(p.title, "Contents", 80)),
      vsnElement("ol", { className: "vsn-toc-list", style: { margin: 0, paddingLeft: 20, display: "grid", gap: 6 } }, sample ? ["Introduction", "How it works", "Frequently asked questions"].map((item) => vsnElement("li", {}, vsnElement("a", { href: "#", style: { color: "inherit" } }, item))) : []),
    ]);
  };
  return { ...base, id: "table-of-contents", label: "Table of Contents", category: "Content",
    defaults: { props: { title: "Contents", headings: "h2,h3" }, styles: {} },
    controls: [
      { key: "title", type: "text", label: "Title", default: "Contents" },
      { key: "headings", type: "select", label: "Include headings", default: "h2,h3", options: [{ value: "h2", label: "H2" }, { value: "h2,h3", label: "H2 + H3" }, { value: "h2,h3,h4", label: "H2 – H4" }] },
    ],
    renderers: { editor: render, storefront: ({ node }) => render({ node, context: { editor: false } }) } };
}

function alertBox() {
  const tones = { info: ["#EAF2FF", "#1F4FB2", "ℹ"], success: ["#E8F7EE", "#14743A", "✓"], warning: ["#FFF6E0", "#8A5A00", "!"], error: ["#FDECEC", "#A1202A", "✕"] };
  const render = ({ node }) => {
    const p = node.props || {}; const [bg, fg, icon] = tones[p.tone] || tones.info;
    return vsnElement("div", { className: "vsn-alert", role: p.tone === "error" ? "alert" : "status", style: { display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", borderRadius: 10, background: bg, color: fg, border: `1px solid ${fg}33` } }, [
      p.showIcon === false ? null : vsnElement("span", { "aria-hidden": "true", style: { fontWeight: 700 } }, icon),
      vsnElement("div", { style: { flex: 1 } }, [p.title ? vsnElement("strong", { style: { display: "block" } }, text(p.title, "", 120)) : null, vsnElement("span", {}, text(p.text, "", 600))].filter(Boolean)),
      p.dismissible ? vsnElement("button", { type: "button", className: "vsn-alert-close", "aria-label": "Dismiss", "data-vsn-alert-dismiss": "1", style: { border: 0, background: "transparent", color: "inherit", cursor: "pointer", fontSize: 16 } }, "×") : null,
    ].filter(Boolean));
  };
  return { ...base, id: "alert", label: "Alert", category: "Content",
    defaults: { props: { tone: "info", title: "Heads up", text: "Orders placed today ship tomorrow.", showIcon: true, dismissible: true }, styles: {} },
    controls: [
      { key: "tone", type: "select", label: "Type", default: "info", options: [{ value: "info", label: "Info" }, { value: "success", label: "Success" }, { value: "warning", label: "Warning" }, { value: "error", label: "Error" }] },
      { key: "title", type: "text", label: "Title" }, { key: "text", type: "textarea", label: "Message" },
      { key: "showIcon", type: "toggle", label: "Show icon", default: true }, { key: "dismissible", type: "toggle", label: "Dismissible", default: true },
    ],
    renderers: { editor: render, storefront: render } };
}

export const PRO_WIDGET_DEFINITIONS = [beforeAfter, hotspots, animatedHeadline, starRating, flipBox, tableOfContents, alertBox];
