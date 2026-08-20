export const OVERLAY_CAMPAIGN_TEMPLATE_TYPES = Object.freeze(["popup","modal","drawer","flyout","announcement-overlay"]);
export const FLOATING_TEMPLATE_TYPES = Object.freeze(["floating-element"]);
export const CAMPAIGN_TEMPLATE_TYPES = Object.freeze([...OVERLAY_CAMPAIGN_TEMPLATE_TYPES, ...FLOATING_TEMPLATE_TYPES]);
export const CAMPAIGN_SCHEMA_VERSION = 1;

const num = (value, fallback = 0, min = 0, max = Number.POSITIVE_INFINITY) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

export function isCampaignTemplate(template) {
  return CAMPAIGN_TEMPLATE_TYPES.includes(String(template || "").trim());
}

export function normalizeCampaignSettings(input = {}, template = "popup") {
  const source = input && typeof input === "object" ? input : {};
  const kind = isCampaignTemplate(template) ? template : "popup";
  return {
    campaignSchemaVersion: CAMPAIGN_SCHEMA_VERSION,
    campaignEnabled: source.campaignEnabled !== false,
    campaignKind: kind,
    campaignStart: String(source.campaignStart || ""),
    campaignEnd: String(source.campaignEnd || ""),
    campaignTimezone: String(source.campaignTimezone || "UTC") || "UTC",
    campaignFallbackPageId: String(source.campaignFallbackPageId || ""),
    campaignTrigger: ["delay","exit-intent","scroll","inactivity","click-selector","cart-state","page-count"].includes(source.campaignTrigger) ? source.campaignTrigger : "delay",
    campaignDelayMs: num(source.campaignDelayMs, 1500, 0, 3600000),
    campaignScrollPercent: num(source.campaignScrollPercent, 50, 1, 100),
    campaignInactivityMs: num(source.campaignInactivityMs, 8000, 1000, 3600000),
    campaignClickSelector: String(source.campaignClickSelector || ""),
    campaignCartState: ["any","empty","has-items"].includes(source.campaignCartState) ? source.campaignCartState : "any",
    campaignPageCount: num(source.campaignPageCount, 2, 1, 1000),
    campaignFrequency: ["session","day","week","once","custom"].includes(source.campaignFrequency) ? source.campaignFrequency : "session",
    campaignFrequencyHours: num(source.campaignFrequencyHours, 24, 1, 8760),
    campaignIncludePath: String(source.campaignIncludePath || source.includePath || ""),
    campaignExcludePath: String(source.campaignExcludePath || source.excludePath || ""),
    campaignCustomerState: ["any","logged-in","logged-out"].includes(source.campaignCustomerState || source.customerState) ? (source.campaignCustomerState || source.customerState) : "any",
    campaignTemplates: String(source.campaignTemplates || ""),
    campaignResourceHandles: String(source.campaignResourceHandles || ""),
    campaignLanguages: String(source.campaignLanguages || ""),
    campaignCountries: String(source.campaignCountries || ""),
    campaignUtmSource: String(source.campaignUtmSource || ""),
    campaignUtmMedium: String(source.campaignUtmMedium || ""),
    campaignUtmCampaign: String(source.campaignUtmCampaign || ""),
    campaignCloseOnBackdrop: source.campaignCloseOnBackdrop !== false,
    campaignCloseOnEscape: source.campaignCloseOnEscape !== false,
    campaignShowClose: source.campaignShowClose !== false,
    campaignDrawerSide: ["left","right"].includes(source.campaignDrawerSide) ? source.campaignDrawerSide : "right",
    campaignMaxWidth: num(source.campaignMaxWidth, kind === "announcement-overlay" ? 1200 : kind === "floating-element" ? 360 : 640, 180, 1800),
    campaignFloatingPosition: ["top-left","top-center","top-right","middle-left","middle-right","bottom-left","bottom-center","bottom-right"].includes(source.campaignFloatingPosition) ? source.campaignFloatingPosition : "bottom-right",
    campaignOffsetX: num(source.campaignOffsetX, 20, 0, 240),
    campaignOffsetY: num(source.campaignOffsetY, 20, 0, 240),
    campaignZIndex: num(source.campaignZIndex, 2147481000, 1, 2147483000),
    campaignHideMobile: source.campaignHideMobile === true,
  };
}

function csvSet(value) {
  return new Set(String(value || "").split(",").map((item)=>item.trim().toLowerCase()).filter(Boolean));
}

export function campaignDateMs(value, timezone = "UTC") {
  const raw = String(value || "").trim();
  if (!raw) return NaN;
  if (/Z$|[+-]\d{2}:?\d{2}$/i.test(raw)) return Date.parse(raw);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return Date.parse(raw);
  const parts = match.slice(1).map(Number); const [y,m,d,h,min,sec=0] = parts;
  let guess = Date.UTC(y,m-1,d,h,min,sec);
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone || "UTC", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23" });
    const offsetAt = (ms) => { const obj=Object.fromEntries(fmt.formatToParts(new Date(ms)).filter(p=>p.type!=="literal").map(p=>[p.type,Number(p.value)])); return Date.UTC(obj.year,obj.month-1,obj.day,obj.hour,obj.minute,obj.second)-ms; };
    let target = guess - offsetAt(guess); target = guess - offsetAt(target); return target;
  } catch { return guess; }
}

export function campaignScheduleState(settings, now = Date.now()) {
  const s = normalizeCampaignSettings(settings, settings?.campaignKind);
  const start = campaignDateMs(s.campaignStart, s.campaignTimezone);
  const end = campaignDateMs(s.campaignEnd, s.campaignTimezone);
  if (Number.isFinite(start) && now < start) return "scheduled";
  if (Number.isFinite(end) && now > end) return "expired";
  return s.campaignEnabled ? "active" : "disabled";
}

export function campaignMatchesContext(settings, context = {}) {
  const s = normalizeCampaignSettings(settings, settings?.campaignKind);
  const path = String(context.path || "/");
  if (s.campaignIncludePath && !path.includes(s.campaignIncludePath)) return false;
  if (s.campaignExcludePath && path.includes(s.campaignExcludePath)) return false;
  if (s.campaignCustomerState === "logged-in" && !context.customerLoggedIn) return false;
  if (s.campaignCustomerState === "logged-out" && context.customerLoggedIn) return false;
  const templates = csvSet(s.campaignTemplates); if (templates.size && !templates.has(String(context.template || context.pageType || "").toLowerCase())) return false;
  const handles = csvSet(s.campaignResourceHandles); if (handles.size && !handles.has(String(context.resourceHandle || "").toLowerCase())) return false;
  const languages = csvSet(s.campaignLanguages); if (languages.size && !languages.has(String(context.language || "").toLowerCase())) return false;
  const countries = csvSet(s.campaignCountries); if (countries.size && !countries.has(String(context.country || "").toLowerCase())) return false;
  if (s.campaignCartState === "empty" && Number(context.cartItemCount || 0) > 0) return false;
  if (s.campaignCartState === "has-items" && Number(context.cartItemCount || 0) <= 0) return false;
  return true;
}
