import { useEffect } from "react";

// Mounts muted looping <video> layers for nodes carrying data-vsn-bg-video,
// the same way the storefront runtime does (vsn-page-renderer.js).
export function mountBackgroundVideos(root) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll("[data-vsn-bg-video]").forEach((host) => {
    const url = host.getAttribute("data-vsn-bg-video") || "";
    const existing = host.querySelector(":scope > video[data-vsn-bg-video-layer]");
    if (existing?.getAttribute("src") === url) return;
    existing?.remove();
    if (!/^https:\/\//.test(url)) return;
    const video = document.createElement("video");
    Object.assign(video, { src: url, muted: true, loop: true, autoplay: true, playsInline: true });
    video.setAttribute("data-vsn-bg-video-layer", "1");
    video.setAttribute("aria-hidden", "true");
    Object.assign(video.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", zIndex: "0", pointerEvents: "none" });
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.prepend(video);
    for (const child of host.children) if (child !== video && getComputedStyle(child).position === "static") { child.style.position = "relative"; child.style.zIndex = "1"; }
    video.play?.().catch(() => {});
  });
}

export default function useBackgroundVideos(selector = "[data-vsn-editor-root]") {
  useEffect(() => { if (typeof document !== "undefined") mountBackgroundVideos(document.querySelector(selector)); });
}
