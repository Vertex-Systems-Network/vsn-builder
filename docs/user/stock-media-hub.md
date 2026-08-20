# Stock Media Hub

VSN Builder provides three related media workspaces under **Assets**:

- **Stock Images** — Unsplash, Pexels, Pixabay
- **Stock Videos** — Pexels, Pixabay
- **Stock Audio** — Freesound (optional; commercial API permission/license required)

## Stock Images

Search the connected image providers, save favorites, then choose **Import to Shopify**. VSN resolves the provider item again on the server, selects a Shopify-safe rendition, downloads it through an allowlisted HTTPS host, validates MIME and byte limits, stages it with Shopify and creates a Shopify File.

Image imports use a safety margin of **18 MP / 18 MB**. Unsplash requests a resized rendition with the aspect ratio preserved; Pexels and Pixabay use provider derivatives that are below the Shopify Files image limit. VSN never intentionally sends an original 20+ MP stock image to Shopify Files.

## Stock Videos

The Stock Videos workspace combines Pexels and Pixabay. Available controls include keyword search, provider, orientation/size, duration, Pixabay video type/category/order, minimum dimensions, safe search, Editor's Choice and Shopify import quality.

The import flow selects a rendition compatible with Shopify Files before transfer. VSN rejects video renditions outside its Shopify compatibility gate (minimum dimensions, maximum dimensions/frame rate, and supported duration). For server stability, the current VSN implementation limits one in-memory video transfer to 200 MB even though Shopify Files supports larger video files.

Favorites, Shopify Imports, Update and Delete are kept separate. Deleting a Shopify copy never deletes the original provider asset.

## Stock Audio

The Stock Audio workspace uses Freesound APIv2 search and preview URLs. It supports search, tags, duration, sorting, favorites, license filtering and Shopify generic-file imports.

Freesound's public token authentication can retrieve metadata and previews, while original sound downloads require OAuth2. VSN therefore imports a high-quality API preview rather than pretending it has access to an original file.

Freesound's free API terms are non-commercial. **Keep the Freesound provider disabled unless you have Freesound permission/licensing for commercial API use.** VSN requires the commercial-API confirmation in Settings before Stock Audio search/import is enabled.

Sound-level licenses are checked separately. NonCommercial sound licenses cannot be imported to Shopify by VSN.

## Provider Settings

Go to **Settings → Stock media integrations**. Keys/tokens are encrypted server-side before storage and are never returned to the browser in raw form.

- Unsplash: Access Key + Secret Key
- Pexels: API Key
- Pixabay: API Key
- Freesound: API Token + commercial API permission/license confirmation

Use **Test saved connection** after saving credentials.

## Q6.3.3 — Usage, search history and premium discovery

Each Stock Media screen now includes an **API usage** action beside API Settings. It shows VSN-observed request/success/error counts plus provider rate-limit headers when a provider returns them.

Searches are remembered independently for Images, Videos and Audio. A history chip restores the saved query and filters and can rerun it. History can be cleared per media type.

Provider page-size defaults are configurable in Settings and are also editable on the Stock Media screen.

Shutterstock can be searched for images, videos and audio. Getty/iStock content can be searched through the Getty Images API for images and videos. Premium results require the merchant's own licensing/download rights before a final Shopify import can be enabled.

Pixabay is intentionally image/video-only in VSN because the documented public Pixabay API does not expose the website's Music/Sound Effects catalog as an audio API.
