# Stock Image Hub

VSN Stock Images provides one workspace for Unsplash, Pexels, and Pixabay.

## Setup

Open **Settings → Stock image integrations** and configure one or more providers. Unsplash has separate **Access Key** and **Secret Key** fields; Pexels and Pixabay use one API key each. Saving a blank credential keeps an already-saved value. Provider credentials are encrypted server-side; the UI only receives configured state and masked suffixes. Unsplash public photo search/import uses the Access Key. The Secret Key is stored separately for OAuth/user-auth flows.

## Discover

Open **Discover** with an empty query to see Unsplash photo discovery, Pexels curated photos, and Pixabay popular results; enter a query for provider search. Use the provider selector or search all providers together. Common controls include search query, orientation, color, page size, and pagination. Advanced controls expose provider-specific options such as Unsplash order/content filtering, Pexels size/locale, and Pixabay image type/category/minimum dimensions/safe-search/Editor's Choice/order/language.

When all providers are selected, VSN interleaves normalized results so one provider does not fill the entire result grid first.

## Favorite

Favorites save a VSN library reference. Pixabay favorites intentionally do not permanently store a Pixabay image URL; use the source link or import the image to Shopify Files.

## Import to Shopify

**Import to Shopify** re-fetches the current provider asset on the server, downloads it from an approved provider host, uploads it through Shopify's staged upload flow, and creates the asset in Shopify Files. Imported records show Shopify processing state.

## Update

**Update** re-fetches the same stock-provider item and replaces the existing Shopify file contents while preserving its Shopify file ID/URL. Shopify requires the existing file to be READY before replacement.

## Delete

**Delete** permanently deletes the imported Shopify file after confirmation. The original provider image is never deleted. If the item is still favorited, its VSN favorite reference remains without the deleted Shopify file binding.
