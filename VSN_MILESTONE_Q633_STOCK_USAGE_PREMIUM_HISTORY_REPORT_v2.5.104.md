# VSN Builder v2.5.104 — Milestone Q.6.3.3

## Stock API Usage, Search History & Premium Providers

### Fixes
- Shopify staged media upload now lets `stagedUploadsCreate` own the source filename. `fileCreate`/`fileUpdate` omit a second filename when `originalSource` is the staged resource URL, avoiding Shopify's filename/original-source extension mismatch.

### API usage telemetry
- Persistent per-shop/provider/media-kind request counters.
- Success/error totals and last HTTP status.
- Last endpoint and last-used timestamp.
- Provider rate-limit limit/remaining/reset when returned by the provider.
- Usage summary under each provider in Settings.
- Usage popup on Stock Images, Stock Videos and Stock Audio screens.

### Search history
- Separate image/video/audio search histories.
- Full search/filter parameter snapshot, not only the keyword.
- One-click rerun.
- Reuse counter and last-used ordering.
- Clear history per stock screen.
- Old history is automatically pruned.

### Per-page settings
- Unsplash Images.
- Pexels Images + Videos.
- Pixabay Images + Videos.
- Freesound Audio.
- Shutterstock Images + Videos + Audio.
- Getty/iStock Images + Videos.
- Stock screens read provider defaults and retain an interactive per-page field.

### Premium providers
- Shutterstock search adapters: images, videos and audio.
- Getty Images API adapter for Getty/iStock image and video discovery.
- Premium preview/search results are license-gated. VSN does not import provider previews as if they were licensed originals.

### Pixabay audio decision
Pixabay's website includes music/sound-effect products, but its documented public API contract exposes image and video endpoints. VSN therefore does not scrape or fabricate a Pixabay audio API.

## Final QA
- Q6.3 Stock Image Hub: 83/83 PASS
- Q6.3.1 Stock Credential/UI: 35/35 PASS
- Q6.3.2 Stock Media Expansion: 93/93 PASS
- Q6.3.3 Usage/Premium/History: 89/89 PASS
- Full `npm run qa:release`: EXIT 0
- Parser QA: 324 JS/JSX files, 0 blocking syntax errors
- Capability coverage: 112/112
- Codebase health: 0 failures / 0 warnings
- Package integrity: PASS
- Generated production Shopify readiness smoke: 20/20 PASS
- Production runtime validation smoke: PASS
- Migration SHA-256: `26b2274b9019cda05fb94d084fdac1c71d6d172aa0faaaa4af5b116a12759c92`
- Packaged SQLite SHA-256: `e2f08c8de05ad8447a8a32575c45fa634035fe8927c724d059a40fab323682fe`
