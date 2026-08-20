# Data Providers

Data providers expose bounded, permission-aware data to the query/binding system. Providers declare IDs, supported fields and runtime behavior; failures are isolated and surfaced through diagnostics.

## Engineering rules

- Keep client-safe and server-only dependencies separated.
- Reuse shared contracts instead of parallel engines.
- Enforce permissions on the server.
- Add acceptance criteria and a regression audit for meaningful platform changes.
