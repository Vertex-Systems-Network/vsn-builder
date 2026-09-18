import { createHmac } from "node:crypto";
import db from "../db.server.js";
import { detectSpam, publicHttpsRequest } from "../utils/security.server.js";

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

async function deliverLegacyWebhook(endpoint, payload) {
  const signature = endpoint.secret
    ? createHmac("sha256", endpoint.secret).update(payload).digest("hex")
    : "";

  return publicHttpsRequest(endpoint.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(signature ? { "x-vsn-signature": signature } : {}),
    },
    body: payload,
    timeoutMs: 5000,
    maxBodyBytes: 512 * 1024,
    maxResponseBytes: 64 * 1024,
  });
}

export async function handleLegacyStorefrontFormSubmission({ session, formData }) {
  const honeypot = String(formData.get("website") || "").trim();
  if (honeypot) return jsonResponse({ ok: true });

  const formType = String(formData.get("formType") || formData.get("formKey") || "contact").trim().slice(0, 80);
  const pageUrl = String(formData.get("pageUrl") || "").trim().slice(0, 1500);
  const productHandle = String(formData.get("productHandle") || "").trim().slice(0, 255);
  const fields = {};
  let customerEmail = "";

  for (const [rawKey, rawValue] of formData.entries()) {
    const key = String(rawKey || "").trim().slice(0, 120);
    if (!key || ["website", "pageUrl", "productHandle", "formType", "formKey"].includes(key)) continue;

    if (typeof rawValue === "string") {
      const value = rawValue.trim().slice(0, 10000);
      if (fields[key] === undefined) fields[key] = value;
      else fields[key] = Array.isArray(fields[key]) ? [...fields[key], value] : [fields[key], value];
      if (!customerEmail && /email/i.test(key) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        customerEmail = value.toLowerCase();
      }
    } else if (rawValue && typeof rawValue === "object") {
      fields[key] = {
        name: String(rawValue.name || "").slice(0, 255),
        type: String(rawValue.type || "application/octet-stream").slice(0, 120),
        size: Number(rawValue.size || 0),
      };
    }
  }

  if (formType === "newsletter") {
    const email = String(fields.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ ok: false, error: "Enter a valid email address." }, 200);
    }
  }

  const spamReason = detectSpam(fields);
  const created = await db.builderFormSubmission.create({
    data: {
      shop: session.shop,
      formKey: formType || "contact",
      pageUrl: pageUrl || null,
      productHandle: productHandle || null,
      customerEmail: customerEmail || (typeof fields.email === "string" ? fields.email.slice(0, 254) : null),
      fieldsJson: JSON.stringify(fields),
      isSpam: Boolean(spamReason),
      spamReason: spamReason || null,
    },
  });

  if (!spamReason) {
    const endpoints = await db.builderWebhookEndpoint.findMany({
      where: { shop: session.shop, enabled: true },
    });
    const payload = JSON.stringify({
      id: created.id,
      shop: session.shop,
      formKey: created.formKey,
      pageUrl,
      productHandle,
      customerEmail: created.customerEmail,
      fields,
      createdAt: created.createdAt,
    });

    await Promise.allSettled(
      endpoints
        .filter((endpoint) => endpoint.formKey === "*" || endpoint.formKey === created.formKey)
        .map((endpoint) => deliverLegacyWebhook(endpoint, payload)),
    );
  }

  return jsonResponse({ ok: true, id: created.id });
}
