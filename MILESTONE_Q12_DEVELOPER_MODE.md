# Milestone Q.1-Q.2 — Developer Mode

VSN remains in Developer Mode. This milestone hardens runtime, migrations and security boundaries but does not enable production billing, production URLs or App Store release behavior.

## Runtime rules

- Development must fail before Vite starts if packaged migrations cannot be deployed.
- Do not use `prisma db push`, reset, or delete merchant development data to clear migration errors.
- Feature routes should return recovery guidance rather than exposing Prisma internals.
- Client render failures must resolve to VSN recovery UI rather than an empty embedded iframe.

## Security rules

- Shopify authentication remains authoritative for admin, app-proxy and webhook traffic.
- Sensitive admin mutations validate same-origin/fetch-metadata signals in addition to Shopify authentication.
- Critical executable Global Code patterns are blocked.
- Sanitizers must remain allowlist-oriented and are covered by release audits.
