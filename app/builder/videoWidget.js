export const VIDEO_SOURCE_OPTIONS = [
  { value: "auto", label: "Auto Detect" },
  { value: "shopify", label: "Shopify Video" },
  { value: "youtube", label: "YouTube" },
  { value: "vimeo", label: "Vimeo" },
  { value: "dailymotion", label: "Dailymotion" },
  { value: "direct", label: "Direct Video URL" },
];

export function detectVideoProvider(url = "") {
  const source = String(url || "").trim();
  if (!source) return "direct";
  if (/youtu\.be\//i.test(source) || /youtube\.com\//i.test(source)) return "youtube";
  if (/vimeo\.com\//i.test(source)) return "vimeo";
  if (/dailymotion\.com\//i.test(source) || /dai\.ly\//i.test(source)) return "dailymotion";
  return "direct";
}

function youtubeId(url = "") {
  const value = String(url || "");
  const match = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/i);
  return match?.[1] || "";
}
function vimeoId(url = "") {
  const match = String(url || "").match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return match?.[1] || "";
}
function dailymotionId(url = "") {
  const match = String(url || "").match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([A-Za-z0-9]+)/i);
  return match?.[1] || "";
}

export function normalizeVideoWidgetProps(value = {}) {
  const explicit = ["auto", "shopify", "youtube", "vimeo", "dailymotion", "direct"].includes(value?.sourceType) ? value.sourceType : "auto";
  const shopifyUrl = String(value?.videoMedia?.url || "").trim();
  const url = explicit === "shopify" ? shopifyUrl : String(value?.url || shopifyUrl || "").trim();
  const provider = explicit === "auto" ? detectVideoProvider(url) : explicit;
  const autoplay = value?.autoplay === true;
  const muted = value?.muted === true || autoplay;
  return {
    ...value,
    sourceType: explicit,
    provider,
    url,
    videoMedia: value?.videoMedia && typeof value.videoMedia === "object" ? value.videoMedia : {},
    startTime: Math.max(0, Number(value?.startTime || 0)),
    endTime: Math.max(0, Number(value?.endTime || 0)),
    autoplay,
    muted,
    loop: value?.loop === true,
    controls: value?.controls !== false,
    playsInline: value?.playsInline !== false,
    defaultVolume: Math.max(0, Math.min(100, Number(value?.defaultVolume ?? 100))),
    preload: ["none", "metadata", "auto"].includes(value?.preload) ? value.preload : "metadata",
    lazyLoad: value?.lazyLoad !== false,
    posterEnabled: value?.posterEnabled === true,
    poster: value?.poster && typeof value.poster === "object" ? value.poster : {},
    showPlayIcon: value?.showPlayIcon !== false,
    playIcon: value?.playIcon && typeof value.playIcon === "object" ? value.playIcon : { source: "library", name: String(value?.playIcon || "play"), polarisType: String(value?.playIcon || "play") },
    playIconSize: Math.max(20, Math.min(160, Number(value?.playIconSize || 64))),
  };
}

export function videoEmbedUrl(value = {}, forceAutoplay = false) {
  const props = normalizeVideoWidgetProps(value);
  const autoplay = forceAutoplay || props.autoplay;
  const common = new URLSearchParams();
  if (autoplay) common.set("autoplay", "1");
  if (props.muted) common.set("mute", "1");
  if (props.loop) common.set("loop", "1");
  if (!props.controls) common.set("controls", "0");
  if (props.startTime) common.set("start", String(Math.floor(props.startTime)));

  if (props.provider === "youtube") {
    const id = youtubeId(props.url);
    if (!id) return "";
    if (props.loop) common.set("playlist", id);
    return `https://www.youtube.com/embed/${id}?${common.toString()}`;
  }
  if (props.provider === "vimeo") {
    const id = vimeoId(props.url);
    if (!id) return "";
    const query = new URLSearchParams();
    if (autoplay) query.set("autoplay", "1");
    if (props.muted) query.set("muted", "1");
    if (props.loop) query.set("loop", "1");
    if (!props.controls) query.set("controls", "0");
    return `https://player.vimeo.com/video/${id}?${query.toString()}`;
  }
  if (props.provider === "dailymotion") {
    const id = dailymotionId(props.url);
    if (!id) return "";
    const query = new URLSearchParams();
    if (autoplay) query.set("autoplay", "1");
    if (props.muted) query.set("mute", "1");
    if (!props.controls) query.set("controls", "0");
    if (props.startTime) query.set("start", String(Math.floor(props.startTime)));
    return `https://www.dailymotion.com/embed/video/${id}?${query.toString()}`;
  }
  return "";
}
