# Email Renderer

Email documents are separate from page documents. The deterministic table renderer supports client diagnostics, Outlook VML button fallback, dark-mode metadata, dynamic bindings and HTML/MJML/plain-text exports.

## Engineering rules

- Keep client-safe and server-only dependencies separated.
- Reuse shared contracts instead of parallel engines.
- Enforce permissions on the server.
- Add acceptance criteria and a regression audit for meaningful platform changes.
