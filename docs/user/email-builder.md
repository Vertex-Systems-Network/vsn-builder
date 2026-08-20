# Email Studio 2.2

VSN Email Studio is a dedicated ecommerce-email editor. It does not reuse web-page markup and it keeps deterministic email-safe HTML, MJML source and plain-text exports.

## Workspace

The full-screen Studio contains:

- **Blocks** — 19 email-native blocks grouped by structure, content, commerce and utility.
- **Layers** — select, reorder, duplicate and delete blocks; active condition/repeat logic is visible in layer labels.
- **Saved** — create linked reusable symbols inside the email and merchant saved blocks reusable across emails.
- **Assets** — choose Shopify Files, register external HTTPS/CDN images, search saved assets and apply them to image-capable blocks.
- **Data** — inspect/copy Shopify merge tags and loop-item tokens.
- **Commerce** — search Shopify products and collections, then insert/populate Product or Product Grid blocks.
- **AI** — structured server-side email/section generation, rewrite and subject-line assistance when the shop plan and server configuration permit it.
- **History** — previous server snapshots plus the current session's before-save snapshots; restore locally, review, and save.
- **Setup** — template name, category, subject, preheader and readiness state.
- **Inspector** — Content, Style, Logic and Global Styles.

## Reusable symbols and saved blocks

Convert a selected block into a reusable symbol. Every linked instance within that email stays synchronized when one instance changes. Detach an instance to edit it independently. Save any selected block into the merchant email-block library to reuse it in other templates.

Saved blocks reuse the existing VSN Library persistence model and symbols live in `BuilderEmailTemplate.documentJson`, so Email Studio 2.2 needs no new database migration.

## Shopify commerce browser

The Commerce panel loads a bounded authenticated catalog preview from Shopify Admin GraphQL. Search products or collections. A product can populate the current Product block or insert a new one; a collection can populate a Product Grid with up to four explicit product cards and a collection CTA.

## Rich text

Text-oriented email blocks support email-safe rich text with bold, italic, underline, strike-through, ordered/unordered lists, links, alignment, clear formatting and merge-tag insertion. Saved rich text is sanitized to a restricted email-safe HTML allowlist before rendering.

## Conditions, loops and responsive visibility

Each block can enable a condition against supported preview/runtime data and can repeat over Products, Recent order line items or Cart items. Every block also has separate **Desktop** and **Mobile** visibility switches. The design canvas keeps hidden/conditional blocks visible as authoring overlays instead of silently removing them.

## Responsive columns

Column blocks support two or three columns. Resize adjacent columns directly on the canvas, use equal/33–67/67–33 presets, normalize percentages, and choose whether columns stack on mobile.

## Version history

Before each manual save, VSN persists the previous email state to the existing `BuilderRevision` store using an `email:<template-id>` revision key. The History panel can restore a snapshot locally so it can be reviewed before the restored state is saved as the current email.

## Template Marketplace

Email Builder includes a curated VSN Email Marketplace catalog separate from the basic starters. Marketplace templates carry category, tags and plan tier. Plan gating is enforced again on the server when a merchant creates an email from a marketplace template.

## AI Email

The AI panel is a structured-generation layer, not an arbitrary HTML/code generator. The API key remains server-side, usage is counted through the existing VSN AI quota system, and provider output must match a strict JSON schema of allowed email block types. Returned blocks are normalized through the same email document schema before entering the editor. AI does not send mail.

## Preview and exports

Use desktop/mobile canvas modes, zoom, light/dark preview, compatibility diagnostics and source mode. Export deterministic HTML, MJML source or plain text. Diagnostics cover Gmail clipping risk, Outlook patterns, Apple Mail/Yahoo concerns, accessibility, image alt text, hidden-all-device blocks and column-width consistency.

## Safety boundaries

Email Studio does not send production email and does not store SMTP/ESP credentials. Existing N.1–N.3 and Email Studio 2.0/2.1 documents normalize forward to Email Document v4 without a Prisma/database migration.
