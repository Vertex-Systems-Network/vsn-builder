import db from "../db.server.js";
import { detectSpam } from "../utils/security.server.js";
import { fileAllowed } from "../builder/formEngine.js";
import {
  getFormConfig,
  requesterHash,
  verifyTurnstile,
  verifyHcaptcha,
  verifyGoogleRecaptcha,
  deliverFormAutomations,
  scanUpload,
  formSuccessPayload,
} from "./form-automation.server.js";
import { loadGoogleCaptchaRuntime } from "./google-platform.server.js";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function collectFormBuilderKeys(nodes, out = new Set()) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (node?.type === "form-builder") out.add(String(node?.props?.formKey || "custom").trim().slice(0, 80) || "custom");
    if (Array.isArray(node?.children)) collectFormBuilderKeys(node.children, out);
  }
  return out;
}

export async function loadRenderFormConfigs(shop, nodes) {
  const keys = [...collectFormBuilderKeys(nodes)];
  const entries = await Promise.all(keys.map(async (key) => [key, (await getFormConfig(db, shop, key)).settings]));
  return Object.fromEntries(entries);
}

export async function handleStorefrontFormSubmission(request, session, formData) {
  const honeypot = String(formData.get("website") || "").trim();
  if (honeypot) return jsonResponse({ ok: true, spamFiltered: true });

  const formType = String(formData.get("formType") || formData.get("formKey") || "contact").trim().slice(0, 80) || "contact";
  const pageUrl = String(formData.get("pageUrl") || "").trim().slice(0, 1500);
  const productHandle = String(formData.get("productHandle") || "").trim().slice(0, 255);
  const { settings, retentionDays } = await getFormConfig(db, session.shop, formType);
  const visitorHash = requesterHash(request, session.shop);

  if (settings.privacyStoreRequesterHash) {
    const since = new Date(Date.now() - 3600000);
    const count = await db.builderFormSubmission.count({ where: { shop: session.shop, requesterHash: visitorHash, createdAt: { gte: since } } });
    if (count >= settings.rateLimitPerHour) return jsonResponse({ ok: false, error: "Too many submissions. Please try again later." }, 429);
  }

  if (settings.captchaMode === "turnstile") {
    const verification = await verifyTurnstile(String(formData.get("cf-turnstile-response") || formData.get("turnstileToken") || ""), request);
    if (!verification.ok) return jsonResponse({ ok: false, error: verification.error }, 400);
  }
  if (settings.captchaMode === "hcaptcha") {
    const verification = await verifyHcaptcha(String(formData.get("h-captcha-response") || formData.get("hcaptchaToken") || ""), request);
    if (!verification.ok) return jsonResponse({ ok: false, error: verification.error }, 400);
  }
  if (settings.captchaMode === "recaptcha-v2") {
    const runtime = await loadGoogleCaptchaRuntime(db, session.shop, "v2");
    if (!runtime.enabled || !runtime.siteKey || !runtime.secretKey) return jsonResponse({ ok: false, error: "Google reCAPTCHA v2 is enabled for this form but is not fully configured." }, 400);
    const verification = await verifyGoogleRecaptcha(String(formData.get("g-recaptcha-response") || formData.get("recaptchaToken") || ""), request, { secretKey: runtime.secretKey, version: "v2" });
    if (!verification.ok) return jsonResponse({ ok: false, error: verification.error }, 400);
  }
  if (settings.captchaMode === "recaptcha-v3") {
    const runtime = await loadGoogleCaptchaRuntime(db, session.shop, "v3");
    if (!runtime.enabled || !runtime.siteKey || !runtime.secretKey) return jsonResponse({ ok: false, error: "Google reCAPTCHA v3 is enabled for this form but is not fully configured." }, 400);
    const threshold = Math.max(0, Math.min(1, Number(settings.recaptchaV3Threshold ?? runtime.threshold ?? 0.5)));
    const expectedAction = String(settings.recaptchaV3Action || runtime.action || "form_submit").replace(/[^A-Za-z0-9_/]/g, "").slice(0, 80) || "form_submit";
    const verification = await verifyGoogleRecaptcha(String(formData.get("g-recaptcha-response") || formData.get("recaptchaToken") || ""), request, { secretKey: runtime.secretKey, version: "v3", threshold, expectedAction });
    if (!verification.ok) return jsonResponse({ ok: false, error: verification.error }, 400);
  }

  const fields = {};
  const files = [];
  let customerEmail = "";
  for (const [rawKey, rawValue] of formData.entries()) {
    const key = String(rawKey || "").trim().slice(0, 120);
    if (!key || ["website", "pageUrl", "productHandle", "formType", "formKey", "cf-turnstile-response", "turnstileToken", "h-captcha-response", "hcaptchaToken", "g-recaptcha-response", "recaptchaToken", "recaptchaAction"].includes(key)) continue;
    if (typeof rawValue === "string") {
      const value = rawValue.trim().slice(0, 10000);
      if (fields[key] === undefined) fields[key] = value;
      else fields[key] = Array.isArray(fields[key]) ? [...fields[key], value] : [fields[key], value];
      if (!customerEmail && /email/i.test(key) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) customerEmail = value.toLowerCase();
    } else if (rawValue && typeof rawValue === "object" && Number(rawValue.size || 0) > 0) {
      files.push({ fieldName: key, file: rawValue });
      fields[key] = { name: String(rawValue.name || "").slice(0, 255), type: String(rawValue.type || "application/octet-stream").slice(0, 120), size: Number(rawValue.size || 0) };
    }
  }

  if (formType === "newsletter") {
    const email = String(fields.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ ok: false, error: "Enter a valid email address." }, 400);
  }
  if (files.length > settings.maxFiles) return jsonResponse({ ok: false, error: `You can upload up to ${settings.maxFiles} files.` }, 400);
  for (const { file } of files) {
    if (Number(file.size || 0) > settings.maxFileSizeMb * 1024 * 1024) return jsonResponse({ ok: false, error: `${file.name} exceeds the ${settings.maxFileSizeMb} MB file limit.` }, 400);
    if (!fileAllowed(file, settings)) return jsonResponse({ ok: false, error: `${file.name} is not an allowed file type.` }, 400);
  }

  const spamReason = detectSpam(fields);
  const created = await db.builderFormSubmission.create({ data: {
    shop: session.shop,
    formKey: formType,
    pageUrl: pageUrl || null,
    productHandle: productHandle || null,
    customerEmail: customerEmail || (typeof fields.email === "string" ? fields.email.slice(0, 254) : null),
    fieldsJson: JSON.stringify(fields),
    isSpam: Boolean(spamReason),
    spamReason: spamReason || null,
    requesterHash: settings.privacyStoreRequesterHash ? visitorHash : null,
    deliveryStatus: spamReason ? "blocked" : "pending",
    retainedUntil: new Date(Date.now() + retentionDays * 86400000),
  } });

  let blockedUpload = false;
  for (const { fieldName, file } of files) {
    const scan = await scanUpload({ file, shop: session.shop, submissionId: created.id });
    if (scan.status === "blocked" || scan.status === "error") blockedUpload = true;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await db.builderFormUpload.create({ data: { shop: session.shop, submissionId: created.id, fieldName, fileName: String(file.name || "upload").slice(0, 255), mimeType: String(file.type || "application/octet-stream").slice(0, 120), size: Number(file.size || 0), fileData: bytes, scanStatus: scan.status, scanMessage: scan.message || null } });
  }
  if (blockedUpload) {
    await db.builderFormSubmission.update({ where: { id: created.id }, data: { isSpam: true, spamReason: "file-scan-blocked", deliveryStatus: "blocked" } });
    return jsonResponse({ ok: false, error: "One of the uploaded files did not pass security scanning." }, 400);
  }
  if (!spamReason) await deliverFormAutomations({ db, shop: session.shop, submission: created, fields, settings });
  return jsonResponse({ ok: true, id: created.id, actions: formSuccessPayload(settings), uploads: files.length });
}
