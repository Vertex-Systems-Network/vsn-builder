# Milestone P.2 platform quality contracts

## Server modules

- `app/services/command-bus.server.js` — transactional command execution and command audit IDs.
- `app/services/platform-p2.server.js` — structural visual baselines, page performance budgets, extension permission evaluation and migration dry-runs.
- `app/components/dashboard/platform/PlatformQualityPanel.jsx` — Platform Intelligence UI.
- `app/builder/editorCommand.js` — command metadata for the editor's existing undo/history mutation path.

## Visual regression

Structural baselines are stored inside `BuilderShopSetting.appSettingsJson` under `platformP2.visualBaselines`. This avoids a migration and keeps the baseline merchant-scoped. Pixel regression uses `tests/e2e/visual-regression.spec.mjs` and is intentionally opt-in because it requires an authenticated embedded-app URL.

## Performance budget

The budget scanner is deterministic and side-effect-free. It measures document pressure, not Shopify storefront Core Web Vitals. Use it as a pre-publish diagnostic, then validate real storefront performance separately.

## Extension sandbox

Manifest evaluation reuses `validatePluginManifest` and `VSN_PLUGIN_ALLOWED_PERMISSIONS`. It does not execute or install the supplied plugin source.

## Migration simulator

`simulateReleaseMigrations` calls `migrateBuilderContent` on structured clones and never persists returned documents.

## Command architecture

Use `runBuilderCommand` for new server-side mutations that need transaction + audit semantics. The visual editor keeps its existing local undo/redo stack but normal commit entries now receive a command ID through `createEditorCommand`.
