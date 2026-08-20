import { auditBatchCss3Profiles, batchCss3Targets, getWidgetStyleProfile } from "../app/builder/widgetStyleProfiles.js";
import { buildWidgetSpecificCss } from "../app/builder/widgetSpecificStyleEngine.js";

const groups = auditBatchCss3Profiles();
for (const [name, result] of Object.entries(groups)) {
  if (result.missing.length) throw new Error(`CSS-3 ${name} missing profiles: ${result.missing.join(", ")}`);
  if (result.covered !== result.total) throw new Error(`CSS-3 ${name} coverage mismatch ${result.covered}/${result.total}`);
}

const required = {
  "navigation-menu": ["navigation"],
  "contact-form": ["form", "button"],
  "social-icons": ["icon"],
  accordion: ["accordion"],
  tabs: ["tabs"],
  "progress-bar": ["progress"],
  "data-table": ["table"],
  counter: ["stats"],
  carousel: ["carousel"],
  "announcement-bar": ["bar"],
  divider: ["divider"],
};
for (const [type, features] of Object.entries(required)) {
  const profile = getWidgetStyleProfile(type);
  for (const feature of features) if (!profile.features.includes(feature)) throw new Error(`${type} missing CSS-3 feature ${feature}`);
}

const navCss = buildWidgetSpecificCss("navigation-menu", "css3-nav", {
  navigation: { borderWidth: "1px", borderColor: "#ddd", hoverBorderColor: "#95BF47", focusWidth: "2px", focusColor: "#95BF47", submenuMinWidth: "18rem", submenuItemPaddingX: "12px" },
});
if (!navCss.includes(":focus-visible") || !navCss.includes("min-width:18rem") || !navCss.includes("border-width:1px")) throw new Error("Navigation interaction CSS missing");

const formCss = buildWidgetSpecificCss("contact-form", "css3-form", {
  form: { controlBorderWidth: "1px", controlBorderStyle: "solid", textareaMinHeight: "8rem", textareaResize: "vertical", accentColor: "#95BF47", disabledOpacity: 0.55, placeholderOpacity: 0.7 },
});
if (!formCss.includes("textarea") || !formCss.includes("resize:vertical") || !formCss.includes("accent-color:#95BF47") || !formCss.includes(":disabled")) throw new Error("Form state CSS missing");

const iconCss = buildWidgetSpecificCss("social-icons", "css3-icon", {
  icon: { borderWidth: "1px", strokeWidth: 1.5, hoverTransform: "scale(1.05)", transition: "all .2s ease" },
});
if (!iconCss.includes("stroke-width:1.5") || !iconCss.includes(":hover") || !iconCss.includes("scale(1.05)")) throw new Error("Icon interaction CSS missing");

const accordionCss = buildWidgetSpecificCss("accordion", "css3-accordion", {
  accordion: { borderWidth: "1px", headerHoverBackground: "#f6f6f7", openShadow: "0 10px 30px rgba(0,0,0,.1)", markerColor: "#95BF47" },
});
if (!accordionCss.includes("summary:hover") || !accordionCss.includes("details[open]") || !accordionCss.includes("summary::marker")) throw new Error("Accordion state CSS missing");

const tabsCss = buildWidgetSpecificCss("tabs", "css3-tabs", {
  tabs: { gap: "8px", borderWidth: "1px", panelBorderWidth: "1px", panelShadow: "0 8px 20px rgba(0,0,0,.08)" },
});
if (!tabsCss.includes("gap:8px") || !tabsCss.includes("box-shadow:0 8px 20px")) throw new Error("Tabs interaction CSS missing");

const progressCss = buildWidgetSpecificCss("progress-bar", "css3-progress", {
  progress: { fillBackground: { type: "gradient", gradientType: "linear", angle: 90, stops: [{ color: "#95BF47", position: 0 }, { color: "#008060", position: 100 }] }, trackBorderWidth: "1px" },
});
if (!progressCss.includes("linear-gradient") || !progressCss.includes("border-width:1px")) throw new Error("Progress CSS missing");

const tableCss = buildWidgetSpecificCss("data-table", "css3-table", {
  table: { rowBorderWidth: "1px", stickyHeader: true, textAlign: "center" },
});
if (!tableCss.includes("position:sticky") || !tableCss.includes("text-align:center")) throw new Error("Table detail CSS missing");

const statsCss = buildWidgetSpecificCss("counter", "css3-stats", {
  stats: { itemGap: "12px", itemShadow: "0 8px 24px rgba(0,0,0,.08)", valueLineHeight: "1.1em" },
});
if (!statsCss.includes("gap:12px") || !statsCss.includes("line-height:1.1em")) throw new Error("Stats CSS missing");

const carouselCss = buildWidgetSpecificCss("carousel", "css3-carousel", {
  carousel: { snapAlign: "center", scrollBehavior: "smooth", itemBorderWidth: "1px", itemHoverTransform: "translateY(-2px)" },
});
if (!carouselCss.includes("scroll-snap-align:center") || !carouselCss.includes("scroll-behavior:smooth") || !carouselCss.includes("translateY(-2px)")) throw new Error("Carousel CSS missing");

const barCss = buildWidgetSpecificCss("announcement-bar", "css3-bar", {
  bar: { background: { type: "color", color: "#111" }, color: "#fff", borderWidth: "1px", textTransform: "uppercase" },
});
if (!barCss.includes("background-color:#111") || !barCss.includes("text-transform:uppercase")) throw new Error("Bar CSS missing");

const dividerCss = buildWidgetSpecificCss("divider", "css3-divider", { divider: { opacity: 0.4, width: "2px" } });
if (!dividerCss.includes("opacity:0.4")) throw new Error("Divider effects CSS missing");

const total = Object.values(batchCss3Targets).flat().length;
console.log(`CSS-3 target profile entries: ${total}/${total}`);
console.log("Navigation/Form/Icon/Interactive renderer checks: PASS");
console.log("Batch CSS-3 audit: PASS");
