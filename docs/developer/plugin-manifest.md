# Plugin Manifest

Plugin manifests declare identity, version/compatibility, permissions and extension registrations. Unknown permissions, incompatible versions or invalid registrations must fail validation.

## Engineering rules

- Keep client-safe and server-only dependencies separated.
- Reuse shared contracts instead of parallel engines.
- Enforce permissions on the server.
- Add acceptance criteria and a regression audit for meaningful platform changes.
