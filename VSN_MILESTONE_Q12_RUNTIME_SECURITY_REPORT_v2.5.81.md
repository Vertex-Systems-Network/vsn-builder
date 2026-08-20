# VSN Milestone Q.1-Q.2 — Runtime Audit & Security Hardening

Version: 2.5.81
Status: Developer Mode / complete

## Runtime hardening

- Fixed the packaged SQLite baseline so all 30 packaged migrations, including BuilderEmailTemplate, are represented and applied.
- Added safe repair for two legacy migration-history gaps where schema columns existed but Prisma history did not.
- Moved migration deployment to Shopify `predev` and added a required-table fail-fast schema check.
- Added Email Builder feature-schema guards and actionable `VSN_SCHEMA_NOT_READY` responses.
- Added System Health migration/schema readiness details.
- Added app-level React runtime recovery and global client runtime reporting.

## Security hardening

- Added origin/fetch-metadata validation for sensitive embedded-admin mutations.
- Added embedded-app response security headers that preserve Shopify framing.
- Hardened SVG sanitization against executable/embedded document content.
- Blocked critical Global JavaScript execution primitives and filtered unsafe legacy snippets from runtime delivery.
- Reduced persisted client-error URL data to origin + pathname and sanitized diagnostics.
- Added automated authentication/security boundary coverage checks.
