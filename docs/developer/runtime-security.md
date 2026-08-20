# Runtime and security hardening

Milestone Q.1-Q.2 adds release-candidate runtime and security boundaries without changing storefront schemas.

## Database readiness

- `shopify.web.toml` runs `npm run db:prepare` before the React Router dev process.
- `scripts/prepare-database.mjs` performs Prisma generate, known legacy migration-history repair, migrate deploy and a required-table check.
- Legacy history repair never applies SQL or resets data. It marks a migration applied only when the exact known columns are already present.
- Feature routes can call `ensureFeatureSchema` to fail with an actionable 503 before Prisma raises P2021.

## Mutation request trust

Sensitive embedded-admin mutations use `assertTrustedMutationRequest`. It rejects `Sec-Fetch-Site: cross-site` requests and mismatched `Origin` values before processing the authenticated mutation. Shopify app-proxy and webhook routes are excluded because they use their own Shopify signature/HMAC authentication boundaries.

## Shopify request authentication

- Admin routes use `authenticate.admin`.
- Storefront app proxy uses `authenticate.public.appProxy`.
- Webhooks use `authenticate.webhook`.

## Browser/runtime isolation

`AppRuntimeBoundary` catches React render failures and reports deduplicated runtime diagnostics. Client error URLs are stored without query strings or hashes to avoid persisting embedded-session navigation parameters.

## Code/content safety

- Widget templates reject scripts, iframes, forms, event handlers, unsafe schemes and CSS execution primitives.
- SDK renderer descriptors use an allowlist for tags, attributes, URLs and style values.
- SVG sanitization removes executable/embedded document content including foreignObject and inline event handlers.
- Global JavaScript blocks eval, new Function, document.write and javascript: schemes at save time and filters legacy unsafe snippets from storefront runtime delivery.

## Response headers

Embedded app document responses add nosniff, strict referrer policy and a restrictive browser permissions policy. VSN deliberately does not set X-Frame-Options because Shopify Admin must embed the application.
