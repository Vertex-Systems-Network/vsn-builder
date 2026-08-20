# Renderer

Canvas, Preview and Storefront share the same schema/rendering contracts. Email uses a separate email renderer. New widget capabilities must be implemented consistently or explicitly unsupported.

## Engineering rules

- Keep client-safe and server-only dependencies separated.
- Reuse shared contracts instead of parallel engines.
- Enforce permissions on the server.
- Add acceptance criteria and a regression audit for meaningful platform changes.
