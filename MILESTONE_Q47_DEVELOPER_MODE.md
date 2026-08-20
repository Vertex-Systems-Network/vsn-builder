# Milestone Q.4.7 — Email Studio 2.1 (Developer Mode)

Version: **2.5.91**  
Status: **Complete**

## Scope

Email Studio 2.1 closes four major workflow gaps identified after comparing the v2.5.90 editor with mature email-authoring systems:

1. Reusable Shopify-aware assets.
2. Email-safe rich-text authoring.
3. Visual conditions and repeat collections.
4. Drag-resizable responsive email columns.

## Developer-mode guarantees

- No production SMTP/ESP sending is enabled.
- No new Prisma migration is introduced.
- Existing `BuilderEmailTemplate.documentJson` records normalize forward to Email Document schema v3.
- Shopify Files selection reuses the existing authenticated Admin media resolver.
- Dynamic data remains token-preserving in saved/exported source.
- Condition/repeat materialization is deterministic when preview/runtime bindings are supplied.
- Outlook-safe HTML, MJML source, plain text and N.3 diagnostics remain supported.
