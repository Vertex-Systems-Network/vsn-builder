# Email Renderer Architecture — Email Studio 2.2

VSN email documents remain isolated from VSN web-page documents. Q.4.8 advances the in-document schema to **Email Document v4** for reusable symbols and responsive visibility while retaining v3 assets, rich text, block logic and resizable columns. This is a JSON normalization upgrade only; `BuilderEmailTemplate.documentJson` remains the persistence field and no Prisma migration is required.

## Authoritative modules

- `app/email/emailSchema.js` — v4 normalization, 19 email blocks, symbols, assets, responsive visibility/columns and backward-compatible defaults.
- `app/email/emailRenderer.js` — deterministic table-safe HTML + plain-text compiler, explicit product grids and responsive visibility classes.
- `app/email/emailMjml.js` — deterministic MJML source export with matching visibility and product-grid semantics.
- `app/email/emailCompatibility.js` — static client-risk diagnostics.
- `app/email/emailBindings.js` — Shopify/sample bindings and token resolution.
- `app/email/emailRichText.js` — restricted rich-text sanitization/rendering/plain-text conversion.
- `app/email/emailLogic.js` — conditions and repeat collection materialization.
- `app/email/emailMarketplace.js` — curated plan-aware Email Marketplace source catalog.
- `app/services/email-builder.server.js` — persistence, server version snapshots, merchant saved blocks and bounded Shopify commerce catalog retrieval.
- `app/services/email-ai.server.js` — structured server-only AI email generation with quota accounting.
- `app/components/email-studio/*` — Studio sidebar, Saved, Assets, Data, Commerce, AI, History, canvas and inspector surfaces.

## Symbols and reusable blocks

Document symbols live under `documentJson.symbols`. Each linked block carries `symbolId` and `symbolName`; edits are propagated across linked instances by the Studio state layer. Merchant reusable blocks use `BuilderLibraryItem` with `kind=email-block`, `templateType=email` and `source=local`, avoiding a duplicate persistence model.

## Version history

The previous state before a save is persisted in `BuilderRevision` with `kind=email-save` and `pageId=email:<template-id>`. Version snapshots contain email metadata plus the prior `documentJson`. Hard deletion of an email also removes its email-save revisions.

## Commerce data

`loadEmailCommerceCatalog` executes authenticated Admin GraphQL through the Shopify app session. The browser receives only bounded normalized product/collection summaries required for authoring. Product Grid blocks can store up to four explicit product items so renderer and MJML output are deterministic even without live bindings.

## Responsive visibility

Every block normalizes to `{desktop:boolean,mobile:boolean}`. HTML/MJML compilers emit stable visibility classes and email-safe mobile CSS. A block disabled for both targets is surfaced by compatibility diagnostics rather than silently accepted.

## AI safety contract

The Email AI provider is invoked only on the server. `OPENAI_API_KEY` is never serialized to the browser. AI usage reuses `BuilderAiUsage` and plan quotas. The provider must produce strict structured JSON containing only approved email block fields; HTML, CSS, JavaScript, Liquid, forms, tracking code and unknown block types are prohibited by the schema/instructions, and provider output is normalized before use.

## Compatibility contract

Existing N.1–N.3/v2 and Studio 2.1/v3 documents normalize into v4 defaults. Legacy button style keys remain supported. Dynamic merge tags remain token-preserving. VML Outlook CTA fallbacks, dark-mode metadata, Gmail clipping diagnostics and deterministic HTML/MJML/plain-text exports remain intact.

VSN still does not include an SMTP/ESP sending runtime or production inbox-screenshot provider.
