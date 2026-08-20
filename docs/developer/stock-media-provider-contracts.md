# Stock Media Provider Contracts — Q6.3.2

## Provider capability matrix

| Provider | Images | Videos | Audio | VSN auth |
| --- | --- | --- | --- | --- |
| Unsplash | yes | no documented VSN video contract | no | Access Key Client-ID; Secret Key stored separately |
| Pexels | yes | yes | no | Authorization API key |
| Pixabay | yes | yes | no | API key query parameter |
| Freesound | no | no | yes | APIv2 Token; commercial permission/license required in VSN |

## Shopify-safe image import

Shopify Files images have both byte and megapixel limits. VSN keeps an internal margin:

- `MAX_IMPORT_BYTES = 18 * 1024 * 1024`
- `MAX_SHOPIFY_IMAGE_PIXELS = 18_000_000`

Unsplash import requests a transformed URL (`w`, `fit=max`, `q=85`) after firing the required download tracking endpoint. Pexels import uses API derivatives (`large2x`, `large`, `medium`) rather than the original source. Pixabay import uses Full HD / large / web derivatives rather than the original image URL.

Every server download is HTTPS-only and provider-host allowlisted. Redirect hosts and MIME types are revalidated before Shopify staged upload.

## Video providers

Pexels uses its `/v1/videos/` endpoints. Pixabay uses `/api/videos/`. Search results are normalized into one VSN video result shape and round-robin aligned when both providers are selected.

The import gate only accepts renditions with:

- minimum width/height 100px
- maximum width/height 4096px
- frame rate no greater than 120 fps when reported
- duration between 0.25 seconds and 600 seconds
- supported media MIME
- current VSN server-transfer cap <= 200 MB

Shopify staging uses `resource: VIDEO` and includes `fileSize`, then `fileCreate(contentType: VIDEO)`.

Pixabay video search cache is 24 hours. Pexels cache is shorter to avoid unnecessary API traffic while retaining fresh results.

## Audio provider

Freesound is an optional audio adapter. VSN uses current APIv2 text search, token authentication and API-generated preview files. Original sound download endpoints are deliberately not called because original downloads require OAuth2.

Freesound's free API usage is non-commercial. The provider defaults disabled and `commercialApiLicensed` defaults false. VSN search/test/import fail closed until a merchant/developer explicitly confirms that their Freesound API usage is commercially licensed/authorized.

Sound licenses are a second gate. VSN blocks import for NonCommercial sound licenses. Audio is staged as Shopify generic `FILE`, and VSN keeps files below 19 MB because Shopify generic Files have a 20 MB limit.

## Persistence

No new Prisma model is needed for Q6.3.2. Favorites and imported media reuse `BuilderLibraryItem` with kinds:

- `stock-image`
- `stock-video`
- `stock-audio`

Provider searches reuse `BuilderStockSearchCache` with namespaced provider keys such as `video:pixabay` and `audio:freesound`.

## Q6.3.3 provider contract additions

### Usage telemetry
All outbound stock-provider requests should use `trackedStockFetch` so VSN can persist a per-shop/provider/media-kind request ledger. Provider quota headers are retained when they are exposed.

### Search history
`BuilderStockSearchHistory` stores a hashed normalized parameter snapshot, query text, reuse count and last-used timestamp. Search history is tenant-scoped and media-kind scoped.

### Shutterstock
VSN supports `/v2/images/search`, `/v2/videos/search` and `/v2/audio/search`. Search can use Basic application credentials or an OAuth bearer token. Search previews are never treated as licensed final-download media.

### Getty/iStock
VSN uses the Getty Images API creative search endpoints for images and videos. iStock discovery is represented through the official Getty/iStock API relationship. Download/import remains license-agreement gated.

### Pixabay audio
Do not add scraping or undocumented audio endpoints. The supported public API contract used by VSN is image/video only.
