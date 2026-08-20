# Milestone Q.6.3.4 — Developer Mode

VSN Builder v2.5.105 fixes the Stock Media React Router client/server boundary without changing production billing, databases, provider credentials, or media data.

## Boundary rule
Browser-used stock provider constants live in `app/config/stock-media.js`. Server-only credentials, DB access, usage telemetry, search history, Shopify import logic and provider API calls remain in `.server.js` modules and are consumed only by route `loader`/`action` paths.
