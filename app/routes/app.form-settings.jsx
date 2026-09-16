import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { getBuilderRole, canBuilder } from "../utils/builder-permissions.js";
import { canAccessBuilderSystem } from "../utils/builder-permissions.server.js";
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";
import { validateWebhookUrl } from "../utils/security.server.js";
import { normalizeFormAutomationSettings } from "../builder/formEngine.js";
import { loadGoogleCaptchaSettings, saveGoogleCaptchaSettings } from "../services/google-platform.server.js";

function parse(value, fallback = {}) {
  try { return JSON.parse(value || "") || fallback; } catch { return fallback; }
}

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  if (!(await canAccessBuilderSystem(db, session, "formSettings"))) throw new Response("Forbidden", { status: 403 });
  const [setting, endpoints, configs, integrations, logs, captchaProviders] = await Promise.all([
    db.builderShopSetting.findUnique({ where: { shop: session.shop } }),
    db.builderWebhookEndpoint.findMany({ where: { shop: session.shop }, orderBy: { updatedAt: "desc" } }),
    db.builderFormConfig.findMany({ where: { shop: session.shop }, orderBy: { updatedAt: "desc" } }),
    db.builderIntegration.findMany({ where: { shop: session.shop, provider: { in: ["webhook", "klaviyo", "mailchimp", "hubspot", "zapier", "make", "shopify-flow"] } }, orderBy: { updatedAt: "desc" } }),
    db.builderAutomationLog.findMany({ where: { shop: session.shop }, orderBy: { createdAt: "desc" }, take: 50 }),
    loadGoogleCaptchaSettings(db, session.shop),
  ]);
  const onboarding = parse(setting?.onboardingJson, {});
  return {
    captchaProviders,
    notificationEmail: onboarding.formNotificationEmail || "",
    emailAdapterConfigured: Boolean(String(process.env.VSN_FORM_EMAIL_WEBHOOK_URL || "").trim()),
    endpoints: endpoints.map((item) => ({ ...item, secret: item.secret ? "••••••••" : "" })),
    configs: configs.map((item) => ({ ...item, settings: normalizeFormAutomationSettings(parse(item.settingsJson, {})) })),
    integrations: integrations.map((item) => ({ ...item, config: parse(item.configJson, {}), secretConfigured: Boolean(Object.keys(parse(item.secretJson, {})).length), secretJson: undefined })),
    logs,
  };
}

export async function action({ request }) {
  assertTrustedMutationRequest(request);
  const { session } = await authenticate.admin(request);
  const role = getBuilderRole(session);
  if (!canBuilder(role, "settings")) return Response.json({ ok: false, error: "Only the store owner can change form security and integration settings." }, { status: 403 });

  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent === "save-email") {
    const email = String(form.get("email") || "").trim().slice(0, 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
    const setting = await db.builderShopSetting.findUnique({ where: { shop: session.shop } });
    const onboarding = { ...parse(setting?.onboardingJson, {}), formNotificationEmail: email };
    await db.builderShopSetting.upsert({ where: { shop: session.shop }, create: { shop: session.shop, onboardingJson: JSON.stringify(onboarding) }, update: { onboardingJson: JSON.stringify(onboarding) } });
    return Response.json({ ok: true, intent, message: "Notification preference saved." });
  }

  if (intent === "save-form-config") {
    const formKey = String(form.get("formKey") || "*").trim().slice(0, 80) || "*";
    const settings = normalizeFormAutomationSettings({
      enabled: String(form.get("enabled") || "true") !== "false",
      maxFiles: form.get("maxFiles"), maxFileSizeMb: form.get("maxFileSizeMb"), allowedFileTypes: form.get("allowedFileTypes"), rateLimitPerHour: form.get("rateLimitPerHour"),
      captchaMode: form.get("captchaMode"), turnstileSiteKey: form.get("turnstileSiteKey"), hcaptchaSiteKey: form.get("hcaptchaSiteKey"), recaptchaV3Threshold: form.get("recaptchaV3Threshold"), recaptchaV3Action: form.get("recaptchaV3Action"),
      notificationEmail: form.get("notificationEmail"), autoresponderEnabled: String(form.get("autoresponderEnabled") || "false") === "true", autoresponderSubject: form.get("autoresponderSubject"), autoresponderBody: form.get("autoresponderBody"),
      successAction: form.get("successAction"), successMessage: form.get("successMessage"), redirectUrl: form.get("redirectUrl"), customEventName: form.get("customEventName"), couponCode: form.get("couponCode"),
      privacyStoreRequesterHash: String(form.get("privacyStoreRequesterHash") || "true") !== "false",
    });
    const retentionDays = Math.max(1, Math.min(3650, Number(form.get("retentionDays") || 90) || 90));
    await db.builderFormConfig.upsert({ where: { shop_formKey: { shop: session.shop, formKey } }, create: { shop: session.shop, formKey, settingsJson: JSON.stringify(settings), retentionDays, enabled: settings.enabled }, update: { settingsJson: JSON.stringify(settings), retentionDays, enabled: settings.enabled } });
    return Response.json({ ok: true, intent, message: `Form configuration saved for ${formKey}.` });
  }

  if (intent === "save-google-captcha") {
    const version = String(form.get("version") || "");
    if (!["v2", "v3"].includes(version)) return Response.json({ ok: false, error: "Choose Google reCAPTCHA v2 or v3." }, { status: 400 });
    const saved = await saveGoogleCaptchaSettings(db, session.shop, version, { enabled: String(form.get("enabled") || "true") !== "false", siteKey: form.get("siteKey"), secretKey: form.get("secretKey"), threshold: form.get("threshold"), action: form.get("action") });
    return Response.json({ ok: true, intent, version, captchaProvider: saved, message: `Google reCAPTCHA ${version} settings saved.` });
  }

  if (intent === "add-integration") {
    const provider = ["webhook", "klaviyo", "mailchimp", "hubspot", "zapier", "make", "shopify-flow"].includes(String(form.get("provider"))) ? String(form.get("provider")) : "webhook";
    let url;
    try { url = validateWebhookUrl(form.get("url")); } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
    const name = String(form.get("name") || provider).trim().slice(0, 100) || provider;
    const formKey = String(form.get("formKey") || "*").trim().slice(0, 80) || "*";
    const apiKey = String(form.get("apiKey") || "").trim().slice(0, 1000);
    const signingSecret = String(form.get("signingSecret") || "").trim().slice(0, 500);
    await db.builderIntegration.create({ data: { shop: session.shop, provider, name, formKey, enabled: true, configJson: JSON.stringify({ url }), secretJson: JSON.stringify({ ...(apiKey ? { apiKey } : {}), ...(signingSecret ? { signingSecret } : {}) }) } });
    return Response.json({ ok: true, intent, message: `${name} integration added.` });
  }

  if (intent === "add-webhook") {
    let url;
    try { url = validateWebhookUrl(form.get("url")); } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
    const formKey = String(form.get("formKey") || "*").trim().slice(0, 80) || "*";
    const secret = String(form.get("secret") || "").trim().slice(0, 200) || null;
    await db.builderWebhookEndpoint.create({ data: { shop: session.shop, formKey, url, secret, enabled: true } });
    return Response.json({ ok: true, intent, message: "Webhook added." });
  }

  const id = String(form.get("id") || "");
  if (["toggle-integration", "delete-integration"].includes(intent)) {
    const row = await db.builderIntegration.findFirst({ where: { id, shop: session.shop } });
    if (!row) return Response.json({ ok: false, error: "Integration not found." }, { status: 404 });
    if (intent === "toggle-integration") await db.builderIntegration.update({ where: { id }, data: { enabled: !row.enabled } });
    else await db.builderIntegration.delete({ where: { id } });
    return Response.json({ ok: true, intent, message: intent === "delete-integration" ? "Integration removed." : "Integration updated." });
  }

  const row = id ? await db.builderWebhookEndpoint.findFirst({ where: { id, shop: session.shop } }) : null;
  if (!row) return Response.json({ ok: false, error: "Webhook not found." }, { status: 404 });
  if (intent === "toggle-webhook") await db.builderWebhookEndpoint.update({ where: { id }, data: { enabled: !row.enabled } });
  else if (intent === "delete-webhook") await db.builderWebhookEndpoint.delete({ where: { id } });
  else return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  return Response.json({ ok: true, intent, message: intent === "delete-webhook" ? "Webhook removed." : "Webhook updated." });
}

export default function FormSettings() {
  const data = useLoaderData();
  const f = useFetcher();
  return <s-page heading="Forms 2.0 & Integrations"><s-section><p className="text-sm text-[#666]">Configure file uploads, validation/security, retention, success actions and automation providers. The same controls are available inside the Builder sidebar.</p><div className="mt-3 rounded-xl border bg-white p-4"><b>{data.configs.length}</b> form configuration(s) · <b>{data.integrations.length}</b> integrations · <b>{data.logs.length}</b> recent delivery log entries.</div>{f.data?.error ? <div className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{f.data.error}</div> : null}</s-section></s-page>;
}
