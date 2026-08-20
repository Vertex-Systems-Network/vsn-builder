/**
 * VSN editor control schema helpers.
 *
 * Keeps UI capabilities separate from persisted CSS values. Values remain valid
 * CSS/system tokens; only labels are humanized for merchants.
 */

export const CONTROL_SCHEMA_VERSION = 1;

export const FIELD_TYPE_CAPABILITIES = Object.freeze({
  text: Object.freeze({ toggleable: true }),
  textarea: Object.freeze({ toggleable: true }),
  number: Object.freeze({ toggleable: true }),
  length: Object.freeze({ toggleable: true }),
  select: Object.freeze({ toggleable: true }),
  multiselect: Object.freeze({ toggleable: true }),
  checkbox: Object.freeze({ toggleable: true }),
  radio: Object.freeze({ toggleable: true }),
  media: Object.freeze({ toggleable: true }),
  color: Object.freeze({
    toggleable: true,
    color: Object.freeze({ solid: true, gradient: true }),
  }),
});

export const COLOR_CAPABILITY_PRESETS = Object.freeze({
  solid: Object.freeze({ solid: true, gradient: false }),
  gradient: Object.freeze({ solid: false, gradient: true }),
  both: Object.freeze({ solid: true, gradient: true }),
  none: Object.freeze({ solid: false, gradient: false }),
});

const FRIENDLY_LABELS = Object.freeze({
  "flex-start": "Start",
  "flex-end": "End",
  "space-between": "Space Between",
  "space-around": "Space Around",
  "space-evenly": "Space Evenly",
  "row-reverse": "Row Reverse",
  "column-reverse": "Column Reverse",
  "wrap-reverse": "Wrap Reverse",
  "no-repeat": "No Repeat",
  "repeat-x": "Repeat Horizontally",
  "repeat-y": "Repeat Vertically",
  "scale-down": "Scale Down",
  "break-all": "Break All",
  "keep-all": "Keep All",
  "break-word": "Break Word",
  "break-spaces": "Break Spaces",
  "pre-wrap": "Preserve + Wrap",
  "pre-line": "Preserve Lines",
  "line-through": "Line Through",
  "ease-in": "Ease In",
  "ease-out": "Ease Out",
  "ease-in-out": "Ease In Out",
  "step-start": "Step Start",
  "step-end": "Step End",
  "not-allowed": "Not Allowed",
  "pan-x": "Pan Horizontally",
  "pan-y": "Pan Vertically",
  "pinch-zoom": "Pinch Zoom",
  "menulist-button": "Menu List Button",
  "both-edges": "Both Edges",
  "subpixel-antialiased": "Subpixel Antialiased",
  "optimizeSpeed": "Optimize Speed",
  "optimizeLegibility": "Optimize Legibility",
  "geometricPrecision": "Geometric Precision",
});

export function humanizeControlValue(value) {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (!raw) return "";
  if (FRIENDLY_LABELS[raw]) return FRIENDLY_LABELS[raw];
  if (/^-?\d+(?:\.\d+)?$/.test(raw) || /[%/()]/.test(raw)) return raw;

  const spaced = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return spaced
    .split(" ")
    .map((word) => {
      const upper = word.toUpperCase();
      if (["CSS", "URL", "HTML", "SVG", "X", "Y", "Z", "RTL", "LTR"].includes(upper)) return upper;
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function normalizeControlOptions(options = []) {
  return options.map((option) => {
    if (option !== null && typeof option === "object" && !Array.isArray(option)) {
      const value = option.value ?? "";
      return {
        ...option,
        value,
        label: option.label ?? humanizeControlValue(value),
      };
    }
    return { value: option, label: humanizeControlValue(option) };
  });
}

export function normalizeColorCapabilities(capabilities, { solidOnly = false, gradientOnly = false } = {}) {
  let solid = capabilities?.solid !== false;
  let gradient = capabilities?.gradient !== false;

  if (solidOnly) { solid = true; gradient = false; }
  if (gradientOnly) { solid = false; gradient = true; }

  // A color control with no modes is unusable. Fall back to solid for legacy
  // callers instead of rendering an empty panel.
  if (!solid && !gradient) solid = true;
  return { solid, gradient };
}

export function resolveColorMode(value, capabilities) {
  const caps = normalizeColorCapabilities(capabilities);
  if (caps.solid && !caps.gradient) return "color";
  if (!caps.solid && caps.gradient) return "gradient";
  const requested = value?.type === "gradient" ? "gradient" : "color";
  if (requested === "gradient" && caps.gradient) return "gradient";
  return caps.solid ? "color" : "gradient";
}
