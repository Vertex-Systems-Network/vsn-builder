# Milestone Q.6.3.3 — Developer Mode

VSN Builder v2.5.104 extends the Stock Media workspace without enabling irreversible production licensing behavior.

## Developer-mode guarantees
- Existing exact Shopify billing handles remain `free`, `sliver`, `gold`, `platenium`.
- Unsplash, Pexels and Pixabay image imports remain provider-ID revalidated before Shopify upload.
- Pexels/Pixabay video imports remain staged Shopify VIDEO uploads.
- Freesound audio remains commercial-permission and item-license gated.
- Shutterstock and Getty/iStock are search/discovery integrations only until the merchant's licensed-download entitlement is explicitly available; VSN does not treat preview URLs as licensed final assets.
- API secrets remain encrypted server-side and are never returned to the browser in plaintext.
