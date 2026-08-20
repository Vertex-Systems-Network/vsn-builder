export const DESIGN_TOKEN_SYSTEM_VERSION = 2;


export const DESIGN_TOKEN_BASE_DEFAULTS = Object.freeze({
  primaryColor: "#008060", secondaryColor: "#6d7175", accentColor: "#008060", textColor: "#1a1a1a", backgroundColor: "#ffffff", surfaceColor: "#ffffff", mutedSurfaceColor: "#f6f6f7", borderColor: "#e3e3e3",
  fontFamily: "Inter, system-ui, sans-serif", headingFontFamily: "inherit", headingScale: "1.25", headingPreset: "700 42px/1.15 Inter, system-ui, sans-serif", bodyPreset: "400 16px/1.6 Inter, system-ui, sans-serif",
  spacingBase: "4", spacingXs: "4px", spacingSm: "8px", spacingMd: "16px", spacingLg: "24px", spacingXl: "40px",
  radiusSm: "6px", radiusMd: "10px", radiusLg: "18px", shadowSm: "0 1px 2px rgba(0,0,0,.08)", shadowMd: "0 8px 24px rgba(0,0,0,.12)", shadowLg: "0 20px 50px rgba(0,0,0,.16)",
  containerSm: "960px", containerMd: "1200px", containerLg: "1440px", containerMaxWidth: "1200px",
  buttonBackground: "#1a1a1a", buttonTextColor: "#ffffff", buttonRadius: "10px", buttonPadding: "12px 20px",
  formBackground: "#ffffff", formTextColor: "#202223", formBorderColor: "#c9cccf", formRadius: "8px",
});

export const DESIGN_TOKEN_GROUPS = Object.freeze([
  { key: 'color', label: 'Colors', keys: ['primaryColor','secondaryColor','accentColor','textColor','backgroundColor','surfaceColor','mutedSurfaceColor','borderColor','buttonBackground','buttonTextColor','formBackground','formTextColor','formBorderColor'] },
  { key: 'type', label: 'Typography', keys: ['fontFamily','headingFontFamily','headingScale','headingPreset','bodyPreset'] },
  { key: 'space', label: 'Spacing', keys: ['spacingBase','spacingXs','spacingSm','spacingMd','spacingLg','spacingXl','buttonPadding'] },
  { key: 'radius', label: 'Radius', keys: ['radiusSm','radiusMd','radiusLg','buttonRadius','formRadius'] },
  { key: 'shadow', label: 'Shadows', keys: ['shadowSm','shadowMd','shadowLg'] },
  { key: 'layout', label: 'Layout', keys: ['containerSm','containerMd','containerLg','containerMaxWidth'] },
]);

export const DEFAULT_SEMANTIC_ALIASES = Object.freeze({
  'color.brand.primary': 'primaryColor',
  'color.brand.secondary': 'secondaryColor',
  'color.brand.accent': 'accentColor',
  'color.text.default': 'textColor',
  'color.background.canvas': 'backgroundColor',
  'color.background.surface': 'surfaceColor',
  'color.background.muted': 'mutedSurfaceColor',
  'color.border.default': 'borderColor',
  'color.action.background': 'buttonBackground',
  'color.action.text': 'buttonTextColor',
  'space.xs': 'spacingXs',
  'space.sm': 'spacingSm',
  'space.md': 'spacingMd',
  'space.lg': 'spacingLg',
  'space.xl': 'spacingXl',
  'radius.sm': 'radiusSm',
  'radius.md': 'radiusMd',
  'radius.lg': 'radiusLg',
  'shadow.sm': 'shadowSm',
  'shadow.md': 'shadowMd',
  'shadow.lg': 'shadowLg',
  'layout.container': 'containerMd',
  'type.body.family': 'fontFamily',
  'type.heading.family': 'headingFontFamily',
});

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function tokenCssName(alias = '') {
  return `--vsn-token-${String(alias).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

export function normalizeDesignTokenDocument(input = {}) {
  const source = record(input);
  const metadata = record(source.__vsn2);
  const base = { ...DESIGN_TOKEN_BASE_DEFAULTS };
  for (const [key, value] of Object.entries(source)) {
    if (key === '__vsn2') continue;
    if (['string','number','boolean'].includes(typeof value)) base[key] = value;
  }
  const aliases = { ...DEFAULT_SEMANTIC_ALIASES, ...record(metadata.aliases) };
  const dark = record(record(metadata.modes).dark);
  return {
    schemaVersion: DESIGN_TOKEN_SYSTEM_VERSION,
    base,
    aliases,
    modes: { dark },
  };
}

export function serializeDesignTokenDocument(document = {}) {
  const normalized = normalizeDesignTokenDocument({
    ...record(document.base),
    __vsn2: {
      aliases: record(document.aliases),
      modes: { dark: record(document.modes?.dark) },
    },
  });
  return {
    ...normalized.base,
    __vsn2: {
      schemaVersion: DESIGN_TOKEN_SYSTEM_VERSION,
      aliases: normalized.aliases,
      modes: normalized.modes,
    },
  };
}

export function resolveTokenValue(document = {}, alias = '', mode = 'base') {
  const normalized = document.base ? document : normalizeDesignTokenDocument(document);
  const target = normalized.aliases?.[alias];
  if (!target) return undefined;
  if (mode === 'dark' && Object.prototype.hasOwnProperty.call(normalized.modes?.dark || {}, target)) return normalized.modes.dark[target];
  return normalized.base?.[target];
}

export function semanticCssVariables(document = {}, mode = 'base') {
  const normalized = document.base ? document : normalizeDesignTokenDocument(document);
  const output = {};
  for (const alias of Object.keys(normalized.aliases || {})) {
    const value = resolveTokenValue(normalized, alias, mode);
    if (value !== undefined && value !== null && String(value).trim() !== '') output[tokenCssName(alias)] = String(value);
  }
  return output;
}

export function tokenGroupForKey(key = '') {
  return DESIGN_TOKEN_GROUPS.find((group) => group.keys.includes(key))?.key || 'other';
}
