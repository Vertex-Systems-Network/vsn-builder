import { useEffect } from 'react';
import { VSN_BASELINE } from '../../config/baseline.js';

function payloadFrom(value, context) {
  const error = value instanceof Error ? value : new Error(String(value?.reason || value?.message || value || 'Unknown client error'));
  return {
    intent: 'client-error',
    release: VSN_BASELINE.version,
    pageId: String(context?.pageId || ''),
    route: String(context?.route || 'editor'),
    widgetId: String(context?.widgetId || ''),
    message: String(error.message || 'Unknown client error').slice(0, 1200),
    stack: String(error.stack || '').slice(0, 7000),
    href: typeof window !== 'undefined' ? window.location.href.slice(0, 1600) : '',
  };
}

export default function ClientErrorReporter({ pageId = '', widgetId = '' }) {
  useEffect(() => {
    let last = '';
    let lastAt = 0;
    const send = (value) => {
      const payload = payloadFrom(value, { pageId, widgetId, route: 'app.builder' });
      const signature = `${payload.message}|${payload.stack.slice(0, 180)}`;
      const now = Date.now();
      if (signature === last && now - lastAt < 5000) return;
      last = signature; lastAt = now;
      const body = new FormData();
      for (const [key, val] of Object.entries(payload)) body.set(key, val);
      fetch('/app/client-errors', { method: 'POST', body, credentials: 'same-origin', keepalive: true }).catch(() => {});
    };
    const onError = (event) => send(event.error || event.message);
    const onRejection = (event) => send(event.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, [pageId, widgetId]);
  return null;
}
