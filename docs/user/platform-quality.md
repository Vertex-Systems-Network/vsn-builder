# Platform Quality & Release

Open **Platform Intelligence → Quality & Release**.

## Visual Regression QA

VSN stores fast structural baselines (page-tree hash plus node/type signature) per page. Capture a baseline after an approved layout. Changed and missing baselines are visible immediately. Pixel screenshots remain available through the authenticated Playwright runner:

```bash
VSN_E2E_EDITOR_URL="https://..." VSN_E2E_PAGE_ID="..." npm run qa:visual-regression:update
VSN_E2E_EDITOR_URL="https://..." VSN_E2E_PAGE_ID="..." npm run qa:visual-regression
```

## Page Performance Budget

Each active page is scored for node count, serialized content size, media references, custom-code bytes and distinct external origins. The report is advisory: it warns before a page becomes expensive but does not silently block publishing.

## Extension Permission Sandbox

Installed SDK plugins show their declared permissions, risk tier and external origins. Paste a plugin manifest into the evaluator to validate compatibility and permissions without installing the plugin.

## Release Migration Simulator

Run the simulator before a release. It applies current VSN document migrations to copies of active Page and Saved Library documents in memory. No merchant content is written.

## Command Architecture

P.2 platform mutations use a transactional command bus. Each command receives a command ID and writes an audit record in the same database transaction as the mutation.
