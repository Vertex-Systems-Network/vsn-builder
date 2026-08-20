# Architecture

VSN is a schema-driven Shopify visual commerce IDE. Dashboard/admin UI, creative Editor UI, shared contracts, renderers and server services have explicit ownership boundaries. Never import `.server` modules into client route code.

## Engineering rules

- Keep client-safe and server-only dependencies separated.
- Reuse shared contracts instead of parallel engines.
- Enforce permissions on the server.
- Add acceptance criteria and a regression audit for meaningful platform changes.
