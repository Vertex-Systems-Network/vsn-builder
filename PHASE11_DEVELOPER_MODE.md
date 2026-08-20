# Phase 11 Developer Mode

Phase 11 remains feature-flagged and developer-safe. No production deployment is implied by this package.

Enable the systems locally with environment variables before `shopify app dev`:

```env
VSN_FEATURE_COLLABORATION_REVIEW=true
VSN_FEATURE_LOCALIZATION_MARKETS=true
VSN_FEATURE_AI_BUILDER=true
OPENAI_API_KEY=your-development-key
```

`OPENAI_API_KEY` is optional unless AI Builder is being tested. If absent, AI returns a structured developer-mode configuration message rather than producing a server stack trace.

Phase 11 adds Shopify scopes for locale/market/native translation testing. After changing scopes, Shopify CLI may require the development app/store permission grant to be refreshed. This is expected in developer mode.

Do not deploy or replace the example application URLs in `shopify.app.toml` until the project is explicitly moved out of developer mode.
