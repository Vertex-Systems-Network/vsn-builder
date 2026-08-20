# Stock Image Provider Contracts

## Architecture

- `stock-image-integrations.server.js` — provider settings, encrypted credentials, masked public settings, connection tests. Unsplash stores Access Key and Secret Key independently while preserving legacy `apiKey` as an Access Key alias.
- `secret-vault.server.js` — per-shop AES-256-GCM secret encryption.
- `stock-images.server.js` — normalized search, provider caching, source validation, Shopify Files lifecycle, favorites/import metadata.
- `app.stock-images.jsx` — authenticated Stock Images workspace.
- `BuilderStockSearchCache` — provider-aware search cache; Pixabay TTL is 24 hours.

## Unified result contract

Each provider maps into: provider/providerLabel/providerId, width/height, thumbnail/preview URL, alt/title, author/author URL, source URL, optional download-tracking location, provider color, and provider-specific raw metadata.

## Security boundaries

Browser-submitted image URLs are never trusted for Shopify import. Import/update always resolves the provider ID again using the saved server credential. Download source and redirect hosts are allowlisted, only HTTPS is accepted, MIME type must be JPEG/PNG/WebP/GIF, and payload size is capped at a conservative 18 MB and provider-side rendition selection targets no more than 18 MP before Shopify Files staging.

## Shopify Files lifecycle

1. `stagedUploadsCreate(resource: IMAGE)`
2. multipart upload to Shopify's returned target
3. `fileCreate` with returned `resourceUrl`
4. `fileUpdate` only when current file status is READY
5. `fileDelete` for confirmed permanent deletion

The Shopify app therefore declares `read_files,write_files`.

## Credential model

- Unsplash public API requests use the Access Key as `Authorization: Client-ID <access-key>`.
- Unsplash Secret Key is separately encrypted and retained for OAuth/user-auth flows; normal public image discovery/import does not send it.
- Optional environment fallbacks: `UNSPLASH_ACCESS_KEY`, `UNSPLASH_SECRET_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`.
- Browser loader payloads expose only configured flags and masked suffixes.

## Provider policy behavior

- Empty-query discovery uses Unsplash `GET /photos`, Pexels `GET /v1/curated`, and Pixabay popular API results.
- Unsplash discovery uses returned image CDN URLs and an import fires `download_location` before downloading `photo.urls.*` for Shopify transfer.
- Pexels result UI links prominently to Pexels and credits the photographer when possible.
- Pixabay queries are cached for 24 hours; its remote URLs are limited to temporary discovery display and are not retained as permanent favorite/import thumbnails.
