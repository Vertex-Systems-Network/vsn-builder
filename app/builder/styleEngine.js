import { normalizeStyleShape } from "./styleSchema.js";

/**
 * VSN global style engine.
 * One pure mapper is shared by Canvas, Preview and storefront so Advanced
 * controls cannot drift between editor and published output.
 */

const LEGACY_SHADOWS = {
  None: "none",
  Small: "0 1px 2px rgba(0,0,0,.08)",
  Medium: "0 6px 18px rgba(0,0,0,.12)",
  Large: "0 14px 34px rgba(0,0,0,.16)",
  "Extra Large": "0 24px 60px rgba(0,0,0,.2)",
};

const CSS_NAME_OVERRIDES = {
  WebkitTextStroke: "-webkit-text-stroke",
  WebkitBackdropFilter: "-webkit-backdrop-filter",
};

function present(value) {
  return value !== undefined && value !== null && value !== "";
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function first(...values) {
  return values.find(present);
}

function alphaColor(color, opacity = 1) {
  const source = String(color || "#000000");
  const alpha = Math.max(0, Math.min(1, numberOr(opacity, 1)));
  if (alpha >= 1 || !/^#[0-9a-f]{6}$/i.test(source)) return source;
  const r = parseInt(source.slice(1, 3), 16);
  const g = parseInt(source.slice(3, 5), 16);
  const b = parseInt(source.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function gradientCss(background = {}) {
  const stops = Array.isArray(background?.stops) && background.stops.length
    ? background.stops
    : [
        { color: background?.from || "#ffffff", position: 0, opacity: 1 },
        { color: background?.to || "#000000", position: 100, opacity: 1 },
      ];
  const body = stops
    .slice()
    .sort((a, b) => Number(a?.position || 0) - Number(b?.position || 0))
    .map((stop) => `${alphaColor(stop?.color, stop?.opacity)} ${Math.max(0, Math.min(100, numberOr(stop?.position, 0)))}%`)
    .join(", ");
  if (background?.gradientType === "radial") {
    const position = background?.radialPosition || "center";
    const shape = background?.radialShape || "circle";
    return `radial-gradient(${shape} at ${position}, ${body})`;
  }
  return `linear-gradient(${numberOr(background?.angle, 135)}deg, ${body})`;
}

function shadowCss(shadow, fallback) {
  if (shadow?.enabled === false) return "none";
  if (shadow?.enabled) {
    return `${shadow.inset ? "inset " : ""}${numberOr(shadow.x, 0)}px ${numberOr(shadow.y, 0)}px ${numberOr(shadow.blur, 0)}px ${numberOr(shadow.spread, 0)}px ${shadow.color || "rgba(0,0,0,.15)"}`;
  }
  return LEGACY_SHADOWS[fallback] ?? fallback;
}

function textShadowCss(shadow, fallback) {
  if (shadow?.enabled === false) return "none";
  if (shadow?.enabled) {
    return `${numberOr(shadow.x, 0)}px ${numberOr(shadow.y, 0)}px ${numberOr(shadow.blur, 0)}px ${shadow.color || "rgba(0,0,0,.3)"}`;
  }
  return fallback;
}

function filterCss(filters = {}, legacy) {
  const parts = [
    numberOr(filters.blur, 0) ? `blur(${numberOr(filters.blur, 0)}px)` : "",
    present(filters.brightness) && numberOr(filters.brightness, 100) !== 100 ? `brightness(${numberOr(filters.brightness, 100)}%)` : "",
    present(filters.contrast) && numberOr(filters.contrast, 100) !== 100 ? `contrast(${numberOr(filters.contrast, 100)}%)` : "",
    present(filters.saturate) && numberOr(filters.saturate, 100) !== 100 ? `saturate(${numberOr(filters.saturate, 100)}%)` : "",
    numberOr(filters.hueRotate, 0) ? `hue-rotate(${numberOr(filters.hueRotate, 0)}deg)` : "",
    numberOr(filters.grayscale, 0) ? `grayscale(${numberOr(filters.grayscale, 0)}%)` : "",
    numberOr(filters.sepia, 0) ? `sepia(${numberOr(filters.sepia, 0)}%)` : "",
    numberOr(filters.invert, 0) ? `invert(${numberOr(filters.invert, 0)}%)` : "",
    present(filters.opacity) && numberOr(filters.opacity, 100) !== 100 ? `opacity(${numberOr(filters.opacity, 100)}%)` : "",
    filters.dropShadow ? `drop-shadow(${String(filters.dropShadow).replace(/[;{}]/g, "")})` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : legacy;
}

function backdropFilterCss(filters = {}, legacy) {
  const parts = [
    numberOr(filters.blur, 0) ? `blur(${numberOr(filters.blur, 0)}px)` : "",
    present(filters.brightness) && numberOr(filters.brightness, 100) !== 100 ? `brightness(${numberOr(filters.brightness, 100)}%)` : "",
    present(filters.contrast) && numberOr(filters.contrast, 100) !== 100 ? `contrast(${numberOr(filters.contrast, 100)}%)` : "",
    present(filters.saturate) && numberOr(filters.saturate, 100) !== 100 ? `saturate(${numberOr(filters.saturate, 100)}%)` : "",
    numberOr(filters.hueRotate, 0) ? `hue-rotate(${numberOr(filters.hueRotate, 0)}deg)` : "",
    numberOr(filters.grayscale, 0) ? `grayscale(${numberOr(filters.grayscale, 0)}%)` : "",
    numberOr(filters.sepia, 0) ? `sepia(${numberOr(filters.sepia, 0)}%)` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : legacy;
}

function cssLengthValue(value, fallbackUnit = "px") {
  if (!present(value)) return undefined;
  return typeof value === "number" || /^-?(?:\d+\.?\d*|\.\d+)$/.test(String(value).trim()) ? `${value}${fallbackUnit}` : String(value);
}

function cssAngleValue(value) {
  if (!present(value)) return undefined;
  return typeof value === "number" || /^-?(?:\d+\.?\d*|\.\d+)$/.test(String(value).trim()) ? `${value}deg` : String(value);
}

function cssOpacityValue(value) {
  if (!present(value)) return undefined;
  const text = String(value).trim();
  if (text.endsWith("%")) {
    const percent = Number.parseFloat(text);
    if (!Number.isFinite(percent)) return undefined;
    return Math.max(0, Math.min(100, percent)) / 100;
  }
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return value;
  if (numeric > 1) return Math.max(0, Math.min(100, numeric)) / 100;
  return Math.max(0, Math.min(1, numeric));
}

function transformCss(transform = {}, legacy = {}) {
  const source = Object.keys(transform || {}).length ? transform : legacy || {};
  const x = first(source.translateX, source.x);
  const y = first(source.translateY, source.y);
  const z = source.translateZ;
  const parts = [];
  if (present(source.perspective)) parts.push(`perspective(${cssLengthValue(source.perspective)})`);
  if (present(x) || present(y) || present(z)) {
    parts.push(`translate3d(${present(x) ? cssLengthValue(x) : "0px"}, ${present(y) ? cssLengthValue(y) : "0px"}, ${present(z) ? cssLengthValue(z) : "0px"})`);
  }
  if (present(source.rotateX)) parts.push(`rotateX(${cssAngleValue(source.rotateX)})`);
  if (present(source.rotateY)) parts.push(`rotateY(${cssAngleValue(source.rotateY)})`);
  const rotateZ = first(source.rotateZ, source.rotate);
  if (present(rotateZ)) parts.push(`rotateZ(${cssAngleValue(rotateZ)})`);
  if (present(source.skewX)) parts.push(`skewX(${cssAngleValue(source.skewX)})`);
  if (present(source.skewY)) parts.push(`skewY(${cssAngleValue(source.skewY)})`);
  const sx = first(source.scaleX, source.scale);
  const sy = first(source.scaleY, source.scale);
  if (present(sx) || present(sy)) parts.push(`scale(${present(sx) ? sx : 1}, ${present(sy) ? sy : 1})`);
  return parts.length ? parts.join(" ") : undefined;
}

function transitionCss(transition, legacy) {
  if (typeof transition === "string" && transition.trim()) return transition.trim();
  if (Array.isArray(transition)) {
    const rows = transition.map(transitionCss).filter(Boolean);
    return rows.length ? rows.join(", ") : legacy;
  }
  if (transition && typeof transition === "object") {
    const property = transition.property || "all";
    const duration = transition.duration || "200ms";
    const timing = transition.timingFunction || transition.timing || "ease";
    const delay = transition.delay || "0ms";
    return `${property} ${duration} ${timing} ${delay}`;
  }
  return legacy;
}

function legacyFlatStyles(styles = {}) {
  const keys = [
    "color","fontSize","fontWeight","fontFamily","fontStyle","lineHeight","letterSpacing","wordSpacing","textAlign","textTransform","textDecoration","textDecorationLine","textDecorationStyle","textDecorationColor","textDecorationThickness","textUnderlineOffset","whiteSpace","wordBreak","overflowWrap","hyphens","textOverflow","textIndent",
    "backgroundColor","backgroundImage","backgroundSize","backgroundPosition","backgroundRepeat","backgroundAttachment","backgroundBlendMode",
    "borderWidth","borderStyle","borderColor","borderRadius","outline","outlineOffset",
    "marginTop","marginRight","marginBottom","marginLeft","paddingTop","paddingRight","paddingBottom","paddingLeft",
    "width","height","minWidth","minHeight","maxWidth","maxHeight","boxSizing","display","visibility","position","top","right","bottom","left","zIndex",
    "overflow","overflowX","overflowY","aspectRatio","objectFit","objectPosition","verticalAlign","flexGrow","flexShrink","flexBasis","order","alignSelf","flexDirection","flexWrap","justifyContent","alignItems","alignContent",
    "gap","rowGap","columnGap","gridTemplateColumns","gridTemplateRows","gridAutoFlow","gridAutoColumns","gridAutoRows","justifyItems",
    "opacity","boxShadow","textShadow","filter","backdropFilter","mixBlendMode","isolation","transform","transformOrigin","perspective","perspectiveOrigin","transition",
    "cursor","pointerEvents","userSelect","touchAction","appearance","resize","accentColor","caretColor",
    "direction","writingMode","clipPath","contain","contentVisibility","containIntrinsicSize","willChange",
    "breakBefore","breakAfter","breakInside","columnCount","columnWidth","columnFill","columnRuleWidth","columnRuleStyle","columnRuleColor",
    "scrollBehavior","scrollSnapAlign","scrollSnapType","scrollSnapStop","scrollbarGutter","overscrollBehavior","overscrollBehaviorX","overscrollBehaviorY",
  ];
  const out = {};
  for (const key of keys) if (present(styles[key]) && typeof styles[key] !== "object") out[key] = styles[key];
  return out;
}

function applyBorder(out, border = {}) {
  const widths = border.widths || {};
  const styles = border.styles || {};
  const colors = border.colors || {};
  const radii = border.radii || {};
  const sides = border.sides || "all";
  if (Object.keys(widths).length || Object.keys(styles).length || Object.keys(colors).length) {
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      const key = side.toLowerCase();
      if (present(widths[key])) out[`border${side}Width`] = widths[key];
      if (present(styles[key])) out[`border${side}Style`] = styles[key];
      if (present(colors[key])) out[`border${side}Color`] = colors[key];
    }
  } else if (sides === "all") {
    if (present(border.width)) out.borderWidth = border.width;
    if (present(border.style)) out.borderStyle = border.style;
    if (present(border.color)) out.borderColor = border.color;
  } else {
    const side = sides[0]?.toUpperCase() + sides.slice(1);
    if (side) {
      if (present(border.width)) out[`border${side}Width`] = border.width;
      if (present(border.style)) out[`border${side}Style`] = border.style;
      if (present(border.color)) out[`border${side}Color`] = border.color;
    }
  }
  if (Object.keys(radii).length) {
    if (present(radii.topLeft)) out.borderTopLeftRadius = radii.topLeft;
    if (present(radii.topRight)) out.borderTopRightRadius = radii.topRight;
    if (present(radii.bottomRight)) out.borderBottomRightRadius = radii.bottomRight;
    if (present(radii.bottomLeft)) out.borderBottomLeftRadius = radii.bottomLeft;
  } else if (present(border.radius)) out.borderRadius = border.radius;

  if (border.outline && border.outline.style && border.outline.style !== "none") {
    out.outline = `${border.outline.width || "1px"} ${border.outline.style} ${border.outline.color || "currentColor"}`;
    if (present(border.outline.offset)) out.outlineOffset = border.outline.offset;
  }
}

export function buildNodeStyle(styles = {}) {
  styles = normalizeStyleShape(styles);
  const typography = styles.typography || {};
  const background = styles.background || {};
  const border = styles.border || {};
  const spacing = styles.spacing || {};
  const size = styles.size || {};
  const effects = styles.effects || {};
  const advanced = styles.advanced || {};
  const layout = styles.layout || {};
  const transform = styles.transform || {};
  const interaction = styles.interaction || {};
  const scroll = styles.scroll || {};
  const out = legacyFlatStyles(styles);

  Object.assign(out, {
    fontSize: first(typography.fontSize, out.fontSize),
    fontWeight: first(typography.fontWeight, out.fontWeight),
    fontFamily: first(typography.fontFamily, out.fontFamily),
    lineHeight: first(typography.lineHeight, out.lineHeight),
    letterSpacing: first(typography.letterSpacing, out.letterSpacing),
    wordSpacing: first(typography.wordSpacing, out.wordSpacing),
    fontStyle: first(typography.fontStyle, out.fontStyle),
    textTransform: first(typography.textTransform, out.textTransform),
    textAlign: first(typography.textAlign, out.textAlign),
    color: first(present(typography.color) ? alphaColor(typography.color, typography.opacity) : undefined, out.color),
    textDecoration: first(typography.textDecoration, out.textDecoration),
    textDecorationLine: first(typography.textDecorationLine, out.textDecorationLine),
    textDecorationStyle: first(typography.textDecorationStyle, out.textDecorationStyle),
    textDecorationColor: first(typography.textDecorationColor, out.textDecorationColor),
    textDecorationThickness: first(typography.textDecorationThickness, out.textDecorationThickness),
    textUnderlineOffset: first(typography.textUnderlineOffset, out.textUnderlineOffset),
    whiteSpace: first(typography.whiteSpace, out.whiteSpace),
    wordBreak: first(typography.wordBreak, out.wordBreak),
    overflowWrap: first(typography.overflowWrap, out.overflowWrap),
    hyphens: first(typography.hyphens, out.hyphens),
    textOverflow: first(typography.textOverflow, out.textOverflow),
    textIndent: first(typography.textIndent, out.textIndent),
  });

  const textShadow = textShadowCss(effects.textShadow, out.textShadow);
  if (present(textShadow)) out.textShadow = textShadow;
  if (effects.textStroke?.enabled) out.WebkitTextStroke = `${numberOr(effects.textStroke.width, 0)}px ${effects.textStroke.color || "#000000"}`;

  const backgroundEnabled = background.enabled !== false;
  let backgroundImage;
  if (backgroundEnabled) {
    if (background.type === "gradient") backgroundImage = gradientCss(background);
    else if (background.type === "media" && background.media?.url) backgroundImage = `url(${background.media.url})`;
    else if (advanced.media?.url) backgroundImage = `url(${advanced.media.url})`;
    else if (advanced.backgroundGallery?.[0]?.url) backgroundImage = `url(${advanced.backgroundGallery[0].url})`;
    else backgroundImage = out.backgroundImage;
    if (background.type === "color" && present(background.color)) out.backgroundColor = background.color;
    if (present(backgroundImage)) out.backgroundImage = backgroundImage;
    if (present(background.size) || backgroundImage) out.backgroundSize = background.size || out.backgroundSize || "cover";
    if (present(background.position) || backgroundImage) out.backgroundPosition = background.position || out.backgroundPosition || "center center";
    if (present(background.repeat) || backgroundImage) out.backgroundRepeat = background.repeat || out.backgroundRepeat || "no-repeat";
    if (present(background.attachment)) out.backgroundAttachment = background.attachment;
    if (present(background.blendMode)) out.backgroundBlendMode = background.blendMode;
  } else {
    for (const key of ["background", "backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition", "backgroundRepeat", "backgroundAttachment", "backgroundBlendMode"]) delete out[key];
  }

  applyBorder(out, border);

  for (const key of ["marginTop","marginRight","marginBottom","marginLeft","paddingTop","paddingRight","paddingBottom","paddingLeft"]) {
    if (present(spacing[key])) out[key] = spacing[key];
  }
  for (const key of ["width","height","minWidth","minHeight","maxWidth","maxHeight"]) {
    if (present(size[key])) out[key] = size[key];
  }
  if (present(size.boxSizing)) out.boxSizing = size.boxSizing;

  const boxShadow = shadowCss(effects.boxShadow, first(effects.shadow, out.boxShadow));
  if (present(boxShadow)) out.boxShadow = boxShadow;
  const filters = filterCss(effects.filters, out.filter);
  if (present(filters)) out.filter = filters;
  const backdrop = backdropFilterCss(effects.backdropFilters, first(effects.backdropFilter, out.backdropFilter));
  if (present(backdrop)) {
    out.backdropFilter = backdrop;
    out.WebkitBackdropFilter = backdrop;
  }
  if (present(effects.opacity)) out.opacity = cssOpacityValue(effects.opacity);
  if (present(effects.mixBlendMode)) out.mixBlendMode = effects.mixBlendMode;
  if (present(effects.isolation)) out.isolation = effects.isolation;

  const simpleLayoutKeys = [
    "position","top","right","bottom","left","aspectRatio","objectFit","objectPosition","verticalAlign","display","visibility","overflow","overflowX","overflowY",
    "flexBasis","alignSelf","flexDirection","flexWrap","justifyContent","alignItems","alignContent","gap","rowGap","columnGap",
    "gridTemplateColumns","gridTemplateRows","gridAutoFlow","gridAutoColumns","gridAutoRows","justifyItems","justifyContent","alignContent",
    "direction","writingMode","clipPath","contain","contentVisibility","containIntrinsicSize","willChange",
    "breakBefore","breakAfter","breakInside","columnWidth","columnFill","columnRuleWidth","columnRuleStyle","columnRuleColor",
  ];
  for (const key of simpleLayoutKeys) if (present(layout[key])) out[key] = layout[key];
  for (const key of ["zIndex","flexGrow","flexShrink","order"]) {
    if (present(layout[key])) out[key] = Number.isFinite(Number(layout[key])) ? Number(layout[key]) : layout[key];
  }
  if (present(layout.columnCount)) out.columnCount = Number.isFinite(Number(layout.columnCount)) ? Number(layout.columnCount) : layout.columnCount;
  if (!present(layout.overflow) && advanced.overflowHidden === true && !present(layout.overflowX) && !present(layout.overflowY)) out.overflow = "hidden";

  const lineClamp = Number(typography.lineClamp);
  if (Number.isFinite(lineClamp) && lineClamp > 0) {
    out.WebkitLineClamp = Math.max(1, Math.round(lineClamp));
    out.WebkitBoxOrient = "vertical";
    if (!present(layout.display)) out.display = "-webkit-box";
    if (!present(layout.overflow) && !present(layout.overflowX) && !present(layout.overflowY)) out.overflow = "hidden";
  }

  const transformValue = transformCss(transform, advanced.transform);
  if (present(transformValue)) out.transform = transformValue;
  if (present(transform.origin)) out.transformOrigin = transform.origin;
  else if (present(transform.originX) || present(transform.originY)) out.transformOrigin = `${transform.originX || "50%"} ${transform.originY || "50%"}`;
  if (present(transform.perspectiveOrigin)) out.perspectiveOrigin = transform.perspectiveOrigin;

  const transition = transitionCss(styles.transition, out.transition);
  if (present(transition)) out.transition = transition;

  for (const key of ["cursor","pointerEvents","userSelect","touchAction","appearance","resize","accentColor","caretColor"]) if (present(interaction[key])) out[key] = interaction[key];
  for (const key of ["scrollBehavior","scrollSnapAlign","scrollSnapType","scrollSnapStop","scrollbarGutter","overscrollBehavior","overscrollBehaviorX","overscrollBehaviorY"]) if (present(scroll[key])) out[key] = scroll[key];
  for (const key of ["scrollMarginTop","scrollMarginRight","scrollMarginBottom","scrollMarginLeft","scrollPaddingTop","scrollPaddingRight","scrollPaddingBottom","scrollPaddingLeft"]) {
    if (present(scroll[key])) out[key] = scroll[key];
  }

  if (Array.isArray(advanced.cssVariables)) {
    for (const item of advanced.cssVariables) {
      const name = String(item?.name || "").trim();
      if (name.startsWith("--")) out[name] = item?.value ?? "";
    }
  }

  for (const key of Object.keys(out)) if (!present(out[key])) delete out[key];
  return out;
}

function cssPropertyName(key) {
  if (CSS_NAME_OVERRIDES[key]) return CSS_NAME_OVERRIDES[key];
  if (key.startsWith("--")) return key;
  return key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

export function styleObjectToCssDeclarations(style = {}) {
  return Object.entries(style)
    .filter(([, value]) => present(value) && typeof value !== "object")
    .map(([key, value]) => `${cssPropertyName(key)}:${String(value).replace(/[{};]/g, "")}`)
    .join(";");
}

export function stateStyleDeclarations(state = {}) {
  return styleObjectToCssDeclarations(buildNodeStyle(state));
}
