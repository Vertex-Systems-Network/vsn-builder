# Wishlist Runtime

Wishlist uses anonymous local persistence and signed app-proxy customer identity for authenticated persistence. Never trust browser-supplied customer identity.

## Engineering rules

- Keep client-safe and server-only dependencies separated.
- Reuse shared contracts instead of parallel engines.
- Enforce permissions on the server.
- Add acceptance criteria and a regression audit for meaningful platform changes.
