import { gradientCss, styleObjectToCssDeclarations } from "./styleEngine.js";
import { getWidgetStyleProfile } from "./widgetStyleProfiles.js";

function present(value) {
  return value !== undefined && value !== null && value !== "";
}

function importantDeclarations(style = {}) {
  return styleObjectToCssDeclarations(style)
    .split(";")
    .filter(Boolean)
    .map((item) => `${item} !important`)
    .join(";");
}

function solidColor(value, fallback = "") {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value.color || fallback;
}

function backgroundStyle(value) {
  if (!value || typeof value !== "object" || value.enabled === false) return {};
  if (value.type === "gradient") return { backgroundImage: gradientCss(value), backgroundColor: "transparent" };
  if (value.type === "color" && present(value.color)) return { backgroundColor: value.color, backgroundImage: "none" };
  return {};
}

function filterValue(filters = {}) {
  const parts = [];
  if (Number(filters.blur) > 0) parts.push(`blur(${Number(filters.blur)}px)`);
  if (present(filters.brightness) && Number(filters.brightness) !== 100) parts.push(`brightness(${Number(filters.brightness)}%)`);
  if (present(filters.contrast) && Number(filters.contrast) !== 100) parts.push(`contrast(${Number(filters.contrast)}%)`);
  if (present(filters.saturate) && Number(filters.saturate) !== 100) parts.push(`saturate(${Number(filters.saturate)}%)`);
  if (Number(filters.hueRotate)) parts.push(`hue-rotate(${Number(filters.hueRotate)}deg)`);
  if (Number(filters.grayscale)) parts.push(`grayscale(${Number(filters.grayscale)}%)`);
  if (Number(filters.sepia)) parts.push(`sepia(${Number(filters.sepia)}%)`);
  if (Number(filters.invert)) parts.push(`invert(${Number(filters.invert)}%)`);
  if (present(filters.opacity) && Number(filters.opacity) !== 100) parts.push(`opacity(${Number(filters.opacity)}%)`);
  if (filters.dropShadow) parts.push(`drop-shadow(${String(filters.dropShadow).replace(/[{};]/g, "")})`);
  return parts.join(" ");
}

function addRule(rules, selector, style) {
  const declarations = importantDeclarations(style);
  if (selector && declarations) rules.push(`${selector}{${declarations}}`);
}

function addRawRule(rules, selector, declarations = {}) {
  addRule(rules, selector, declarations);
}

function safeId(id) {
  return String(id || "").replace(/["'\\]/g, "");
}

function splitSelectorList(selectorList) {
  const input = String(selectorList || "");
  const parts = [];
  let current = "";
  let depth = 0;
  let quote = "";
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      current += char;
      if (char === quote && input[index - 1] !== "\\") quote = "";
      continue;
    }
    if (char === '"' || char === "'") { quote = char; current += char; continue; }
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function withPseudo(selectorList, pseudo) {
  return splitSelectorList(selectorList).map((selector) => `${selector}${pseudo}`).join(",");
}

function withDescendant(selectorList, descendant) {
  return splitSelectorList(selectorList).map((selector) => `${selector} ${descendant}`).join(",");
}

export function buildWidgetSpecificCss(type, id, widgetStyles = {}) {
  const cleanId = safeId(id);
  if (!cleanId || !widgetStyles || typeof widgetStyles !== "object") return "";
  const root = `[data-vsn-id="${cleanId}"]`;
  const { features } = getWidgetStyleProfile(type);
  const has = (feature) => features.includes(feature);
  const rules = [];

  if (has("structureItems")) {
    const item = widgetStyles.structureItems || {};
    const selector = `${root}>*`;
    addRule(rules, selector, {
      ...backgroundStyle(item.background),
      minWidth: item.minWidth,
      minHeight: item.minHeight,
      padding: item.padding,
      borderRadius: item.radius,
      borderWidth: item.borderWidth,
      borderColor: item.borderColor,
      borderStyle: item.borderWidth ? (item.borderStyle || "solid") : undefined,
      boxShadow: item.shadow,
      alignSelf: item.alignSelf,
      overflow: item.overflow,
    });
  }

  if (has("textCore")) {
    const text = widgetStyles.textCore || {};
    const fill = text.fill || {};
    if (fill?.enabled === false) {
      // Keep the saved fill values for re-enable, but emit no fill CSS while disabled.
    } else if (fill?.type === "gradient") {
      addRule(rules, root, {
        backgroundImage: gradientCss(fill),
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        color: "transparent",
        WebkitTextFillColor: "transparent",
      });
    } else if (fill?.type === "color" && present(fill.color)) {
      addRule(rules, root, { color: fill.color, backgroundImage: "none", WebkitTextFillColor: fill.color });
    }
    addRule(rules, root, {
      textRendering: text.textRendering,
      WebkitFontSmoothing: text.fontSmoothing,
    });
    addRule(rules, `${root}::selection,${root} *::selection`, {
      color: text.selectionColor,
      backgroundColor: text.selectionBackground,
      WebkitTextFillColor: text.selectionColor,
    });
    addRule(rules, `${root} strong,${root} b`, { color: text.strongColor, WebkitTextFillColor: text.strongColor });
    addRule(rules, `${root} em,${root} i`, { color: text.emColor, WebkitTextFillColor: text.emColor });
  }

  if (has("richText")) {
    const rich = widgetStyles.richText || {};
    addRule(rules, `${root} a`, {
      color: rich.linkColor,
      textDecorationLine: rich.linkDecoration,
      textUnderlineOffset: rich.linkUnderlineOffset,
    });
    addRule(rules, `${root} a:hover`, { color: rich.linkHoverColor });
    addRule(rules, `${root} p`, { marginBottom: rich.paragraphSpacing });
    addRule(rules, `${root} h1,${root} h2,${root} h3,${root} h4,${root} h5,${root} h6`, { marginTop: rich.headingSpacingTop, marginBottom: rich.headingSpacingBottom });
    addRule(rules, `${root} ul,${root} ol`, { paddingInlineStart: rich.listIndent });
    addRule(rules, `${root} li::marker`, { color: rich.markerColor });
    addRule(rules, `${root} blockquote`, {
      borderInlineStart: present(rich.blockquoteBorderWidth) ? `${rich.blockquoteBorderWidth} solid ${rich.blockquoteBorderColor || "currentColor"}` : undefined,
      backgroundColor: rich.blockquoteBackground,
      padding: rich.blockquotePadding,
      borderRadius: rich.blockquoteRadius,
    });
    addRule(rules, `${root} code`, { backgroundColor: rich.codeBackground, color: rich.codeColor, borderRadius: rich.codeRadius, padding: rich.codePadding });
  }

  if (has("media")) {
    const media = widgetStyles.media || {};
    const selector = `${root}:is(img,video,iframe),${root} img,${root} video,${root} iframe`;
    const filter = filterValue(media.filters || {});
    addRule(rules, selector, {
      width: media.width,
      height: media.height,
      aspectRatio: media.aspectRatio,
      objectFit: media.objectFit,
      objectPosition: media.objectPosition,
      borderRadius: media.borderRadius,
      borderWidth: media.borderWidth,
      borderColor: media.borderColor,
      borderStyle: media.borderWidth ? (media.borderStyle || "solid") : undefined,
      ...backgroundStyle(media.background),
      boxShadow: media.shadow,
      opacity: media.opacity,
      filter: filter || undefined,
      transition: media.transition,
      marginInlineStart: media.alignment === "center" ? "auto" : media.alignment === "right" ? "auto" : undefined,
      marginInlineEnd: media.alignment === "center" ? "auto" : media.alignment === "left" ? "auto" : undefined,
    });
    addRule(rules, withPseudo(selector, ":hover"), {
      transform: media.hoverTransform,
      opacity: media.hoverOpacity,
    });
  }

  if (has("galleryThumbs")) {
    const thumbs = widgetStyles.galleryThumbs || {};
    addRule(rules, `${root} .vsn-product-gallery-thumbs`, { gap: thumbs.gap });
    addRule(rules, `${root} .vsn-product-gallery-thumb`, {
      width: thumbs.size,
      height: thumbs.size,
      borderRadius: thumbs.radius,
      borderColor: thumbs.borderColor,
      borderWidth: thumbs.borderWidth,
      opacity: thumbs.opacity,
    });
    addRule(rules, `${root} .vsn-product-gallery-thumb.is-active`, { borderColor: thumbs.activeBorderColor, opacity: 1 });
  }

  if (has("button")) {
    const button = widgetStyles.button || {};
    const selector = `${root}:is(a,button),${root}.vsn-button,${root} .vsn-button,${root}>button,${root}>a,${root} button,${root} a`;
    addRule(rules, selector, {
      ...backgroundStyle(button.background),
      color: solidColor(button.color),
      borderColor: button.borderColor,
      borderWidth: button.borderWidth,
      borderStyle: button.borderStyle || (button.borderWidth ? "solid" : undefined),
      borderRadius: button.borderRadius,
      paddingInline: button.paddingX,
      paddingBlock: button.paddingY,
      minHeight: button.minHeight,
      minWidth: button.minWidth,
      fontSize: button.fontSize,
      fontWeight: button.fontWeight,
      lineHeight: button.lineHeight,
      letterSpacing: button.letterSpacing,
      textTransform: button.textTransform,
      gap: button.iconGap,
      justifyContent: button.alignment,
      boxShadow: button.shadow,
      transitionProperty: button.transitionDuration || button.transitionTiming ? "background,color,border-color,box-shadow,transform,opacity" : undefined,
      transitionDuration: button.transitionDuration,
      transitionTimingFunction: button.transitionTiming,
    });
    addRule(rules, `${withDescendant(selector, "svg")},${withDescendant(selector, ".vsn-icon")}`, { width: button.iconSize, height: button.iconSize, fontSize: button.iconSize });
    addRule(rules, withPseudo(selector, ":hover"), { ...backgroundStyle(button.hoverBackground), color: solidColor(button.hoverColor), borderColor: button.hoverBorderColor, boxShadow: button.hoverShadow, transform: button.hoverTransform });
    addRule(rules, withPseudo(selector, ":active"), { ...backgroundStyle(button.activeBackground), color: solidColor(button.activeColor), borderColor: button.activeBorderColor, transform: button.activeTransform });
    addRule(rules, withPseudo(selector, ":focus-visible"), { outline: present(button.focusWidth) ? `${button.focusWidth} solid ${button.focusColor || "currentColor"}` : undefined, outlineOffset: button.focusOffset });
    addRule(rules, `${withPseudo(selector, ":disabled")},${root}[aria-disabled="true"] button,${root}[aria-disabled="true"] a`, { opacity: button.disabledOpacity, cursor: button.disabledCursor });
  }

  if (has("navigation")) {
    const nav = widgetStyles.navigation || {};
    const links = `${root} a,${root} .vsn-nav-links>a,${root} .vsn-tab-button,${root} .vsn-mega-trigger`;
    addRule(rules, links, {
      color: nav.linkColor,
      backgroundColor: nav.linkBackground,
      paddingInline: nav.paddingX,
      paddingBlock: nav.paddingY,
      borderRadius: nav.radius,
      textDecorationLine: nav.decoration,
      fontSize: nav.fontSize,
      fontWeight: nav.fontWeight,
      lineHeight: nav.lineHeight,
      letterSpacing: nav.letterSpacing,
      textTransform: nav.textTransform,
      borderColor: nav.borderColor,
      borderWidth: nav.borderWidth,
      borderStyle: nav.borderWidth ? (nav.borderStyle || "solid") : undefined,
      gap: nav.iconGap,
      transitionProperty: nav.transitionDuration ? "color,background-color,border-color,transform,box-shadow" : undefined,
      transitionDuration: nav.transitionDuration,
      transitionTimingFunction: nav.transitionTiming,
    });
    addRule(rules, `${withDescendant(links, "svg")},${withDescendant(links, ".vsn-icon")}`, { width: nav.iconSize, height: nav.iconSize, fontSize: nav.iconSize });
    addRule(rules, withPseudo(links, ":hover"), { color: nav.hoverColor, backgroundColor: nav.hoverBackground, borderColor: nav.hoverBorderColor });
    addRule(rules, withPseudo(links, ":visited"), { color: nav.visitedColor });
    addRule(rules, withPseudo(links, ":focus-visible"), { outline: present(nav.focusWidth) ? `${nav.focusWidth} solid ${nav.focusColor || "currentColor"}` : undefined, outlineOffset: nav.focusOffset });
    addRule(rules, `${root} a[aria-current="page"],${root} .is-active,${root} [aria-selected="true"]`, { color: nav.activeColor, backgroundColor: nav.activeBackground, borderColor: nav.activeBorderColor, fontWeight: nav.activeWeight });
    addRule(rules, `${root} .vsn-nav-links,${root}>div:first-child`, { gap: nav.gap });
    const submenu = `${root} .vsn-mega-menu-panel,${root} .vsn-mega-panel,${root} [role="menu"]`;
    addRule(rules, submenu, {
      backgroundColor: nav.submenuBackground,
      borderColor: nav.submenuBorderColor,
      borderWidth: nav.submenuBorderWidth,
      borderStyle: nav.submenuBorderWidth ? "solid" : undefined,
      borderRadius: nav.submenuRadius,
      padding: nav.submenuPadding,
      boxShadow: nav.submenuShadow,
      minWidth: nav.submenuMinWidth,
    });
    const submenuLinks = `${root} .vsn-mega-menu-panel a,${root} .vsn-mega-panel a,${root} [role="menu"] a`;
    addRule(rules, submenuLinks, { color: nav.submenuColor, paddingInline: nav.submenuItemPaddingX, paddingBlock: nav.submenuItemPaddingY, borderRadius: nav.submenuItemRadius });
    addRule(rules, withPseudo(submenuLinks, ":hover"), { color: nav.submenuHoverColor, backgroundColor: nav.submenuHoverBackground });
  }

  if (has("form")) {
    const form = widgetStyles.form || {};
    addRule(rules, `${root},${root} form`, { rowGap: form.fieldGap });
    addRule(rules, `${root} label,${root} .vsn-form-field>label,${root} .vsn-form-field>span`, { color: form.labelColor, fontSize: form.labelSize, fontWeight: form.labelWeight });
    const controls = `${root} input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),${root} select,${root} textarea`;
    addRule(rules, controls, {
      minHeight: form.controlHeight,
      backgroundColor: form.controlBackground,
      color: form.controlColor,
      borderColor: form.controlBorderColor,
      borderWidth: form.controlBorderWidth,
      borderStyle: form.controlBorderWidth ? (form.controlBorderStyle || "solid") : undefined,
      borderRadius: form.controlRadius,
      paddingInline: form.controlPaddingX,
      paddingBlock: form.controlPaddingY,
      fontSize: form.controlFontSize,
      fontWeight: form.controlFontWeight,
      lineHeight: form.controlLineHeight,
      boxShadow: form.controlShadow,
      transition: form.controlTransition,
    });
    addRule(rules, withPseudo(controls, "::placeholder"), { color: form.placeholderColor, opacity: form.placeholderOpacity });
    addRule(rules, `${withPseudo(controls, ":focus")},${withPseudo(controls, ":focus-visible")}`, {
      borderColor: form.focusBorderColor,
      backgroundColor: form.focusBackground,
      color: form.focusColor,
      boxShadow: form.focusShadow,
      outline: present(form.focusOutlineWidth) ? `${form.focusOutlineWidth} solid ${form.focusOutlineColor || form.focusBorderColor || "currentColor"}` : "none",
      outlineOffset: form.focusOutlineOffset,
    });
    addRule(rules, withPseudo(controls, ":invalid"), { backgroundColor: form.invalidBackground, borderColor: form.invalidBorderColor });
    addRule(rules, withPseudo(controls, ":disabled"), { backgroundColor: form.disabledBackground, color: form.disabledColor, borderColor: form.disabledBorderColor, opacity: form.disabledOpacity, cursor: "not-allowed" });
    addRule(rules, `${root} textarea`, { minHeight: form.textareaMinHeight, resize: form.textareaResize });
    const choices = `${root} input[type="checkbox"],${root} input[type="radio"]`;
    addRule(rules, choices, { width: form.choiceSize, height: form.choiceSize, accentColor: form.accentColor });
    addRule(rules, `${root} .vsn-form-help,${root} small,${root} .vsn-field-help`, { color: form.helperColor, fontSize: form.helperSize });
    addRule(rules, `${root} .vsn-form-status`, { color: form.messageColor, fontSize: form.messageSize });
    addRule(rules, `${root} .vsn-form-status[data-tone="error"]`, { color: form.errorColor });
    addRule(rules, `${root} .vsn-form-status[data-tone="success"]`, { color: form.successColor });
  }

  if (has("gridCards") || has("cards")) {
    const card = widgetStyles.card || {};
    const grid = widgetStyles.grid || {};
    const gridSelector = `${root}.vsn-search-results-grid,${root}.vsn-blog-article-grid,${root} .vsn-product-recommendations-grid,${root}>div:first-child`;
    addRule(rules, gridSelector, { gap: grid.gap, rowGap: grid.rowGap, columnGap: grid.columnGap });
    const cardSelector = `${root} .vsn-product-card,${root} .vsn-search-card,${root} article,${root}>div:first-child>div`;
    addRule(rules, cardSelector, {
      ...backgroundStyle(card.background),
      color: card.color,
      borderColor: card.borderColor,
      borderWidth: card.borderWidth,
      borderStyle: card.borderWidth ? "solid" : undefined,
      borderRadius: card.borderRadius,
      padding: card.padding,
      boxShadow: card.shadow,
      overflow: card.overflow,
      transition: card.transition,
    });
    addRule(rules, `${cardSelector}:hover`, { boxShadow: card.hoverShadow, transform: card.hoverTransform, borderColor: card.hoverBorderColor });
    addRule(rules, `${cardSelector} img`, { aspectRatio: card.mediaAspectRatio, objectFit: card.mediaObjectFit, objectPosition: card.mediaObjectPosition, borderRadius: card.mediaRadius });
    addRule(rules, `${cardSelector} h2,${cardSelector} h3,${cardSelector} strong`, { color: card.titleColor, fontSize: card.titleSize, fontWeight: card.titleWeight, lineHeight: card.titleLineHeight });
    addRule(rules, `${cardSelector} p,${cardSelector} .vsn-card-body`, { color: card.bodyColor, fontSize: card.bodySize, lineHeight: card.bodyLineHeight });
  }

  if (has("commercePrice")) {
    const price = widgetStyles.commercePrice || {};
    if (type === "product-compare-price") {
      addRule(rules, root, {
        color: price.compareColor || price.color,
        fontSize: price.compareSize || price.fontSize,
        fontWeight: price.fontWeight,
        lineHeight: price.lineHeight,
        opacity: price.compareOpacity,
        textDecorationLine: "line-through",
        textDecorationThickness: price.decorationThickness,
      });
    } else {
      addRule(rules, root, {
        color: price.color,
        fontSize: price.fontSize,
        fontWeight: price.fontWeight,
        lineHeight: price.lineHeight,
      });
    }
    addRule(rules, `${root} .vsn-product-price-row,${root} .vsn-card-price-row`, { gap: price.gap });
  }

  if (has("commerceMeta")) {
    const meta = widgetStyles.commerceMeta || {};
    addRule(rules, root, { fontSize: meta.fontSize, fontWeight: meta.fontWeight });
    addRule(rules, `${root} strong,${root} .vsn-meta-label,${root}>span:first-child`, { color: meta.labelColor });
    addRule(rules, `${root} .vsn-product-meta-value,${root} .vsn-meta-value`, { color: meta.valueColor });
    const statusStyle = { paddingInline: meta.pillPaddingX, paddingBlock: meta.pillPaddingY, borderRadius: meta.pillRadius };
    addRule(rules, `${root}.vsn-product-availability[data-vsn-stock-state="in-stock"],${root}.vsn-inventory-status[data-vsn-stock-state="in-stock"]`, { ...statusStyle, color: meta.inStockColor });
    addRule(rules, `${root}.vsn-product-availability[data-vsn-stock-state="low-stock"],${root}.vsn-inventory-status[data-vsn-stock-state="low-stock"]`, { ...statusStyle, color: meta.lowStockColor });
    addRule(rules, `${root}.vsn-product-availability[data-vsn-stock-state="sold-out"],${root}.vsn-inventory-status[data-vsn-stock-state="sold-out"]`, { ...statusStyle, color: meta.soldOutColor });
    // Preview/legacy markup may not expose stock-state data attributes yet.
    if (type === "product-availability" || type === "inventory-status") addRule(rules, root, { ...statusStyle, color: meta.inStockColor });
  }

  if (has("commerceOptions")) {
    const options = widgetStyles.commerceOptions || {};
    addRule(rules, root, { gap: options.labelGap });
    addRule(rules, `${root}>span,${root}>label,${root} .vsn-option-label`, { color: options.labelColor, fontWeight: options.labelWeight });
    addRule(rules, `${root} select,${root} input[type="number"]`, { width: options.width });
    addRule(rules, `${root} select:focus,${root} input[type="number"]:focus,${root} [aria-checked="true"],${root} .is-selected`, {
      borderColor: options.selectedBorderColor,
      backgroundColor: options.selectedBackground,
    });
  }

  if (has("commerceGrid")) {
    const commerce = widgetStyles.commerceGrid || {};
    const cards = `${root} .vsn-product-card,${root}.vsn-product-card,${root} article,${root}>div:first-child>div>div`;
    addRule(rules, `${cards} a`, { display: "grid", gap: commerce.contentGap });
    addRule(rules, `${root} .vsn-product-image-wrap,${cards} .vsn-card-media`, { backgroundColor: commerce.imageBackground, padding: commerce.imagePadding });
    addRule(rules, `${root} .vsn-card-price,${root} .vsn-product-card-price,${root} .vsn-product-price-row>span:first-child`, { color: commerce.priceColor, fontSize: commerce.priceSize });
    addRule(rules, `${root} .vsn-card-compare-price,${root} .vsn-product-card-compare-price,${root} .vsn-product-price-row>span:last-child`, { color: commerce.compareColor, opacity: commerce.compareOpacity, textDecorationLine: "line-through" });
    const badgeStyle = { color: commerce.badgeColor, borderRadius: commerce.badgeRadius, paddingInline: commerce.badgePaddingX, paddingBlock: commerce.badgePaddingY };
    addRule(rules, `${root} .vsn-product-badge-sale`, { ...badgeStyle, backgroundColor: commerce.saleBadgeBackground });
    addRule(rules, `${root} .vsn-product-badge-sold-out`, { ...badgeStyle, backgroundColor: commerce.soldOutBadgeBackground });
    if (present(commerce.titleClamp)) {
      addRule(rules, `${root} .vsn-card-title,${root} .vsn-product-card-title,${cards} h2,${cards} h3`, {
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: commerce.titleClamp,
        overflow: "hidden",
      });
    }
  }

  if (has("collectionTools")) {
    const tools = widgetStyles.collectionTools || {};
    const toolbar = `${root}.vsn-product-filters,${root} .vsn-product-filters,${root}.vsn-collection-sorting,${root} .vsn-collection-sorting,[data-vsn-grid-id="${cleanId}"].vsn-product-filters`;
    addRule(rules, toolbar, { ...backgroundStyle(tools.background), padding: tools.padding, borderRadius: tools.radius, gap: tools.gap, marginBottom: tools.marginBottom });
    addRule(rules, `${toolbar}>strong,${toolbar}>span:first-child`, { color: tools.headingColor, fontSize: tools.headingSize });
    addRule(rules, `${toolbar} [data-vsn-filter-clear],${toolbar}>button`, { color: tools.clearColor, backgroundColor: tools.clearBackground });
  }

  if (has("commercePagination")) {
    const pagination = widgetStyles.commercePagination || {};
    addRule(rules, `${root},${root}.vsn-standalone-pagination,${root} .vsn-load-more-wrap`, { display: "flex", justifyContent: pagination.alignment, gap: pagination.gap });
    const externalLoadMore = `[data-vsn-grid-id="${cleanId}"].vsn-load-more-button`;
    addRule(rules, externalLoadMore, {
      marginLeft: pagination.alignment === "center" || pagination.alignment === "flex-end" ? "auto" : undefined,
      marginRight: pagination.alignment === "center" || pagination.alignment === "flex-start" ? "auto" : undefined,
    });
    addRule(rules, `${root} [aria-busy="true"],${root} button:disabled,${externalLoadMore}[disabled]`, { opacity: pagination.loadingOpacity });
  }

  if (has("cartSurface")) {
    const cart = widgetStyles.cartSurface || {};
    addRule(rules, `${root},${root}.vsn-cart-widget,${root} .vsn-cart-widget`, {
      ...backgroundStyle(cart.background),
      padding: cart.padding,
      borderRadius: cart.radius,
      borderColor: cart.borderColor,
      borderWidth: cart.borderWidth,
      borderStyle: cart.borderWidth ? "solid" : undefined,
      boxShadow: cart.shadow,
    });
    addRule(rules, `${root}.vsn-cart-widget>strong,${root} .vsn-cart-heading,${root} h2,${root} h3`, { color: cart.headingColor, fontSize: cart.headingSize });
    addRule(rules, `${root} .vsn-cart-widget-body,${root} .vsn-cart-empty,${root} .vsn-cart-meta`, { color: cart.mutedColor });
    addRule(rules, `${root} .vsn-cart-actions,${root} .vsn-cart-footer`, { gap: cart.actionGap });
  }

  if (has("stickyCart")) {
    const sticky = widgetStyles.stickyCart || {};
    addRule(rules, `${root},${root}.vsn-sticky-cart,${root} .vsn-sticky-cart`, {
      ...backgroundStyle(sticky.background),
      paddingInline: sticky.paddingX,
      paddingBlock: sticky.paddingY,
      borderTopColor: sticky.borderColor,
      borderTopWidth: sticky.borderWidth,
      borderTopStyle: sticky.borderWidth ? "solid" : undefined,
      boxShadow: sticky.shadow,
    });
    addRule(rules, `${root}.vsn-sticky-cart strong,${root} .vsn-sticky-cart strong`, { color: sticky.titleColor });
    addRule(rules, `${root}.vsn-sticky-cart strong+div,${root} .vsn-sticky-cart strong+div`, { color: sticky.priceColor });
  }

  if (has("commerceHeading")) {
    const heading = widgetStyles.commerceHeading || {};
    addRule(rules, `${root}>h2:first-child,${root}>h3:first-child,${root} .vsn-commerce-heading`, { color: heading.color, fontSize: heading.fontSize, fontWeight: heading.fontWeight, marginBottom: heading.marginBottom });
  }

  if (has("searchSummary")) {
    const summary = widgetStyles.searchSummary || {};
    addRule(rules, `${root} .vsn-search-query-prefix,${root} .vsn-search-count-label`, { color: summary.labelColor });
    addRule(rules, `${root} .vsn-search-query-value,${root} .vsn-search-count-value`, { color: summary.valueColor, fontWeight: summary.valueWeight });
    if (type === "search-result-count") addRule(rules, root, { backgroundColor: summary.background, paddingInline: summary.paddingX, paddingBlock: summary.paddingY, borderRadius: summary.radius, display: "inline-flex", alignItems: "center", gap: "0.35em" });
  }

  if (has("searchResults")) {
    const search = widgetStyles.searchResults || {};
    addRule(rules, `${root} .vsn-search-card>a`, { display: "grid", gap: search.contentGap });
    addRule(rules, `${root} .vsn-search-card-media`, { marginBottom: search.mediaMarginBottom });
    addRule(rules, `${root} .vsn-search-type`, { color: search.typeColor, fontSize: search.typeSize });
    addRule(rules, `${root} .vsn-search-card-title`, { color: search.titleColor, fontSize: search.titleSize, fontWeight: search.titleWeight });
    if (present(search.titleClamp)) addRule(rules, `${root} .vsn-search-card-title`, { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: search.titleClamp, overflow: "hidden" });
    addRule(rules, `${root} .vsn-search-card-excerpt`, { color: search.excerptColor, fontSize: search.excerptSize });
    if (present(search.excerptClamp)) addRule(rules, `${root} .vsn-search-card-excerpt`, { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: search.excerptClamp, overflow: "hidden" });
    addRule(rules, `${root} .vsn-search-empty`, { color: search.emptyColor });
  }

  if (has("articleCards")) {
    const article = widgetStyles.articleCards || {};
    const cards = `${root} .vsn-article-card`;
    addRule(rules, `${cards}>a`, { display: "grid", gap: article.contentGap });
    addRule(rules, `${cards} .vsn-article-card-title`, { color: article.titleColor, fontSize: article.titleSize, fontWeight: article.titleWeight });
    if (present(article.titleClamp)) addRule(rules, `${cards} .vsn-article-card-title`, { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: article.titleClamp, overflow: "hidden" });
    addRule(rules, `${cards} .vsn-article-card-excerpt`, { color: article.excerptColor, fontSize: article.excerptSize });
    addRule(rules, `${cards} .vsn-article-card-date`, { color: article.dateColor });
    addRule(rules, `${cards} .vsn-article-card-author`, { color: article.authorColor });
    addRule(rules, `${cards} .vsn-article-card-meta`, { display: "flex", flexWrap: "wrap", gap: article.metaGap });
  }

  if (has("articleBody")) {
    const body = widgetStyles.articleBody || {};
    addRule(rules, `${root} h1,${root} h2,${root} h3,${root} h4,${root} h5,${root} h6`, { color: body.headingColor, marginTop: body.headingTop, marginBottom: body.headingBottom });
    addRule(rules, `${root} a`, { color: body.linkColor });
    addRule(rules, `${root} a:hover`, { color: body.linkHoverColor });
    addRule(rules, `${root} blockquote`, { borderInlineStartColor: body.quoteBorderColor, padding: body.quotePadding });
    addRule(rules, `${root} img,${root} video,${root} iframe`, { borderRadius: body.mediaRadius });
    addRule(rules, `${root} code,${root} pre`, { backgroundColor: body.codeBackground, color: body.codeColor });
  }

  if (has("articleMeta")) {
    const meta = widgetStyles.articleMeta || {};
    addRule(rules, root, { color: meta.color, backgroundColor: meta.background, fontSize: meta.fontSize, fontWeight: meta.fontWeight, paddingInline: meta.paddingX, paddingBlock: meta.paddingY, borderRadius: meta.radius });
    addRule(rules, `${root}.vsn-article-tags`, { display: "flex", alignItems: "center", flexWrap: "wrap", gap: meta.tagGap });
    addRule(rules, `${root} .vsn-article-tag`, { backgroundColor: meta.tagBackground, paddingInline: meta.paddingX, paddingBlock: meta.paddingY, borderRadius: meta.radius });
  }

  if (has("articleNav")) {
    const nav = widgetStyles.articleNav || {};
    addRule(rules, root, { gap: nav.gap });
    addRule(rules, `${root} a`, { color: nav.color, backgroundColor: nav.background, borderColor: nav.borderColor, borderWidth: nav.borderColor ? "1px" : undefined, borderStyle: nav.borderColor ? "solid" : undefined, padding: nav.padding, borderRadius: nav.radius, textDecorationLine: "none" });
    addRule(rules, `${root} a:hover`, { color: nav.hoverColor });
  }

  if (has("customerIdentity")) {
    const identity = widgetStyles.customerIdentity || {};
    addRule(rules, root, { backgroundColor: identity.background, paddingInline: identity.paddingX, paddingBlock: identity.paddingY, borderRadius: identity.radius });
    addRule(rules, `${root} .vsn-customer-prefix`, { color: identity.prefixColor });
    addRule(rules, `${root} .vsn-customer-name-value`, { color: identity.nameColor, fontWeight: identity.nameWeight });
  }

  if (has("customerLink")) {
    const customer = widgetStyles.customerLink || {};
    const links = `${root}:is(a,button),${root} a,${root} button`;
    addRule(rules, links, { textDecorationLine: customer.decoration, textUnderlineOffset: customer.underlineOffset });
    addRule(rules, withPseudo(links, ":hover"), { textDecorationLine: customer.hoverDecoration });
  }

  if (has("codeSurface")) {
    const code = widgetStyles.codeSurface || {};
    addRule(rules, `${root},${root} pre,${root}.vsn-code-surface`, { backgroundColor: code.background, color: code.color, fontSize: code.fontSize, lineHeight: code.lineHeight, padding: code.padding, borderRadius: code.radius, borderWidth: code.borderWidth, borderColor: code.borderColor, borderStyle: code.borderWidth ? "solid" : undefined, maxHeight: code.maxHeight, overflow: code.overflow, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" });
  }

  if (has("contentCollection")) {
    const content = widgetStyles.contentCollection || {};
    const items = `${root} .vsn-content-item,${root} .vsn-team-card,${root} .vsn-logo-item,${root} .vsn-gallery-item,${root}.vsn-image-box`;
    addRule(rules, items, { backgroundColor: content.background, borderColor: content.borderColor, borderWidth: content.borderColor ? "1px" : undefined, borderStyle: content.borderColor ? "solid" : undefined, padding: content.padding, borderRadius: content.radius, boxShadow: content.shadow, gap: content.gap });
    addRule(rules, `${items} img,${items} .vsn-content-media`, { borderRadius: content.mediaRadius });
    addRule(rules, `${items} h2,${items} h3,${items} strong,${items} .vsn-content-title`, { color: content.titleColor });
    addRule(rules, `${items} p,${items} .vsn-content-body,${items} .vsn-content-meta`, { color: content.bodyColor });
  }

  if (has("icon")) {
    const icon = widgetStyles.icon || {};
    const selector = `${root} svg,${root} .vsn-icon,${root}>span:first-child,${root} li>span:first-child,${root}>div:first-child>a`;
    addRule(rules, selector, {
      width: icon.size,
      height: icon.size,
      fontSize: icon.size,
      color: icon.color,
      backgroundColor: icon.background,
      borderRadius: icon.radius,
      padding: icon.padding,
      borderColor: icon.borderColor,
      borderWidth: icon.borderWidth,
      borderStyle: icon.borderWidth ? (icon.borderStyle || "solid") : undefined,
      opacity: icon.opacity,
      boxShadow: icon.shadow,
      rotate: icon.rotate,
      transition: icon.transition,
    });
    addRule(rules, `${root} svg`, { strokeWidth: icon.strokeWidth });
    addRule(rules, withPseudo(selector, ":hover"), { color: icon.hoverColor, backgroundColor: icon.hoverBackground, borderColor: icon.hoverBorderColor, transform: icon.hoverTransform });
    addRule(rules, `${root} li,${root}>div:first-child`, { gap: icon.gap });
    addRule(rules, `${root} li>a,${root} li>span:last-child,${root} .vsn-icon-label,${root} strong`, { color: icon.labelColor, fontSize: icon.labelSize, fontWeight: icon.labelWeight });
  }

  if (has("accordion")) {
    const accordion = widgetStyles.accordion || {};
    addRule(rules, `${root} details`, {
      backgroundColor: accordion.background,
      borderColor: accordion.borderColor,
      borderWidth: accordion.borderWidth,
      borderStyle: accordion.borderWidth ? (accordion.borderStyle || "solid") : undefined,
      borderRadius: accordion.radius,
      padding: accordion.padding,
      boxShadow: accordion.shadow,
      transition: accordion.transition,
    });
    addRule(rules, `${root} summary`, { color: accordion.headerColor, backgroundColor: accordion.headerBackground, fontSize: accordion.headerSize, fontWeight: accordion.headerWeight, padding: accordion.headerPadding, transition: accordion.transition });
    addRule(rules, `${root} summary:hover`, { color: accordion.headerHoverColor, backgroundColor: accordion.headerHoverBackground });
    addRule(rules, `${root} summary::marker,${root} summary::-webkit-details-marker`, { color: accordion.markerColor, fontSize: accordion.markerSize });
    addRule(rules, `${root} details>div`, { color: accordion.contentColor, fontSize: accordion.contentSize, lineHeight: accordion.contentLineHeight, paddingTop: accordion.contentGap, padding: accordion.contentPadding });
    addRule(rules, `${root} details[open]`, { backgroundColor: accordion.openBackground, borderColor: accordion.openBorderColor, boxShadow: accordion.openShadow });
    addRule(rules, `${root} details[open]>summary`, { color: accordion.openHeaderColor });
    addRule(rules, `${root}`, { gap: accordion.itemGap });
  }

  if (has("tabs")) {
    const tabs = widgetStyles.tabs || {};
    const tabButtons = `${root} .vsn-tab-button,${root}>div:first-child>button`;
    addRule(rules, `${root}>div:first-child,${root} [role="tablist"]`, { gap: tabs.gap });
    addRule(rules, tabButtons, {
      color: tabs.color,
      backgroundColor: tabs.background,
      borderRadius: tabs.radius,
      paddingInline: tabs.paddingX,
      paddingBlock: tabs.paddingY,
      fontSize: tabs.fontSize,
      fontWeight: tabs.fontWeight,
      borderColor: tabs.borderColor,
      borderWidth: tabs.borderWidth,
      borderStyle: tabs.borderWidth ? "solid" : undefined,
      transition: tabs.transition,
    });
    addRule(rules, `${root} .vsn-tab-button:hover,${root}>div:first-child>button:hover`, { color: tabs.hoverColor, backgroundColor: tabs.hoverBackground });
    addRule(rules, `${root} .vsn-tab-button.is-active,${root} .vsn-tab-button[aria-selected="true"],${root}>div:first-child>button:first-child`, { color: tabs.activeColor, backgroundColor: tabs.activeBackground, borderColor: tabs.activeBorderColor });
    addRule(rules, `${root} [data-vsn-tab-panel],${root}>div:nth-child(2)`, { backgroundColor: tabs.panelBackground, color: tabs.panelColor, padding: tabs.panelPadding, borderRadius: tabs.panelRadius, borderColor: tabs.panelBorderColor, borderWidth: tabs.panelBorderWidth, borderStyle: tabs.panelBorderWidth ? "solid" : undefined, boxShadow: tabs.panelShadow });
  }

  if (has("progress")) {
    const progress = widgetStyles.progress || {};
    addRule(rules, `${root}>div:first-child>div:last-child,${root} .vsn-progress-track`, { height: progress.height, backgroundColor: progress.trackColor, borderRadius: progress.radius, borderColor: progress.trackBorderColor, borderWidth: progress.trackBorderWidth, borderStyle: progress.trackBorderWidth ? "solid" : undefined, overflow: "hidden" });
    addRule(rules, `${root}>div:first-child>div:last-child>div,${root}>div:last-child>span,${root} .vsn-progress-fill`, { ...backgroundStyle(progress.fillBackground), ...(progress.fillBackground ? {} : { backgroundColor: progress.fillColor }), borderRadius: progress.radius });
    addRule(rules, `${root} b,${root}>div:first-child>span`, { color: progress.labelColor, fontSize: progress.labelSize, fontWeight: progress.labelWeight });
    addRule(rules, `${root}>div:first-child>span:last-child,${root} .vsn-progress-value`, { color: progress.valueColor, fontSize: progress.valueSize, fontWeight: progress.valueWeight });
  }

  if (has("table")) {
    const table = widgetStyles.table || {};
    addRule(rules, `${root} table`, { borderColor: table.borderColor, borderWidth: table.outerBorderWidth, borderStyle: table.outerBorderWidth ? "solid" : undefined, borderRadius: table.radius, overflow: "hidden", borderCollapse: "collapse" });
    addRule(rules, `${root} th`, { backgroundColor: table.headerBackground, color: table.headerColor, fontSize: table.headerSize, fontWeight: table.headerWeight, padding: table.cellPadding, borderColor: table.borderColor, borderBottomWidth: table.rowBorderWidth, borderBottomStyle: table.rowBorderWidth ? (table.rowBorderStyle || "solid") : undefined, textAlign: table.textAlign, verticalAlign: table.verticalAlign, position: table.stickyHeader ? "sticky" : undefined, top: table.stickyHeader ? 0 : undefined, zIndex: table.stickyHeader ? 1 : undefined });
    addRule(rules, `${root} td`, { color: table.cellColor, fontSize: table.cellSize, padding: table.cellPadding, borderColor: table.borderColor, borderBottomWidth: table.rowBorderWidth, borderBottomStyle: table.rowBorderWidth ? (table.rowBorderStyle || "solid") : undefined, textAlign: table.textAlign, verticalAlign: table.verticalAlign });
    addRule(rules, `${root} tbody tr:nth-child(even)`, { backgroundColor: table.stripeColor });
    addRule(rules, `${root} tbody tr:hover`, { backgroundColor: table.hoverColor });
  }

  if (has("stats")) {
    const stats = widgetStyles.stats || {};
    addRule(rules, root, { gap: stats.itemGap, textAlign: stats.textAlign });
    addRule(rules, `${root}>div:first-child>div,${root}.vsn-countdown>span,${root}>span`, {
      backgroundColor: stats.itemBackground,
      borderColor: stats.itemBorderColor,
      borderWidth: stats.itemBorderWidth,
      borderStyle: stats.itemBorderWidth ? (stats.itemBorderStyle || "solid") : undefined,
      borderRadius: stats.itemRadius,
      padding: stats.itemPadding,
      minWidth: stats.itemMinWidth,
      boxShadow: stats.itemShadow,
      textAlign: stats.textAlign,
    });
    addRule(rules, `${root} b,${root}.vsn-counter,${root}.vsn-countdown>span${type === "counter" ? `,${root}>div:first-child` : ""}`, { color: stats.valueColor, fontSize: stats.valueSize, fontWeight: stats.valueWeight, lineHeight: stats.valueLineHeight });
    addRule(rules, `${root}>div:first-child>div>div`, { color: stats.labelColor, fontSize: stats.labelSize, fontWeight: stats.labelWeight });
  }

  if (has("carousel")) {
    const carousel = widgetStyles.carousel || {};
    const track = `${root}.vsn-snap-carousel,${root}>div:first-child`;
    const items = `${root}.vsn-snap-carousel>article,${root}>div:first-child>div`;
    addRule(rules, track, { gap: carousel.gap, scrollPaddingInline: carousel.scrollPadding, scrollBehavior: carousel.scrollBehavior });
    addRule(rules, items, { minWidth: carousel.itemWidth, borderRadius: carousel.itemRadius, padding: carousel.itemPadding, scrollSnapAlign: carousel.snapAlign, ...backgroundStyle(carousel.itemBackground), borderColor: carousel.itemBorderColor, borderWidth: carousel.itemBorderWidth, borderStyle: carousel.itemBorderWidth ? "solid" : undefined, boxShadow: carousel.itemShadow, transition: carousel.itemTransition });
    addRule(rules, withPseudo(items, ":hover"), { transform: carousel.itemHoverTransform });
  }

  if (has("bar")) {
    const bar = widgetStyles.bar || {};
    addRule(rules, root, { minHeight: bar.minHeight, paddingInline: bar.paddingX, paddingBlock: bar.paddingY, letterSpacing: bar.letterSpacing, ...backgroundStyle(bar.background), color: bar.color, fontSize: bar.fontSize, fontWeight: bar.fontWeight, textTransform: bar.textTransform, textAlign: bar.textAlign, borderRadius: bar.radius, borderWidth: bar.borderWidth, borderColor: bar.borderColor, borderStyle: bar.borderWidth ? "solid" : undefined, boxShadow: bar.shadow });
  }

  if (has("divider")) {
    const divider = widgetStyles.divider || {};
    addRule(rules, `${root}:is(hr),${root} hr,${root}>hr`, { borderTopColor: divider.color, borderTopWidth: divider.width, borderTopStyle: divider.style, width: divider.length, marginInline: divider.alignment === "center" ? "auto" : divider.alignment === "right" ? "0 0 0 auto" : undefined, opacity: divider.opacity });
  }

  return rules.join("\n");
}
