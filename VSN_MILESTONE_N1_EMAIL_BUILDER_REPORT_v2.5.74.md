# VSN Milestone N.1 — Email Builder Foundation Report

Version: **2.5.74**  
Mode: **Developer Mode**

## Implemented

- Dedicated Email Builder system and navigation.
- Separate email document schema and email renderer.
- Email-safe table HTML compilation and plain-text compilation.
- Seven starter templates: Welcome, Newsletter, Promotion, Product Launch, Abandoned Cart, Order Update, Back In Stock.
- Persisted My Emails with duplicate, metadata update, Trash, restore and permanent delete.
- In-app iframe preview plus HTML/plain-text export.
- `BuilderEmailTemplate` Prisma model and migration.
- Backup format v9 and uninstall cleanup.
- Role/system gating through the existing Permissions 2.0 architecture.

## Explicitly deferred to N.2+

- Full drag/drop email block editor.
- Responsive desktop/mobile canvas controls and client-specific warning panels.
- MJML adapter/compilation dependency.
- Dynamic Shopify customer/product/order binding UI.
- Sending-provider integrations and production campaign delivery.
- Real Gmail/Outlook pixel rendering service integration.
