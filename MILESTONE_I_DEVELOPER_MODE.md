# Milestone I — Developer Mode Guardrail

VSN Builder remains in Developer Mode for Milestone I.

- Motion Library, animation persistence, editor integration and storefront runtime are enabled for development-store validation.
- No production billing, app deployment or irreversible production migration is triggered automatically.
- The packaged SQLite baseline includes the Milestone I schema migration for local development.
- Light/Dark/System appearance is a per-browser staff preference and does not alter the storefront theme.
- Shopify owner profile data is read from the authenticated staff session and Shopify Admin API; when Shopify does not expose an avatar, VSN shows initials rather than inventing an image.
