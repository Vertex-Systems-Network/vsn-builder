import { useCallback, useEffect, useState } from "react";

const APPEARANCE_KEY = "vsn:appearance";
const APPEARANCE_EVENT = "vsn:appearance-change";

function preferenceValue() {
  try {
    const value = localStorage.getItem(APPEARANCE_KEY) || "system";
    return ["light", "dark", "system"].includes(value) ? value : "system";
  } catch {
    return "system";
  }
}

function resolveAppearance(media) {
  const preference = preferenceValue();
  return preference === "dark" || (preference === "system" && Boolean(media?.matches));
}

function applyDocumentTheme(darkMode) {
  if (typeof document !== "undefined") document.documentElement.dataset.vsnTheme = darkMode ? "dark" : "light";
}

export default function useEditorAppearance() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const apply = () => {
      const next = resolveAppearance(media);
      setDarkMode(next);
      applyDocumentTheme(next);
    };
    const syncStorage = (event) => { if (!event?.key || event.key === APPEARANCE_KEY) apply(); };
    const syncLocal = () => apply();
    apply();
    media?.addEventListener?.("change", apply);
    window.addEventListener("storage", syncStorage);
    window.addEventListener(APPEARANCE_EVENT, syncLocal);
    return () => {
      media?.removeEventListener?.("change", apply);
      window.removeEventListener("storage", syncStorage);
      window.removeEventListener(APPEARANCE_EVENT, syncLocal);
    };
  }, []);

  const toggle = useCallback(() => {
    setDarkMode((current) => {
      const nextDark = !current;
      const nextPreference = nextDark ? "dark" : "light";
      try { localStorage.setItem(APPEARANCE_KEY, nextPreference); } catch {}
      applyDocumentTheme(nextDark);
      window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: { preference: nextPreference } }));
      return nextDark;
    });
  }, []);

  return { darkMode, toggle };
}
