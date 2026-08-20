# Google platform integrations

## Google Maps
Use Dashboard → Settings → Google Maps to enable the integration and save an API key. The key is encrypted at rest in VSN Builder. `GOOGLE_MAPS_API_KEY` can be used as a server environment fallback.

For production, restrict the Google key to the required Maps API and the storefront/referrer domains that should be allowed to use it. The VSN Map widget uses the Google Maps Embed place endpoint. A page renders a clear configuration placeholder instead of a keyless Google iframe when the integration is unavailable.

## Google reCAPTCHA v2
Forms Settings can enable Google reCAPTCHA v2 and save a Site Key plus encrypted Secret Key. The storefront renderer creates the v2 widget and the form submission is accepted only after server-side Siteverify succeeds.

Optional environment fallbacks:
- `VSN_RECAPTCHA_V2_SITE_KEY`
- `VSN_RECAPTCHA_V2_SECRET_KEY`

## Google reCAPTCHA v3
Forms Settings can enable Google reCAPTCHA v3 and configure:
- Site Key
- encrypted Secret Key
- score threshold (0–1; default 0.5)
- action (alphanumeric characters, slash and underscore)

The client obtains the v3 token at the actual submit action rather than at initial page load. The server then verifies success, score and the exact expected action.

Optional environment fallbacks:
- `VSN_RECAPTCHA_V3_SITE_KEY`
- `VSN_RECAPTCHA_V3_SECRET_KEY`

## Security boundaries
Raw Maps/reCAPTCHA secrets are never included in public Settings payloads. Blank secret-key saves preserve an existing encrypted value. Storefront submission payloads do not persist captcha tokens as customer form fields.
