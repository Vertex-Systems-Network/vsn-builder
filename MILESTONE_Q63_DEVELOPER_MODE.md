# Milestone Q.6.3 — Developer Mode

Version: **2.5.101**  
Date: **2026-08-10**  
Status: **Complete**

Q6.3 adds the Stock Image Hub and durable Dashboard/Templates view preferences while keeping the project in Developer Mode.

## Safety contract

- Stock-provider API keys are server-only and encrypted before database persistence.
- No provider credential is serialized into loader/action responses.
- Provider content is only imported to Shopify after a fresh server-side provider lookup.
- Remote image downloads are restricted to provider-owned HTTPS hosts, supported image MIME types, and a 25 MB maximum.
- Unsplash discovery previews use returned CDN URLs; import triggers the documented download event.
- Pixabay search responses are cached for 24 hours and Pixabay URLs are not persisted as permanent favorites/import thumbnails.
- Shopify Files writes use `write_files` and staged upload/file mutations.
- No production provider API key is included in the package.
- Exact Shopify billing handles remain `free`, `sliver`, `gold`, `platenium`.
