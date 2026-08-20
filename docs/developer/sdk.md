# SDK

The Extension SDK registers reviewed widgets, categories, field types, data providers, controls, renderers, template types and inspector panels through a guarded registry. Validate manifests before install.

## Engineering rules

- Keep client-safe and server-only dependencies separated.
- Reuse shared contracts instead of parallel engines.
- Enforce permissions on the server.
- Add acceptance criteria and a regression audit for meaningful platform changes.
