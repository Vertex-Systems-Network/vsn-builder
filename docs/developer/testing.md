# Testing

Run targeted milestone audits during development and `npm run qa:release` before packaging. Validate syntax, package integrity, codebase health, migrations, client/server boundaries and ecosystem/documentation coverage.

## Engineering rules

- Keep client-safe and server-only dependencies separated.
- Reuse shared contracts instead of parallel engines.
- Enforce permissions on the server.
- Add acceptance criteria and a regression audit for meaningful platform changes.
