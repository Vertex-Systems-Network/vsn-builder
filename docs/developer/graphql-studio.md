# GraphQL Studio

GraphQL Studio uses the authenticated Shopify Admin API, schema explorer, variables, history, cost/timing and saved queries. Mutations are disabled by default and require action permission plus confirmation.

## Engineering rules

- Keep client-safe and server-only dependencies separated.
- Reuse shared contracts instead of parallel engines.
- Enforce permissions on the server.
- Add acceptance criteria and a regression audit for meaningful platform changes.
