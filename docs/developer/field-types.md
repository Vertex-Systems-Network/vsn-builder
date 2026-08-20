# Widget Field Types

Custom Widget Studio uses shared human-readable field types and per-type configuration. Field definitions declare validation, defaults, group and renderer behavior.

## Engineering rules

- Keep client-safe and server-only dependencies separated.
- Reuse shared contracts instead of parallel engines.
- Enforce permissions on the server.
- Add acceptance criteria and a regression audit for meaningful platform changes.
