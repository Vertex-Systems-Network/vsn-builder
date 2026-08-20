import { authenticate } from '../shopify.server';
import { recordOperationalError } from '../utils/observability.server.js';
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";
import { sanitizePlainText } from "../utils/security.server.js";

export async function action({ request }) {
  assertTrustedMutationRequest(request);
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const pageId = String(form.get('pageId') || '').slice(0, 120) || null;
  const widgetId = String(form.get('widgetId') || '').slice(0, 120) || null;
  const release = sanitizePlainText(form.get('release') || '', 80);
  const route = sanitizePlainText(form.get('route') || 'client', 180);
  const message = sanitizePlainText(form.get('message') || 'Client runtime error', 1200);
  const stack = sanitizePlainText(form.get('stack') || '', 7000);
  let href = ''; try { const parsed = new URL(String(form.get('href') || '')); href = `${parsed.origin}${parsed.pathname}`.slice(0,1600); } catch {}
  await recordOperationalError({ shop: session.shop, code: 'CLIENT_RUNTIME', message, route, pageId, details: { release, widgetId, stack, href } });
  return Response.json({ ok: true });
}
export default function ClientErrorsRoute(){ return null; }
