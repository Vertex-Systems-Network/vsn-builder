# Permissions

System access controls navigation/screen availability. Resource/action permissions control sensitive operations such as publish/delete, Marketplace install, GraphQL mutation, Global Code publish and billing management.

## Engineering rules

- Keep client-safe and server-only dependencies separated.
- Reuse shared contracts instead of parallel engines.
- Enforce permissions on the server.
- Add acceptance criteria and a regression audit for meaningful platform changes.
