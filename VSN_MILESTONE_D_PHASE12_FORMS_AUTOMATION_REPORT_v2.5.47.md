# VSN Builder v2.5.47
## Milestone D — Phase 12: Forms 2.0, Integrations & Automation

Phase 12 extends the v2.5.46 Phase 11 baseline without replacing the established Canvas, Preview, Storefront, Campaign, CRO, Typography or Library architectures.

## Phase 12 core

- Multi-file uploads with size/type limits and private authenticated downloads.
- Conditional fields, validation rules, calculated fields and hidden fields.
- Query, customer and product prefill support.
- Honeypot and per-requester rate limiting.
- Cloudflare Turnstile and hCaptcha verification adapters.
- Form-specific or wildcard configuration with retention controls.
- Admin notification/autoresponder delivery adapter.
- Managed HTTP integrations and signed webhook delivery with retry logs.
- Success message, redirect, popup close, custom event and coupon actions.
- Submission delivery state, spam state, upload scan state and automation logs.
- Cleanup support for retained submissions and related uploads/logs.

## Builder workspace additions

- Campaign Builder and CRO Experiments are available directly from the Page Builder sidebar while reusing their existing loaders/actions and engines.
- New Floating Elements system reuses Campaign targeting/scheduling/frequency infrastructure and adds fixed-position storefront behavior.
- Custom Fonts is now a managed registry with search, add, update, trash, restore and permanent delete. Active fonts remain a shared Typography font source beside Google/system fonts.
- SVG Library is now a managed sanitized registry with search, add, edit, trash, restore and permanent delete, and is wired into the editor SVG picker.
- Form Submissions and Form Settings are available from the same workspace.

## Library and diagnostics

- Default Library Sync restores missing or soft-deleted VSN defaults without replacing merchant-created content.
- Popup starter templates and Floating Element starter templates are part of the default library catalog.
- Diagnostics & System Information exposes a sanitized builder-wide report covering version/baseline, runtime, database/migrations, Shopify configuration presence, feature flags, content, assets, forms/automation, collaboration, backups and structural issues.
- System information never exposes secret values.

## Backup policy

Backup format v4 includes managed custom-font binaries, SVG assets, form configuration and integration endpoint metadata. Form submissions are intentionally excluded for privacy, and integration secrets are intentionally stripped. Secrets must be re-entered after restore.

## Developer mode

Phase 12 remains feature-flagged and developer-safe. External email, CAPTCHA, scanner and third-party delivery services require explicit development credentials/endpoints; no production credentials are assumed.
