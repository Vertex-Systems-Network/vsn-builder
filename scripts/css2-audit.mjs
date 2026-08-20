import { auditBatchCss2Profiles, batchCss2Targets, getWidgetStyleProfile } from "../app/builder/widgetStyleProfiles.js";
import { buildWidgetSpecificCss } from "../app/builder/widgetSpecificStyleEngine.js";

const groups = auditBatchCss2Profiles();
for (const [name, result] of Object.entries(groups)) {
  if (result.missing.length) throw new Error(`CSS-2 ${name} missing profiles: ${result.missing.join(", ")}`);
  if (result.covered !== result.total) throw new Error(`CSS-2 ${name} coverage mismatch ${result.covered}/${result.total}`);
}

const required = {
  container: ["structureItems"],
  heading: ["textCore"],
  text: ["textCore", "richText"],
  image: ["media"],
  "product-gallery": ["media", "galleryThumbs"],
  button: ["button"],
  "product-add-to-cart": ["button"],
};
for (const [type, features] of Object.entries(required)) {
  const profile = getWidgetStyleProfile(type);
  for (const feature of features) {
    if (!profile.features.includes(feature)) throw new Error(`${type} missing CSS-2 feature ${feature}`);
  }
}

const structureCss = buildWidgetSpecificCss("container", "css2-structure", {
  structureItems: { minWidth: "12rem", padding: "1rem", borderWidth: "1px", borderColor: "#ddd", background: { type: "color", color: "#fff" } },
});
if (!structureCss.includes('[data-vsn-id="css2-structure"]>*') || !structureCss.includes("min-width:12rem")) throw new Error("Structure child CSS was not generated");

const textCss = buildWidgetSpecificCss("heading", "css2-text", {
  textCore: { fill: { type: "gradient", gradientType: "linear", angle: 90, stops: [{ color: "#111111", position: 0 }, { color: "#95BF47", position: 100 }] }, selectionBackground: "#95BF47" },
});
if (!textCss.includes("background-clip:text") || !textCss.includes("::selection")) throw new Error("Text surface CSS was not generated");

const mediaCss = buildWidgetSpecificCss("image", "css2-media", {
  media: { width: "80%", borderWidth: "2px", borderColor: "#111", shadow: "0 4px 12px rgba(0,0,0,.2)", hoverTransform: "scale(1.03)", transition: "transform .2s ease" },
});
if (!mediaCss.includes("border-width:2px") || !mediaCss.includes(":hover") || !mediaCss.includes("scale(1.03)")) throw new Error("Media advanced CSS was not generated");

const buttonCss = buildWidgetSpecificCss("button", "css2-button", {
  button: { borderWidth: "1px", borderStyle: "dashed", lineHeight: "1.2em", textTransform: "uppercase", iconSize: "18px", activeTransform: "translateY(1px)", transitionDuration: ".2s", transitionTiming: "ease" },
});
if (!buttonCss.includes("text-transform:uppercase") || !buttonCss.includes(":active") || !buttonCss.includes("transition-duration:.2s")) throw new Error("Button advanced CSS was not generated");
if (buttonCss.includes('[data-vsn-id="css2-button"]{width:18px')) throw new Error("Icon sizing leaked onto button root selector");

const totalTargets = Object.values(batchCss2Targets).flat().length;
console.log(`CSS-2 target profiles: ${totalTargets}/${totalTargets}`);
console.log("Structure/Text/Media/Button renderer checks: PASS");
console.log("Batch CSS-2 audit: PASS");
