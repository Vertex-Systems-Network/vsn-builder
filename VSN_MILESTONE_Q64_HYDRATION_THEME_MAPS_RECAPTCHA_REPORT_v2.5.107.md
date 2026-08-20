# VSN Builder v2.5.107 — Q.6.4 Hydration, UI Theme, Maps & Form Security

## Scope
- Fix embedded-app Suspense hydration instability by preventing urgent shell/view state updates during hydration.
- Add seven VSN management UI accent presets plus a custom accent color picker and shared CSS variables.
- Add encrypted Google Maps API configuration and use it in the storefront Map widget.
- Add encrypted Google reCAPTCHA v2/v3 credentials, Forms configuration, storefront execution and server verification.
- Extract storefront form submission/security work from the large proxy route into a dedicated server-only service.

## Hydration contract
- Initial localStorage/system appearance synchronization runs inside `startTransition`.
- System-theme and shell preference synchronization uses non-urgent transition updates.
- Dashboard Home is rendered directly instead of sitting behind lazy-page Suspense.
- Other lazy Dashboard destinations retain Suspense and bounded lazy-load recovery.

## UI theme contract
- Presets: Lime, Emerald, Ocean, Violet, Sunset, Rose and Graphite, plus Custom.
- Custom colors are normalized to six-digit hex.
- Root variables include `--vsn-green`, `--vsn-green-dark`, `--vsn-accent-soft`, `--vsn-accent-rgb` and `--vsn-accent-foreground`.
- Appearance preferences remain local UI preferences and do not modify storefront content design tokens.

## Google Maps
- API key is encrypted in `BuilderIntegration` through the existing secret vault.
- Blank saves preserve an already stored key.
- `GOOGLE_MAPS_API_KEY` is an optional environment fallback.
- Published Map widgets use the keyed Google Maps Embed place endpoint and render an explicit unconfigured state when no key is available.

## Google reCAPTCHA
- Forms support `recaptcha-v2` and `recaptcha-v3` in addition to existing captcha modes.
- Site keys are public runtime configuration; secret keys remain encrypted/server-only.
- v2 tokens are verified server-side.
- v3 tokens are generated at submit time, then server verification checks success, score threshold and exact action.
- reCAPTCHA response fields are excluded from stored form submission fields.

## Database
No Prisma migration is required. Existing `BuilderIntegration` persistence is reused.
