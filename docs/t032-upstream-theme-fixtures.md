# T032 — Theme app-block compatibility fixtures (source-level only)

**15 October 2026 · IN_REVIEW · No Shopify store installed, published, or deployed**

The local theme-extension static audit covers 26 Liquid blocks and packaged assets. This extra suite checks where the **real, pinned upstream theme section source** accepts `@app` blocks and actually renders them. It protects against claiming a section supports Builder solely because a theme is marketed as compatible.

## Pinned official fixture evidence

| Theme | Source commit | Tested section | Shopify app block? | Liquid rendering evidence |
| --- | --- | --- | --- | --- |
| Dawn 16.0.0 | `258f00f64365e2018ca4c62778a6bf55a5d3cd18` | `sections/apps.liquid` | Yes | Section iterates and renders `section.blocks` |
| Dawn 16.0.0 | same | `sections/main-page.liquid` | **No** | No app-block schema entry or block renderer; use Dawn Apps section instead |
| Horizon | `dfad90d87be2408de52636315069fc998da28c9e` | `sections/main-page.liquid` | Yes | `content_for 'blocks'` plus `@app` |
 
Sources are copied from original MIT-licensed [Dawn](https://github.com/Shopify/dawn/tree/258f00f64365e2018ca4c62778a6bf55a5d3cd18) and [Horizon](https://github.com/Shopify/horizon/tree/dfad90d87be2408de52636315069fc998da28c9e) repositories solely as offline test fixtures, copyright Shopify Inc.; see each upstream `LICENSE.md`.

The tests verify the **actual** Builder `page-builder.liquid` and `native-vsn-section.liquid` both declare section app-block targets and packaged CSS/JS; upstream sections must advertise `@app` *and* render block content. A schema advertising app blocks but not rendering them deliberately fails. Swapping Dawn's Apps section with its non-app main-page fixture deliberately fails.

## Boundary and placement notes

For **Dawn**, insert VSN's section-target app block through the theme's Apps section rather than assuming its default `main-page` section accepts app blocks. For **Horizon**, the tested `main-page` section supports app blocks with content-block rendering.

**Not certified:** Theme Editor app-block insertion on a signed-in Shopify development store, installed extension bundle, available-if app metafields, storefront AJAX/proxy, responsive layout/screenshots, save/publish, real merchant ownership, and Shopify-hosted performance. `Prestige`, `Impulse` (third-party premium themes), and `Custom` remain explicitly **unverified**. Do not substitute copies of unrelated public themes for licensed premium versions.

## Local commands

```sh
node scripts/t032-theme-extension-static-audit.mjs
node --test tests/t032-theme-extension-static-audit.test.mjs
node scripts/t032-pinned-theme-fixtures.mjs
node --test tests/t032-pinned-theme-fixtures.test.mjs
```

**T032 remains IN_REVIEW** pending actual supported-theme fixtures/merchant tests as its acceptance requires; do not final-close T032 or T033 on these offline results. No Staging/Live deploy and no Shopify submission.
