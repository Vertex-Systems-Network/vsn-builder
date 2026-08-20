# Milestone Q.4.8 — Email Studio 2.2 (Developer Mode)

Version: **2.5.92**

Developer Mode remains active. Q.4.8 upgrades Email Studio without changing production URLs, billing activation, or the SQLite development-data contract.

## Included
- Reusable linked symbols inside an email.
- Merchant saved email blocks through the existing Library model.
- Shopify Products + Collections authoring browser.
- Desktop/mobile block visibility.
- Persistent Email revision history through BuilderRevision.
- Curated plan-aware Email Marketplace.
- Structured server-only AI Email assistant foundation.
- Email Document v4 normalization; no Prisma migration.

## Safety
- No SMTP/ESP sending runtime is introduced.
- AI credentials remain server-side and output is restricted to the VSN structured email schema.
- Existing Email Builder documents normalize forward.
