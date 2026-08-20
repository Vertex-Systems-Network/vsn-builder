# PageFly → VSN Migration Guide

There is no blind one-click DOM importer in this package. Migrate deliberately:
1. Inventory PageFly pages, global sections, custom code, forms and app blocks.
2. Rebuild repeatable design primitives as VSN Components / Saved Library sections.
3. Recreate dynamic product/collection grids with Loop / Query Builder rather than copying generated markup.
4. Move fonts/SVGs into managed VSN asset libraries.
5. Recreate animations with Interactions and campaigns with Campaign Builder.
6. Run responsive, accessibility, SEO and storefront comparison QA before replacing the original page.

This approach avoids carrying PageFly-specific generated CSS/DOM debt into VSN.
