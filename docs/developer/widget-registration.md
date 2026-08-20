# Widget Registration

Register one stable widget ID, label, capabilities, defaults, editor/storefront rendering contract and field/control metadata. Do not create a second registry.

## Engineering rules

- Keep client-safe and server-only dependencies separated.
- Reuse shared contracts instead of parallel engines.
- Enforce permissions on the server.
- Add acceptance criteria and a regression audit for meaningful platform changes.
