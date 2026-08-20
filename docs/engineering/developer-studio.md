# Developer Studio — Milestone K

## Purpose
Developer Studio is the owner-only development surface for Shopify Admin GraphQL work and storefront-level CSS/JavaScript. It is intentionally separate from the Loop Query Builder: Loop Query Builder remains a constrained merchant content/data abstraction, while Developer Studio exposes the authenticated app's actual GraphQL contract for technical users.

## GraphQL Studio
- Uses `authenticate.admin()` and the app's current Shopify Admin GraphQL client.
- Reads `currentAppInstallation.accessScopes` and GraphQL root introspection for the schema explorer.
- Supports query documents, JSON variables, saved queries, favorites, schema search and execution history.
- History stores query text, actor, success, duration and Shopify cost/throttle metadata. It does **not** store response payloads or unsaved variables.
- Subscriptions are rejected.
- Mutations are disabled unless the user completes a typed `MUTATE` confirmation for that individual run.
- Mutations whose operation document contains destructive verbs require a second typed `DELETE` confirmation.
- Shopify scopes remain authoritative; Developer Studio cannot bypass them.

## Global CSS / JavaScript
`BuilderGlobalCode` stores the current snippet and `BuilderGlobalCodeRevision` stores immutable snapshots created before edits/toggles/trash/rollback.

Supported scopes:
- whole storefront
- structural header/footer
- product, collection, search and article templates
- exact storefront page path
- market
- locale

JavaScript locations are `head`, `body-start` and `body-end`. CSS is always normalized to `head`. Theme-app-extension delivery uses the existing authenticated app proxy:
- `?globalCode=css`
- `?globalCode=js`

The runtime resolves only enabled, non-trashed snippets that match the request context and orders them by numeric priority. JavaScript snippets are isolated in `try/catch` blocks so one failing snippet does not prevent later snippets from running.

## Safe Mode
Enterprise Safe Mode short-circuits both Global CSS and Global JavaScript responses. This provides a recovery path if custom storefront code causes instability.

## Performance
Global Code responses use a short 15-second public cache with `stale-while-revalidate=30`. Runtime asset requests are handled before storefront visitor tracking so they do not inflate visitor metrics.

## Backups and privacy
Backup v7 includes saved GraphQL queries and Global Code/revisions. GraphQL execution history is excluded. Shopify GraphQL response data is never included in backups by this feature.

## Milestone L boundary
Milestone K is owner-only. Fine-grained permissions such as `graphql.run_queries`, `graphql.run_mutations`, and `global_code.publish` belong to Milestone L and must be enforced on the server as well as hidden in UI.
