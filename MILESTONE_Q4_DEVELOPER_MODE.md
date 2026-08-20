# Milestone Q.4 — Developer Mode / Production Integration Boundary

Q.4 adds production configuration and validation without switching the current workspace out of Developer Mode.

- `shopify.app.toml` stays the default development configuration and keeps `automatically_update_urls_on_dev = true`.
- Production values are generated into a named `shopify.app.production.toml` only when the merchant/developer supplies a real production URL and production Client ID.
- `deploy:production` explicitly targets `--config production`.
- No production URL, billing activation or hosting credential is fabricated by the package.
- API target is stable `2026-07`; System Health detects Shopify API fall-forward.
- App-proxy prefix/subpath remain `apps/vsn-builder`; existing installs can retain merchant-customized proxy paths.
