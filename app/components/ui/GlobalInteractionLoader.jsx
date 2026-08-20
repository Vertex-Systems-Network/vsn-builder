import { useCallback, useEffect, useRef, useState } from "react";
import { useFetchers, useNavigation } from "react-router";

const MIN_VISIBLE_MS = 320;

export default function GlobalInteractionLoader() {
  const [visible, setVisible] = useState(false);
  const startedAt = useRef(0);
  const timer = useRef(null);
  const watchdog = useRef(null);
  const explicitLoads = useRef(0);
  const routerBusyRef = useRef(false);
  const visibleRef = useRef(false);
  const navigation = useNavigation();
  const fetchers = useFetchers();
  const routerBusy = navigation.state !== "idle" || fetchers.some((fetcher) => fetcher.state !== "idle");

  const setLoaderVisible = useCallback((next) => {
    visibleRef.current = next;
    setVisible(next);
  }, []);

  const show = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!visibleRef.current) startedAt.current = Date.now();
    setLoaderVisible(true);
  }, [setLoaderVisible]);

  const hideWhenReady = useCallback(() => {
    if (routerBusyRef.current || explicitLoads.current > 0) return;
    const elapsed = Date.now() - startedAt.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLoaderVisible(false), wait);
  }, [setLoaderVisible]);

  useEffect(() => {
    routerBusyRef.current = routerBusy;
    if (routerBusy) show();
    else hideWhenReady();
  }, [routerBusy, show, hideWhenReady]);

  useEffect(() => {
    const armWatchdog = () => {
      if (watchdog.current) clearTimeout(watchdog.current);
      watchdog.current = setTimeout(() => {
        // Explicit UI loaders must never keep the whole application blocked forever.
        // Router navigation/fetcher state still remains authoritative when it is genuinely busy.
        explicitLoads.current = 0;
        if (!routerBusyRef.current) setLoaderVisible(false);
      }, 15000);
    };
    const onStart = () => {
      explicitLoads.current += 1;
      show();
      armWatchdog();
    };
    const onStop = () => {
      explicitLoads.current = Math.max(0, explicitLoads.current - 1);
      if (explicitLoads.current === 0 && watchdog.current) { clearTimeout(watchdog.current); watchdog.current = null; }
      hideWhenReady();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && !routerBusyRef.current) {
        explicitLoads.current = 0;
        if (watchdog.current) { clearTimeout(watchdog.current); watchdog.current = null; }
        setLoaderVisible(false);
      }
    };
    window.addEventListener("vsn:loading:start", onStart);
    window.addEventListener("vsn:loading:stop", onStop);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("vsn:loading:start", onStart);
      window.removeEventListener("vsn:loading:stop", onStop);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer.current) clearTimeout(timer.current);
      if (watchdog.current) clearTimeout(watchdog.current);
    };
  }, [show, hideWhenReady]);

  return visible ? (
    <div className="vsn-global-loader" role="status" aria-label="Loading">
      <div className="vsn-global-loader-bar" />
      <div className="vsn-global-loader-chip"><span className="vsn-global-loader-spinner"/><span>Loading</span></div>
    </div>
  ) : null;
}
