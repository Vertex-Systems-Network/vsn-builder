# Phase 12 Developer Mode

VSN Builder v2.5.47 remains intentionally in developer mode.

## Feature gate

`VSN_FEATURE_FORMS_AUTOMATION` defaults to `false`. Enable it explicitly in a development environment when testing Forms 2.0.

## Optional external services

The core builder works without production credentials. Features that contact external services require explicit developer configuration:

- `VSN_TURNSTILE_SECRET_KEY` — Cloudflare Turnstile verification.
- `VSN_HCAPTCHA_SECRET_KEY` — hCaptcha verification.
- `VSN_FORM_FILE_SCAN_WEBHOOK` — optional malware/security scanner endpoint.
- `VSN_FORM_EMAIL_WEBHOOK_URL` and `VSN_FORM_EMAIL_WEBHOOK_SECRET` — optional email-delivery adapter for admin notifications and autoresponders.

Managed integration endpoints can be configured for Webhook, Klaviyo, Mailchimp, HubSpot, Zapier, Make and Shopify Flow bridge use cases. Credentials remain store configuration and are intentionally omitted from exported backups.

## Safety rules

- No production deployment or production URL changes are performed by Phase 12.
- Submission retention is configurable; expired retained data is cleanup-compatible.
- Form attachments are stored privately and served only through authenticated admin routes.
- SVG uploads are sanitized before storage and rendering.
- Font and SVG delete operations are soft-delete first; permanent deletion is a separate action.
- Library Sync restores VSN defaults without overwriting merchant-created library content.
