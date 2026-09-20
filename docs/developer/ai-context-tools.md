# Server-authoritative AI context tools

P1.3a introduces an internal, read-only context registry for future AI workflows. It does not change the P1.1 Editor Agent protocol and is not exposed as an arbitrary GraphQL surface.

## Purpose

Before P1.3a, the Builder had several separate sources of Shopify and VSN context, and the legacy AI Builder could receive a client-supplied `commerceContext`. P1.3a establishes a server-authoritative boundary that future Agent work can use without sending giant store dumps or trusting model/client-supplied GraphQL.

The legacy `commerceContext` path is intentionally not removed in P1.3a. Migration to the server-authoritative registry belongs to P1.3b so existing AI Builder behavior is not broken.

## Registry limits

The version-1 registry is defined in `app/ai/contextTools.js`.

- maximum 4 context requests per batch;
- maximum 10 items for normal Shopify list tools;
- maximum 20 markets;
- maximum 5 translation resource IDs;
- search strings capped at 160 characters;
- collection product samples capped at 8;
- analytics windows restricted to reviewed 24-hour or 168-hour windows;
- Shopify resources must use GraphQL GIDs.

Unknown tools and malformed IDs fail closed.

## Allowlisted tools

The initial registry contains only:

- `vsn.page.current`
- `shopify.products.search`
- `shopify.product.get`
- `shopify.collections.search`
- `shopify.collection.get`
- `shopify.files.search`
- `shopify.markets.list`
- `shopify.locales.list`
- `shopify.translations.get`
- `vsn.analytics.summary`
- `vsn.experiments.page`

No order, customer, payment, staff, credential, or secret context is exposed.

## Server authority

`app/services/ai-context-tools.server.js` requires the authenticated shop and current Builder page ID.

The current page is resolved from `BuilderPage` using both `shop` and `pageId`. Its template and linked Shopify resource identity therefore come from VSN's canonical persisted page rather than client-provided context.

Shopify context uses hard-coded GraphQL query documents and bounded variables. The caller cannot provide a GraphQL document.

The service is read-only:

- no Shopify mutations;
- no VSN database creates/updates/deletes;
- no page publication;
- no Global Design changes;
- no AI provider call;
- no Agent command execution.

## Shopify context

The fixed queries cover the currently authorized read scopes:

- products and bounded variant metadata;
- collections and bounded product samples;
- Files media metadata;
- Markets;
- shop locales;
- translatable content for explicitly supplied resource IDs.

Translation `digest` values are intentionally omitted because P1.3a is read-only and does not prepare translation mutations.

## App-owned context

`vsn.analytics.summary` reuses the existing privacy-conscious visitor summary service.

`vsn.experiments.page` reads experiment configuration only for the authenticated shop and current page. It returns bounded experiment/variant metadata and does not expose visitor assignments or raw event metadata.

## Agent boundary

P1.3a does **not** add context tools to `AI_AGENT_EXECUTABLE_COMMANDS` and does not change the Agent output schema.

P1.3b now integrates this registry into the Editor Agent behind an independent default-off feature flag. The model may request up to four allowlisted context tools in a planner phase; VSN executes them server-side and supplies normalized results to the final Agent edit-plan phase as untrusted data. The P1.1 executable command allowlist remains unchanged.

## QA

Run:

```bash
npm run qa:p13a-context
npm run security:audit
npm run qa:release
```

The deterministic audit uses mocked Shopify/VSN data. It verifies tool/input limits, shop/page isolation, fixed GraphQL documents, normalized outputs, sensitive-domain exclusions, translation digest omission, no write paths, and that the P1.1 Agent executable command allowlist remains unchanged.
